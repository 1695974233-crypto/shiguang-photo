import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pagePath = new URL("../app/page.tsx", import.meta.url);
const routePath = new URL("../app/api/generate/route.ts", import.meta.url);
const runtimePath = new URL("../app/skill-runtime.ts", import.meta.url);

test("minimal zine follows the GitHub v0.3.1 sparse editorial contract", async () => {
  const page = await readFile(pagePath, "utf8");
  const route = await readFile(routePath, "utf8");
  const runtime = await readFile(runtimePath, "utf8");

  assert.match(page, /大片留白 · 微型编辑/);
  assert.match(page, /70%–90% 为开放纸面/);
  assert.match(page, /minimal-zine\.png/);
  assert.match(runtime, /GitHub 原版 Minimal Zine Poster v0\.3\.1/);
  assert.match(runtime, /70%至90%应读作开放纸面/);
  assert.match(runtime, /约占8%至25%的主要视觉事件/);
  assert.match(runtime, /https:\/\/github\.com\/LiamGvchi\/gc-minimal-zine-poster/);
  assert.match(route, /只学习暖白纸、大片留白、小视觉事件、短字、印刷颗粒和单一高纯强调色/);
  assert.match(route, /不要复制网页案例的玫瑰、RED STAYS、构图或颜色/);
  assert.match(route, /previewStyleReference\("minimal-zine\.png"\)/);
  assert.match(route, /adapter\.id === "minimal-zine" \|\| \(adapter\.id === "gathered-scenes" && !usesLocalComposite\)/);
  assert.doesNotMatch(runtime, /P 是一块占画面约25%至42%的连续摄影材料/);
  assert.doesNotMatch(route, /anchored-bleed-internal-seam/);
});
