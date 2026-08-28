function imageMimeType(base64: string) {
  if (base64.startsWith("iVBOR")) return "image/png";
  if (base64.startsWith("UklGR")) return "image/webp";
  return "image/jpeg";
}

export async function inlineImageForBrowser(
  image: string,
  fetchImage: typeof fetch = fetch,
) {
  if (image.startsWith("data:image/")) return image;
  let sourceUrl: URL;
  try {
    sourceUrl = new URL(image);
  } catch {
    throw new Error("模型返回的图片地址无效。");
  }
  if (sourceUrl.protocol !== "https:") throw new Error("模型返回的图片地址不安全。");
  const response = await fetchImage(sourceUrl, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`模型图片下载失败（${response.status}）。`);
  const declaredLength = Number(response.headers.get("content-length") || 0);
  const maximumBytes = 20 * 1024 * 1024;
  if (declaredLength > maximumBytes) throw new Error("模型图片超过浏览器合成上限。");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.length > maximumBytes) throw new Error("模型图片大小异常。");
  const encoded = bytes.toString("base64");
  const responseType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  const mime = responseType === "image/png" || responseType === "image/webp" || responseType === "image/jpeg"
    ? responseType
    : imageMimeType(encoded);
  return `data:${mime};base64,${encoded}`;
}
