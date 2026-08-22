import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Shiguang photo studio", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>拾光后期｜AI 照片风格创作<\/title>/);
  assert.match(html, /把普通照片/);
  assert.match(html, /体验邀请码/);
  assert.match(html, /type="password"/);
  assert.match(html, /极简 Zine/);
  assert.match(html, /自然人像补光/);
  assert.doesNotMatch(html, /ARK_API_KEY|GENERATION_ACCESS_CODES|SG-[A-F0-9]{8}/);
});

test("renders all ten selectable scenes", async () => {
  const response = await render();
  const html = await response.text();
  const sceneButtons = html.match(/class="scene-button(?: selected)?"/g) ?? [];
  assert.equal(sceneButtons.length, 10);
  assert.match(html, /拾景纸刊/);
  assert.doesNotMatch(html, /层叠撕纸刊/);
});
