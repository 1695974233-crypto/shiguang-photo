// Heartbeats keep long model calls active without repeating a chargeable request.
export function streamResult(run: () => Promise<Response>, heartbeatMs = 10_000): Response {
  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setInterval>;
  let closed = false;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (value: unknown) => { if (!closed) controller.enqueue(encoder.encode(JSON.stringify(value) + "\n")); };
      send({ type: "heartbeat" });
      timer = setInterval(() => send({ type: "heartbeat" }), heartbeatMs);
      void run().then(async (response) => {
        send({ type: "result", data: await response.json() });
      }).catch(() => {
        send({ type: "result", data: { error: "连接未能完成，未自动重复生图。请稍后手动尝试。" } });
      }).finally(() => {
        clearInterval(timer);
        if (!closed) { closed = true; controller.close(); }
      });
    },
    cancel() { closed = true; clearInterval(timer); },
  });
  return new Response(body, { headers: {
    "Content-Type": "application/x-ndjson; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    "X-Accel-Buffering": "no",
  } });
}

export async function readGenerationResponse<T>(response: Response): Promise<T> {
  const connectionError = "生成连接中断，无法确认本次生图结果；没有自动重复提交。请稍后手动尝试。";
  if (!response.headers.get("content-type")?.includes("application/x-ndjson")) {
    let value;
    try { value = JSON.parse(await response.text()); }
    catch { throw new Error(`服务暂时未返回有效结果（HTTP ${response.status}），没有自动重复生图。`); }
    if (!response.ok) throw new Error(value.error || `请求失败（HTTP ${response.status}）。`);
    return value as T;
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error(connectionError);
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read().catch(() => { throw new Error(connectionError); });
      buffer += decoder.decode(value, { stream: !done });
      let newline;
      while ((newline = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newline); buffer = buffer.slice(newline + 1);
        if (!line.trim()) continue;
        const event = JSON.parse(line);
        if (event.type === "result") {
          if (event.data.error) throw new Error(event.data.error);
          return event.data as T;
        }
      }
      if (done) throw new Error(connectionError);
    }
  } finally { reader.releaseLock(); }
}
