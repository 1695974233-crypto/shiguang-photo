import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const routePath = new URL("../app/api/generate/route.ts", import.meta.url);
const runtimePath = new URL("../app/skill-runtime.ts", import.meta.url);
const pagePath = new URL("../app/page.tsx", import.meta.url);

test("gathered scenes uses an isolated authored background plate plus deterministic source-pixel composite", async () => {
  const route = await readFile(routePath, "utf8");
  const runtime = await readFile(runtimePath, "utf8");
  const page = await readFile(pagePath, "utf8");

  assert.doesNotMatch(route, /segmentPhotoSubjects/);
  assert.match(route, /背景底板 \+ 原像素合成/);
  assert.match(route, /layout: "scene-fragment"/);
  assert.match(route, /backgroundLayerMode: backgroundPlate \? "authored-plate"/);
  assert.match(route, /modelLayerStrength: backgroundPlate \? 0\.92 : 0/);
  assert.match(route, /buildGatheredBackgroundPrompt\(plan, orientation, art\)/);
  assert.match(route, /backgroundZones: sceneBackgroundPlan\.backgroundZones\.map/);
  assert.match(route, /photoAnchors: \[/);
  assert.match(route, /\.\.\.sceneBackgroundPlan\.subjectBox/);
  assert.match(route, /photoEvidenceType: "relational-region"/);
  assert.match(route, /shouldRetry: false/);
  assert.match(route, /hardBlock: false/);
  assert.match(runtime, /name: "拾景纸刊 · Scene Paper Collage"/);
  assert.match(page, /applyRealScenePaperComposite\(inputImage, data\.image \|\| inputImage, data\.localComposite\)/);
});

test("gathered scenes generates only a background plate and safely falls back locally", async () => {
  const route = await readFile(routePath, "utf8");
  const prompt = await readFile(new URL("../app/gathered-background-prompt.ts", import.meta.url), "utf8");

  assert.match(route, /if \(adapter\.id === "gathered-scenes" && sceneBackgroundPlan\) \{[\s\S]*return Response\.json/);
  assert.match(route, /避免产生主体偏移/);
  assert.match(route, /generateGatheredBackgroundPlate/);
  assert.match(route, /await planGatheredBackgroundArt/);
  assert.match(prompt, /不得描绘、复制、替换或新增主要主体/);
  assert.match(prompt, /不得生成主体剪影或照片区域/);
  assert.match(prompt, /不得在底板上画出洞口、撕边、轮廓圈或相框/);
  assert.match(prompt, /印迹从原有景物的方向向空纸中断续消隐/);
  assert.match(route, /本地背景降级 \+ 原像素合成/);
  assert.match(route, /浏览器随后才从上传照片的原始同坐标像素覆盖主体/);
  assert.doesNotMatch(route, /拾景纸刊任务没有成功提交/);
  assert.doesNotMatch(route, /const dashscopeKey = process\.env\.DASHSCOPE_API_KEY/);
});

test("relationship analysis makes the dedicated geometry pass authoritative and keeps one semantic model stage", async () => {
  const route = await readFile(routePath, "utf8");

  assert.match(route, /function compileStableSceneBackgroundPlan/);
  assert.match(route, /compileSceneBackgroundPlan\(apiKey, body, "scene-analysis"\)/);
  assert.match(route, /compileSceneBackgroundPlan\(apiKey, body, "geometry-audit"\)/);
  assert.match(route, /mergeStableScenePlans\(scenePlan, geometryPlan, geometryPlan\)/);
  assert.match(route, /Coverage audit is a failover/);
  assert.match(route, /subjectFrameContact/);
  assert.match(route, /closeUnclippedPhotoDomain/);
  assert.match(route, /doubao-seed-2-0-lite-260428/);
  assert.match(route, /模型依据纸裁外背景证据/);
  assert.match(route, /浏览器随后才从上传照片的原始同坐标像素覆盖主体/);
});

test("the source scene is split into one bounded photo island and a full-page print field", async () => {
  const route = await readFile(routePath, "utf8");
  const runtime = await readFile(runtimePath, "utf8");

  assert.match(route, /subjectBox 紧贴主体本身/);
  assert.match(route, /relationshipEvidence/);
  assert.match(route, /constrainPhotoDomainBox/);
  assert.match(route, /不得把P吸附到左边、上边或任一画布角/);
  assert.match(route, /P域之外100%都属于I背景域/);
  assert.match(route, /粗网点、干刷丝网、石墨拓印、稀疏机械线/);
  assert.match(route, /gatheredIllustrationGrammar/);
  assert.match(runtime, /I必须来自同一照片P域之外的剩余背景/);
});

test("stable gathered scenes keeps the original aspect ratio in the client", async () => {
  const page = await readFile(pagePath, "utf8");

  assert.match(page, /if \(scene\.id === "gathered-scenes"\) setRatio\("original"\)/);
  assert.match(page, /selectedScene\?\.id === "gathered-scenes" && item\.id !== "original"/);
  assert.match(page, /保持原图比例与完整坐标/);
  assert.match(page, /保持原图比例 · 原像素固定纸裁/);
});

test("local composite responses are valid without a generated image or VLM review loop", async () => {
  const page = await readFile(pagePath, "utf8");

  assert.match(page, /!data\.image && !data\.localEdit && !data\.localComposite/);
  assert.match(page, /!data\.localComposite && data\.shouldRetry/);
  assert.match(page, /主体使用原图同坐标像素/);
  assert.match(page, /纸裁按主体与支撑关系生成/);
});
