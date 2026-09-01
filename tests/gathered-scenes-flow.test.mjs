import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const routePath = new URL("../app/api/generate/route.ts", import.meta.url);
const runtimePath = new URL("../app/skill-runtime.ts", import.meta.url);
const pagePath = new URL("../app/page.tsx", import.meta.url);
const policyPath = new URL("../app/scene-paper-collage-policy.ts", import.meta.url);

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
  assert.match(route, /SOURCE_BACKGROUND_WHITELIST/);
  assert.match(route, /SOURCE_EVIDENCE/);
  assert.match(route, /摄影域内主体、必要接触或支撑部分和最少关系环境/);
  assert.match(route, /禁止任何绘画处理/);
  assert.match(route, /外部任何可辨场景元素只能来自这一闭集/);
  assert.match(route, /不得自行增加类别、典型场景元素或装饰物/);
  assert.match(route, /P与I合起来铺满整张成图/);
  assert.match(route, /不存在第三块空白画板/);
  assert.match(route, /I占据P之外的全部页面/);
  assert.match(route, /至少两处背景结构或一处宽阔背景表面/);
  assert.match(route, /闭合、不规则摄影岛/);
  assert.match(route, /贯穿画布的撕缝机械分半/);
  assert.match(route, /淡化照片、连续水彩重绘或另一块近似摄影/);
  assert.match(route, /缩略图尺度必须一眼分清自然摄影P和纸上版画I/);
  assert.match(route, /不能留下未处理画板/);
  assert.match(route, /撕口不是固定窗口/);
  assert.match(route, /主体紧边抠图/);
  assert.match(route, /默认优先无字/);

  assert.match(runtime, /横图默认5:3，竖图默认3:5/);
  assert.match(runtime, /通常约28%至58%，绝对不得超过整页60%/);
  assert.match(runtime, /P内部从撕边到撕边只能是原图自然摄影/);
  assert.match(runtime, /禁止任何绘画处理/);
  assert.match(runtime, /SOURCE_BACKGROUND_WHITELIST 场景语义闭集/);
  assert.match(runtime, /绝不能依据地点、题材、主体类别或常见构图补充场景元素/);
  assert.match(runtime, /P之外的全部页面/);
  assert.match(runtime, /不能形成第三块独立空白内容域/);
  assert.match(runtime, /照片贴片感或两个场景拼接感失败/);
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
  assert.match(taskRoute, /photoDomainAnchorPass/);
  assert.match(taskRoute, /observedSubjectBox/);
  assert.match(taskRoute, /observedPhotoDomainBox/);
  assert.match(taskRoute, /4%中心偏移和8%宽高变化是纠偏目标/);
  assert.match(taskRoute, /domainDelta\.x <= 0\.04 && domainDelta\.y <= 0\.04/);
  assert.match(taskRoute, /domainSizeDelta\.width <= 0\.08/);
  assert.match(taskRoute, /photoDomainCoveragePass/);
  assert.match(taskRoute, /photoDomainPurityPass/);
  assert.match(taskRoute, /relationshipBoundaryPass/);
  assert.match(taskRoute, /subjectSeparationPass/);
  assert.match(taskRoute, /outsideBackgroundPresencePass/);
  assert.match(taskRoute, /fullPageBackgroundPass/);
  assert.match(taskRoute, /backgroundPrintStylePass/);
  assert.match(taskRoute, /boundaryContinuityPass/);
  assert.match(taskRoute, /sourceTraceabilityPass/);
  assert.match(taskRoute, /confirmedInventedExteriorObjects/);
  assert.match(taskRoute, /hardBlock/);
  assert.match(taskRoute, /主体相对原图发生了位置、大小、方向或取景变化/);
  assert.match(taskRoute, /纸裁整体位置或大小偏离了原图主体关系域/);
  assert.doesNotMatch(taskRoute, /主体明显不在摄影岛视觉中心附近/);
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
  const taskRoute = await readFile(new URL("../app/api/generate/task/route.ts", import.meta.url), "utf8");

  assert.match(route, /type SceneBackgroundPlan/);
  assert.match(route, /compileSceneBackgroundPlan/);
  assert.match(route, /subjectBox/);
  assert.match(route, /subjectAnchors/);
  assert.match(route, /supportObjects/);
  assert.match(route, /relationshipEvidence/);
  assert.match(route, /constrainPhotoDomainBox/);
  assert.match(route, /geometryBoundTargetPercent/);
  assert.match(route, /photoDomainBox/);
  assert.match(route, /photoDomainAnchorRule/);
  assert.match(route, /relationshipDomainFallback/);
  assert.match(taskRoute, /fallbackDomainBox = relationshipDomainFallback\(subjectBox\)/);
  assert.doesNotMatch(taskRoute, /x: number\(domainBoxSource\.x, 0\.25\)/);
  assert.match(route, /原图完整画幅作为固定坐标系/);
  assert.match(route, /P的整体中心不得偏移超过画布宽高的4%/);
  assert.match(route, /整体宽高不得偏离超过8%/);
  assert.match(route, /不要求主体位于框中心/);
  assert.match(route, /禁止为了版式平衡把P或主体移向左上、中央或任何固定象限/);
  assert.match(route, /主体中心在P内部的固定相对坐标/);
  assert.match(route, /不得把P吸附到左边、上边或任一画布角/);
  assert.match(route, /photoDomainTargetPercent/);
  assert.match(route, /boundaryLogic/);
  assert.match(route, /backgroundZones/);
  assert.match(route, /中心位移不得超过画布宽高的2%/);
  assert.match(route, /宽高变化不得超过3%/);
  assert.match(route, /禁止平移、放大、缩小、旋转、镜像、透视校正、重新取景/);
  assert.match(route, /不要生成后再把原图主体覆盖或粘贴回来/);
  assert.match(route, /objectClass/);
  assert.match(route, /sourceBox/);
  assert.match(route, /visualEvidence/);
  assert.match(route, /confidence/);
  assert.match(route, /backgroundZones 返回1至4项/);
  assert.match(route, /宁可只返回一个高置信场景元素，也不要凑数/);
  assert.doesNotMatch(route, /荷塘应转译|海边转译|桥边转译|古建转译|荷塘至少考虑/);
  assert.doesNotMatch(route, /鸭脚下的局部岩石|人物扶着的栏柱|古建筑群连续的山体基座/);
  assert.match(route, /天然重复结构至少保留三处可辨轮廓或节奏/);
  assert.match(route, /SOURCE_BACKGROUND_WHITELIST（场景语义闭集）/);
  assert.match(route, /任何未列入白名单的可辨场景元素都禁止出现/);
  assert.match(route, /P域之外100%都属于I背景域/);
  assert.match(route, /低密度背景/);
  assert.match(route, /方位、透视、方向、尺度和层级对应/);
  assert.match(route, /背景近乎空白/);
  assert.match(route, /未分配画板/);
  assert.match(route, /照片贴在另一张背景上/);
  assert.match(route, /任何无法匹配 SOURCE_EVIDENCE 的场景语义形状/);
  assert.match(runtime, /I必须来自同一照片P域之外的剩余背景/);
  assert.match(runtime, /形成连续全幅背景场/);
  assert.match(runtime, /任何可辨场景形状无法指回原图均失败/);
});

