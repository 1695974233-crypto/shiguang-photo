import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pagePath = new URL("../app/page.tsx", import.meta.url);
const routePath = new URL("../app/api/generate/route.ts", import.meta.url);
const runtimePath = new URL("../app/skill-runtime.ts", import.meta.url);

test("minimal zine uses intact photo, authored print, paper, and structural color", async () => {
  const page = await readFile(pagePath, "utf8");
  const route = await readFile(routePath, "utf8");
  const runtime = await readFile(runtimePath, "utf8");

  assert.match(page, /完整摄影 · 非具象印刷场/);
  assert.match(page, /照片始终保持为一块未滤镜化的真实材料/);
  assert.match(runtime, /P 是一块占画面约25%至42%的连续摄影材料/);
  assert.match(runtime, /每个主要插画母题至少执行两次结构变换/);
  assert.match(runtime, /同时介入中性插画以及撕缝或画布边缘/);
  assert.match(route, /Keep the retained photograph as one intact, natural, unfiltered printed fragment/);
  assert.match(route, /anchored-bleed-internal-seam/);
  assert.match(route, /照片内部海报化、阈值化、矢量化、选择性改色、语义分割/);
  assert.match(route, /adapter\.id === "minimal-zine" \|\| \(adapter\.id === "gathered-scenes" && !usesLocalComposite\)/);
  assert.doesNotMatch(runtime, /72%至88%/);
  assert.doesNotMatch(route, /MIT 许可项目 README/);
});
