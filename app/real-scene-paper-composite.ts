export type PhotoAnchorMode = "floating" | "top-bleed" | "bottom-bleed" | "left-bleed" | "right-bleed";
export type PhotoAnchorShape = "organic" | "ellipse" | "flow";

export type PhotoAnchor = {
  x: number;
  y: number;
  width: number;
  height: number;
  shape?: PhotoAnchorShape;
};

export type NormalizedPoint = { x: number; y: number };
export type PhotoEvidenceSide = "above" | "below" | "left" | "right";
export type EdgeForegroundSide = "top" | "right" | "bottom" | "left";
export type ScenePrintTreatment = "halftone" | "dry-brush" | "rubbing" | "linework";

export type SceneBackgroundZone = {
  name?: string;
  objectClass: string;
  sourceBox: { x: number; y: number; width: number; height: number };
  confidence?: number;
  treatment?: string;
};

export type RealScenePaperCompositeSpec = {
  photoWindow: { x: number; y: number; width: number; height: number };
  photoAnchors?: PhotoAnchor[];
  anchorMode?: PhotoAnchorMode;
  layout?: "scene-fragment" | "layered-rip" | "structural-memory";
  subjectMasks?: string[];
  subjectScores?: number[];
  segmentationFallback?: boolean;
  preserveOnlyPrimary?: boolean;
  compositionMode?: "scene-wrap" | "subject-island" | "layered-window";
  focusMode?: "single-subject" | "distributed-subject" | "subject-context" | "scene-band";
  targetPhotoShare?: number;
  semanticMinimum?: string[];
  spatialInvariants?: string[];
  dominantGesture?: "horizontal" | "vertical" | "diagonal-down" | "diagonal-up" | "curve" | "convergence" | "radial";
  layoutArchetype?: "transformative-seam" | "underprint-overlay" | "photo-anchor-field" | "directional-split" | "irregular-fragments";
  photoEvidenceType?: "object-island" | "relational-region" | "continuous-band" | "distributed-fragments";
  boundaryGuide?: NormalizedPoint[];
  photoEvidenceSide?: PhotoEvidenceSide;
  illustrationGrammar?: "halftone" | "dry-brush" | "screen-print" | "cut-paper" | "directional-lines";
  backgroundZones?: SceneBackgroundZone[];
  quietBackgroundZone?: string;
  structuralHue?: string;
  chromaticBridge?: string;
  quietAreas?: string[];
  edgeForegroundSides?: EdgeForegroundSide[];
  modelLayerStrength?: number;
};

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));

export function generatedStyleOpacity(
  source: { red: number; green: number; blue: number },
  generated: { red: number; green: number; blue: number },
  strength = 0.28,
) {
  const sourceLuminance = source.red * 0.299 + source.green * 0.587 + source.blue * 0.114;
  const generatedLuminance = generated.red * 0.299 + generated.green * 0.587 + generated.blue * 0.114;
  const sourceChroma = Math.max(source.red, source.green, source.blue) - Math.min(source.red, source.green, source.blue);
  const generatedChroma = Math.max(generated.red, generated.green, generated.blue) - Math.min(generated.red, generated.green, generated.blue);
  const luminanceGap = Math.abs(sourceLuminance - generatedLuminance);
  const chromaGap = Math.abs(sourceChroma - generatedChroma);
  const inventedNeutralStructure = sourceChroma >= 22
    && generatedChroma <= sourceChroma * 0.5
    && generatedLuminance <= sourceLuminance - 34;
  const inventedBrightShape = generatedLuminance >= sourceLuminance + 62
    && generatedChroma <= sourceChroma + 10;
  if (inventedNeutralStructure || inventedBrightShape) return 0;
  const agreement = clamp(1 - luminanceGap / 82 - chromaGap / 150, 0, 1);
  return clamp(strength, 0, 0.42) * agreement * agreement;
}

export function normalizeBoundaryGuide(points: NormalizedPoint[] | undefined, side: PhotoEvidenceSide, fallback = 0.5) {
  const horizontal = side === "above" || side === "below";
  const cleaned = (points ?? [])
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
    .map((point) => ({ x: clamp(point.x, 0, 1), y: clamp(point.y, 0, 1) }))
    .sort((left, right) => horizontal ? left.x - right.x : left.y - right.y)
    .filter((point, index, list) => index === 0 || (horizontal ? point.x - list[index - 1].x : point.y - list[index - 1].y) > 0.002);
  const guide = cleaned.length >= 2
    ? cleaned
    : horizontal
      ? [{ x: 0, y: clamp(fallback, 0.08, 0.92) }, { x: 1, y: clamp(fallback, 0.08, 0.92) }]
      : [{ x: clamp(fallback, 0.08, 0.92), y: 0 }, { x: clamp(fallback, 0.08, 0.92), y: 1 }];
  if (horizontal) {
    if (guide[0].x > 0) guide.unshift({ x: 0, y: guide[0].y });
    if (guide[guide.length - 1].x < 1) guide.push({ x: 1, y: guide[guide.length - 1].y });
  } else {
    if (guide[0].y > 0) guide.unshift({ x: guide[0].x, y: 0 });
    if (guide[guide.length - 1].y < 1) guide.push({ x: guide[guide.length - 1].x, y: 1 });
  }
  return guide;
}

export function localizedSupportAnchor(core: PhotoAnchor, support: PhotoAnchor): PhotoAnchor {
  const coreCenterX = clamp(core.x + core.width / 2, 0, 1);
  const coreCenterY = clamp(core.y + core.height / 2, 0, 1);
  const supportCenterX = clamp(support.x + support.width / 2, 0, 1);
  const supportCenterY = clamp(support.y + support.height / 2, 0, 1);
  const deltaX = supportCenterX - coreCenterX;
  const deltaY = supportCenterY - coreCenterY;
  const verticalRelation = Math.abs(deltaY) >= Math.abs(deltaX);
  const maximumWidth = clamp(core.width * 1.15, 0.2, 0.44);
  const maximumHeight = clamp(core.height * 0.82, 0.14, 0.28);
  let windowX = coreCenterX - maximumWidth / 2;
  let windowY = coreCenterY - maximumHeight / 2;
  if (verticalRelation) {
    windowY = deltaY >= 0
      ? core.y + core.height - maximumHeight * 0.16
      : core.y - maximumHeight * 0.84;
  } else {
    windowX = deltaX >= 0
      ? core.x + core.width - maximumWidth * 0.16
      : core.x - maximumWidth * 0.84;
  }
  windowX = clamp(windowX, 0, Math.max(0, 1 - maximumWidth));
  windowY = clamp(windowY, 0, Math.max(0, 1 - maximumHeight));
  const supportLeft = clamp(support.x, 0, 1);
  const supportTop = clamp(support.y, 0, 1);
  const supportRight = clamp(support.x + support.width, 0, 1);
  const supportBottom = clamp(support.y + support.height, 0, 1);
  const left = Math.max(supportLeft, windowX);
  const top = Math.max(supportTop, windowY);
  const right = Math.min(supportRight, windowX + maximumWidth);
  const bottom = Math.min(supportBottom, windowY + maximumHeight);
  if (right - left < 0.06 || bottom - top < 0.06) {
    return {
      x: windowX,
      y: windowY,
      width: maximumWidth,
      height: maximumHeight,
      shape: support.shape ?? "organic",
    };
  }
  return { x: left, y: top, width: right - left, height: bottom - top, shape: support.shape ?? "organic" };
}

export function pointInsidePhotoAnchor(anchor: PhotoAnchor, x: number, y: number, index = 0) {
  const radiusX = Math.max(0.001, anchor.width / 2);
  const radiusY = Math.max(0.001, anchor.height / 2);
  const normalizedX = (x - (anchor.x + radiusX)) / radiusX;
  const normalizedY = (y - (anchor.y + radiusY)) / radiusY;
  if (anchor.shape === "ellipse") return normalizedX * normalizedX + normalizedY * normalizedY <= 1.05;
  if (anchor.shape === "flow") {
    return Math.pow(Math.abs(normalizedX), 1.7) + Math.pow(Math.abs(normalizedY), 1.45) <= 1.08;
  }
  const angle = Math.atan2(normalizedY, normalizedX);
  const irregularRadius = 1.02
    + Math.sin(angle * 5 + index * 1.73) * 0.055
    + Math.sin(angle * 9 - index * 0.91) * 0.025;
  return Math.hypot(normalizedX, normalizedY) <= irregularRadius;
}

export function expandedPhotoIsland(anchors: PhotoAnchor[], fallback: PhotoAnchor): PhotoAnchor {
  const sourceAnchors = anchors.length ? anchors : [fallback];
  const left = Math.min(...sourceAnchors.map((anchor) => anchor.x));
  const top = Math.min(...sourceAnchors.map((anchor) => anchor.y));
  const right = Math.max(...sourceAnchors.map((anchor) => anchor.x + anchor.width));
  const bottom = Math.max(...sourceAnchors.map((anchor) => anchor.y + anchor.height));
  const unionWidth = Math.max(0.08, right - left);
  const unionHeight = Math.max(0.08, bottom - top);
  const width = clamp(unionWidth + clamp(unionWidth * 0.24, 0.08, 0.14), 0.4, 0.66);
  const height = clamp(unionHeight + clamp(unionHeight * 0.2, 0.07, 0.13), 0.36, 0.6);
  const centerX = (left + right) / 2;
  const centerY = (top + bottom) / 2;
  return {
    x: clamp(centerX - width / 2, 0.025, Math.max(0.025, 0.975 - width)),
    y: clamp(centerY - height / 2, 0.025, Math.max(0.025, 0.975 - height)),
    width,
    height,
    shape: "organic",
  };
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("纸媒图层无法读取，请重新生成。"));
    image.src = source;
  });
}

function drawCover(context: CanvasRenderingContext2D, image: HTMLImageElement, width: number, height: number) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  context.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
}

