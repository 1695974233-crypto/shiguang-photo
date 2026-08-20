import { writeFileSync } from "node:fs";
import worker from "../dist/server/index.js";

const response = await worker.fetch(
  new Request("https://shiguang.local/"),
  { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
  {
    waitUntil(promise) {
      Promise.resolve(promise).catch(() => {});
    },
    passThroughOnException() {},
  },
);

if (!response.ok) throw new Error(`首页预渲染失败：HTTP ${response.status}`);
writeFileSync(new URL("../dist/client/index.html", import.meta.url), await response.text());
