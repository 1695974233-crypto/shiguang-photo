import { skillAdapters } from "../../skill-runtime";

type GenerateRequest = {
  image?: string;
  sceneId?: string;
  accessCode?: string;
  instruction?: string;
  textPosition?: string;
  ratio?: string;
  mode?: "new" | "refine";
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

type SkillPlan = {
  photoAnalysis: string;
  recipe: string;
  finalPrompt: string;
};

const ratioPrompts: Record<string, string> = {
  original: "保持输入图片原始宽高比。",
  portrait: "输出竖版画面，优先 3:4。",
  landscape: "输出横版画面，优先 4:3。",
  square: "输出 1:1 方形画面。",
};

const defaultModelChain = [
  { id: "doubao-seedream-4-5-251128", label: "Seedream 4.5" },
  { id: "doubao-seedream-4-0-250828", label: "Seedream 4.0" },
  { id: "doubao-seedream-5-0-lite-260128", label: "Seedream 5.0 Lite" },
];

type ArkResponse = {
  data?: Array<{ b64_json?: string; url?: string }>;
  error?: { message?: string };
  usage?: unknown;
};

type CompilerResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
};

function parseSkillPlan(raw: string): SkillPlan {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const parsed = JSON.parse(cleaned) as Partial<SkillPlan>;
  if (!parsed.photoAnalysis || !parsed.recipe || !parsed.finalPrompt) throw new Error("Skill 没有返回完整方案。");
  return { photoAnalysis: parsed.photoAnalysis, recipe: parsed.recipe, finalPrompt: parsed.finalPrompt };
}

async function compileSkillPlan(apiKey: string, body: GenerateRequest, instruction: string, adapter: typeof skillAdapters[string]) {
  const ratioRule = ratioPrompts[body.ratio || "original"];
  const textRule = instruction
    ? `用户补充要求：${instruction}\n如其中明确要求添加文字，文字位置偏好为“${body.textPosition || "AI 自动"}”，必须逐字准确；若没有明确要求文字，不得自行添加。`
    : "用户没有补充要求。不得自行添加标题、日期、编号、Logo、水印或虚构信息。";
  const taskRule = body.mode === "refine"
    ? "这是继续修改：输入图是上一版成品。只编译本次修改需要的精确编辑指令，并锁定其他已存在的内容、风格、人物和构图。"
    : "这是首次生成：根据输入照片独立做出适合这张照片的构图选择，不要复刻网页案例图。";
  const system = `你是一个视觉 Skill 执行器，不是通用文案助手。你的职责是先真实阅读输入照片，再严格运行选中的工作流，最后为 Seedream 图像编辑模型编译一段只针对这张照片的可执行提示词。

Skill：${adapter.name}
实现方式：${adapter.implementation}
工作流：${adapter.workflow}
生成前检查：${adapter.review}

必须遵守：
1. 分析只能来自本次输入图，不能猜测网页案例或其他照片。
2. 在多种布局都可行时，必须根据主体位置、画面比例、负空间和方向选择一种，而不是套固定模板。
3. finalPrompt 要写清楚保留什么、改变什么、具体构图、材料、颜色、文字许可和禁止项；不要提到 Skill、分析过程或案例图。
4. 人像编辑必须优先保持身份、五官与手部；真实摄影区域不得被要求重画时，必须明确锁定。
5. 只输出一个 JSON 对象，不要 Markdown，不要额外解释。格式：{"photoAnalysis":"用中文概括照片中与本 Skill 有关的事实，60至160字","recipe":"用中文说明本次选择的构图、材料、色彩与保留策略，60至180字","finalPrompt":"交给图像模型的完整中文编辑提示词，300至900字"}`;
  const userText = `${taskRule}\n${ratioRule}\n${textRule}`;
  const response = await fetch("https://ark.cn-beijing.volces.com/api/v3/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.ARK_SKILL_MODEL?.trim() || "doubao-seed-2-0-lite-260428",
      messages: [
        { role: "system", content: system },
        { role: "user", content: [
          { type: "image_url", image_url: { url: body.image } },
          { type: "text", text: userText },
        ] },
      ],
      response_format: { type: "json_object" },
      reasoning_effort: "minimal",
      temperature: 0.2,
      max_tokens: 1800,
    }),
    signal: AbortSignal.timeout(90_000),
  });
  const data = await response.json() as CompilerResponse;
  if (!response.ok) throw new Error(data.error?.message || `照片分析失败（${response.status}）。`);
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("照片分析模型没有返回方案。");
  return parseSkillPlan(content);
}

