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
  structuralHue?: string;
  chromaticBridge?: string;
  quietAreas?: string[];
  edgeForegroundSides?: EdgeForegroundSide[];
};

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));

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

function createSourceDerivedPaperLayer(image: HTMLImageElement, width: number, height: number) {
  const longestSide = 1200;
  const scale = Math.min(1, longestSide / Math.max(width, height));
  const workingWidth = Math.max(1, Math.round(width * scale));
  const workingHeight = Math.max(1, Math.round(height * scale));
  const workingCanvas = document.createElement("canvas");
  workingCanvas.width = workingWidth;
  workingCanvas.height = workingHeight;
  const working = workingCanvas.getContext("2d", { willReadFrequently: true });
  if (!working) throw new Error("浏览器无法准备同场景纸面转译。");
  working.filter = "blur(0.7px) saturate(0.84) contrast(1.02)";
  drawCover(working, image, workingWidth, workingHeight);
  working.filter = "none";
  const pixels = working.getImageData(0, 0, workingWidth, workingHeight);
  const paper = [238, 229, 209] as const;
  for (let offset = 0; offset < pixels.data.length; offset += 4) {
    const red = pixels.data[offset];
    const green = pixels.data[offset + 1];
    const blue = pixels.data[offset + 2];
    const luminance = red * 0.299 + green * 0.587 + blue * 0.114;
    const average = (red + green + blue) / 3;
    const chroma = Math.max(red, green, blue) - Math.min(red, green, blue);
    const normalizedChroma = clamp(chroma / 110, 0, 1);
    const tonalDistance = clamp(Math.abs(luminance - 142) / 142, 0, 1);
    const structure = clamp(normalizedChroma * 0.42 + tonalDistance * 0.58, 0, 1);
    const saturation = 0.42 + structure * 0.24;
    const mutedRed = average + (red - average) * saturation;
    const mutedGreen = average + (green - average) * saturation;
    const mutedBlue = average + (blue - average) * saturation;
    const contrast = 0.78 + structure * 0.12;
    const compressedRed = 128 + (mutedRed - 128) * contrast;
    const compressedGreen = 128 + (mutedGreen - 128) * contrast;
    const compressedBlue = 128 + (mutedBlue - 128) * contrast;
    const paperMix = 0.1 + (1 - structure) * 0.24;
    const pixelIndex = offset / 4;
    const x = pixelIndex % workingWidth;
    const y = Math.floor(pixelIndex / workingWidth);
    const grain = (((x * 17 + y * 31 + x * y * 3) % 23) - 11) * 0.18;
    pixels.data[offset] = clamp(compressedRed * (1 - paperMix) + paper[0] * paperMix + grain, 0, 255);
    pixels.data[offset + 1] = clamp(compressedGreen * (1 - paperMix) + paper[1] * paperMix + grain, 0, 255);
    pixels.data[offset + 2] = clamp(compressedBlue * (1 - paperMix) + paper[2] * paperMix + grain, 0, 255);
    pixels.data[offset + 3] = 255;
  }
  working.putImageData(pixels, 0, 0);

  const paperCanvas = document.createElement("canvas");
  paperCanvas.width = width;
  paperCanvas.height = height;
  const paperContext = paperCanvas.getContext("2d");
  if (!paperContext) throw new Error("浏览器无法放大同场景纸面转译。");
  paperContext.imageSmoothingEnabled = true;
  paperContext.drawImage(workingCanvas, 0, 0, width, height);
  // Lift the print field towards warm paper. Without this veil, dark foliage
  // becomes a heavy grey filter instead of a quiet dry-print / halftone mass.
  paperContext.globalAlpha = 0.05;
  paperContext.fillStyle = "#f4ead4";
  paperContext.fillRect(0, 0, width, height);
  paperContext.globalAlpha = 1;
  return paperCanvas;
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
  const amplitude = Math.max(5, Math.min(width, height) * (alreadyNormalized ? 0.018 : 0.013));
  const stepsX = alreadyNormalized ? 34 : 18;
  const stepsY = 13;
  const offset = (index: number, salt: number) => (
    Math.sin(index * 2.17 + salt) * 0.58 + Math.sin(index * 5.31 + salt * 0.7) * 0.42
  ) * amplitude;

  context.beginPath();
  context.moveTo(left, top + offset(0, 1.3));
  for (let index = 1; index <= stepsX; index += 1) {
    context.lineTo(left + (right - left) * index / stepsX, top + offset(index, 1.3));
  }
  for (let index = 1; index <= stepsY; index += 1) {
    context.lineTo(right + offset(index, 3.1), top + (bottom - top) * index / stepsY);
  }
  for (let index = stepsX - 1; index >= 0; index -= 1) {
    context.lineTo(left + (right - left) * index / stepsX, bottom + offset(index, 4.9));
  }
  for (let index = stepsY - 1; index >= 0; index -= 1) {
    context.lineTo(left + offset(index, 6.7), top + (bottom - top) * index / stepsY);
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
    // The uploaded scene remains the spatial truth. The model contributes only
    // restrained print language, so hallucinated bands or camouflage fields can
    // never replace the source geometry.
    context.fillStyle = "#f4ead4";
    context.fillRect(0, 0, width, height);
    const paperLayer = createSourceDerivedPaperLayer(sourceImage, width, height);
    context.drawImage(paperLayer, 0, 0);
    context.save();
    const bandScore = horizontalBandScore(transformedImage, width, height);
    const flatScore = flatPosterizationScore(transformedImage, width, height);
    const artifactScore = bandScore + flatScore;
    context.globalAlpha = artifactScore >= 3
      ? 0.03
      : artifactScore >= 2
        ? 0.06
        : artifactScore >= 1
          ? 0.1
          : spec.subjectMasks?.length
            ? 0.16
            : 0.12;
    drawCover(context, transformedImage, width, height);
    context.restore();
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
  const anchors = spec.photoAnchors?.length
    ? spec.photoAnchors.slice(0, 5)
    : [{ ...normalizedPhotoWindow(photoWindow, spec.anchorMode), shape: "organic" as const }];
  const usesRelationshipRegion = spec.layout === "scene-fragment"
    && (spec.photoEvidenceType === "relational-region" || spec.photoEvidenceType === "continuous-band");
  let hasGuidedRegion = false;
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
    hasGuidedRegion = true;
  }
  if (spec.subjectMasks?.length && spec.layout === "scene-fragment") {
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
        const candidate = { image, invert, score: candidateScore, area, confidence, coverage, edgeTouches };
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
      for (const chosen of selected) {
        raw.clearRect(0, 0, width, height);
        drawCover(raw, chosen.image, width, height);
        const maskPixels = raw.getImageData(0, 0, width, height);
        for (let offset = 0; offset < maskPixels.data.length; offset += 4) {
          const luminance = (maskPixels.data[offset] + maskPixels.data[offset + 1] + maskPixels.data[offset + 2]) / 3;
          const selectedLuminance = chosen.invert ? 255 - luminance : luminance;
          maskPixels.data[offset] = 255;
          maskPixels.data[offset + 1] = 255;
          maskPixels.data[offset + 2] = 255;
          maskPixels.data[offset + 3] = selectedLuminance >= 112 ? 255 : 0;
        }
        raw.putImageData(maskPixels, 0, 0);
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
  } else if (!hasGuidedRegion) {
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
  if (spec.layout === "scene-fragment") {
    const edgeForegroundMask = createEdgeForegroundMask(sourceImage, width, height, spec.edgeForegroundSides);
    if (edgeForegroundMask) mask.drawImage(edgeForegroundMask, 0, 0);
  }
  fragment.globalCompositeOperation = "destination-in";
  fragment.drawImage(maskCanvas, 0, 0);
  fragment.globalCompositeOperation = "source-over";

  if (spec.layout === "scene-fragment") {
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
  return canvas.toDataURL("image/jpeg", 0.94);
}