test("source image is primary evidence and only confident source or geometry failures hard-block", async () => {
  const route = await readFile(routePath, "utf8");
  const taskRoute = await readFile(new URL("../app/api/generate/task/route.ts", import.meta.url), "utf8");
  const page = await readFile(pagePath, "utf8");
  const policy = await readFile(policyPath, "utf8");

  assert.match(route, /allowedBackgroundZones: sceneBackgroundPlan\.backgroundZones\.map/);
  assert.match(route, /sourceBackgroundWhitelist/);
  assert.match(route, /confidence < 0\.55/);
  assert.match(route, /任何未列入SOURCE_BACKGROUND_WHITELIST的可辨场景元素/);
  assert.doesNotMatch(route, /原图没有的楼房，原图没有的栏杆，原图没有的道路，原图没有的桥/);
  assert.match(taskRoute, /exteriorObjectsDetected/);
  assert.match(taskRoute, /confirmedInventedExteriorObjects/);
  assert.match(taskRoute, /uncertainExteriorMarks/);
  assert.match(taskRoute, /allowedMaterialEffects/);
  assert.match(taskRoute, /prohibitedExteriorArtifacts/);
  assert.match(taskRoute, /exteriorElementAudit/);
  assert.match(taskRoute, /verifiedTraceabilityPass/);
  assert.match(taskRoute, /const confidentGeometryFailure = parsed\.subjectGeometryPass === false && obviousMeasuredGeometryDrift/);
  assert.match(taskRoute, /photoDomainSubjectRelationPass/);
  assert.match(taskRoute, /subjectDomainRelationDelta/);
  assert.match(taskRoute, /const confidentDomainAnchorFailure = \(parsed\.photoDomainAnchorPass === false && obviousMeasuredDomainDrift\)/);
  assert.match(taskRoute, /subjectDelta\.x > 0\.08 \|\| subjectDelta\.y > 0\.08/);
  assert.match(taskRoute, /domainDelta\.x > 0\.10 \|\| domainDelta\.y > 0\.10/);
  assert.match(taskRoute, /hardBlock: confidentGeometryFailure \|\| confidentDomainAnchorFailure \|\| !verifiedTraceabilityPass \|\| !artifactCompliancePass/);
  assert.doesNotMatch(taskRoute, /hardBlock: !geometryPass/);
  assert.match(taskRoute, /只有 scene_element 才与第一张原图P域之外逐项核对/);
  assert.match(taskRoute, /拼贴材料永远不能因为原图中没有纸张而令其失败/);
  assert.match(taskRoute, /第一张原图本身是最高优先级证据/);
  assert.match(page, /纸裁外部仍出现原图不存在的场景元素/);
  assert.match(page, /纸张基底、纤维、撕边、印刷和扫描质感不会被当作新增场景元素/);
  assert.match(policy, /SCENE_ELEMENT 场景元素/);
  assert.match(policy, /COLLAGE_MATERIAL 拼贴材料/);
  assert.match(policy, /ABSTRACT_MARK 抽象印痕/);
  assert.match(policy, /PROHIBITED_ARTIFACT 禁止伪影/);
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
