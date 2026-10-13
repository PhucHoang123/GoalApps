const { chromium } = require("playwright");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const root = path.resolve("native-test-data", String(process.pid));
fs.mkdirSync(root, { recursive: true });
async function open() {
  const child = spawn("src-tauri/target/debug/weekly-minimum.exe", [], {
    windowsHide: true,
    env: {
      ...process.env,
      APPDATA: root,
      WEEKLY_MINIMUM_TEST_DATA_DIR: root,
      WEBVIEW2_USER_DATA_FOLDER: path.join(root, "webview"),
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: "--remote-debugging-port=9337",
    },
  });
  child.stderr.on("data", (b) => console.log(b.toString()));
  child.on("exit", (code) => console.log("Native exit", code));
  let browser;
  for (let n = 0; n < 50; n++) {
    try {
      browser = await chromium.connectOverCDP("http://127.0.0.1:9337");
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  if (!browser) {
    child.kill();
    throw Error("Native WebView did not expose a debug connection");
  }
  const context = browser.contexts()[0];
  let page;
  for (let n = 0; n < 40; n++) {
    page = context.pages()[0];
    if (page) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  try {
    await page
      .getByRole("button", { name: "Increase Paid Work", exact: true })
      .waitFor({ timeout: 10000 });
  } catch (e) {
    console.log(
      "NATIVE PAGE",
      page.url(),
      await page.locator("body").innerText(),
    );
    await browser.close();
    child.kill();
    throw e;
  }
  return { child, browser, page };
}
(async () => {
  let app = await open();
  try {
    const initial = +(await app.page
      .getByRole("button", { name: "Log Paid Work", exact: true })
      .innerText());
    await app.page
      .getByRole("button", { name: "Increase Paid Work", exact: true })
      .click();
    await app.page
      .getByText("Saved on this device", { exact: false })
      .waitFor();
    await app.browser.close();
    app.child.kill();
    await new Promise((r) => setTimeout(r, 1000));
    app = await open();
    assert.equal(
      +(await app.page
        .getByRole("button", { name: "Log Paid Work", exact: true })
        .innerText()),
      initial + 0.5,
    );
    await app.page
      .getByRole("button", { name: "Settings", exact: true })
      .click();
    await app.page.getByLabel("Always on top").check();
    await app.page
      .getByText("Saved on this device", { exact: false })
      .waitFor();
    assert.equal(await app.page.getByRole("alert").count(), 0);
    console.log(
      "PASS: native Tauri startup, atomic JSON save, restart persistence, always-on-top command.",
    );
  } finally {
    await app.browser.close();
    app.child.kill();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
