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
  assert.match(page, /固定放大版/);
  assert.match(page, /随机构图/);
  assert.match(page, /minimalLayoutMode/);
  assert.match(runtime, /GitHub 原版 Minimal Zine Poster v0\.3\.1/);
  assert.match(runtime, /整体外接框占全画布22%至25%/);
  assert.match(runtime, /视觉簇放宽到8%至25%/);
  assert.match(runtime, /https:\/\/github\.com\/LiamGvchi\/gc-minimal-zine-poster/);
  assert.match(route, /视觉簇固定在左下区域/);
  assert.match(route, /整体外接框必须占全画布22%至25%/);
  assert.match(route, /低于20%的过小照片/);
  assert.match(route, /固定放大版与随机构图均必须完全无字/);
  assert.match(route, /用户主动选择随机构图/);
  assert.match(route, /最近间距不得超过画布短边3%/);
  assert.match(route, /previewStyleReference\("minimal-zine\.png"\)/);
  assert.match(route, /adapter\.id === "minimal-zine" \|\| \(adapter\.id === "gathered-scenes" && !usesLocalComposite\)/);
  assert.doesNotMatch(runtime, /P 是一块占画面约25%至42%的连续摄影材料/);
  assert.doesNotMatch(route, /anchored-bleed-internal-seam/);
});
