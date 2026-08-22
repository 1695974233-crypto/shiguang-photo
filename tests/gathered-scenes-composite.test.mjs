import assert from "node:assert/strict";
import test from "node:test";
import { normalizeBoundaryGuide, normalizedLayeredPhotoWindow, normalizedPhotoWindow } from "../app/real-scene-paper-composite.ts";

test("gathered-scenes photo window keeps a substantial real-photo region", () => {
  const window = normalizedPhotoWindow({ x: 0.4, y: 0.4, width: 0.1, height: 0.1 });
  assert.ok(window.width >= 0.34);
  assert.ok(window.height >= 0.34);
});

test("a bottom-bleed anchor reaches beyond the lower canvas edge", () => {
  const window = normalizedPhotoWindow({ x: 0.2, y: 0.5, width: 0.5, height: 0.3 }, "bottom-bleed");
  assert.ok(window.y + window.height > 1);
  assert.ok(window.x < 0 && window.x + window.width > 1);
});

test("a top-bleed anchor creates one transverse seam instead of a framed window", () => {
  const window = normalizedPhotoWindow({ x: 0.2, y: 0.1, width: 0.5, height: 0.6 }, "top-bleed");
  assert.ok(window.y < 0);
  assert.ok(window.x < 0 && window.x + window.width > 1);
});

test("gathered-scenes photo window stays inside the canvas", () => {
  const window = normalizedPhotoWindow({ x: 0.9, y: 0.9, width: 0.8, height: 0.8 });
  assert.ok(window.x >= 0 && window.y >= 0);
  assert.ok(window.x + window.width <= 1);
  assert.ok(window.y + window.height <= 1);
});

test("layered torn zine keeps the photo opening between the paper bands", () => {
  const window = normalizedLayeredPhotoWindow({ x: 0, y: 0.1, width: 1, height: 0.8 });
  assert.ok(window.x < 0);
  assert.ok(window.y >= 0.28);
  assert.ok(window.y + window.height <= 0.78);
  assert.ok(window.x + window.width > 1);
});

test("a horizontal scene guide is clamped, sorted, de-duplicated and extended across the page", () => {
  const guide = normalizeBoundaryGuide([
    { x: 0.82, y: 1.4 },
    { x: 0.22, y: 0.41 },
    { x: 0.221, y: 0.7 },
  ], "below");
  assert.deepEqual(guide, [
    { x: 0, y: 0.41 },
    { x: 0.22, y: 0.41 },
    { x: 0.82, y: 1 },
    { x: 1, y: 1 },
  ]);
});

test("a vertical scene guide spans the full page height", () => {
  const guide = normalizeBoundaryGuide([
    { x: 0.76, y: 0.8 },
    { x: -0.2, y: 0.2 },
  ], "left");
  assert.deepEqual(guide, [
    { x: 0, y: 0 },
    { x: 0, y: 0.2 },
    { x: 0.76, y: 0.8 },
    { x: 0.76, y: 1 },
  ]);
});

test("missing scene analysis falls back to a safe relationship seam", () => {
  assert.deepEqual(normalizeBoundaryGuide([], "above", 0.63), [
    { x: 0, y: 0.63 },
    { x: 1, y: 0.63 },
  ]);
  assert.deepEqual(normalizeBoundaryGuide(undefined, "right", 0.36), [
    { x: 0.36, y: 0 },
    { x: 0.36, y: 1 },
  ]);
});
