import assert from "node:assert/strict";
import { test } from "node:test";
import { fitWithin, youtubeId } from "./media.ts";

test("reads the video ID from YouTube links", () => {
  const id = "dQw4w9WgXcQ";
  for (const link of [
    `https://www.youtube.com/watch?v=${id}`,
    `https://youtube.com/watch?v=${id}&t=42s`,
    `https://m.youtube.com/watch?v=${id}`,
    `https://youtu.be/${id}?si=abc`,
    `https://www.youtube.com/shorts/${id}`,
    `https://www.youtube.com/live/${id}`,
    `https://www.youtube.com/embed/${id}`,
  ]) {
    assert.equal(youtubeId(link), id, link);
  }
});

test("rejects links that aren't YouTube videos", () => {
  for (const link of ["https://vimeo.com/123", "https://www.youtube.com/@morrison", "not a url", "https://youtu.be/short"]) {
    assert.equal(youtubeId(link), null, link);
  }
});

test("fits images inside a box without enlarging", () => {
  assert.deepEqual(fitWithin(4032, 3024, 2000), { width: 2000, height: 1500 });
  assert.deepEqual(fitWithin(3024, 4032, 600), { width: 450, height: 600 });
  assert.deepEqual(fitWithin(800, 600, 2000), { width: 800, height: 600 });
});
