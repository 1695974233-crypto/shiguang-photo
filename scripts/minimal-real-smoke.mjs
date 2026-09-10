import { readFile, writeFile } from "node:fs/promises";
import worker from "../dist/server/index.js";
import { readGenerationResponse } from "../app/generation-transport.ts";

const sourcePath = process.argv[2];
const analysisPath = process.argv[3];
const outputPath = process.argv[4];
const option = process.argv[5];
const planOnly = option === "--plan-only";
const refine = option === "--refine";
const modelOverride = option && !option.startsWith("--") ? option : undefined;
if (!sourcePath || !analysisPath || !outputPath) {
  throw new Error("Usage: minimal-real-smoke.mjs source.jpg analysis.jpg output.jpg [model]");
}
if (modelOverride) {
  process.env.ARK_IMAGE_MODELS = modelOverride;
  process.env.ARK_IMAGE_MODEL = modelOverride;
}

const dataUri = async (filePath) => `data:image/jpeg;base64,${(await readFile(filePath)).toString("base64")}`;
const requestBase = {
  image: await dataUri(sourcePath),
  analysisImage: await dataUri(analysisPath),
  sceneId: "minimal-zine",
  accessCode: process.env.GENERATION_ACCESS_CODE,
  minimalLayoutMode: "original",
  ratio: "portrait",
  instruction: "",
  textPosition: "AI 自动",
  mode: refine ? "refine" : "new",
};
const submit = async (extra) => readGenerationResponse(await worker.fetch(new Request("http://localhost/api/generate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ ...requestBase, ...extra }),
}), {}, { waitUntil() {}, passThroughOnException() {} }));

console.log("plan:start");
let planned;
let plan;
planned = await submit({ stage: "plan" });
plan = JSON.parse(Buffer.from(planned.planToken.split(".")[0], "base64url").toString()).plan;
console.log(JSON.stringify({ photoAnalysis: plan.photoAnalysis, recipe: plan.recipe }, null, 2));
if (planOnly) process.exit(0);
console.log("image:start");
const candidate = await submit({
  stage: "image",
  planToken: planned.planToken,
  qualityCorrection: process.env.MINIMAL_QUALITY_CORRECTION || "Regenerate from the user image as a completely flat editorial print. No drop shadows, raised or curled paper, layered cards, physical craft mockup, or floating decorations. Use a bold partial crop instead of the complete rose plant. Make at least two carriers overlap, intersect, or align as one visual metaphor. Keep the single pure red accent inside that event, and press the short note into its edge. Do not create a second focal point.",
});
const match = candidate.image?.match(/^data:(image\/[^;]+);base64,(.+)$/s);
if (!match) throw new Error("Expected inline image data.");
await writeFile(outputPath, Buffer.from(match[2], "base64"));
console.log(`image:ok model=${candidate.model}`);
console.log("review:start");
const review = await submit({ stage: "review", candidateImage: candidate.image });
const reportPath = outputPath.replace(/\.[^.]+$/, "-report.json");
await writeFile(reportPath, JSON.stringify({
  generatedAt: new Date().toISOString(),
  outputPath,
  model: candidate.model,
  plan,
  qualityWarning: review.qualityWarning,
  qualityCorrection: review.qualityCorrection,
}, null, 2));
console.log(JSON.stringify({ outputPath, reportPath, model: candidate.model, ...review }, null, 2));