function structuralInk(label: string | undefined) {
  if (/绿|green/i.test(label ?? "")) return [164, 205, 38] as const;
  if (/橙|橘|orange/i.test(label ?? "")) return [231, 84, 34] as const;
  if (/红|red/i.test(label ?? "")) return [219, 57, 43] as const;
  if (/蓝|blue|cobalt/i.test(label ?? "")) return [49, 82, 199] as const;
  if (/黄|yellow/i.test(label ?? "")) return [229, 186, 30] as const;
  if (/紫|洋红|粉|purple|magenta|pink/i.test(label ?? "")) return [187, 54, 137] as const;
  return [218, 77, 43] as const;
}

export function scenePrintTreatment(objectClass = "", requestedTreatment = ""): ScenePrintTreatment {
  if (/建筑|桥|栏杆|屋顶|塔|楼|墙|亭|building|bridge|rail|roof|tower|wall|pavilion/i.test(objectClass)) return "linework";
  if (/树|植物|叶|草|花|林|荷|芦苇|vegetation|tree|leaf|grass|flower|forest|lotus|reed/i.test(objectClass)) return "rubbing";
  if (/水|海|河|湖|池|溪|天空|云|water|sea|river|lake|pond|stream|sky|cloud/i.test(objectClass)) return "dry-brush";
  if (/地面|道路|路面|岩石|石|沙|岸|土|ground|road|rock|stone|sand|bank|soil/i.test(objectClass)) return "halftone";
  const requested = requestedTreatment.toLowerCase();
  if (/石墨拓印|拓印|rubbing|relief/.test(requested)) return "rubbing";
  if (/稀疏机械线|机械线|line/.test(requested)) return "linework";
  if (/干刷|丝网|dry.?brush|screen/.test(requested)) return "dry-brush";
  if (/粗网点|网点|half.?tone/.test(requested)) return "halftone";
  return "rubbing";
}

export function sourceCompatibleInk(red: number, green: number, blue: number) {
  const luminance = red * 0.299 + green * 0.587 + blue * 0.114;
  const neutral = clamp(luminance * 0.42, 48, 112);
  return [
    Math.round(red * 0.52 + neutral * 0.48),
    Math.round(green * 0.52 + neutral * 0.48),
    Math.round(blue * 0.52 + neutral * 0.48),
  ] as const;
}

function smoothstep(value: number) {
  const normalized = clamp(value, 0, 1);
  return normalized * normalized * (3 - 2 * normalized);
}

function zoneWeight(zone: SceneBackgroundZone, x: number, y: number, hash: number) {
  const box = zone.sourceBox;
  const width = Math.max(0.02, box.width);
  const height = Math.max(0.02, box.height);
  const localX = (x - box.x) / width;
  const localY = (y - box.y) / height;
  if (localX < 0 || localX > 1 || localY < 0 || localY > 1) return 0;
  const edgeDistance = Math.min(localX, 1 - localX, localY, 1 - localY);
  const feather = smoothstep(edgeDistance / 0.1);
  const brokenBoundary = 0.82 + hash * 0.18;
  return feather * brokenBoundary * clamp(zone.confidence ?? 1, 0.55, 1);
}

type SceneBackgroundFamily = "architecture" | "water" | "sky" | "vegetation" | "ground" | "generic";

function sceneBackgroundFamily(objectClass = ""): SceneBackgroundFamily {
  if (/天空|云|天际|sky|cloud/i.test(objectClass)) return "sky";
  if (/建筑|桥|栏杆|屋顶|塔|楼|墙|亭|道路|路面|building|bridge|rail|roof|tower|wall|pavilion|road/i.test(objectClass)) return "architecture";
  if (/树|植物|叶|草|花|林|荷|芦苇|vegetation|tree|leaf|grass|flower|forest|lotus|reed/i.test(objectClass)) return "vegetation";
  if (/水|海|河|湖|池|溪|water|sea|river|lake|pond|stream/i.test(objectClass)) return "water";
  if (/地面|岩石|石|沙|岸|土|ground|rock|stone|sand|bank|soil/i.test(objectClass)) return "ground";
  return "generic";
}

function sceneMaterialEvidence(
  family: SceneBackgroundFamily,
  edgeX: number,
  edgeY: number,
  darkness: number,
  chroma: number,
  red: number,
  green: number,
  blue: number,
) {
  const edgeStrength = clamp(edgeX + edgeY, 0, 1);
  if (family === "sky") {
    // Quiet sky remains mostly warm paper. Only real cloud/sky gradients leave
    // a faint source-colour trace; a flat sky must never become wallpaper.
    return clamp(edgeStrength * 0.16 + chroma / 1100, 0.008, 0.045);
  }
  if (family === "water") {
    // Horizontal water marks are supported by vertical luminance changes and
    // local tonal variation, not by the mere presence of a large water box.
    return clamp(edgeY * 2.15 + edgeX * 0.38 + darkness * 0.24 + chroma / 520, 0.035, 0.84);
  }
  if (family === "architecture") {
    return clamp(edgeStrength * 2.25 + darkness * 0.24, 0.035, 0.92);
  }
  if (family === "vegetation") {
    const greenEvidence = clamp((green - Math.max(red, blue) + 24) / 80, 0, 1);
    return clamp(edgeStrength * 0.82 + darkness * 0.24 + chroma / 210 + greenEvidence * 0.34, 0.035, 0.88);
  }
  if (family === "ground") {
    return clamp(edgeStrength * 1.15 + darkness * 0.42 + chroma / 360, 0.035, 0.9);
  }
  return clamp(edgeStrength * 0.9 + darkness * 0.25 + chroma / 300, 0.025, 0.72);
}

function compatibleSceneTreatments(zones: SceneBackgroundZone[]) {
  const selected: ScenePrintTreatment[] = [];
  for (const zone of zones) {
    const treatment = scenePrintTreatment(zone.objectClass, zone.treatment);
    if (!selected.includes(treatment)) selected.push(treatment);
    if (selected.length === 2) break;
  }
  return selected.length ? selected : ["rubbing", "linework"] satisfies ScenePrintTreatment[];
}

function nearestCompatibleTreatment(treatment: ScenePrintTreatment, allowed: ScenePrintTreatment[]) {
  if (allowed.includes(treatment)) return treatment;
  const isLinear = treatment === "linework" || treatment === "halftone";
  return allowed.find((candidate) => isLinear
    ? candidate === "linework" || candidate === "halftone"
    : candidate === "rubbing" || candidate === "dry-brush") ?? allowed[0];
}

function dominantHorizontalBoundary(sourcePixels: Uint8ClampedArray, width: number, height: number) {
  const luminanceAt = (x: number, y: number) => {
    const offset = (y * width + x) * 4;
    return sourcePixels[offset] * 0.299 + sourcePixels[offset + 1] * 0.587 + sourcePixels[offset + 2] * 0.114;
  };
  let bestY = Math.round(height * 0.46);
  let bestScore = -1;
  for (let y = Math.round(height * 0.2); y <= Math.round(height * 0.82); y += 2) {
    let score = 0;
    let samples = 0;
    for (let x = 4; x < width - 4; x += 5) {
      score += Math.abs(luminanceAt(x, y - 3) - luminanceAt(x, y + 3));
      samples += 1;
    }
    const normalizedScore = samples ? score / samples : 0;
    if (normalizedScore > bestScore) {
      bestScore = normalizedScore;
      bestY = y;
    }
  }
  return bestY / Math.max(1, height - 1);
}