function imageMimeType(base64: string) {
  if (base64.startsWith("iVBOR")) return "image/png";
  if (base64.startsWith("UklGR")) return "image/webp";
  return "image/jpeg";
}

export async function POST(request: Request) {
  let body: GenerateRequest;
  try { body = await request.json() as GenerateRequest; }
  catch { return Response.json({ error: "请求内容无法读取。" }, { status: 400 }); }

  const accessCodes = [
    ...(process.env.GENERATION_ACCESS_CODES?.split(",") ?? []),
    process.env.GENERATION_ACCESS_CODE ?? "",
  ].map((code) => code.trim()).filter(Boolean);
  if (accessCodes.length === 0) {
    return Response.json({ error: "线上体验邀请码尚未配置，请联系网站创建者。" }, { status: 503 });
  }
  if (!body.accessCode || !accessCodes.some((code) => codesMatch(body.accessCode!.trim(), code))) {
    return Response.json({ error: "邀请码不正确，请检查后重新输入。" }, { status: 401 });
  }

  const apiKey = process.env.ARK_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "网页已经可以使用，但还没有连接火山方舟。请先配置 ARK_API_KEY。" }, { status: 503 });
  }

  const adapter = body.sceneId ? skillAdapters[body.sceneId] : undefined;
  if (!body.image || !body.sceneId || !adapter) {
    return Response.json({ error: "请上传照片并选择有效场景。" }, { status: 400 });
  }
  if (body.image.length > 15_000_000) {
    return Response.json({ error: "图片数据过大，请换一张小于 10MB 的图片。" }, { status: 413 });
  }

  const instruction = body.instruction?.trim();
  let plan: SkillPlan;
  try {
    plan = await compileSkillPlan(apiKey, body, instruction || "", adapter);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "照片分析失败。";
    return Response.json({ error: `所选 Skill 还没有完成读图，因此没有继续扣费生图。${reason}` }, { status: 502 });
  }
  const prompt = `${plan.finalPrompt}\n输出必须是单张完成图，平视展示，不要样机、界面截图、Logo、水印或解释文字。`;

  const configuredIds = process.env.ARK_IMAGE_MODELS
    ?.split(",")
    .map((item) => item.trim())
    .filter(Boolean) ?? [];
  const legacyPreferredId = process.env.ARK_IMAGE_MODEL?.trim();
  const orderedIds = [...new Set([
    ...configuredIds,
    ...(legacyPreferredId ? [legacyPreferredId] : []),
    ...defaultModelChain.map((model) => model.id),
  ])];
  const models = orderedIds.map((id) => ({
    id,
    label: defaultModelChain.find((model) => model.id === id)?.label ?? id,
  }));

  let lastError = "模型暂时无法生成图片。";
  for (const [index, model] of models.entries()) {
    try {
      const upstream = await fetch("https://ark.cn-beijing.volces.com/api/v3/images/generations", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: model.id,
          prompt,
          image: [body.image],
          size: "2K",
          sequential_image_generation: "disabled",
          stream: false,
          response_format: "b64_json",
          watermark: false,
        }),
        signal: AbortSignal.timeout(240_000),
      });
      const data = await upstream.json() as ArkResponse;
      if (!upstream.ok) {
        lastError = data.error?.message || `火山方舟调用失败（${upstream.status}）。`;
        continue;
      }
      const first = data.data?.[0];
      const image = first?.b64_json
        ? `data:${imageMimeType(first.b64_json)};base64,${first.b64_json}`
        : first?.url;
      if (!image) {
        lastError = `${model.label} 没有返回图片。`;
        continue;
      }
      return Response.json({
        image,
        model: model.id,
        modelLabel: model.label,
        fallbackUsed: index > 0,
        skill: { name: adapter.name, implementation: adapter.implementation, sourceUrl: adapter.sourceUrl },
        skillAnalysis: plan.photoAnalysis,
        skillRecipe: plan.recipe,
        usage: data.usage,
      });
    } catch (error) {
      lastError = error instanceof Error ? error.message : `${model.label} 调用失败。`;
    }
  }

  return Response.json({ error: `三个模型都没有成功生成，请稍后重试。${lastError ? `（${lastError}）` : ""}` }, { status: 502 });
}
