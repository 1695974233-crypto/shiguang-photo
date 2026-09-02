import assert from "node:assert/strict";
import test from "node:test";

import {
  boxArea,
  closeUnclippedPhotoDomain,
  constrainPhotoDomainBox,
  subjectDomainRelationDelta,
  subjectPositionInsideDomain,
} from "../app/photo-domain-geometry.ts";

test("a huge top-left proposal cannot drag a centered subject domain to the corner", () => {
  const subject = { x: 0.44, y: 0.4, width: 0.14, height: 0.2 };
  const result = constrainPhotoDomainBox(subject, { x: 0, y: 0, width: 0.8, height: 0.8 });

  assert.ok(result.x > 0.12);
  assert.ok(result.y > 0.05);
  assert.ok(boxArea(result) <= 0.600001);
  const relation = subjectPositionInsideDomain(subject, result);
  assert.ok(relation.x > 0.32 && relation.x < 0.68);
  assert.ok(relation.y > 0.32 && relation.y < 0.68);
});

test("a model proposal cannot add a large unused left or top background margin", () => {
  const subject = { x: 0.57, y: 0.42, width: 0.18, height: 0.24 };
  const result = constrainPhotoDomainBox(subject, { x: 0.02, y: 0.02, width: 0.79, height: 0.78 });

  assert.ok(subject.x - result.x < 0.22);
  assert.ok(subject.y - result.y < 0.22);
  assert.ok(result.x > 0.34);
  assert.ok(result.y > 0.19);
  assert.ok(boxArea(result) <= 0.600001);
});

test("a closed photo island keeps a safety margin from every uncut source edge", () => {
  const result = closeUnclippedPhotoDomain(
    { x: 0, y: 0.01, width: 1, height: 0.98 },
    { top: false, right: false, bottom: false, left: false },
  );
  assert.equal(result.x, 0.045);
  assert.equal(result.y, 0.045);
  assert.ok(Math.abs(result.width - 0.91) < 1e-12);
  assert.ok(Math.abs(result.height - 0.91) < 1e-12);
});

test("a source-cropped subject may keep its real contact with the bottom frame", () => {
  const result = closeUnclippedPhotoDomain(
    { x: 0.2, y: 0.28, width: 0.6, height: 0.72 },
    { top: false, right: false, bottom: true, left: false },
  );
  assert.equal(result.y + result.height, 1);
  assert.equal(result.x, 0.2);
});

test("verified direct support can expand the photo domain asymmetrically", () => {
  const subject = { x: 0.42, y: 0.34, width: 0.16, height: 0.2 };
  const result = constrainPhotoDomainBox(
    subject,
    { x: 0.32, y: 0.24, width: 0.38, height: 0.55 },
    [{
      name: "承托物",
      role: "direct_support",
      sourceBox: { x: 0.4, y: 0.52, width: 0.2, height: 0.18 },
      confidence: 0.94,
    }],
  );

  assert.ok(result.y + result.height > 0.72);
  assert.ok(subjectPositionInsideDomain(subject, result).y < 0.5);
});

test("distant ordinary context is ignored even when proposed as relationship evidence", () => {
  const subject = { x: 0.48, y: 0.45, width: 0.12, height: 0.16 };
  const result = constrainPhotoDomainBox(
    subject,
    { x: 0, y: 0, width: 0.7, height: 0.75 },
    [{
      name: "远处普通天空",
      role: "inseparable_context",
      sourceBox: { x: 0, y: 0, width: 0.45, height: 0.3 },
      confidence: 0.9,
    }],
  );

  assert.ok(result.x > 0.2);
  assert.ok(result.y > 0.18);
});

test("review geometry detects a subject pushed to the lower-right inside the photo domain", () => {
  const delta = subjectDomainRelationDelta(
    { x: 0.42, y: 0.4, width: 0.16, height: 0.2 },
    { x: 0.32, y: 0.3, width: 0.36, height: 0.4 },
    { x: 0.42, y: 0.4, width: 0.16, height: 0.2 },
    { x: 0.05, y: 0.05, width: 0.67, height: 0.67 },
  );

  assert.ok(delta.x > 0.1);
  assert.ok(delta.y > 0.1);
});