function createSourceDerivedPaperLayer(
  image: HTMLImageElement,
  width: number,
  height: number,
  backgroundZones: SceneBackgroundZone[] = [],
) {
  // Keep the source coordinate system intact and translate only its visual
  // language. Scene evidence boxes select where ink is allowed; source edges,
  // tone and colour decide the actual printed contour inside each box.
  const longestSide = 960;
  const scale = Math.min(1, longestSide / Math.max(width, height));
  const workingWidth = Math.max(1, Math.round(width * scale));
  const workingHeight = Math.max(1, Math.round(height * scale));
  const workingCanvas = document.createElement("canvas");
  workingCanvas.width = workingWidth;
  workingCanvas.height = workingHeight;
  const working = workingCanvas.getContext("2d", { willReadFrequently: true });
  if (!working) throw new Error("浏览器无法准备同场景纸面转译。");
  working.filter = "blur(0.85px) saturate(0.78) contrast(1.06)";
  drawCover(working, image, workingWidth, workingHeight);
  working.filter = "none";
  const pixels = working.getImageData(0, 0, workingWidth, workingHeight);
  const sourcePixels = new Uint8ClampedArray(pixels.data);
  const horizontalBoundary = dominantHorizontalBoundary(sourcePixels, workingWidth, workingHeight);
  const paper = [244, 235, 217] as const;
  const allowedTreatments = compatibleSceneTreatments(backgroundZones);
  const bayer4 = [
    0, 8, 2, 10,
    12, 4, 14, 6,
    3, 11, 1, 9,
    15, 7, 13, 5,
  ] as const;
  for (let offset = 0; offset < pixels.data.length; offset += 4) {
    const red = sourcePixels[offset];
    const green = sourcePixels[offset + 1];
    const blue = sourcePixels[offset + 2];
    const luminance = red * 0.299 + green * 0.587 + blue * 0.114;
    const chroma = Math.max(red, green, blue) - Math.min(red, green, blue);
    const pixelIndex = offset / 4;
    const x = pixelIndex % workingWidth;
    const y = Math.floor(pixelIndex / workingWidth);
    const leftOffset = (y * workingWidth + Math.max(0, x - 2)) * 4;
    const rightOffset = (y * workingWidth + Math.min(workingWidth - 1, x + 2)) * 4;
    const topOffset = (Math.max(0, y - 2) * workingWidth + x) * 4;
    const bottomOffset = (Math.min(workingHeight - 1, y + 2) * workingWidth + x) * 4;
    const neighborLuminance = (sampleOffset: number) => sourcePixels[sampleOffset] * 0.299
      + sourcePixels[sampleOffset + 1] * 0.587
      + sourcePixels[sampleOffset + 2] * 0.114;
    const gradientX = Math.abs(neighborLuminance(leftOffset) - neighborLuminance(rightOffset));
    const gradientY = Math.abs(neighborLuminance(topOffset) - neighborLuminance(bottomOffset));
    const gradient = gradientX + gradientY;
    const darkness = clamp((205 - luminance) / 170, 0, 1);
    const edgeStrength = clamp(gradient / 82, 0, 1);
    const sourceStructure = clamp(edgeStrength * 0.52 + darkness * 0.28 + chroma / 150 * 0.2, 0, 1);
    const hash = Math.abs(Math.sin(x * 12.9898 + y * 78.233 + x * y * 0.0017) * 43758.5453) % 1;
    const normalizedX = x / Math.max(1, workingWidth - 1);
    const normalizedY = y / Math.max(1, workingHeight - 1);
    let selectedZone: SceneBackgroundZone | undefined;
    let selectedWeight = 0;
    let selectedMaterialEvidence = 0;
    for (const zone of backgroundZones) {
      const weight = zoneWeight(zone, normalizedX, normalizedY, hash);
      const family = sceneBackgroundFamily(zone.objectClass);
      let materialEvidence = sceneMaterialEvidence(
        family,
        clamp(gradientX / 82, 0, 1),
        clamp(gradientY / 82, 0, 1),
        darkness,
        chroma,
        red,
        green,
        blue,
      );
      if (
        family === "water"
        && zone.sourceBox.height >= 0.62
        && normalizedY < Math.max(horizontalBoundary + 0.015, zone.sourceBox.y + zone.sourceBox.height * 0.34)
        && blue >= red + 4
        && edgeStrength < 0.18
      ) {
        materialEvidence *= 0.16;
      }
      if (weight * materialEvidence > selectedWeight * selectedMaterialEvidence) {
        selectedZone = zone;
        selectedWeight = weight;
        selectedMaterialEvidence = materialEvidence;
      }
    }
    const inferredTreatment = green >= red + 5 && green >= blue + 3 && chroma >= 12
      ? "rubbing" as const
      : blue >= red + 4 && luminance >= 95
        ? "dry-brush" as const
        : edgeStrength >= 0.26
          ? "linework" as const
          : "halftone" as const;
    const requestedTreatment = selectedZone
      ? scenePrintTreatment(selectedZone.objectClass, selectedZone.treatment)
      : inferredTreatment;
    const treatment = nearestCompatibleTreatment(requestedTreatment, allowedTreatments);
    const materialEvidence = selectedZone
      ? selectedMaterialEvidence
      : sceneMaterialEvidence("generic", clamp(gradientX / 82, 0, 1), clamp(gradientY / 82, 0, 1), darkness, chroma, red, green, blue);
    // When analysis boxes are available, non-box pixels carry only sparse
    // source contours. This prevents a repeated all-over dot wallpaper while
    // preserving enough low-density evidence that the page never feels blank.
    let evidenceWeight = selectedZone
      ? selectedWeight * materialEvidence
      : backgroundZones.length
        ? 0
        : clamp(sourceStructure * 0.72, 0.12, 0.72);
    const orderedThreshold = bayer4[(y % 4) * 4 + (x % 4)] / 16;
    const jitteredThreshold = (orderedThreshold + hash * 0.17) % 1;
    let printed = false;
    let printedCoverage = 0;
    if (treatment === "linework") {
      const sparseHatch = (x + Math.floor(y * 0.22) + Math.floor(hash * 4)) % 7 <= 2;
      const softStructuralTone = darkness >= 0.15 && hash < 0.14 + evidenceWeight * 0.18;
      printed = evidenceWeight > 0.035 && sparseHatch
        && (edgeStrength >= 0.045 + (1 - evidenceWeight) * 0.12 || softStructuralTone);
      printedCoverage = 0.5 + edgeStrength * 0.3;
    } else if (treatment === "dry-brush") {
      const horizontalBristle = (y + Math.floor(Math.sin(x * 0.08) * 3) + Math.floor(hash * 3)) % 11 <= 3;
      const brokenStroke = hash <= 0.42 + sourceStructure * 0.34;
      printed = evidenceWeight > 0.055 && horizontalBristle && brokenStroke
        && (gradientY >= 2.5 || edgeStrength >= 0.075 || darkness >= 0.15);
      printedCoverage = 0.36 + darkness * 0.22 + edgeStrength * 0.16;
    } else if (treatment === "rubbing") {
      const reliefCluster = (Math.sin(x * 0.075) + Math.sin(y * 0.091) + Math.sin((x + y) * 0.041)) / 3;
      const reliefDensity = clamp(0.16 + sourceStructure * 0.58 + reliefCluster * 0.15, 0.08, 0.78);
      printed = evidenceWeight > 0.06 && jitteredThreshold < reliefDensity * evidenceWeight;
      printedCoverage = 0.34 + sourceStructure * 0.26;
    } else {
      const dotDensity = clamp(0.08 + darkness * 0.42 + edgeStrength * 0.26 + chroma / 360, 0.06, 0.72);
      printed = evidenceWeight > 0.05 && jitteredThreshold < dotDensity * evidenceWeight;
      printedCoverage = 0.34 + darkness * 0.22 + edgeStrength * 0.12;
    }
    const sourceContour = edgeStrength >= 0.085
      && hash < clamp(0.08 + edgeStrength * 0.72, 0.1, 0.5)
      && (x + Math.floor(y * 0.31)) % 6 <= 1;
    if (sourceContour) {
      // Always retain a sparse source-coordinate contour plate. It recovers a
      // bridge, railing or shoreline that the semantic pass may omit, without
      // inventing any object or filling flat sky and paper.
      printed = true;
      printedCoverage = Math.max(printedCoverage, 0.46 + edgeStrength * 0.24);
      evidenceWeight = Math.max(evidenceWeight, clamp(edgeStrength * 0.82, 0.09, 0.62));
    }
    const sourceInk = sourceCompatibleInk(red, green, blue);
    const quietWash = selectedZone
      ? 0.006 + evidenceWeight * 0.035
      : backgroundZones.length
        ? 0.002
        : 0.018 + evidenceWeight * 0.028;
    const coverage = printed ? printedCoverage * clamp(evidenceWeight + 0.2, 0.24, 1) : quietWash;
    const grain = (((x * 17 + y * 31 + x * y * 3) % 29) - 14) * 0.27;
    const fiber = ((Math.sin(x * 0.13 + y * 0.037) + Math.sin(y * 0.19)) * 0.75);
    pixels.data[offset] = clamp(paper[0] * (1 - coverage) + sourceInk[0] * coverage + grain + fiber, 0, 255);
    pixels.data[offset + 1] = clamp(paper[1] * (1 - coverage) + sourceInk[1] * coverage + grain + fiber, 0, 255);
    pixels.data[offset + 2] = clamp(paper[2] * (1 - coverage) + sourceInk[2] * coverage + grain + fiber, 0, 255);
    pixels.data[offset + 3] = 255;
  }
  working.putImageData(pixels, 0, 0);

  const paperCanvas = document.createElement("canvas");
  paperCanvas.width = width;
  paperCanvas.height = height;
  const paperContext = paperCanvas.getContext("2d");
  if (!paperContext) throw new Error("浏览器无法放大同场景纸面转译。");
  paperContext.imageSmoothingEnabled = true;
  paperContext.imageSmoothingQuality = "high";
  paperContext.drawImage(workingCanvas, 0, 0, width, height);
  return paperCanvas;
}

