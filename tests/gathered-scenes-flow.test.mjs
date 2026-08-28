import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const routePath = new URL("../app/api/generate/route.ts", import.meta.url);
const runtimePath = new URL("../app/skill-runtime.ts", import.meta.url);
const pagePath = new URL("../app/page.tsx", import.meta.url);

test("gathered scenes directly runs make-scene-paper-collage instead of the legacy local compositor", async () => {
  const route = await readFile(routePath, "utf8");
  const runtime = await readFile(runtimePath, "utf8");
  const page = await readFile(pagePath, "utf8");

  assert.doesNotMatch(route, /segmentPhotoSubjects|volcengine-segmentation|gatheredSegmentation/);
  assert.doesNotMatch(route, /gatheredScenesCoreContract|gatheredScenesTruthContract|gatheredScenesAdaptiveHandoffContract|gatheredScenesBlankAndInkContract/);
  assert.match(route, /const usesLocalComposite = adapter\.id === "abstract-editorial"/);
  assert.doesNotMatch(route, /adapter\.id === "gathered-scenes" && Boolean\(.*masks/);
  assert.match(route, /layout: "structural-memory"/);
  assert.doesNotMatch(route, /layout: adapter\.id === "gathered-scenes" \? "scene-fragment"/);

  assert.match(runtime, /name: "拾景纸刊 · Scene Paper Collage"/);
  assert.match(runtime, /implementation: "个人 Skill 适配"/);
  assert.match(runtime, /直接运行 make-scene-paper-collage 图像编辑工作流/);
  assert.match(page, /个人 Skill · make-scene-paper-collage/);
  assert.match(page, /成图不会再经过旧版语义分割或浏览器二次纸裁/);
});

test("scene paper collage compiler follows the personal skill visual specification", async () => {
  const route = await readFile(routePath, "utf8");
  const runtime = await readFile(runtimePath, "utf8");

  assert.match(route, /const scenePaperCollageContract/);
  assert.match(route, /const scenePaperCollageCompilerContract/);
  assert.match(route, /唯一摄影开口的位置和约45%至65%的主体安全范围/);
  assert.match(route, /finalPrompt 必须按四段编写/);
  assert.match(route, /一至两个将延续到纸面的场景结构/);
  assert.match(route, /最多两种相容印刷处理/);
  assert.match(route, /禁止矩形、圆角矩形、对称徽章、贴纸轮廓、数码蒙版和主体紧边抠图/);
  assert.match(route, /保留大量未印暖象牙白纸/);
  assert.match(route, /强调色可省略/);
  assert.match(route, /默认优先无字/);

  assert.match(runtime, /横图默认输出5:3，竖图默认输出3:5/);
  assert.match(runtime, /一处占页面约45%至65%的主要摄影开口/);
  assert.match(runtime, /主体安全优先/);
  assert.match(runtime, /摄影开口内部保持原照片自然色彩、光线、纹理、身份、脸、表情、姿态、手、解剖、衣服/);
  assert.match(runtime, /最多两种相容的粗网点、复印点、干刷丝网、石墨拓印、浮雕印影或稀疏机械线/);
  assert.match(runtime, /约1%至4%的断续覆盖/);
  assert.match(runtime, /全部二维平整/);
});

test("gathered scenes sends only the edit target and uses skill-native ratios", async () => {
  const route = await readFile(routePath, "utf8");

  assert.match(route, /const styleReferences = adapter\.id === "minimal-zine"/);
  assert.match(route, /const imageInputs = \[body\.image, \.\.\.styleReferences\]/);
  assert.match(route, /generateQwenImageCandidate\([\s\S]*body\.analysisImage \|\| body\.image!/);
  assert.match(route, /size: "1536\*2560"/);
  assert.match(route, /size: "2560\*1536"/);
  assert.match(route, /3:5竖版暖象牙白天然棉纸/);
  assert.match(route, /5:3横版暖象牙白天然棉纸/);
  assert.match(route, /qwenScenePaperCollageContract/);
  assert.match(route, /prompt_extend: false/);
  assert.match(route, /watermark: false/);
});

test("failed collage candidates are corrected once without redesigning successful parts", async () => {
  const route = await readFile(routePath, "utf8");

  assert.match(route, /const shouldAutoRetry = \(adapter\.id === "minimal-zine" \|\| \(adapter\.id === "gathered-scenes" && !usesLocalComposite\)\)/);
  assert.match(route, /review && !review\.pass && review\.correction/);
  assert.match(route, /仅修正这一项/);
  assert.match(route, /不要重新设计成功部分/);
  assert.match(route, /只指出观察到的失败项，不重新设计已成功部分/);
  assert.match(route, /摄影区域明显不是一处主要开口/);
  assert.match(route, /开口是矩形、圆角矩形、对称徽章、贴纸白边或紧贴主体的数码蒙版/);
});
