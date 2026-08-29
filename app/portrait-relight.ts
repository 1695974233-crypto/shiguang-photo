export type NormalizedBox = { x: number; y: number; width: number; height: number };

export type PortraitRelightSpec = {
  faceBox: NormalizedBox;
  personBox: NormalizedBox;
  faceExposureEv: number;
  subjectExposureEv: number;
  highlightCompression: number;
  warmth: number;
  overlayText?: string;
  textPosition?: string;
};

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));

export function relightPixel(red: number, green: number, blue: number, faceWeight: number, personWeight: number, spec: PortraitRelightSpec) {
  const faceExposure = clamp(spec.faceExposureEv, 0.25, 0.72);
  const subjectExposure = clamp(spec.subjectExposureEv, 0.06, 0.32);
  const highlightCompression = clamp(spec.highlightCompression, 0, 0.35);
  const warmth = clamp(spec.warmth, -0.12, 0.12);
  const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
  const shadowProtection = clamp((0.78 - luminance) / 0.58, 0, 1) ** 0.72;
  const exposure = (subjectExposure * personWeight + faceExposure * faceWeight) * shadowProtection;
  const gain = 2 ** exposure;

  let nextRed = linearToSrgb(srgbToLinear(red) * gain);
  let nextGreen = linearToSrgb(srgbToLinear(green) * gain);
  let nextBlue = linearToSrgb(srgbToLinear(blue) * gain);
  const nextLuminance = (0.2126 * nextRed + 0.7152 * nextGreen + 0.0722 * nextBlue) / 255;

  const localHighlightCompression = highlightCompression * Math.max(faceWeight, personWeight);
  if (nextLuminance > 0.67 && localHighlightCompression > 0) {
    const compressedLuminance = 0.67 + (nextLuminance - 0.67) * (1 - localHighlightCompression);
    const ratio = compressedLuminance / nextLuminance;
    nextRed *= ratio;
    nextGreen *= ratio;
    nextBlue *= ratio;
  }

  const skinWeight = Math.max(faceWeight, personWeight * 0.22);
  nextRed += warmth * 34 * skinWeight;
  nextBlue -= warmth * 24 * skinWeight;
  return [
    clamp(Math.round(nextRed), 0, 255),
    clamp(Math.round(nextGreen), 0, 255),
    clamp(Math.round(nextBlue), 0, 255),
  ] as const;
}

function featheredEllipse(x: number, y: number, box: NormalizedBox, inner = 0.4) {
  const radiusX = Math.max(box.width / 2, 0.01);
  const radiusY = Math.max(box.height / 2, 0.01);
  const centerX = box.x + radiusX;
  const centerY = box.y + radiusY;
  const distance = Math.sqrt(((x - centerX) / radiusX) ** 2 + ((y - centerY) / radiusY) ** 2);
  return 1 - clamp((distance - inner) / (1 - inner), 0, 1);
}

function srgbToLinear(value: number) {
  const channel = value / 255;
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(value: number) {
  const channel = clamp(value, 0, 1);
  const encoded = channel <= 0.0031308 ? channel * 12.92 : 1.055 * channel ** (1 / 2.4) - 0.055;
  return clamp(Math.round(encoded * 255), 0, 255);
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("照片无法读取，请重新上传。"));
    image.src = source;
  });
}

export async function createAnalysisThumbnail(source: string) {
  const image = await loadImage(source);
  const maximumDimension = 1024;
  const scale = Math.min(1, maximumDimension / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("浏览器无法准备照片分析图。请更新浏览器后重试。");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.82);
}

export async function createGenerationInput(source: string) {
  const image = await loadImage(source);
  const maximumDimension = 2048;
  const scale = Math.min(1, maximumDimension / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("浏览器无法准备生图照片。请更新浏览器后重试。");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.9);
}

function drawOverlayText(context: CanvasRenderingContext2D, width: number, height: number, text: string, position: string) {
  const cleanText = text.trim().slice(0, 80);
  if (!cleanText) return;

  const margin = Math.round(Math.min(width, height) * 0.055);
  const fontSize = Math.round(clamp(Math.min(width, height) * 0.052, 26, 92));
  context.save();
  context.font = `600 ${fontSize}px "PingFang SC", "Microsoft YaHei", sans-serif`;
  context.textBaseline = "top";
  context.shadowColor = "rgba(0, 0, 0, .48)";
  context.shadowBlur = Math.max(4, Math.round(fontSize * 0.12));
  context.lineWidth = Math.max(2, Math.round(fontSize * 0.045));
  context.strokeStyle = "rgba(0, 0, 0, .38)";
  context.fillStyle = "#fffdf7";

  const textWidth = Math.min(context.measureText(cleanText).width, width - margin * 2);
  const isRight = position.includes("右");
  const isBottom = position.includes("下");
  const isCenter = position === "正上方" || position === "正下方" || position === "AI 自动";
  let x = isRight ? width - margin - textWidth : margin;
  if (isCenter) x = (width - textWidth) / 2;
  const y = isBottom ? height - margin - fontSize * 1.25 : margin;
  context.strokeText(cleanText, x, y, width - margin * 2);
  context.fillText(cleanText, x, y, width - margin * 2);
  context.restore();
}

export async function applyPortraitRelight(source: string, spec: PortraitRelightSpec) {
  const image = await loadImage(source);
  const maximumDimension = 3600;
  const scale = Math.min(1, maximumDimension / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("浏览器无法启动照片后期处理。请更新浏览器后重试。");
  context.drawImage(image, 0, 0, width, height);

  const pixels = context.getImageData(0, 0, width, height);
  for (let py = 0; py < height; py += 1) {
    const normalizedY = py / height;
    for (let px = 0; px < width; px += 1) {
      const index = (py * width + px) * 4;
      const normalizedX = px / width;
      const faceWeight = featheredEllipse(normalizedX, normalizedY, spec.faceBox, 0.32);
      const personWeight = featheredEllipse(normalizedX, normalizedY, spec.personBox, 0.48);
      const [nextRed, nextGreen, nextBlue] = relightPixel(
        pixels.data[index], pixels.data[index + 1], pixels.data[index + 2], faceWeight, personWeight, spec,
      );
      pixels.data[index] = nextRed;
      pixels.data[index + 1] = nextGreen;
      pixels.data[index + 2] = nextBlue;
    }
  }

  context.putImageData(pixels, 0, 0);
  if (spec.overlayText) drawOverlayText(context, width, height, spec.overlayText, spec.textPosition || "AI 自动");
  return canvas.toDataURL("image/jpeg", 0.94);
}
