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
  assert.match(route, /一至两个将绘画化到纸面的场景结构/);
  assert.match(route, /主印刷场和一个可跨留白分布的次级场景回声/);
  assert.match(route, /最多两种相容印刷处理/);
  assert.match(route, /禁止矩形、圆角矩形、对称徽章、贴纸轮廓、数码蒙版和主体紧边抠图/);
  assert.match(route, /保留约35%至55%的可见暖象牙白裸纸/);
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

test("gathered scenes sends only the original edit target and uses skill-native ratios", async () => {
  const route = await readFile(routePath, "utf8");

  assert.match(route, /const styleReferences = adapter\.id === "minimal-zine"/);
  assert.match(route, /const imageInputs = \[body\.image, \.\.\.styleReferences\]/);
  assert.match(route, /generateQwenImageCandidate\([\s\S]*body\.image!/);
  assert.doesNotMatch(route, /generateQwenImageCandidate\([\s\S]{0,260}body\.analysisImage \|\| body\.image!/);
  assert.match(route, /size: "1152\*1920"/);
  assert.match(route, /size: "1920\*1152"/);
  assert.match(route, /3:5竖版暖象牙白天然棉纸/);
  assert.match(route, /5:3横版暖象牙白天然棉纸/);
  assert.match(route, /qwenScenePaperCollageContract/);
  assert.match(route, /prompt_extend: false/);
  assert.match(route, /watermark: false/);
});

test("gathered scenes uses a short async submission and a separate task poll route", async () => {
  const route = await readFile(routePath, "utf8");
  const page = await readFile(pagePath, "utf8");
  const taskRoute = await readFile(new URL("../app/api/generate/task/route.ts", import.meta.url), "utf8");

  assert.match(route, /X-DashScope-Async/);
  assert.match(route, /startQwenImageTask/);
  assert.match(route, /pendingTask: \{ id: taskId, pollAfterMs: 2500 \}/);
  assert.match(route, /plan = scenePaperCollageFallbackPlan/);
  assert.match(page, /createGenerationInput/);
  assert.match(page, /fetch\("\/api\/generate\/task"/);
  assert.match(page, /10 \* 60_000/);
  assert.match(taskRoute, /task_status/);
  assert.match(taskRoute, /inlineImageForBrowser/);
});

test("empty or malformed photo analysis falls back without blocking collage generation", async () => {
  const route = await readFile(routePath, "utf8");

  assert.match(route, /function compilerMessageText/);
  assert.match(route, /Array\.isArray\(content\)/);
  assert.match(route, /function scenePaperCollageFallbackPlan/);
  assert.match(route, /if \(adapter\.id === "gathered-scenes"\)[\s\S]*plan = scenePaperCollageFallbackPlan\(body, instruction \|\| "", backgroundPlan\)/);
  assert.match(route, /一处占页面约45%至65%/);
  assert.match(route, /只从原图中选择一至两个清楚可见/);
  assert.match(route, /max_tokens: adapter\.id === "gathered-scenes" \? 4200/);
});

test("paper background uses active source-derived primary and secondary print fields", async () => {
  const route = await readFile(routePath, "utf8");
  const runtime = await readFile(runtimePath, "utf8");

  assert.match(route, /type SceneBackgroundPlan/);
  assert.match(route, /compileSceneBackgroundPlan/);
  assert.match(route, /motifs 为1至2项，优先给出2项/);
  assert.match(route, /原照片背景的绘画化转译/);
  assert.match(route, /主印刷场必须与对应景物所在的撕口边缘相接/);
  assert.match(route, /次级场景回声/);
  assert.match(route, /放大约1\.5至3倍/);
  assert.match(route, /影响约45%至65%的可见纸面/);
  assert.match(route, /实际墨覆盖约18%至32%/);
  assert.match(route, /不能退化成只有几根边缘短线或大面积空白/);
  assert.match(route, /通用城市素描，库存树木/);
  assert.match(route, /建筑蓝图，地图线，工程草图/);
  assert.match(route, /每一个可辨认形状都必须能指回原图/);
  assert.match(runtime, /开口外必须把原照片背景绘画化/);
  assert.match(runtime, /一个与对应撕口相接的主印刷场/);
  assert.match(runtime, /可隔着留白分布到另一侧/);
  assert.match(runtime, /只有细小边缘毛刺、几根零星短划或近乎空白直接判定失败/);
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