function organicRelationshipPath(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  anchor: PhotoAnchor,
  index: number,
  expansionX = 1,
  expansionY = expansionX,
) {
  const centerX = (anchor.x + anchor.width / 2) * width;
  const centerY = (anchor.y + anchor.height / 2) * height;
  const radiusX = anchor.width * width * 0.5 * expansionX;
  const radiusY = anchor.height * height * 0.5 * expansionY;
  const points = 22;
  context.beginPath();
  for (let point = 0; point < points; point += 1) {
    const angle = point / points * Math.PI * 2;
    const wobble = 1
      + Math.sin(angle * 3 + index * 1.9) * 0.11
      + Math.sin(angle * 7 - index * 0.8) * 0.055;
    const directionalStretch = 1 + Math.sin(angle - 0.65) * (index === 0 ? 0.08 : 0.14);
    const x = centerX + Math.cos(angle) * radiusX * wobble * directionalStretch;
    const y = centerY + Math.sin(angle) * radiusY * wobble;
    if (point === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.closePath();
}

function createAdaptivePhotoIslandMask(
  width: number,
  height: number,
  anchors: PhotoAnchor[],
  fallback: PhotoAnchor,
) {
  const analysisWidth = 420;
  const analysisHeight = Math.max(1, Math.round(analysisWidth * height / width));
  const seedCanvas = document.createElement("canvas");
  seedCanvas.width = analysisWidth;
  seedCanvas.height = analysisHeight;
  const seed = seedCanvas.getContext("2d");
  if (!seed) throw new Error("浏览器无法生成不规则摄影场景碎片。");
  const fallbackOnly = anchors.length === 0;
  const sourceAnchors = fallbackOnly ? [fallback] : anchors;
  seed.fillStyle = "#ffffff";
  sourceAnchors.forEach((anchor, index) => {
    const expansionX = fallbackOnly ? 1.035 : index === 0 ? 1.25 : 1.58;
    const expansionY = fallbackOnly ? 1.035 : index === 0 ? 1.3 : 1.08;
    organicRelationshipPath(seed, analysisWidth, analysisHeight, anchor, index, expansionX, expansionY);
    seed.fill();
  });
  // Bind subject and contact support into one truthful scene fragment. Rounded
  // corridors avoid both a sticker silhouette and a bounding-box rectangle.
  if (sourceAnchors.length > 1) {
    const core = sourceAnchors[0];
    const coreX = (core.x + core.width / 2) * analysisWidth;
    const coreY = (core.y + core.height / 2) * analysisHeight;
    seed.lineCap = "round";
    seed.lineJoin = "round";
    sourceAnchors.slice(1).forEach((anchor, index) => {
      seed.beginPath();
      seed.moveTo(coreX, coreY);
      seed.lineTo(
        (anchor.x + anchor.width / 2) * analysisWidth,
        (anchor.y + anchor.height / 2) * analysisHeight,
      );
      seed.lineWidth = Math.max(
        analysisWidth * Math.min(core.width, anchor.width) * 0.46,
        18 + index * 2,
      );
      seed.strokeStyle = "#ffffff";
      seed.stroke();
    });
  }
  const softCanvas = document.createElement("canvas");
  softCanvas.width = analysisWidth;
  softCanvas.height = analysisHeight;
  const soft = softCanvas.getContext("2d", { willReadFrequently: true });
  if (!soft) throw new Error("浏览器无法柔化摄影场景碎片。");
  soft.filter = "blur(9px)";
  soft.drawImage(seedCanvas, 0, 0);
  soft.filter = "none";
  const pixels = soft.getImageData(0, 0, analysisWidth, analysisHeight);
  for (let offset = 0; offset < pixels.data.length; offset += 4) {
    const pixelIndex = offset / 4;
    const x = pixelIndex % analysisWidth;
    const y = Math.floor(pixelIndex / analysisWidth);
    const organicNoise = Math.sin(x * 0.37 + y * 0.11) * 8
      + Math.sin(x * 0.09 - y * 0.31) * 5;
    const selected = pixels.data[offset + 3] >= 105 + organicNoise;
    pixels.data[offset] = 255;
    pixels.data[offset + 1] = 255;
    pixels.data[offset + 2] = 255;
    pixels.data[offset + 3] = selected ? 255 : 0;
  }
  soft.putImageData(pixels, 0, 0);
  const fullCanvas = document.createElement("canvas");
  fullCanvas.width = width;
  fullCanvas.height = height;
  const full = fullCanvas.getContext("2d");
  if (!full) throw new Error("浏览器无法放大摄影场景碎片。");
  full.imageSmoothingEnabled = true;
  full.imageSmoothingQuality = "high";
  full.drawImage(softCanvas, 0, 0, width, height);
  return fullCanvas;
}

function drawChromaticBridge(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  anchors: PhotoAnchor[],
  structuralHue?: string,
) {
  if (!anchors.length) return;
  const core = anchors[0];
  const support = anchors[1] ?? core;
  const ink = structuralInk(structuralHue);
  context.save();
  context.strokeStyle = `rgb(${ink[0]} ${ink[1]} ${ink[2]})`;
  context.lineWidth = clamp(Math.min(width, height) * 0.002, 2.2, 6.5);
  context.lineCap = "round";
  context.globalAlpha = 0.92;
  const startX = clamp(core.x - core.width * 0.05, 0.04, 0.82) * width;
  const startY = clamp(support.y + support.height * 0.16, 0.12, 0.82) * height;
  const endX = clamp(core.x + core.width * 1.48, 0.58, 0.92) * width;
  const endY = clamp(support.y + support.height * 2.05, 0.58, 0.91) * height;
  context.beginPath();
  context.moveTo(startX, startY);
  context.bezierCurveTo(
    startX - width * 0.08,
    startY + height * 0.08,
    endX + width * 0.04,
    endY - height * 0.13,
    endX,
    endY,
  );
  context.stroke();
  context.globalAlpha = 0.78;
  context.beginPath();
  context.ellipse(endX, endY, width * 0.045, height * 0.012, 0, 0, Math.PI * 2);
  context.stroke();
  context.globalAlpha = 0.55;
  context.beginPath();
  context.ellipse(endX, endY, width * 0.026, height * 0.006, 0, 0, Math.PI * 2);
  context.stroke();
  context.restore();
}

function createSourceProtectedGeneratedLayer(
  sourceImage: HTMLImageElement,
  transformedImage: HTMLImageElement,
  width: number,
  height: number,
  strength: number,
) {
  const longestSide = 1200;
  const scale = Math.min(1, longestSide / Math.max(width, height));
  const workingWidth = Math.max(1, Math.round(width * scale));
  const workingHeight = Math.max(1, Math.round(height * scale));
  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = workingWidth;
  sourceCanvas.height = workingHeight;
  const source = sourceCanvas.getContext("2d", { willReadFrequently: true });
  const generatedCanvas = document.createElement("canvas");
  generatedCanvas.width = workingWidth;
  generatedCanvas.height = workingHeight;
  const generated = generatedCanvas.getContext("2d", { willReadFrequently: true });
  if (!source || !generated) return undefined;
  drawCover(source, sourceImage, workingWidth, workingHeight);
  drawCover(generated, transformedImage, workingWidth, workingHeight);
  const sourcePixels = source.getImageData(0, 0, workingWidth, workingHeight).data;
  const generatedPixels = generated.getImageData(0, 0, workingWidth, workingHeight);
  for (let offset = 0; offset < generatedPixels.data.length; offset += 4) {
    const generatedRed = generatedPixels.data[offset];
    const generatedGreen = generatedPixels.data[offset + 1];
    const generatedBlue = generatedPixels.data[offset + 2];
    const generatedLuminance = generatedRed * 0.299 + generatedGreen * 0.587 + generatedBlue * 0.114;
    const generatedChroma = Math.max(generatedRed, generatedGreen, generatedBlue) - Math.min(generatedRed, generatedGreen, generatedBlue);
    const paperLike = generatedLuminance >= 210
      && generatedChroma <= 34
      && generatedRed >= generatedBlue + 2;
    const sourceRed = sourcePixels[offset];
    const sourceGreen = sourcePixels[offset + 1];
    const sourceBlue = sourcePixels[offset + 2];
    const sourceLuminance = sourceRed * 0.299 + sourceGreen * 0.587 + sourceBlue * 0.114;
    const sourceChroma = Math.max(sourceRed, sourceGreen, sourceBlue) - Math.min(sourceRed, sourceGreen, sourceBlue);
    // Remove only source-less paper holes from the model layer. The complete
    // source-derived print plate underneath then restores the corresponding
    // water, road, wall, sky or ground without introducing a new object.
    const sourceCarriesScene = sourceLuminance < 205 || sourceChroma >= 16;
    if (paperLike && sourceCarriesScene) {
      generatedPixels.data[offset + 3] = 0;
      continue;
    }
    const opacity = generatedStyleOpacity(
      { red: sourceRed, green: sourceGreen, blue: sourceBlue },
      { red: generatedRed, green: generatedGreen, blue: generatedBlue },
      strength,
    );
    generatedPixels.data[offset + 3] = Math.round(255 * opacity);
  }
  generated.putImageData(generatedPixels, 0, 0);
  const fullCanvas = document.createElement("canvas");
  fullCanvas.width = width;
  fullCanvas.height = height;
  const full = fullCanvas.getContext("2d");
  if (!full) return undefined;
  full.imageSmoothingEnabled = true;
  full.drawImage(generatedCanvas, 0, 0, width, height);
  return fullCanvas;
}

function createTornFiberHandoff(maskCanvas: HTMLCanvasElement, width: number, height: number) {
  const fiberCanvas = document.createElement("canvas");
  fiberCanvas.width = width;
  fiberCanvas.height = height;
  const fiber = fiberCanvas.getContext("2d");
  if (!fiber) return undefined;
  const band = clamp(Math.round(Math.min(width, height) * 0.015), 18, 52);
  fiber.globalAlpha = 0.52;
  for (let step = 0; step < 21; step += 1) {
    const angle = step / 21 * Math.PI * 2;
    const irregularity = 0.32 + ((Math.sin(step * 2.73) + 1) / 2) * 0.68;
    const radius = band * irregularity;
    fiber.drawImage(maskCanvas, Math.cos(angle) * radius, Math.sin(angle) * radius);
  }
  fiber.globalAlpha = 1;
  fiber.globalCompositeOperation = "destination-out";
  fiber.drawImage(maskCanvas, 0, 0);
  fiber.globalCompositeOperation = "source-in";
  fiber.fillStyle = "#f5ead2";
  fiber.fillRect(0, 0, width, height);
  fiber.globalCompositeOperation = "source-over";
  return fiberCanvas;
}

function createEdgeForegroundMask(
  image: HTMLImageElement,
  width: number,
  height: number,
  sides: EdgeForegroundSide[] | undefined,
) {
  const sampleWidth = Math.min(360, width);
  const sampleHeight = Math.max(1, Math.round(sampleWidth * height / width));
  const sampleCanvas = document.createElement("canvas");
  sampleCanvas.width = sampleWidth;
  sampleCanvas.height = sampleHeight;
  const sample = sampleCanvas.getContext("2d", { willReadFrequently: true });
  if (!sample) return undefined;
  drawCover(sample, image, sampleWidth, sampleHeight);
  const pixels = sample.getImageData(0, 0, sampleWidth, sampleHeight).data;
  const total = sampleWidth * sampleHeight;
  const selected = new Uint8Array(total);
  const hintedSides = new Set(sides ?? []);
  const allSides: EdgeForegroundSide[] = ["top", "right", "bottom", "left"];
  const isForeground = (index: number) => {
    const offset = index * 4;
    const red = pixels[offset];
    const green = pixels[offset + 1];
    const blue = pixels[offset + 2];
    const luminance = red * 0.299 + green * 0.587 + blue * 0.114;
    const chroma = Math.max(red, green, blue) - Math.min(red, green, blue);
    // Edge foliage, branches and rails are normally darker than the open sky,
    // water or wall behind them. A conservative source-only test prevents the
    // recovery pass from turning the whole edge back into a rectangular photo.
    return luminance <= 112 || (luminance <= 137 && chroma >= 20);
  };
  // The vision planner can miss a small blurred branch on one edge. Probe all
  // four sides independently, then use more conservative limits for sides that
  // were not explicitly reported. This recovers real framing foliage without
  // restoring a broad dark sea, pavement, wall or rectangular photo border.
  for (const side of allSides) {
    const queued = new Uint8Array(total);
    const component = new Uint8Array(total);
    const queue = new Int32Array(total);
    let queueStart = 0;
    let queueEnd = 0;
    let edgeSeedCount = 0;
    const withinEdgeBand = (x: number, y: number) => (
      (side === "left" && x <= sampleWidth * 0.36)
      || (side === "right" && x >= sampleWidth * 0.64)
      || (side === "top" && y <= sampleHeight * 0.31)
      || (side === "bottom" && y >= sampleHeight * 0.69)
    );
    const enqueue = (x: number, y: number, fromEdge = false) => {
      if (x < 0 || x >= sampleWidth || y < 0 || y >= sampleHeight || !withinEdgeBand(x, y)) return;
      const index = y * sampleWidth + x;
      if (queued[index] || !isForeground(index)) return;
      queued[index] = 1;
      queue[queueEnd] = index;
      queueEnd += 1;
      if (fromEdge) edgeSeedCount += 1;
    };
    if (side === "top" || side === "bottom") {
      const y = side === "top" ? 0 : sampleHeight - 1;
      for (let x = 0; x < sampleWidth; x += 1) enqueue(x, y, true);
    } else {
      const x = side === "left" ? 0 : sampleWidth - 1;
      for (let y = 0; y < sampleHeight; y += 1) enqueue(x, y, true);
    }
    while (queueStart < queueEnd) {
      const index = queue[queueStart];
      queueStart += 1;
      component[index] = 1;
      const x = index % sampleWidth;
      const y = Math.floor(index / sampleWidth);
      enqueue(x - 1, y);
      enqueue(x + 1, y);
      enqueue(x, y - 1);
      enqueue(x, y + 1);
    }
    const componentPixels = queueEnd;
    const share = componentPixels / total;
    const edgeLength = side === "top" || side === "bottom" ? sampleWidth : sampleHeight;
    const edgeCoverage = edgeSeedCount / edgeLength;
    const hinted = hintedSides.has(side);
    const accepted = hinted
      ? share >= 0.00045 && share <= 0.16
      : share >= 0.0008 && share <= 0.085 && edgeCoverage <= 0.68;
    if (!accepted) continue;
    for (let index = 0; index < total; index += 1) {
      if (component[index]) selected[index] = 1;
    }
  }
  // Dilate just enough to recover soft leaf edges and shallow depth-of-field.
  const expanded = selected.slice();
  for (let pass = 0; pass < 2; pass += 1) {
    const previous = expanded.slice();
    for (let y = 1; y < sampleHeight - 1; y += 1) {
      for (let x = 1; x < sampleWidth - 1; x += 1) {
        const index = y * sampleWidth + x;
        if (previous[index]) continue;
        if (previous[index - 1] || previous[index + 1] || previous[index - sampleWidth] || previous[index + sampleWidth]) {
          expanded[index] = 1;
        }
      }
    }
  }
  const maskPixels = sample.createImageData(sampleWidth, sampleHeight);
  let selectedPixels = 0;
  for (let index = 0; index < total; index += 1) {
    const offset = index * 4;
    maskPixels.data[offset] = 255;
    maskPixels.data[offset + 1] = 255;
    maskPixels.data[offset + 2] = 255;
    maskPixels.data[offset + 3] = expanded[index] ? 255 : 0;
    if (expanded[index]) selectedPixels += 1;
  }
  // A bad planner choice or a uniformly dark border must not restore a frame.
  if (selectedPixels / total < 0.001 || selectedPixels / total > 0.24) return undefined;
  sample.putImageData(maskPixels, 0, 0);
  const fullMask = document.createElement("canvas");
  fullMask.width = width;
  fullMask.height = height;
  const full = fullMask.getContext("2d");
  if (!full) return undefined;
  full.imageSmoothingEnabled = true;
  full.filter = "blur(1.2px)";
  full.drawImage(sampleCanvas, 0, 0, width, height);
  full.filter = "none";
  return fullMask;
}

function horizontalBandScore(image: HTMLImageElement, width: number, height: number) {
  const sampleWidth = 96;
  const sampleHeight = Math.max(32, Math.round(sampleWidth * height / width));
  const canvas = document.createElement("canvas");
  canvas.width = sampleWidth;
  canvas.height = sampleHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return 0;
  drawCover(context, image, sampleWidth, sampleHeight);
  const pixels = context.getImageData(0, 0, sampleWidth, sampleHeight).data;
  const rows: Array<{ luminance: number; variance: number }> = [];
  for (let y = 0; y < sampleHeight; y += 1) {
    let sum = 0;
    let sumSquares = 0;
    for (let x = 0; x < sampleWidth; x += 1) {
      const offset = (y * sampleWidth + x) * 4;
      const luminance = pixels[offset] * 0.299 + pixels[offset + 1] * 0.587 + pixels[offset + 2] * 0.114;
      sum += luminance;
      sumSquares += luminance * luminance;
    }
    const average = sum / sampleWidth;
    rows.push({ luminance: average, variance: sumSquares / sampleWidth - average * average });
  }
  let transitions = 0;
  let lastTransition = -sampleHeight;
  for (let y = 2; y < Math.floor(sampleHeight * 0.76); y += 1) {
    const delta = Math.abs(rows[y].luminance - rows[y - 2].luminance);
    const quietRow = Math.min(rows[y].variance, rows[y - 2].variance) < 900;
    if (delta >= 11 && quietRow && y - lastTransition >= Math.max(3, sampleHeight * 0.055)) {
      transitions += 1;
      lastTransition = y;
    }
  }
  return transitions;
}

function flatPosterizationScore(image: HTMLImageElement, width: number, height: number) {
  const sampleWidth = 96;
  const sampleHeight = Math.max(32, Math.round(sampleWidth * height / width));
  const canvas = document.createElement("canvas");
  canvas.width = sampleWidth;
  canvas.height = sampleHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return 0;
  drawCover(context, image, sampleWidth, sampleHeight);
  const pixels = context.getImageData(0, 0, sampleWidth, sampleHeight).data;
  const colorBins = new Set<string>();
  let flatNeighbors = 0;
  let comparedNeighbors = 0;
  let dominantRowShare = 0;

  for (let y = 0; y < sampleHeight; y += 1) {
    const rowBins = new Map<string, number>();
    for (let x = 0; x < sampleWidth; x += 1) {
      const offset = (y * sampleWidth + x) * 4;
      const red = pixels[offset];
      const green = pixels[offset + 1];
      const blue = pixels[offset + 2];
      const bin = `${red >> 5}-${green >> 5}-${blue >> 5}`;
      colorBins.add(bin);
      rowBins.set(bin, (rowBins.get(bin) ?? 0) + 1);
      if (x > 0) {
        const previous = offset - 4;
        const difference = Math.abs(red - pixels[previous])
          + Math.abs(green - pixels[previous + 1])
          + Math.abs(blue - pixels[previous + 2]);
        if (difference <= 12) flatNeighbors += 1;
        comparedNeighbors += 1;
      }
    }
    const rowMaximum = Math.max(...rowBins.values());
    dominantRowShare = Math.max(dominantRowShare, rowMaximum / sampleWidth);
  }

  const flatRatio = flatNeighbors / Math.max(1, comparedNeighbors);
  if ((flatRatio > 0.72 && colorBins.size < 30) || (dominantRowShare > 0.7 && colorBins.size < 36)) return 2;
  if ((flatRatio > 0.6 && colorBins.size < 46) || (dominantRowShare > 0.58 && colorBins.size < 52)) return 1;
  return 0;
}

function semanticTornPaperPath(
  context: CanvasRenderingContext2D,
  sourceImage: HTMLImageElement,
  width: number,
  height: number,
  rawWindow: RealScenePaperCompositeSpec["photoWindow"],
  mode: Exclude<PhotoAnchorMode, "floating">,
) {
  const window = normalizedPhotoWindow(rawWindow, mode);
  const horizontal = mode === "top-bleed" || mode === "bottom-bleed";
  const sampleLongSide = 260;
  const sampleWidth = horizontal ? sampleLongSide : Math.max(1, Math.round(sampleLongSide * width / height));
  const sampleHeight = horizontal ? Math.max(1, Math.round(sampleLongSide * height / width)) : sampleLongSide;
  const sampleCanvas = document.createElement("canvas");
  sampleCanvas.width = sampleWidth;
  sampleCanvas.height = sampleHeight;
  const sample = sampleCanvas.getContext("2d", { willReadFrequently: true });
  if (!sample) {
    tornPaperPath(context, width, height, rawWindow, mode);
    return;
  }
  drawCover(sample, sourceImage, sampleWidth, sampleHeight);
  const pixels = sample.getImageData(0, 0, sampleWidth, sampleHeight).data;
  const luminanceAt = (x: number, y: number) => {
    const safeX = clamp(Math.round(x), 0, sampleWidth - 1);
    const safeY = clamp(Math.round(y), 0, sampleHeight - 1);
    const offset = (safeY * sampleWidth + safeX) * 4;
    return pixels[offset] * 0.299 + pixels[offset + 1] * 0.587 + pixels[offset + 2] * 0.114;
  };
  const axisLength = horizontal ? sampleWidth : sampleHeight;
  const crossLength = horizontal ? sampleHeight : sampleWidth;
  const rawBoundary = horizontal
    ? (mode === "top-bleed" ? window.y + window.height : window.y)
    : (mode === "left-bleed" ? window.x + window.width : window.x);
  const center = clamp(rawBoundary, 0.12, 0.88) * crossLength;
  const searchRadius = Math.max(7, Math.round(crossLength * 0.075));
  const points: number[] = [];
  let previous = center;
  for (let axis = 0; axis < axisLength; axis += 1) {
    let best = center;
    let bestScore = -Infinity;
    for (let cross = Math.max(2, Math.round(center - searchRadius)); cross <= Math.min(crossLength - 3, Math.round(center + searchRadius)); cross += 1) {
      const before = horizontal ? luminanceAt(axis, cross - 2) : luminanceAt(cross - 2, axis);
      const after = horizontal ? luminanceAt(axis, cross + 2) : luminanceAt(cross + 2, axis);
      const edge = Math.abs(after - before);
      const distancePenalty = Math.abs(cross - center) * 0.24;
      const continuityPenalty = Math.abs(cross - previous) * 0.52;
      const score = edge - distancePenalty - continuityPenalty;
      if (score > bestScore) {
        bestScore = score;
        best = cross;
      }
    }
    previous = previous * 0.72 + best * 0.28;
    points.push(previous);
  }
  // Broad smoothing follows a coastline, crown, roof or road; the tiny second
  // term supplies fibrous irregularity without a regular saw-tooth mask look.
  for (let pass = 0; pass < 3; pass += 1) {
    const copy = [...points];
    for (let index = 2; index < points.length - 2; index += 1) {
      points[index] = (copy[index - 2] + copy[index - 1] * 2 + copy[index] * 3 + copy[index + 1] * 2 + copy[index + 2]) / 9;
    }
  }
  const scaled = points.map((value, index) => (
    value / crossLength * (horizontal ? height : width)
    + Math.sin(index * 1.91) * Math.max(1.5, Math.min(width, height) * 0.0018)
  ));

  context.beginPath();
  if (horizontal) {
    const keepsTop = mode === "top-bleed";
    context.moveTo(0, keepsTop ? 0 : height);
    context.lineTo(width, keepsTop ? 0 : height);
    for (let index = scaled.length - 1; index >= 0; index -= 1) {
      context.lineTo(index / Math.max(1, scaled.length - 1) * width, scaled[index]);
    }
  } else {
    const keepsLeft = mode === "left-bleed";
    context.moveTo(keepsLeft ? 0 : width, 0);
    context.lineTo(keepsLeft ? 0 : width, height);
    for (let index = scaled.length - 1; index >= 0; index -= 1) {
      context.lineTo(scaled[index], index / Math.max(1, scaled.length - 1) * height);
    }
  }
  context.closePath();
}

function guidedTornPaperPath(
  context: CanvasRenderingContext2D,
  sourceImage: HTMLImageElement,
  width: number,
  height: number,
  rawPoints: NormalizedPoint[] | undefined,
  side: PhotoEvidenceSide,
  fallback: number,
) {
  const horizontal = side === "above" || side === "below";
  const guide = normalizeBoundaryGuide(rawPoints, side, fallback);
  const sampleWidth = 320;
  const sampleHeight = Math.max(1, Math.round(sampleWidth * height / width));
  const sampleCanvas = document.createElement("canvas");
  sampleCanvas.width = sampleWidth;
  sampleCanvas.height = sampleHeight;
  const sample = sampleCanvas.getContext("2d", { willReadFrequently: true });
  if (!sample) return;
  drawCover(sample, sourceImage, sampleWidth, sampleHeight);
  const pixels = sample.getImageData(0, 0, sampleWidth, sampleHeight).data;
  const luminanceAt = (x: number, y: number) => {
    const safeX = clamp(Math.round(x), 0, sampleWidth - 1);
    const safeY = clamp(Math.round(y), 0, sampleHeight - 1);
    const offset = (safeY * sampleWidth + safeX) * 4;
    return pixels[offset] * 0.299 + pixels[offset + 1] * 0.587 + pixels[offset + 2] * 0.114;
  };
  const interpolateGuide = (position: number) => {
    const axis = horizontal ? "x" : "y";
    const cross = horizontal ? "y" : "x";
    let rightIndex = 1;
    while (rightIndex < guide.length - 1 && guide[rightIndex][axis] < position) rightIndex += 1;
    const left = guide[Math.max(0, rightIndex - 1)];
    const right = guide[rightIndex];
    const span = Math.max(0.0001, right[axis] - left[axis]);
    const progress = clamp((position - left[axis]) / span, 0, 1);
    return left[cross] + (right[cross] - left[cross]) * progress;
  };
  const steps = horizontal ? sampleWidth : sampleHeight;
  const crossLength = horizontal ? sampleHeight : sampleWidth;
  const searchRadius = Math.max(4, Math.round(crossLength * 0.04));
  const snapped: number[] = [];
  let previous = interpolateGuide(0) * crossLength;
  for (let axisIndex = 0; axisIndex < steps; axisIndex += 1) {
    const base = interpolateGuide(axisIndex / Math.max(1, steps - 1)) * crossLength;
    let best = base;
    let bestScore = -Infinity;
    for (let crossIndex = Math.max(2, Math.round(base - searchRadius)); crossIndex <= Math.min(crossLength - 3, Math.round(base + searchRadius)); crossIndex += 1) {
      const before = horizontal ? luminanceAt(axisIndex, crossIndex - 2) : luminanceAt(crossIndex - 2, axisIndex);
      const after = horizontal ? luminanceAt(axisIndex, crossIndex + 2) : luminanceAt(crossIndex + 2, axisIndex);
      const edge = Math.abs(after - before);
      const score = edge - Math.abs(crossIndex - base) * 0.34 - Math.abs(crossIndex - previous) * 0.28;
      if (score > bestScore) {
        bestScore = score;
        best = crossIndex;
      }
    }
    // Weak edges should follow the authored scene guide instead of drifting to
    // incidental texture such as windows, waves or individual leaves.
    const snappedValue = bestScore >= 8 ? base * 0.38 + best * 0.62 : base;
    previous = previous * 0.55 + snappedValue * 0.45;
    snapped.push(previous);
  }
  for (let pass = 0; pass < 2; pass += 1) {
    const copy = [...snapped];
    for (let index = 2; index < snapped.length - 2; index += 1) {
      snapped[index] = (copy[index - 2] + copy[index - 1] * 2 + copy[index] * 3 + copy[index + 1] * 2 + copy[index + 2]) / 9;
    }
  }
  const edgePoints = snapped.map((value, index) => {
    const fiber = Math.sin(index * 1.73) * Math.max(1.1, Math.min(width, height) * 0.0014);
    return horizontal
      ? { x: index / Math.max(1, snapped.length - 1) * width, y: value / sampleHeight * height + fiber }
      : { x: value / sampleWidth * width + fiber, y: index / Math.max(1, snapped.length - 1) * height };
  });
  context.beginPath();
  if (horizontal) {
    const keepsAbove = side === "above";
    context.moveTo(0, keepsAbove ? 0 : height);
    context.lineTo(width, keepsAbove ? 0 : height);
  } else {
    const keepsLeft = side === "left";
    context.moveTo(keepsLeft ? 0 : width, 0);
    context.lineTo(keepsLeft ? 0 : width, height);
  }
  for (let index = edgePoints.length - 1; index >= 0; index -= 1) context.lineTo(edgePoints[index].x, edgePoints[index].y);
  context.closePath();
}

export function normalizedPhotoWindow(window: RealScenePaperCompositeSpec["photoWindow"], mode: PhotoAnchorMode = "floating") {
  const width = clamp(window.width, 0.34, 0.82);
  const height = clamp(window.height, 0.34, 0.78);
  const normalized = {
    x: clamp(window.x, 0.03, 0.97 - width),
    y: clamp(window.y, 0.04, 0.96 - height),
    width,
    height,
  };
  if (mode === "top-bleed") {
    normalized.height += normalized.y + 0.025;
    normalized.y = -0.025;
    normalized.x = -0.025;
    normalized.width = 1.05;
  }
  if (mode === "bottom-bleed") {
    normalized.height = 1.025 - normalized.y;
    normalized.x = -0.025;
    normalized.width = 1.05;
  }
  if (mode === "left-bleed") {
    normalized.width += normalized.x + 0.025;
    normalized.x = -0.025;
    normalized.y = -0.025;
    normalized.height = 1.05;
  }
  if (mode === "right-bleed") {
    normalized.width = 1.025 - normalized.x;
    normalized.y = -0.025;
    normalized.height = 1.05;
  }
  return normalized;
}

export function normalizedLayeredPhotoWindow(window: RealScenePaperCompositeSpec["photoWindow"]) {
  const y = clamp(window.y, 0.28, 0.34);
  const height = Math.min(clamp(window.height, 0.42, 0.48), 0.78 - y);
  return { x: -0.025, y, width: 1.05, height };
}

function tornPaperPath(context: CanvasRenderingContext2D, width: number, height: number, rawWindow: RealScenePaperCompositeSpec["photoWindow"], mode: PhotoAnchorMode, alreadyNormalized = false) {
  const window = alreadyNormalized ? rawWindow : normalizedPhotoWindow(rawWindow, mode);
  const left = window.x * width;
  const top = window.y * height;
  const right = (window.x + window.width) * width;
  const bottom = (window.y + window.height) * height;
  const amplitude = Math.max(5, Math.min(width, height) * (alreadyNormalized ? 0.009 : 0.013));
  const stepsX = alreadyNormalized ? 26 : 18;
  const stepsY = alreadyNormalized ? 17 : 13;
  const offset = (index: number, salt: number) => (
    Math.sin(index * 2.17 + salt) * 0.58 + Math.sin(index * 5.31 + salt * 0.7) * 0.42
  ) * amplitude;

  context.beginPath();
  context.moveTo(left, top + offset(0, 1.3) * (alreadyNormalized ? 0.55 : 1));
  for (let index = 1; index <= stepsX; index += 1) {
    context.lineTo(left + (right - left) * index / stepsX, top + offset(index, 1.3) * (alreadyNormalized ? 0.55 : 1));
  }
  for (let index = 1; index <= stepsY; index += 1) {
    context.lineTo(right + offset(index, 3.1) * (alreadyNormalized ? 0.38 : 1), top + (bottom - top) * index / stepsY);
  }
  for (let index = stepsX - 1; index >= 0; index -= 1) {
    context.lineTo(left + (right - left) * index / stepsX, bottom + offset(index, 4.9) * (alreadyNormalized ? 1.15 : 1));
  }
  for (let index = stepsY - 1; index >= 0; index -= 1) {
    context.lineTo(left + offset(index, 6.7) * (alreadyNormalized ? 0.52 : 1), top + (bottom - top) * index / stepsY);
  }
  context.closePath();
}

function anchorPath(context: CanvasRenderingContext2D, width: number, height: number, anchor: PhotoAnchor, index: number) {
  const left = anchor.x * width;
  const top = anchor.y * height;
  const right = (anchor.x + anchor.width) * width;
  const bottom = (anchor.y + anchor.height) * height;
  if (anchor.shape === "ellipse") {
    context.beginPath();
    context.ellipse((left + right) / 2, (top + bottom) / 2, (right - left) / 2, (bottom - top) / 2, -0.08 + index * 0.05, 0, Math.PI * 2);
    context.closePath();
    return;
  }
  if (anchor.shape === "flow") {
    const bend = (bottom - top) * 0.2;
    context.beginPath();
    context.moveTo(left, top + bend);
    context.bezierCurveTo(left + (right - left) * 0.28, top - bend * 0.2, left + (right - left) * 0.7, top + bend * 1.35, right, top);
    context.lineTo(right, bottom - bend);
    context.bezierCurveTo(left + (right - left) * 0.72, bottom + bend * 0.15, left + (right - left) * 0.3, bottom - bend * 1.15, left, bottom);
    context.closePath();
    return;
  }
  tornPaperPath(context, width, height, anchor, "floating", true);
}

export async function applyRealScenePaperComposite(source: string, transformedLayer: string, spec: RealScenePaperCompositeSpec) {
  const [sourceImage, transformedImage] = await Promise.all([loadImage(source), loadImage(transformedLayer)]);
  const maximumDimension = 3600;
  const scale = Math.min(1, maximumDimension / Math.max(sourceImage.naturalWidth, sourceImage.naturalHeight));
  const width = Math.max(1, Math.round(sourceImage.naturalWidth * scale));
  const height = Math.max(1, Math.round(sourceImage.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("浏览器无法合成实景纸拼，请更新浏览器后重试。");

  if (spec.layout === "scene-fragment") {
    // The source-derived plate guarantees complete scene coverage. Qwen remains
    // the main authored illustration layer, except where it incorrectly turns
    // source content into blank paper; those pixels become transparent so the
    // same source region's quiet print translation shows through.
    context.fillStyle = "#f4ead4";
    context.fillRect(0, 0, width, height);
    const paperLayer = createSourceDerivedPaperLayer(sourceImage, width, height, spec.backgroundZones);
    context.drawImage(paperLayer, 0, 0);
    const bandScore = horizontalBandScore(transformedImage, width, height);
    const flatScore = flatPosterizationScore(transformedImage, width, height);
    const artifactScore = bandScore + flatScore;
    const requestedStrength = clamp(spec.modelLayerStrength ?? 0.24, 0, 0.42);
    const artifactMultiplier = artifactScore >= 3 ? 0.32 : artifactScore >= 2 ? 0.5 : artifactScore >= 1 ? 0.72 : 1;
    const protectedGenerated = requestedStrength > 0.01
      ? createSourceProtectedGeneratedLayer(sourceImage, transformedImage, width, height, requestedStrength * artifactMultiplier)
      : undefined;
    if (protectedGenerated) context.drawImage(protectedGenerated, 0, 0);
  } else {
    drawCover(context, transformedImage, width, height);
  }

  const fragmentCanvas = document.createElement("canvas");
  fragmentCanvas.width = width;
  fragmentCanvas.height = height;
  const fragment = fragmentCanvas.getContext("2d");
  if (!fragment) throw new Error("浏览器无法准备真实照片区域。");
  const photoWindow = spec.layout === "layered-rip"
    ? normalizedLayeredPhotoWindow(spec.photoWindow)
    : spec.photoWindow;
  fragment.drawImage(sourceImage, 0, 0, width, height);
  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = width;
  maskCanvas.height = height;
  const mask = maskCanvas.getContext("2d");
  if (!mask) throw new Error("浏览器无法准备摄影锚点遮罩。");
  // The material handoff is not the same thing as the subject cutout. Keep a
  // separate mask for the relationship-domain seam before semantic masks add
  // the duck/person/object itself. Otherwise the paper fibre becomes a sticker
  // outline around every body part.
  const handoffMaskCanvas = document.createElement("canvas");
  handoffMaskCanvas.width = width;
  handoffMaskCanvas.height = height;
  const handoffMask = handoffMaskCanvas.getContext("2d");
  if (!handoffMask) throw new Error("浏览器无法准备摄影与插画的材料交界。");
  const plannedAnchors = spec.photoAnchors?.length
    ? spec.photoAnchors.slice(0, 5)
    : [{ ...normalizedPhotoWindow(photoWindow, spec.anchorMode), shape: "organic" as const }];
  const anchors = plannedAnchors.map((anchor, index) => index === 0
    ? anchor
    : localizedSupportAnchor(plannedAnchors[0], anchor));
  const usesRelationshipRegion = spec.layout === "scene-fragment"
    && spec.photoEvidenceType === "continuous-band"
    && spec.focusMode === "scene-band"
    && (spec.boundaryGuide?.length ?? 0) >= 2;
  let hasGuidedRegion = false;
  let hasLocalHandoffRegion = false;
  if (usesRelationshipRegion) {
    const side = spec.photoEvidenceSide ?? "below";
    const fallback = side === "above"
      ? photoWindow.y + photoWindow.height
      : side === "below"
        ? photoWindow.y
        : side === "left"
          ? photoWindow.x + photoWindow.width
          : photoWindow.x;
    mask.fillStyle = "#ffffff";
    guidedTornPaperPath(mask, sourceImage, width, height, spec.boundaryGuide, side, fallback);
    mask.fill();
    handoffMask.drawImage(maskCanvas, 0, 0);
    hasGuidedRegion = true;
  }
  // Gathered Scenes keeps the subject inside a larger piece of truthful
  // photography. The torn contour follows the fused subject/contact relation,
  // not the semantic silhouette and not the relation's rectangular bounds.
  const usesPhotoPaperIsland = spec.layout === "scene-fragment" && !usesRelationshipRegion;
  if (usesPhotoPaperIsland) {
    const fallbackIsland = { ...normalizedPhotoWindow(photoWindow, spec.anchorMode), shape: "organic" as const };
    // The compiled photo domain already includes the subject and only the
    // necessary support/context. Use that single source-coordinate domain as
    // the paper opening. Re-fusing every semantic/background box here created
    // long corridors toward the top-left and could duplicate a support object.
    const adaptiveIsland = createAdaptivePhotoIslandMask(width, height, [], fallbackIsland);
    handoffMask.drawImage(adaptiveIsland, 0, 0);
    mask.drawImage(handoffMaskCanvas, 0, 0);
    hasLocalHandoffRegion = true;
  }
  if (spec.subjectMasks?.length && spec.layout === "scene-fragment" && !hasLocalHandoffRegion) {
    const maskImages = await Promise.all(spec.subjectMasks.slice(0, 5).map(loadImage));
    const analysisWidth = 320;
    const analysisCanvas = document.createElement("canvas");
    analysisCanvas.width = analysisWidth;
    analysisCanvas.height = Math.max(1, Math.round(analysisWidth * height / width));
    const analysis = analysisCanvas.getContext("2d", { willReadFrequently: true });
    if (!analysis) throw new Error("浏览器无法分析主体遮罩。");
    const guideAnchors = anchors.map((anchor) => ({
      left: Math.floor(anchor.x * analysisCanvas.width),
      top: Math.floor(anchor.y * analysisCanvas.height),
      right: Math.ceil((anchor.x + anchor.width) * analysisCanvas.width),
      bottom: Math.ceil((anchor.y + anchor.height) * analysisCanvas.height),
    }));
    type MaskCandidate = {
      image: HTMLImageElement;
      invert: boolean;
      score: number;
      area: number;
      confidence: number;
      coverage: Uint8Array;
      edgeTouches: number;
      anchorIndices: number[];
    };
    const candidates: MaskCandidate[] = [];
    maskImages.forEach((image, index) => {
      analysis.clearRect(0, 0, analysisCanvas.width, analysisCanvas.height);
      drawCover(analysis, image, analysisCanvas.width, analysisCanvas.height);
      const pixels = analysis.getImageData(0, 0, analysisCanvas.width, analysisCanvas.height).data;
      let white = 0;
      const anchorWhite = guideAnchors.map(() => 0);
      const anchorPixels = guideAnchors.map(() => 0);
      const whiteCoverage = new Uint8Array(analysisCanvas.width * analysisCanvas.height);
      let minimumX = analysisCanvas.width;
      let minimumY = analysisCanvas.height;
      let maximumX = -1;
      let maximumY = -1;
      for (let y = 0; y < analysisCanvas.height; y += 1) {
        for (let x = 0; x < analysisCanvas.width; x += 1) {
          const offset = (y * analysisCanvas.width + x) * 4;
          const on = pixels[offset + 3] >= 64 && (pixels[offset] + pixels[offset + 1] + pixels[offset + 2]) / 3 >= 128;
          if (on) {
            white += 1;
            whiteCoverage[y * analysisCanvas.width + x] = 1;
            minimumX = Math.min(minimumX, x);
            minimumY = Math.min(minimumY, y);
            maximumX = Math.max(maximumX, x);
            maximumY = Math.max(maximumY, y);
          }
          guideAnchors.forEach((box, anchorIndex) => {
            if (x >= box.left && x < box.right && y >= box.top && y < box.bottom) {
              anchorPixels[anchorIndex] += 1;
              if (on) anchorWhite[anchorIndex] += 1;
            }
          });
        }
      }
      const total = analysisCanvas.width * analysisCanvas.height;
      const whiteArea = white / total;
      let imageBest: MaskCandidate | undefined;
      ([false, true] as const).forEach((invert) => {
        const area = invert ? 1 - whiteArea : whiteArea;
        const coverage = invert
          ? whiteCoverage.map((value) => value ? 0 : 1)
          : whiteCoverage.slice();
        const anchorRecall = anchorPixels.map((count, anchorIndex) => {
          const selected = invert ? count - anchorWhite[anchorIndex] : anchorWhite[anchorIndex];
          return count ? selected / count : 0;
        });
        const weightedRecall = anchorRecall.reduce((sum, value, anchorIndex) => sum + value * (anchorIndex === 0 ? 3 : 1), 0)
          / Math.max(1, anchorRecall.reduce((sum, _value, anchorIndex) => sum + (anchorIndex === 0 ? 3 : 1), 0));
        // EntitySegment can return a broad "whole scene" layer. It technically
        // overlaps every planned anchor, but pasting it back would erase almost
        // all of the paper treatment. Keep the photographic island focused on
        // an actual subject and leave a meaningful background for collage.
        if (area < 0.015 || area > 0.62) return;
        const selectedPixels = invert ? total - white : white;
        const selectedGuidePixels = anchorPixels.reduce((sum, count, anchorIndex) => {
          return sum + (invert ? count - anchorWhite[anchorIndex] : anchorWhite[anchorIndex]);
        }, 0);
        const precision = selectedPixels ? Math.min(1, selectedGuidePixels / selectedPixels) : 0;
        const confidence = spec.subjectScores?.[index] ?? 0.8;
        const targetPhotoShare = clamp(spec.targetPhotoShare ?? 0.36, 0.14, 0.56);
        const edgeMarginX = Math.max(2, Math.round(analysisCanvas.width * 0.02));
        const edgeMarginY = Math.max(2, Math.round(analysisCanvas.height * 0.02));
        const edgeTouches = invert
          ? 4
          : Number(minimumX <= edgeMarginX)
            + Number(maximumX >= analysisCanvas.width - 1 - edgeMarginX)
            + Number(minimumY <= edgeMarginY)
            + Number(maximumY >= analysisCanvas.height - 1 - edgeMarginY);
        const oversizedPenalty = area > targetPhotoShare + 0.1 ? (area - targetPhotoShare - 0.1) * 5.2 : 0;
        const borderPenalty = Math.max(0, edgeTouches - 1) * 0.48;
        const candidateScore = weightedRecall * 2.45
          + (anchorRecall[0] ?? 0) * 1.35
          + precision * 1.35
          + confidence * 0.72
          - Math.abs(area - targetPhotoShare) * 1.05
          - oversizedPenalty
          - borderPenalty;
        const anchorIndices = anchorRecall
          .map((recall, anchorIndex) => ({ recall, anchorIndex }))
          .filter(({ recall }) => recall >= 0.12)
          .map(({ anchorIndex }) => anchorIndex);
        if (!anchorIndices.length && anchorRecall.length) {
          anchorIndices.push(anchorRecall.indexOf(Math.max(...anchorRecall)));
        }
        const candidate = { image, invert, score: candidateScore, area, confidence, coverage, edgeTouches, anchorIndices };
        if (!imageBest || candidateScore > imageBest.score) imageBest = candidate;
      });
      if (imageBest) candidates.push(imageBest);
    });
    candidates.sort((left, right) => right.score - left.score);
    const selected: MaskCandidate[] = [];
    const unionCoverage = new Uint8Array(analysisCanvas.width * analysisCanvas.height);
    let unionPixels = 0;
    const focusMode = spec.focusMode ?? "subject-context";
    const targetPhotoShare = clamp(spec.targetPhotoShare ?? 0.36, 0.14, 0.56);
    const maximumUnion = clamp(targetPhotoShare + (focusMode === "distributed-subject" ? 0.12 : 0.08), 0.22, 0.62);
    const maximumMasks = focusMode === "single-subject" ? 1 : focusMode === "distributed-subject" ? 3 : 2;
    for (const candidate of candidates) {
      const isPrimary = selected.length === 0;
      // A subject-island composition keeps only the core photographic subject.
      // Secondary entities (trees, sky, pavement and other occluders) must stay
      // in the generated layer so they can become ink, halftone and dry-brush
      // marks instead of rebuilding most of the original photograph on top.
      if (!isPrimary && (spec.preserveOnlyPrimary || spec.compositionMode === "subject-island")) break;
      const isReliableForeground = candidate.confidence >= 0.88
        && candidate.area <= 0.38
        && candidate.score >= (candidates[0]?.score ?? 0) * 0.28;
      if (!isPrimary && !isReliableForeground) continue;
      if (candidate.edgeTouches >= 3 && candidate.area > targetPhotoShare + 0.08) continue;
      let marginalPixels = 0;
      for (let pixelIndex = 0; pixelIndex < candidate.coverage.length; pixelIndex += 1) {
        if (candidate.coverage[pixelIndex] && !unionCoverage[pixelIndex]) marginalPixels += 1;
      }
      const nextUnionShare = (unionPixels + marginalPixels) / candidate.coverage.length;
      if (isPrimary && nextUnionShare > maximumUnion + 0.1 && candidates.some((other) => other !== candidate && other.area <= maximumUnion + 0.06)) continue;
      if (!isPrimary && (marginalPixels / candidate.coverage.length < 0.012 || nextUnionShare > maximumUnion)) continue;
      selected.push(candidate);
      for (let pixelIndex = 0; pixelIndex < candidate.coverage.length; pixelIndex += 1) {
        if (candidate.coverage[pixelIndex] && !unionCoverage[pixelIndex]) {
          unionCoverage[pixelIndex] = 1;
          unionPixels += 1;
        }
      }
      if (selected.length >= maximumMasks) break;
    }
    if (selected.length) {
      const rawCanvas = document.createElement("canvas");
      rawCanvas.width = width;
      rawCanvas.height = height;
      const raw = rawCanvas.getContext("2d", { willReadFrequently: true });
      if (!raw) throw new Error("浏览器无法读取主体遮罩。");
      for (const [selectedIndex, chosen] of selected.entries()) {
        raw.clearRect(0, 0, width, height);
        drawCover(raw, chosen.image, width, height);
        const maskPixels = raw.getImageData(0, 0, width, height);
        // The highest-ranked mask is the real core subject and already has a
        // precise semantic edge. Planning boxes must never amputate a head,
        // hand, wing or other extremity. Only secondary support masks are
        // constrained to their localized contact anchors.
        const matchedAnchors = selectedIndex === 0
          ? []
          : chosen.anchorIndices
            .filter((anchorIndex) => anchorIndex > 0)
            .map((anchorIndex) => anchors[anchorIndex])
            .filter(Boolean);
        for (let offset = 0; offset < maskPixels.data.length; offset += 4) {
          const pixelIndex = offset / 4;
          const x = pixelIndex % width;
          const y = Math.floor(pixelIndex / width);
          const normalizedX = x / width;
          const normalizedY = y / height;
          const insideSemanticAnchor = selectedIndex === 0 || matchedAnchors.some((anchor, anchorIndex) => (
            pointInsidePhotoAnchor(anchor, normalizedX, normalizedY, anchorIndex)
          ));
          const luminance = (maskPixels.data[offset] + maskPixels.data[offset + 1] + maskPixels.data[offset + 2]) / 3;
          const selectedLuminance = chosen.invert ? 255 - luminance : luminance;
          maskPixels.data[offset] = 255;
          maskPixels.data[offset + 1] = 255;
          maskPixels.data[offset + 2] = 255;
          maskPixels.data[offset + 3] = insideSemanticAnchor && selectedLuminance >= 112 ? 255 : 0;
        }
        raw.putImageData(maskPixels, 0, 0);
        // Keep the semantic cutout on its real edge. Expanding it would pull a
        // ring of pond/sky/ground pixels into the photo fragment and create the
        // very green or white sticker halo that this composite must avoid.
        mask.drawImage(rawCanvas, 0, 0);
      }
    } else if (!hasGuidedRegion) {
      mask.fillStyle = "#ffffff";
      anchors.forEach((anchor, index) => {
        anchorPath(mask, width, height, anchor, index);
        mask.fill();
      });
    }
  } else if (spec.layout === "structural-memory") {
    // Structural memory uses one quiet, borderless seam between an untouched
    // photographic region and the generated abstract panel. The compiler
    // chooses the region from the source composition; the browser guarantees
    // that the pixels inside it are the actual uploaded photograph.
    mask.fillStyle = "#ffffff";
    mask.fillRect(
      photoWindow.x * width,
      photoWindow.y * height,
      photoWindow.width * width,
      photoWindow.height * height,
    );
  } else if (!hasGuidedRegion && !hasLocalHandoffRegion) {
    mask.filter = spec.layout === "layered-rip" ? "blur(1.15px)" : "blur(0.85px)";
    mask.fillStyle = "#ffffff";
    if (spec.layout === "scene-fragment" && spec.anchorMode && spec.anchorMode !== "floating" && !spec.photoAnchors?.length) {
      semanticTornPaperPath(mask, sourceImage, width, height, photoWindow, spec.anchorMode);
      mask.fill();
    } else {
      anchors.forEach((anchor, index) => {
        anchorPath(mask, width, height, anchor, index);
        mask.fill();
      });
    }
    mask.filter = "none";
  }
  // Keep the whole factual paper fragment, including the source context around
  // the subject. This is intentionally larger than the semantic subject mask.
  if (spec.layout === "scene-fragment" && hasLocalHandoffRegion) {
    mask.drawImage(handoffMaskCanvas, 0, 0);
  }
  // A compiled local paper island is already the complete photographic P
  // domain. Recovering dark pixels from the canvas edges here used to add
  // rectangular water/road strips and small corner wedges outside the tear.
  // Edge recovery is only valid for older scene-fragment modes that do not
  // have a local handoff region.
  if (spec.layout === "scene-fragment" && !spec.subjectMasks?.length && !hasLocalHandoffRegion) {
    const edgeForegroundMask = createEdgeForegroundMask(sourceImage, width, height, spec.edgeForegroundSides);
    if (edgeForegroundMask) mask.drawImage(edgeForegroundMask, 0, 0);
  }
  fragment.globalCompositeOperation = "destination-in";
  fragment.drawImage(maskCanvas, 0, 0);
  fragment.globalCompositeOperation = "source-over";

  if (spec.layout === "scene-fragment") {
    // Prefer the source-planned relationship boundary. The final semantic mask
    // is only a fallback for genuinely isolated objects with no scene seam.
    const usesRelationshipHandoff = hasGuidedRegion || hasLocalHandoffRegion;
    const fiberHandoff = createTornFiberHandoff(usesRelationshipHandoff ? handoffMaskCanvas : maskCanvas, width, height);
    if (fiberHandoff) context.drawImage(fiberHandoff, 0, 0);
    const featherCanvas = document.createElement("canvas");
    featherCanvas.width = width;
    featherCanvas.height = height;
    const feather = featherCanvas.getContext("2d");
    if (feather) {
      feather.filter = "blur(2.2px)";
      feather.drawImage(fragmentCanvas, 0, 0);
      context.drawImage(featherCanvas, 0, 0);
    }
  }
  context.drawImage(fragmentCanvas, 0, 0);
  if (spec.layout === "scene-fragment" && spec.structuralHue?.trim()) {
    drawChromaticBridge(context, width, height, anchors, spec.structuralHue);
  }
  return canvas.toDataURL("image/jpeg", 0.94);
}
