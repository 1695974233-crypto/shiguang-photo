import assert from "node:assert/strict";
import test from "node:test";
import { generatedStyleOpacity, localizedSupportAnchor, normalizeBoundaryGuide, normalizedLayeredPhotoWindow, normalizedPhotoWindow, pointInsidePhotoAnchor, scenePrintTreatment, sourceCompatibleInk } from "../app/real-scene-paper-composite.ts";
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

test("a compiled photo island ignores independent semantic masks that could duplicate support objects", async () => {
  const source = await readFile(new URL("../app/real-scene-paper-composite.ts", import.meta.url), "utf8");
  assert.match(source, /spec\.subjectMasks\?\.length && spec\.layout === "scene-fragment" && !hasLocalHandoffRegion/);
  assert.match(source, /createAdaptivePhotoIslandMask\(width, height, \[\], fallbackIsland\)/);
  assert.match(source, /if \(spec\.layout === "scene-fragment" && hasLocalHandoffRegion\)[\s\S]*mask\.drawImage\(handoffMaskCanvas/);
  assert.match(source, /!spec\.subjectMasks\?\.length && !hasLocalHandoffRegion/);
  assert.match(source, /else if \(!hasGuidedRegion && !hasLocalHandoffRegion\)/);
});

test("a localized subject-support relationship does not become a full-width photo half-plane", async () => {
  const source = await readFile(new URL("../app/real-scene-paper-composite.ts", import.meta.url), "utf8");
  assert.match(source, /spec\.photoEvidenceType === "continuous-band"/);
  assert.match(source, /spec\.focusMode === "scene-band"/);
  assert.match(source, /const usesPhotoPaperIsland = spec\.layout === "scene-fragment" && !usesRelationshipRegion/);
  assert.match(source, /const adaptiveIsland = createAdaptivePhotoIslandMask\(width, height, \[\], fallbackIsland\)/);
  assert.doesNotMatch(source, /spec\.photoEvidenceType === "relational-region" \|\| spec\.photoEvidenceType === "continuous-band"/);
});

test("the photographic scene fragment expands and fuses organic relationship shapes instead of drawing a torn rectangle", async () => {
  const source = await readFile(new URL("../app/real-scene-paper-composite.ts", import.meta.url), "utf8");
  const adaptiveStart = source.indexOf("function createAdaptivePhotoIslandMask");
  const bridgeStart = source.indexOf("function drawChromaticBridge");
  const adaptiveFragment = source.slice(adaptiveStart, bridgeStart);
  assert.match(adaptiveFragment, /organicRelationshipPath/);
  assert.match(adaptiveFragment, /expansionX = fallbackOnly \? 1\.035/);
  assert.match(adaptiveFragment, /lineCap = "round"/);
  assert.match(adaptiveFragment, /blur\(9px\)/);
  assert.match(adaptiveFragment, /organicNoise/);
  assert.doesNotMatch(adaptiveFragment, /tornPaperPath|fillRect/);
});

test("source-derived background is zoned by source evidence instead of using one all-over raster", async () => {
  const source = await readFile(new URL("../app/real-scene-paper-composite.ts", import.meta.url), "utf8");
  const printStart = source.indexOf("function createSourceDerivedPaperLayer");
  const organicStart = source.indexOf("function organicRelationshipPath");
  const printLayer = source.slice(printStart, organicStart);
  assert.match(printLayer, /const longestSide = 960/);
  assert.match(printLayer, /zoneWeight/);
  assert.match(printLayer, /selectedZone/);
  assert.match(printLayer, /allowedTreatments/);
  assert.match(printLayer, /43758\.5453/);
  assert.match(printLayer, /sourceCompatibleInk/);
  assert.match(printLayer, /dominantHorizontalBoundary/);
  assert.match(printLayer, /sourceContour/);
  assert.match(printLayer, /quietWash/);
  assert.match(printLayer, /const bayer4 =/);
  assert.match(printLayer, /horizontalBristle/);
  assert.match(printLayer, /reliefCluster/);
  assert.match(printLayer, /sparseHatch/);
  assert.match(printLayer, /dotDensity/);
  assert.doesNotMatch(printLayer, /quietCoverage/);
  assert.doesNotMatch(printLayer, /const colorInk = structuralInk/);
});

test("scene objects select a source-appropriate print language", () => {
  assert.equal(scenePrintTreatment("桥梁与栏杆", "稀疏机械线"), "linework");
  assert.equal(scenePrintTreatment("湖面", "干刷丝网"), "dry-brush");
  assert.equal(scenePrintTreatment("石岸", "粗网点"), "halftone");
  assert.equal(scenePrintTreatment("荷叶与树木", "石墨拓印"), "rubbing");
  assert.equal(scenePrintTreatment("水生植物叶片", "干刷丝网"), "rubbing");
  assert.equal(scenePrintTreatment("水面", "粗网点"), "dry-brush");
});

test("paper ink keeps the source hue ordering while compressing chroma", () => {
  const greenInk = sourceCompatibleInk(72, 142, 64);
  const blueInk = sourceCompatibleInk(72, 118, 176);
  assert.ok(greenInk[1] > greenInk[0] && greenInk[1] > greenInk[2]);
  assert.ok(blueInk[2] > blueInk[1] && blueInk[1] > blueInk[0]);
  assert.ok(Math.max(...greenInk) - Math.min(...greenInk) < 70);
  assert.ok(Math.max(...blueInk) - Math.min(...blueInk) < 70);
});

test("the API passes source boxes and per-zone treatments into the deterministic compositor", async () => {
  const source = await readFile(new URL("../app/api/generate/route.ts", import.meta.url), "utf8");
  assert.match(source, /backgroundZones: sceneBackgroundPlan\.backgroundZones\.map/);
  assert.match(source, /sourceBox: zone\.sourceBox/);
  assert.match(source, /treatment: zone\.treatment/);
  assert.match(source, /quietBackgroundZone: sceneBackgroundPlan\.quietBackgroundZone/);
});

test("decorative chromatic bridge is opt-in rather than invented by default", async () => {
  const source = await readFile(new URL("../app/real-scene-paper-composite.ts", import.meta.url), "utf8");
  assert.match(source, /spec\.layout === "scene-fragment" && spec\.structuralHue\?\.trim\(\)/);
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
