import assert from "node:assert/strict";
import test from "node:test";

import { inlineImageForBrowser } from "../app/inline-image.ts";

test("remote model images are converted to browser-safe data URIs", async () => {
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB", "base64");
  const result = await inlineImageForBrowser("https://example.com/qwen-result.png", async (url) => {
    assert.equal(String(url), "https://example.com/qwen-result.png");
    return new Response(png, { status: 200, headers: { "content-type": "image/png" } });
  });
  assert.equal(result, `data:image/png;base64,${png.toString("base64")}`);
});

test("existing data URIs pass through without another download", async () => {
  const input = "data:image/jpeg;base64,AAAA";
  const result = await inlineImageForBrowser(input, async () => {
    throw new Error("fetch should not run");
  });
  assert.equal(result, input);
});

test("non-HTTPS model image URLs are rejected", async () => {
  await assert.rejects(() => inlineImageForBrowser("http://example.com/result.png"), /图片地址不安全/);
});
