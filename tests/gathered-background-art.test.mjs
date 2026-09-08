import assert from "node:assert/strict";
import test from "node:test";
import { parseBackgroundArtDirection, planGatheredBackgroundArt } from "../app/gathered-background-art.ts";
import { buildGatheredBackgroundPrompt } from "../app/gathered-background-prompt.ts";

const plan = {
  subject: "杯子",
  photoDomainBox: { x: 0.3, y: 0.4, width: 0.4, height: 0.5 },
  backgroundZones: [{
    name: "窗边光影", objectClass: "窗框投影", confidence: 0.9,
    sourceBox: { x: 0, y: 0, width: 1, height: 0.3 },
    sourceLocation: "上方桌面", visualEvidence: "斜向暖灰投影，中间有亮缝", direction: "向右下",
  }],
};
const valid = {
  marks: [{ sourceIndex: 1, treatment: "merged_masses", density: "airy" }],
  quietAreas: ["right"],
};

test("planner output cannot inject object prose or alter photo geometry", () => {
  const original = structuredClone(plan);
  const parsed = parseBackgroundArtDirection({ ...valid,
    marks: [{ ...valid.marks[0], retain: "岸边的一排船锚", simplify: "印成五枚图标", ink: "新对象色" }, { ...valid.marks[0], sourceIndex: 99 }],
    quiet: "新增装饰",
    subjectBox: { x: 0 }, prompt: "无来源的大段指令",
  }, 1);
  assert.deepEqual(parsed, valid);
  const prompt = buildGatheredBackgroundPrompt(plan, "横向", parsed);
  assert.match(prompt, /窗框投影：只提炼证据中的原有形态/);
  assert.doesNotMatch(prompt, /船锚|五枚图标|新对象色|新增装饰|无来源的大段指令|subjectBox/);
  assert.deepEqual(plan, original);
});

test("malformed, empty, duplicate and unbound art decisions are rejected or bounded", () => {
  assert.equal(parseBackgroundArtDirection(null, 1), undefined);
  assert.equal(parseBackgroundArtDirection({ marks: [], quietAreas: ["upper"] }, 1), undefined);
  assert.equal(parseBackgroundArtDirection({ ...valid, marks: [{ ...valid.marks[0], sourceIndex: 0 }] }, 1), undefined);
  assert.equal(parseBackgroundArtDirection({ ...valid, quietAreas: ["新增船锚"] }, 1), undefined);
  assert.equal(parseBackgroundArtDirection({ ...valid, marks: [{ ...valid.marks[0], treatment: "draw_anchor" }] }, 1), undefined);
  assert.equal(parseBackgroundArtDirection({ ...valid, marks: [{ ...valid.marks[0], density: "filled" }] }, 1), undefined);
  assert.equal(parseBackgroundArtDirection(valid, 0), undefined);
  assert.deepEqual(parseBackgroundArtDirection({ ...valid, marks: [...valid.marks, ...valid.marks] }, 1), valid);
});

test("background art planning uses factual evidence only and never sends numeric boxes", async () => {
  let calls = 0;
  const art = await planGatheredBackgroundArt({ apiKey: "test-placeholder", modelId: "test-model", image: "data:image/jpeg;base64,test", plan }, async (_url, init) => {
    calls++;
    const payload = JSON.parse(init.body);
    assert.doesNotMatch(JSON.stringify(payload.messages), /sourceBox|photoDomainBox/);
    assert.match(JSON.stringify(payload.messages), /窗框投影/);
    assert.equal(payload.model, "test-model");
    return Response.json({ choices: [{ message: { content: JSON.stringify(valid) } }] });
  });
  assert.equal(calls, 1);
  assert.deepEqual(art, valid);
});

test("missing evidence skips planning and upstream failures safely use the generic contract", async () => {
  const options = { apiKey: "test-placeholder", modelId: "test-model", image: "unused", plan };
  assert.equal(await planGatheredBackgroundArt({ ...options, plan: { ...plan, backgroundZones: [] } }, async () => { throw new Error("must not call"); }), undefined);
  assert.equal(await planGatheredBackgroundArt(options, async () => new Response("unavailable", { status: 503 })), undefined);
  assert.equal(await planGatheredBackgroundArt(options, async () => { throw new Error("offline"); }), undefined);
  assert.equal(await planGatheredBackgroundArt(options, async () => Response.json({ choices: [{ message: { content: "invalid JSON" } }] })), undefined);
});
