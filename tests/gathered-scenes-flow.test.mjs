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
  assert.match(page, /成图不会后贴原图主体/);
});

test("scene paper collage compiler enforces the source-scene two-material partition", async () => {
  const route = await readFile(routePath, "utf8");
  const runtime = await readFile(runtimePath, "utf8");

  assert.match(route, /const scenePaperCollageContract/);
  assert.match(route, /const scenePaperCollageCompilerContract/);
  assert.match(route, /摄影域通常28%至58%，绝对不得超过60%/);
  assert.match(route, /finalPrompt 必须按四段编写/);
  assert.match(route, /主体—支撑物—背景关系/);
  assert.match(route, /摄影域内主体、必要接触\/支撑物和最少关系环境/);
  assert.match(route, /禁止任何绘画、网点、素描、干刷或透明覆盖/);
  assert.match(route, /背景拆成二至四个真实区域\/结构家族/);
  assert.match(route, /至少三个方向/);
  assert.match(route, /撕口不是固定窗口/);
  assert.match(route, /主体紧边抠图/);
  assert.match(route, /默认优先无字/);

  assert.match(runtime, /横图默认5:3，竖图默认3:5/);
  assert.match(runtime, /通常约28%至58%，绝对不得超过整页60%/);
  assert.match(runtime, /P内部从撕边到撕边只能是原图自然摄影/);
  assert.match(runtime, /禁止网点、素描、干刷、拓印、透明颜料/);
  assert.match(runtime, /最多两种相容的粗网点、复印点、干刷丝网、石墨拓印、浮雕印影或稀疏机械线/);
  assert.match(runtime, /至少三个外部方向/);
  assert.match(runtime, /成品二维平整/);
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
  assert.match(route, /pendingTask: \{[\s\S]{0,160}id: taskId,[\s\S]{0,80}pollAfterMs: 2500/);
  assert.match(route, /plan = scenePaperCollageFallbackPlan/);
  assert.match(page, /createGenerationInput/);
  assert.match(page, /fetch\("\/api\/generate\/task"/);
  assert.match(page, /sourceImage: analysisImage/);
  assert.match(page, /reviewContext: data\.pendingTask\.reviewContext/);
  assert.match(page, /automaticRetryAttempt < 1/);
  assert.match(page, /await requestGeneration\(mode, refinement, data\.qualityCorrection, automaticRetryAttempt \+ 1\)/);
  assert.match(page, /10 \* 60_000/);
  assert.match(taskRoute, /task_status/);
  assert.match(taskRoute, /inlineImageForBrowser/);
  assert.match(taskRoute, /reviewScenePaperCollage/);
  assert.match(taskRoute, /subjectGeometryPass/);
  assert.match(taskRoute, /photoDomainCoveragePass/);
  assert.match(taskRoute, /photoDomainPurityPass/);
  assert.match(taskRoute, /relationshipBoundaryPass/);
  assert.match(taskRoute, /outsideBackgroundPresencePass/);
  assert.match(taskRoute, /sourceTraceabilityPass/);
  assert.match(taskRoute, /shouldRetry/);
});

test("empty or malformed photo analysis falls back without blocking collage generation", async () => {
  const route = await readFile(routePath, "utf8");

  assert.match(route, /function compilerMessageText/);
  assert.match(route, /Array\.isArray\(content\)/);
  assert.match(route, /function scenePaperCollageFallbackPlan/);
  assert.match(route, /if \(adapter\.id === "gathered-scenes"\)[\s\S]*plan = scenePaperCollageFallbackPlan\(body, instruction \|\| "", sceneBackgroundPlan\)/);
  assert.match(route, /目标约28%至58%，硬上限60%/);
  assert.match(route, /只从P域之外原照片背景/);
  assert.match(route, /max_tokens: adapter\.id === "gathered-scenes" \? 4200/);
});

test("relationship analysis separates the photo domain from source-derived background zones", async () => {
  const route = await readFile(routePath, "utf8");
  const runtime = await readFile(runtimePath, "utf8");

  assert.match(route, /type SceneBackgroundPlan/);
  assert.match(route, /compileSceneBackgroundPlan/);
  assert.match(route, /subjectBox/);
  assert.match(route, /subjectAnchors/);
  assert.match(route, /supportObjects/);
  assert.match(route, /photoDomainBox/);
  assert.match(route, /photoDomainTargetPercent/);
  assert.match(route, /boundaryLogic/);
  assert.match(route, /backgroundZones/);
  assert.match(route, /中心位移不得超过画布宽高的2%/);
  assert.match(route, /宽高变化不得超过3%/);
  assert.match(route, /禁止平移、放大、缩小、旋转、镜像、透视校正、重新取景/);
  assert.match(route, /不要生成后再把原图主体覆盖或粘贴回来/);
  assert.match(route, /鸭脚下的局部岩石/);
  assert.match(route, /人物扶着的栏柱/);
  assert.match(route, /古建筑群连续的山体基座/);
  assert.match(route, /backgroundZones 返回2至4项/);
  assert.match(route, /荷塘至少考虑荷叶\/水面\/岩石/);
  assert.match(route, /天然重复结构至少保留三处可辨轮廓或节奏/);
  assert.match(route, /P域之外只允许转译这些原图背景区域/);
  assert.match(route, /至少三个方向或跨两侧加远端/);
  assert.match(route, /影响约45%至75%的外部纸面/);
  assert.match(route, /实际墨覆盖约16%至32%/);
  assert.match(route, /背景近乎空白/);
  assert.match(route, /通用城市素描，库存树木/);
  assert.match(route, /建筑蓝图，地图线，工程草图/);
  assert.match(route, /无法从原图指出来源/);
  assert.match(runtime, /I必须来自同一照片P域之外的剩余背景/);
  assert.match(runtime, /主印刷场与对应撕边相接/);
  assert.match(runtime, /近乎空白、只有一侧或零星短线失败/);
});

test("failed collage candidates are corrected once without redesigning successful parts", async () => {
  const route = await readFile(routePath, "utf8");

  assert.match(route, /const shouldAutoRetry = \(adapter\.id === "minimal-zine" \|\| \(adapter\.id === "gathered-scenes" && !usesLocalComposite\)\)/);
  assert.match(route, /review && !review\.pass && review\.correction/);
  assert.match(route, /仅修正这一项/);
  assert.match(route, /不要重新设计成功部分/);
  assert.match(route, /只指出观察到的失败项，不重新设计已成功部分/);
  assert.match(route, /只有一处摄影域/);
  assert.match(route, /摄影域超过整页60%/);
  assert.match(route, /摄影域内部任何明显网点、素描、干刷、拓印、透明颜料或局部重绘/);
});
