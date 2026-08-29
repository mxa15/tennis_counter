const test = require("node:test");
const assert = require("node:assert/strict");

const { normalizeSqlParams } = require("./sqlHelpers");

test("normalizeSqlParams replaces user_id with auth user id and keeps other values", () => {
  assert.deepStrictEqual(normalizeSqlParams(["user_id", 42, "abc"], 7), [
    7,
    42,
    "abc",
  ]);
});

test("normalizeSqlParams handles missing params safely", () => {
  assert.deepStrictEqual(normalizeSqlParams(undefined, 7), []);
  assert.deepStrictEqual(normalizeSqlParams(null, 7), []);
});
