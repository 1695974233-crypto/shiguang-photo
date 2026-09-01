export type NormalizedBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type RelationshipEvidence = {
  name: string;
  role: "direct_support" | "inseparable_context";
  sourceBox: NormalizedBox;
  confidence: number;
};

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

export function normalizeBox(
  value: Partial<NormalizedBox> | undefined,
  fallback: NormalizedBox,
): NormalizedBox {
  const width = clamp(Number.isFinite(value?.width) ? value!.width! : fallback.width, 0.01, 1);
  const height = clamp(Number.isFinite(value?.height) ? value!.height! : fallback.height, 0.01, 1);
  return {
    x: clamp(Number.isFinite(value?.x) ? value!.x! : fallback.x, 0, 1 - width),
    y: clamp(Number.isFinite(value?.y) ? value!.y! : fallback.y, 0, 1 - height),
    width,
    height,
  };
}

export function boxArea(box: NormalizedBox) {
  return box.width * box.height;
}

function unionBox(left: NormalizedBox, right: NormalizedBox): NormalizedBox {
  const x = Math.min(left.x, right.x);
  const y = Math.min(left.y, right.y);
  const rightEdge = Math.max(left.x + left.width, right.x + right.width);
  const bottomEdge = Math.max(left.y + left.height, right.y + right.height);
  return { x, y, width: rightEdge - x, height: bottomEdge - y };
}

function intersectBox(left: NormalizedBox, right: NormalizedBox): NormalizedBox | null {
  const x = Math.max(left.x, right.x);
  const y = Math.max(left.y, right.y);
  const rightEdge = Math.min(left.x + left.width, right.x + right.width);
  const bottomEdge = Math.min(left.y + left.height, right.y + right.height);
  return rightEdge > x && bottomEdge > y
    ? { x, y, width: rightEdge - x, height: bottomEdge - y }
    : null;
}

function expandBox(box: NormalizedBox, marginX: number, marginY: number): NormalizedBox {
  const x = Math.max(0, box.x - marginX);
  const y = Math.max(0, box.y - marginY);
  const rightEdge = Math.min(1, box.x + box.width + marginX);
  const bottomEdge = Math.min(1, box.y + box.height + marginY);
  return { x, y, width: rightEdge - x, height: bottomEdge - y };
}

function axisGap(startA: number, sizeA: number, startB: number, sizeB: number) {
  const endA = startA + sizeA;
  const endB = startB + sizeB;
  if (endA < startB) return startB - endA;
  if (endB < startA) return startA - endB;
  return 0;
}

function keepWithinArea(
  candidate: NormalizedBox,
  subject: NormalizedBox,
  maximumArea: number,
): NormalizedBox {
  if (boxArea(candidate) <= maximumArea || boxArea(subject) >= maximumArea) return candidate;
  const left = subject.x - candidate.x;
  const top = subject.y - candidate.y;
  const right = candidate.x + candidate.width - subject.x - subject.width;
  const bottom = candidate.y + candidate.height - subject.y - subject.height;
  let low = 0;
  let high = 1;
  for (let index = 0; index < 28; index += 1) {
    const factor = (low + high) / 2;
    const probe = {
      x: subject.x - left * factor,
      y: subject.y - top * factor,
      width: subject.width + (left + right) * factor,
      height: subject.height + (top + bottom) * factor,
    };
    if (boxArea(probe) <= maximumArea) low = factor;
    else high = factor;
  }
  return {
    x: subject.x - left * low,
    y: subject.y - top * low,
    width: subject.width + (left + right) * low,
    height: subject.height + (top + bottom) * low,
  };
}

/**
 * Converts the vision model's proposed photo domain into a bounded relationship domain.
 * The subject is the hard anchor. The proposal can shape nearby margins, but it cannot
 * pull the domain toward a distant canvas edge or absorb ordinary scenery.
 */
export function constrainPhotoDomainBox(
  subjectInput: NormalizedBox,
  proposedInput: NormalizedBox,
  evidence: RelationshipEvidence[] = [],
): NormalizedBox {
  const subject = normalizeBox(subjectInput, { x: 0.4, y: 0.35, width: 0.2, height: 0.3 });
  let relationship = subject;

  const rankedEvidence = evidence
    .filter((item) => item.confidence >= 0.62)
    .sort((left, right) => {
      if (left.role !== right.role) return left.role === "direct_support" ? -1 : 1;
      return right.confidence - left.confidence;
    })
    .slice(0, 4);

  for (const item of rankedEvidence) {
    const sourceBox = normalizeBox(item.sourceBox, subject);
    const reachX = item.role === "direct_support"
      ? Math.max(0.16, subject.width * 0.85)
      : Math.max(0.10, subject.width * 0.55);
    const reachY = item.role === "direct_support"
      ? Math.max(0.16, subject.height * 0.85)
      : Math.max(0.10, subject.height * 0.55);
    const nearbyEnvelope = expandBox(subject, Math.min(0.24, reachX), Math.min(0.24, reachY));
    const nearbyPart = intersectBox(sourceBox, nearbyEnvelope);
    if (!nearbyPart) continue;
    const gapX = axisGap(relationship.x, relationship.width, nearbyPart.x, nearbyPart.width);
    const gapY = axisGap(relationship.y, relationship.height, nearbyPart.y, nearbyPart.height);
    if (Math.hypot(gapX, gapY) > 0.06) continue;
    const candidate = unionBox(relationship, nearbyPart);
    const evidenceAreaLimit = item.role === "direct_support" ? 0.64 : 0.58;
    if (boxArea(candidate) <= evidenceAreaLimit) relationship = candidate;
  }

  const marginX = clamp(0.05 + relationship.width * 0.12, 0.055, 0.11);
  const marginY = clamp(0.05 + relationship.height * 0.12, 0.055, 0.11);
  const minimumDomain = expandBox(relationship, marginX, marginY);

  // A soft proposal can only affect the immediate relationship envelope. This is the
  // guard that prevents a large top-left proposal from dragging the final domain there.
  const maximumEnvelope = expandBox(relationship, marginX + 0.16, marginY + 0.16);
  const proposed = normalizeBox(proposedInput, minimumDomain);
  const boundedProposal = intersectBox(proposed, maximumEnvelope);
  const candidate = boundedProposal ? unionBox(minimumDomain, boundedProposal) : minimumDomain;
  return keepWithinArea(candidate, subject, 0.64);
}

export function subjectPositionInsideDomain(subject: NormalizedBox, domain: NormalizedBox) {
  const subjectCenterX = subject.x + subject.width / 2;
  const subjectCenterY = subject.y + subject.height / 2;
  return {
    x: clamp((subjectCenterX - domain.x) / domain.width, 0, 1),
    y: clamp((subjectCenterY - domain.y) / domain.height, 0, 1),
    leftBuffer: Math.max(0, subject.x - domain.x),
    topBuffer: Math.max(0, subject.y - domain.y),
    rightBuffer: Math.max(0, domain.x + domain.width - subject.x - subject.width),
    bottomBuffer: Math.max(0, domain.y + domain.height - subject.y - subject.height),
  };
}

export function subjectDomainRelationDelta(
  expectedSubject: NormalizedBox,
  expectedDomain: NormalizedBox,
  observedSubject: NormalizedBox,
  observedDomain: NormalizedBox,
) {
  const expected = subjectPositionInsideDomain(expectedSubject, expectedDomain);
  const observed = subjectPositionInsideDomain(observedSubject, observedDomain);
  return {
    x: Math.abs(expected.x - observed.x),
    y: Math.abs(expected.y - observed.y),
  };
}
