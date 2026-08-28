import assert from "node:assert/strict";
import test from "node:test";
import { generatedStyleOpacity, localizedSupportAnchor, normalizeBoundaryGuide, normalizedLayeredPhotoWindow, normalizedPhotoWindow, pointInsidePhotoAnchor } from "../app/real-scene-paper-composite.ts";
import { readFile } from "node:fs/promises";

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

test("final relation-domain composite protects source coverage without a sticker outline", async () => {
  const source = await readFile(new URL("../app/real-scene-paper-composite.ts", import.meta.url), "utf8");
  assert.match(source, /createSourceProtectedGeneratedLayer/);
  assert.match(source, /paperLike && sourceCarriesScene/);
  assert.match(source, /anchorIndices/);
  assert.match(source, /insideSemanticAnchor/);
  assert.match(source, /usesRelationshipHandoff \? handoffMaskCanvas : maskCanvas/);
  assert.match(source, /ring of pond\/sky\/ground pixels/);
  assert.match(source, /selectedIndex === 0 \|\| matchedAnchors\.some/);
  assert.match(source, /Planning boxes must never amputate a head/);
  assert.match(source, /hasLocalHandoffRegion[\s\S]*mask\.drawImage\(handoffMaskCanvas, 0, 0\)/);
  assert.doesNotMatch(source, /context\.strokeStyle\s*=\s*["']#fff/);
});

test("relationship seam is captured before semantic subject masks expand the photo domain", async () => {
  const source = await readFile(new URL("../app/real-scene-paper-composite.ts", import.meta.url), "utf8");
  const seamCapture = source.indexOf("handoffMask.drawImage(maskCanvas");
  const semanticMasks = source.indexOf("if (spec.subjectMasks?.length");
  assert.ok(seamCapture > 0);
  assert.ok(semanticMasks > seamCapture);
});

test("a localized subject-support relationship does not become a full-width photo half-plane", async () => {
  const source = await readFile(new URL("../app/real-scene-paper-composite.ts", import.meta.url), "utf8");
  assert.match(source, /spec\.photoEvidenceType === "continuous-band"/);
  assert.match(source, /spec\.focusMode === "scene-band"/);
  assert.match(source, /const usesPhotoPaperIsland = spec\.layout === "scene-fragment" && !usesRelationshipRegion/);
  assert.match(source, /const adaptiveIsland = createAdaptivePhotoIslandMask\(width, height, anchors, fallbackIsland\)/);
  assert.doesNotMatch(source, /spec\.photoEvidenceType === "relational-region" \|\| spec\.photoEvidenceType === "continuous-band"/);
});

test("the photographic scene fragment expands and fuses organic relationship shapes instead of drawing a torn rectangle", async () => {
  const source = await readFile(new URL("../app/real-scene-paper-composite.ts", import.meta.url), "utf8");
  const adaptiveStart = source.indexOf("function createAdaptivePhotoIslandMask");
  const bridgeStart = source.indexOf("function drawChromaticBridge");
  const adaptiveFragment = source.slice(adaptiveStart, bridgeStart);
  assert.match(adaptiveFragment, /organicRelationshipPath/);
  assert.match(adaptiveFragment, /expansionX = index === 0 \? 1\.25 : 1\.58/);
  assert.match(adaptiveFragment, /lineCap = "round"/);
  assert.match(adaptiveFragment, /blur\(9px\)/);
  assert.match(adaptiveFragment, /organicNoise/);
  assert.doesNotMatch(adaptiveFragment, /tornPaperPath|fillRect/);
});

test("source-derived background uses calm print inks and irregular dropout rather than enlarged pixels or fluorescent structural fill", async () => {
  const source = await readFile(new URL("../app/real-scene-paper-composite.ts", import.meta.url), "utf8");
  const printStart = source.indexOf("function createSourceDerivedPaperLayer");
  const organicStart = source.indexOf("function organicRelationshipPath");
  const printLayer = source.slice(printStart, organicStart);
  assert.match(printLayer, /const longestSide = 420/);
  assert.match(printLayer, /const slate = \[47, 62, 65\]/);
  assert.match(printLayer, /const olive = \[128, 141, 104\]/);
  assert.match(printLayer, /43758\.5453/);
  assert.doesNotMatch(printLayer, /const colorInk = structuralInk/);
});

test("an oversized support anchor is reduced to the local contact domain around the subject", () => {
  const support = localizedSupportAnchor(
    { x: 0.38, y: 0.36, width: 0.34, height: 0.28 },
    { x: 0, y: 0.54, width: 1, height: 0.46 },
  );
  assert.ok(support.width <= 0.5);
  assert.ok(support.height <= 0.24);
  assert.ok(support.x > 0.2);
  assert.ok(support.y >= 0.54);
  assert.ok(support.x + support.width < 0.9);
});

test("local support clipping has an organic boundary rather than rectangular corners", () => {
  const anchor = { x: 0.3, y: 0.5, width: 0.4, height: 0.24, shape: "organic" };
  assert.equal(pointInsidePhotoAnchor(anchor, 0.5, 0.62), true);
  assert.equal(pointInsidePhotoAnchor(anchor, 0.302, 0.502), false);
  assert.equal(pointInsidePhotoAnchor(anchor, 0.698, 0.738), false);
});

test("model style is rejected when it invents dark neutral architecture over a colored source region", () => {
  const inventedBuilding = generatedStyleOpacity(
    { red: 112, green: 148, blue: 92 },
    { red: 62, green: 64, blue: 63 },
    0.28,
  );
  const sourceConsistentInk = generatedStyleOpacity(
    { red: 112, green: 148, blue: 92 },
    { red: 103, green: 132, blue: 86 },
    0.28,
  );
  assert.equal(inventedBuilding, 0);
  assert.ok(sourceConsistentInk > 0.1);
});
