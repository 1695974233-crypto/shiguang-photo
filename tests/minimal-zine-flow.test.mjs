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
  assert.match(page, /当前玫瑰图是 GitHub 原版双面板实测成品/);
  assert.match(page, /它只用于页面预览，不会作为生成参考图/);
  assert.match(page, /minimal-zine\.png/);
  assert.match(page, /GitHub 原版/);
  assert.match(page, /自定义放大版/);
  assert.match(page, /useState<"original" \| "enlarged">\("original"\)/);
  assert.match(page, /minimalLayoutMode/);
  assert.match(runtime, /GitHub 原版 Minimal Zine Poster v0\.3\.1/);
  assert.match(runtime, /默认运行“GitHub 原版”/);
  assert.match(runtime, /视觉隐喻/);
  assert.match(runtime, /焦点载体/);
  assert.match(runtime, /自定义放大版/);
  assert.match(runtime, /无字时必须用照片裁片与单色色块/);
  assert.match(runtime, /禁止把单张网页预览图作为生成参考/);
  assert.match(runtime, /https:\/\/github\.com\/LiamGvchi\/gc-minimal-zine-poster/);
  assert.match(route, /严格使用八段斜杠记录/);
  assert.match(route, /GitHub 原版：默认3:5竖版/);
  assert.match(route, /自定义放大版：强制3:5竖版/);
  assert.match(route, /禁止只把整张照片或完整主体缩小贴在纸上/);
  assert.match(route, /输入图是用户唯一的 edit target，不存在第二张风格参考图/);
  assert.match(route, /极简 Zine 方案没有完成八段变化配方/);
  assert.match(route, /adapter\.id === "minimal-zine" \? 0\.48/);
  assert.match(route, /minimalOriginalVariants\[randomInt\(minimalOriginalVariants\.length\)\]/);
  assert.match(route, /不得有投影、翘角、厚度、抬起纸片、层叠纸卡或实体手工样机深度/);
  assert.match(route, /出现任何可见投影、悬浮纸片、翘边、厚纸层或实体拼贴样机深度时总分不得超过58/);
  assert.match(route, /游离于主视觉簇之外形成第二视觉事件/);
  assert.doesNotMatch(route, /previewStyleReference\("minimal-zine\.png"\)/);
  assert.match(route, /adapter\.id === "minimal-zine" \|\| \(adapter\.id === "gathered-scenes" && !usesLocalComposite\)/);
  assert.doesNotMatch(route, /minimalLayoutMode === "random"/);
  assert.doesNotMatch(route, /minimalLayoutMode === "locked"/);
  assert.doesNotMatch(runtime, /P 是一块占画面约25%至42%的连续摄影材料/);
  assert.doesNotMatch(route, /anchored-bleed-internal-seam/);
});
