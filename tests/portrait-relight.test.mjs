import assert from "node:assert/strict";
import test from "node:test";
import { relightPixel } from "../app/portrait-relight.ts";

const spec = {
  faceBox: { x: 0.4, y: 0.2, width: 0.2, height: 0.2 },
  personBox: { x: 0.3, y: 0.15, width: 0.4, height: 0.8 },
  faceExposureEv: 0.42,
  subjectExposureEv: 0.16,
  highlightCompression: 0.22,
  warmth: 0.03,
};

test("relight keeps dark pixels outside the subject unchanged", () => {
  assert.deepEqual(relightPixel(42, 48, 53, 0, 0, spec), [42, 48, 53]);
});

test("relight keeps bright background pixels unchanged", () => {
  assert.deepEqual(relightPixel(240, 238, 232, 0, 0, spec), [240, 238, 232]);
});

test("relight lifts a shadowed face without clipping channels", () => {
  const result = relightPixel(55, 45, 40, 1, 1, spec);
  assert.ok(result[0] > 55 && result[1] > 45 && result[2] > 40);
  assert.ok(result.every((channel) => channel >= 0 && channel <= 255));
});

test("relight compresses bright highlights instead of lifting them", () => {
  const result = relightPixel(240, 238, 232, 1, 1, spec);
  assert.ok(result[0] <= 240 && result[1] <= 238 && result[2] <= 232);
});
