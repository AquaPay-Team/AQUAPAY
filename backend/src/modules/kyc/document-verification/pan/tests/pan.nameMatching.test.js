import test from "node:test";
import assert from "node:assert/strict";
import { compareFullNames, normalizeFullName } from "../pan.nameMatching.js";

test("matches exact names case-insensitively and independent of token order", () => {
  assert.equal(compareFullNames("Rahul Kumar Sharma", "Rahul Kumar Sharma"), true);
  assert.equal(compareFullNames("Rahul Kumar Sharma", "SHARMA RAHUL KUMAR"), true);
  assert.equal(compareFullNames("Rahul Kumar Sharma", "rahul kumar sharma"), true);
});

test("normalizes punctuation and repeated whitespace without fuzzy matching", () => {
  assert.equal(compareFullNames("Rahul-Kumar Sharma", "Rahul Kumar Sharma"), true);
  assert.equal(compareFullNames("Rahul, Kumar  Sharma", "Sharma Rahul Kumar"), true);
  assert.equal(compareFullNames("Rahul\tKumar\nSharma", "Rahul Kumar Sharma"), true);
  assert.equal(compareFullNames("Rahul Kumar Sharma", "Rahul Sharma Singh"), false);
});

test("requires every full-name token and does not accept initials", () => {
  assert.equal(compareFullNames("Rahul Kumar Sharma", "Rahul Sharma"), false);
  assert.equal(compareFullNames("Rahul Kumar Sharma", "Rahul K Sharma"), false);
  assert.equal(compareFullNames("Rahul Kumar Sharma", "R K Sharma"), false);
  assert.equal(compareFullNames("Rahul Kumar Sharma", "Rahul Kumar Singh"), false);
  assert.equal(compareFullNames("Rahul Kumar Sharma", "Asha Devi"), false);
});

test("preserves duplicate-token multiplicity", () => {
  assert.equal(compareFullNames("Rahul Kumar Kumar", "Kumar Rahul Kumar"), true);
  assert.equal(compareFullNames("Rahul Kumar Kumar", "Rahul Kumar"), false);
  assert.equal(compareFullNames("Rahul Kumar Kumar", "Rahul Kumar Sharma"), false);
});

test("applies Unicode NFKC normalization, preserves accents, and rejects empty names", () => {
  assert.equal(compareFullNames("\u00c9lodie \u00c1lvarez", "E\u0301LODIE A\u0301LVAREZ"), true);
  assert.equal(compareFullNames("\uff32\uff21\uff28\uff35\uff2c \uff2b\uff35\uff2d\uff21\uff32 \uff33\uff28\uff21\uff32\uff2d\uff21", "Rahul Kumar Sharma"), true);
  assert.equal(compareFullNames("Jos\u00e9 \u00c1lvarez", "Jose Alvarez"), false);
  assert.deepEqual(normalizeFullName("Jos\u00e9 \u00c1lvarez"), ["jos\u00e9", "\u00e1lvarez"]);
  assert.equal(compareFullNames("", "Rahul"), false);
  assert.equal(compareFullNames("Rahul", ""), false);
  assert.equal(compareFullNames("   ", "Rahul"), false);
  assert.equal(compareFullNames(null, "Rahul"), false);
  assert.equal(compareFullNames("Rahul", undefined), false);
});
