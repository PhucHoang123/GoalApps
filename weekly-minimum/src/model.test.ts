import { test } from "node:test";
import assert from "node:assert/strict";
import {
  completion,
  ensureWeek,
  fresh,
  log,
  progress,
  validate,
  weekKey,
} from "./model.ts";
test("Monday rollover crosses year and Sunday correctly", () => {
  assert.equal(weekKey(new Date(2027, 0, 1)), "2026-12-28");
  assert.equal(weekKey(new Date(2027, 0, 3)), "2026-12-28");
  assert.equal(weekKey(new Date(2027, 0, 4)), "2027-01-04");
  assert.equal(weekKey(new Date(2026, 9, 13), 0), "2026-10-11");
});
test("progress has no ceiling; invalid and negative amounts are rejected", () => {
  let d = ensureWeek(fresh(), "2026-10-12");
  const g = d.goals[0];
  d = log(d, "2026-10-12", g.id, 30, "Extra room");
  assert.equal(progress(d.weeks["2026-10-12"], g.id), 30);
  assert.equal(completion(d.weeks["2026-10-12"]), 40);
  assert.throws(() => log(d, "2026-10-12", g.id, -31));
  assert.throws(() => log(d, "2026-10-12", g.id, Infinity));
});
test("new weeks preserve history and snapshot targets", () => {
  let d = ensureWeek(fresh(), "2026-12-28");
  const g = d.goals[0];
  d = log(d, "2026-12-28", g.id, 3);
  d.goals = d.goals.map((x) => ({ ...x, target: 50 }));
  d = ensureWeek(d, "2027-01-04");
  assert.equal(d.weeks["2026-12-28"].goals[0].target, 25);
  assert.equal(progress(d.weeks["2026-12-28"], g.id), 3);
  assert.equal(progress(d.weeks["2027-01-04"], g.id), 0);
  assert.equal(d.weeks["2027-01-04"].goals[0].target, 50);
});
test("archive preserves records and JSON persistence round-trips", () => {
  let d = ensureWeek(fresh(), "2026-10-12");
  d = log(d, "2026-10-12", d.goals[0].id, 0.5, "note");
  d.goals[0].archived = true;
  d = ensureWeek(d, "2026-10-19");
  assert.equal(d.weeks["2026-10-19"].goals.length, 2);
  assert.equal(d.weeks["2026-10-12"].goals.length, 3);
  assert.deepEqual(validate(JSON.parse(JSON.stringify(d))), d);
  assert.throws(() => validate({ version: 2 }));
});
