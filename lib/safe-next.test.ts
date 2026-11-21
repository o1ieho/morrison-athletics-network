import assert from "node:assert/strict";
import { test } from "node:test";
import { safeNext } from "./safe-next.ts";

test("same-site paths pass through", () => {
  assert.equal(safeNext("/operator/abc?x=1"), "/operator/abc?x=1");
  assert.equal(safeNext("/admin/games#top"), "/admin/games#top");
});

test("anything that could leave the site falls back to /operator", () => {
  for (const next of [
    "/\\evil.com",
    "/%5Cevil.com",
    "/%5cevil.com",
    "//evil.com",
    "https://evil.com",
    "javascript:alert(1)",
    "evil.com",
    "/\tevil.com",
    // Dot segments that normalise to "//host".
    "/.//evil.com",
    "/..//evil.com",
    "/%2e//evil.com",
    "/a/..//evil.com",
    "/./%2Fevil.com/../..//evil.com",
    " /operator",
    "",
    undefined,
    null,
  ]) {
    assert.equal(safeNext(next), "/operator", String(next));
  }
});

test("a repeated ?next= (an array) falls back", () => {
  assert.equal(safeNext(["/a", "/b"]), "/operator");
});

test("ordinary dot segments still resolve to a same-site path", () => {
  assert.equal(safeNext("/admin/../operator"), "/operator");
});

test("a custom fallback", () => {
  assert.equal(safeNext("//evil.com", "/"), "/");
});
