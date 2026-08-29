import { inlineImageForBrowser } from "../../../inline-image";

type TaskRequest = {
  taskId?: string;
  accessCode?: string;
};

type DashScopeTaskResponse = {
  output?: {
    task_id?: string;
    task_status?: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELED" | "UNKNOWN";
    choices?: Array<{ message?: { content?: Array<{ image?: string }> } }>;
    code?: string;
    message?: string;
  };
  usage?: unknown;
  code?: string;
  message?: string;
};

function codesMatch(received: string, expected: string) {
  const left = new TextEncoder().encode(received);
  const right = new TextEncoder().encode(expected);
  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return difference === 0;
}

function dashscopeTaskEndpoint(taskId: string) {
  const explicit = process.env.DASHSCOPE_TASK_ENDPOINT?.trim();
  if (explicit) return `${explicit.replace(/\/$/, "")}/${encodeURIComponent(taskId)}`;
  const generationEndpoint = process.env.DASHSCOPE_ASYNC_IMAGE_ENDPOINT?.trim()
    || process.env.DASHSCOPE_IMAGE_ENDPOINT?.trim()
    || "https://dashscope.aliyuncs.com/api/v1/services/aigc/image-generation/generation";
  const url = new URL(generationEndpoint);
  const apiIndex = url.pathname.indexOf("/api/v1/");
  url.pathname = `${apiIndex >= 0 ? url.pathname.slice(0, apiIndex) : ""}/api/v1/tasks/${encodeURIComponent(taskId)}`;
  url.search = "";
  return url.toString();
}

export async function POST(request: Request) {
  let body: TaskRequest;
  try { body = await request.json() as TaskRequest; }
  catch { return Response.json({ error: "任务查询内容无法读取。" }, { status: 400 }); }

  const accessCodes = [
    ...(process.env.GENERATION_ACCESS_CODES?.split(",") ?? []),
    process.env.GENERATION_ACCESS_CODE ?? "",
  ].map((code) => code.trim()).filter(Boolean);
  if (!body.accessCode || !accessCodes.some((code) => codesMatch(body.accessCode!.trim(), code))) {
    return Response.json({ error: "邀请码不正确，请检查后重新输入。" }, { status: 401 });
  }
  if (!body.taskId || !/^[A-Za-z0-9_-]{8,128}$/.test(body.taskId)) {
    return Response.json({ error: "生图任务编号无效。" }, { status: 400 });
  }
  const apiKey = process.env.DASHSCOPE_API_KEY?.trim();
  if (!apiKey) return Response.json({ error: "拾景纸刊异步生图尚未配置。" }, { status: 503 });

  try {
    const response = await fetch(dashscopeTaskEndpoint(body.taskId), {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(20_000),
    });
    const data = await response.json() as DashScopeTaskResponse;
    if (!response.ok) throw new Error(data.message || data.output?.message || data.code || data.output?.code || `任务查询失败（${response.status}）。`);
    const status = data.output?.task_status;
    if (status === "PENDING" || status === "RUNNING") {
      return Response.json({ status: "pending", taskStatus: status });
    }
    if (status !== "SUCCEEDED") {
      throw new Error(data.output?.message || data.output?.code || `生图任务状态为 ${status || "UNKNOWN"}。`);
    }
    const imageUrl = data.output?.choices?.[0]?.message?.content?.find((item) => item.image)?.image;
    if (!imageUrl) throw new Error("生图任务完成了，但没有返回图片。");
    const image = await inlineImageForBrowser(imageUrl);
    return Response.json({ status: "succeeded", image, usage: data.usage });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "任务查询失败。";
    return Response.json({ error: reason }, { status: 502 });
  }
}
