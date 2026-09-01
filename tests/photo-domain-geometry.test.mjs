import assert from "node:assert/strict";
import test from "node:test";

import {
  boxArea,
  constrainPhotoDomainBox,
  subjectDomainRelationDelta,
  subjectPositionInsideDomain,
} from "../app/photo-domain-geometry.ts";

test("a huge top-left proposal cannot drag a centered subject domain to the corner", () => {
  const subject = { x: 0.44, y: 0.4, width: 0.14, height: 0.2 };
  const result = constrainPhotoDomainBox(subject, { x: 0, y: 0, width: 0.8, height: 0.8 });

  assert.ok(result.x > 0.12);
  assert.ok(result.y > 0.05);
  assert.ok(boxArea(result) <= 0.640001);
  const relation = subjectPositionInsideDomain(subject, result);
  assert.ok(relation.x > 0.32 && relation.x < 0.68);
  assert.ok(relation.y > 0.32 && relation.y < 0.68);
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
