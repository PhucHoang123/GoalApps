const { chromium } = require("playwright");
const { spawn } = require("node:child_process");
const assert = require("node:assert/strict");
(async () => {
  const fs = require("node:fs");
  const server = require("node:http").createServer((req, res) => {
    const path = "dist" + (req.url === "/" ? "/index.html" : req.url);
    res.setHeader(
      "Content-Type",
      path.endsWith(".js")
        ? "text/javascript"
        : path.endsWith(".css")
          ? "text/css"
          : "text/html",
    );
    if (fs.existsSync(path)) res.end(fs.readFileSync(path));
    else {
      res.statusCode = 404;
      res.end();
    }
  });
  await new Promise((resolve) => server.listen(5180, "127.0.0.1", resolve));
  let browser;
  try {
    browser = await chromium.launchPersistentContext("./test-profile", {
      headless: true,
      channel: "chrome",
    });
    const p = await browser.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto("http://127.0.0.1:5180");
    await p.evaluate(() => localStorage.clear());
    await p.reload();
    await p
      .getByRole("button", { name: "Increase Paid Work", exact: true })
      .click();
    await p.getByRole("button", { name: "Log Paid Work", exact: true }).click();
    await p.getByLabel("Total hours").fill("28");
    await p.getByLabel("A short note (optional)").fill("A flexible week");
    await p.getByRole("button", { name: "Save progress", exact: true }).click();
    await p.getByRole("button", { name: "Add goal" }).click();
    await p.getByLabel("Name", { exact: true }).fill("Reading");
    await p.getByLabel("Weekly target").fill("2");
    await p.getByRole("button", { name: "Save goal" }).click();
    await p
      .getByRole("button", { name: "Increase Reading", exact: true })
      .click();
    await p.getByRole("button", { name: "Edit Reading", exact: true }).click();
    await p.getByLabel("Weekly target").fill("5");
    await p.getByRole("button", { name: "Save goal" }).click();
    await p.getByRole("button", { name: "Edit Reading", exact: true }).click();
    await p.getByRole("button", { name: "Delete", exact: true }).click();
    await p.getByRole("button", { name: "Confirm", exact: true }).click();
    await p.reload();
    await p
      .getByRole("button", { name: "Log Paid Work", exact: true })
      .waitFor();
    const d = await p.evaluate(() =>
      JSON.parse(localStorage.getItem("weekly-minimum")),
    );
    const w = Object.values(d.weeks)[0];
    assert.equal(
      w.entries.find((e) => e.note === "A flexible week").delta,
      27.5,
    );
    assert.equal(d.goals.find((g) => g.name === "Reading").archived, true);
    assert.equal(w.goals.find((g) => g.name === "Reading").target, 5);
    await p.screenshot({ path: "preview.png", fullPage: true });
    await browser.close();
    browser = await chromium.launchPersistentContext("./test-profile", {
      headless: true,
      channel: "chrome",
    });
    const q = await browser.newPage();
    await q.goto("http://127.0.0.1:5180");
    await q
      .getByRole("button", { name: "Log Paid Work", exact: true })
      .waitFor();
    assert.equal(
      await q
        .getByRole("button", { name: "Log Paid Work", exact: true })
        .innerText(),
      "28",
    );
    await q.setViewportSize({ width: 380, height: 700 });
    assert.equal(
      await q.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS: add, edit, delete/archive, exact logging, notes, reload, browser restart persistence, compact layout, no runtime errors.",
    );
  } finally {
    if (browser) await browser.close();
    server.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
