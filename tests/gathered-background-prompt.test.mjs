import assert from "node:assert/strict";
import test from "node:test";
import { buildGatheredBackgroundPrompt, selectBackgroundEvidence } from "../app/gathered-background-prompt.ts";

const zone = (objectClass, overrides = {}) => ({
  name: objectClass,
  objectClass,
  sourceBox: { x: 0, y: 0.5, width: 1, height: 0.3 },
  sourceLocation: "原图下半部",
  visualEvidence: `${objectClass}的可见轮廓`,
  direction: "横向延伸",
  confidence: 0.95,
  ...overrides,
});
const plan = (backgroundZones) => ({
  subject: "海边人物",
  photoDomainBox: { x: 0.4, y: 0.3, width: 0.5, height: 0.6 },
  backgroundZones,
  quietBackgroundZone: "不应作为证据传递的装饰建议",
});
const whitelist = (prompt) => JSON.parse(prompt.match(/SOURCE_BACKGROUND_WHITELIST=(\[[^\n]*?\])。/)[1]);

test("background selection deduplicates source labels without a scene catalogue or mutation", () => {
  const zones = [zone("玻璃幕墙"), zone(" 玻璃幕墙 ", { confidence: 0.91 }), zone("货架"), zone("地面")];
  const original = structuredClone(zones);
  assert.deepEqual(selectBackgroundEvidence(zones).map((z) => z.objectClass), ["玻璃幕墙", "货架", "地面"]);
  assert.deepEqual(zones, original);
});

test("unverified objects and invalid evidence cannot enter the image prompt whitelist", () => {
  const p = buildGatheredBackgroundPrompt(plan([
    zone("海面"), zone("船锚", { confidence: 0.55 }),
    zone("帆船", { confidence: Number.NaN }), zone("灯塔", { visualEvidence: "" }),
    zone("码头", { sourceBox: { x: 0, y: 0, width: 0, height: 0.2 } }),
    zone("假背景框", { sourceBox: { x: -0.3, y: 0, width: 1, height: 1 } }),
  ]), "横向");
  assert.deepEqual(whitelist(p), ["海面"]);
  assert.doesNotMatch(p, /船锚|帆船|灯塔|码头|锚点|假背景框/);
  assert.match(p, /可辨场景对象的闭集/);
  assert.match(p, /不得靠题材联想添加/);
});

test("only factual evidence is compiled, not per-zone styling or quiet-zone suggestions", () => {
  const input = plan([zone("湖面", { treatment: "叠加船锚图案与彩色印章" })]);
  const original = structuredClone(input);
  const p = buildGatheredBackgroundPrompt(input, "横向");
  assert.deepEqual(whitelist(p), ["湖面"]);
  assert.match(p, /湖面的可见轮廓/);
  assert.doesNotMatch(p, /sourceBox|photoDomainBox|左40%|宽50%/);
  assert.doesNotMatch(p, /叠加船锚|不应作为证据/);
  assert.deepEqual(input, original);
});

test("complexity is handled by source-derived grouping, not fixed colour or giant objects", () => {
  const p = buildGatheredBackgroundPrompt(plan([
    zone("水生植物叶片"), zone("荷叶群", { confidence: 0.92 }), zone("水面"), zone("岩石"),
  ]), "竖向");
  assert.deepEqual(whitelist(p), ["水生植物叶片", "水面", "岩石", "荷叶群"]);
  assert.match(p, /一个主视觉组/);
  assert.match(p, /不排列一枚枚完整印章/);
  assert.match(p, /一至两块连通的大静区/);
  assert.match(p, /同一块印面内部的缺墨/);
  assert.match(p, /不强加橙线/);
  assert.match(p, /不把一群物体替换成一个巨型物体/);
  assert.match(p, /不按对象类别套固定配色/);
  assert.doesNotMatch(p, /#[a-f\d]{6}|85%至95%|一块有几处大缺口/i);
  assert.doesNotMatch(p, /3至7处|加入且只加入|深墨锚点/);
});

test("plain full-frame backgrounds remain valid evidence without inventing motifs", () => {
  const p = buildGatheredBackgroundPrompt(plan([zone("灰色墙面", {
    sourceBox: { x: 0, y: 0, width: 1, height: 1 },
    visualEvidence: "无具体图案的灰色表面，向右逐渐变亮",
  })]), "横向");
  assert.deepEqual(whitelist(p), ["灰色墙面"]);
  assert.match(p, /简单背景减少笔墨/);
  assert.match(p, /无具体图案的灰色表面/);
});

test("quiet-paper and omission rules are unconditional even with no sky evidence", () => {
  const p = buildGatheredBackgroundPrompt(plan([zone("金属管线")]), "竖向");
  assert.match(p, /未选部分及原图低信息区域以连续暖纸表现/);
  assert.match(p, /不得补完场景/);
  assert.match(p, /不把范围填成矩形色板/);
});

test("unseen indoor, industrial and natural classes share one rendering contract", () => {
  for (const objectClass of ["窗帘", "钢梁", "陶瓷餐盘", "沙丘", "雪地", "玻璃反光", "轨道", "书架", "石墙"]) {
    const input = plan([zone(objectClass)]);
    const original = structuredClone(input);
    const p = buildGatheredBackgroundPrompt(input, "横向");
    assert.deepEqual(whitelist(p), [objectClass]);
    assert.match(p, /当前照片背景的实际颜色和明暗提取/);
    assert.doesNotMatch(p, /鸭子|颐和园|荷叶|seaside|palace|\.jpe?g|#[a-f\d]{6}/i);
    assert.deepEqual(input, original);
  }
});

test("empty evidence is not replaced with generic scene motifs", () => {
  const p = buildGatheredBackgroundPrompt(plan([]), "竖向");
  assert.deepEqual(whitelist(p), []);
  assert.match(p, /若白名单为空/);
  assert.match(p, /不得推断任何对象/);
});
