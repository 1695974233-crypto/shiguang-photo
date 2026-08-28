"use client";

import { ChangeEvent, FormEvent, useMemo, useRef, useState } from "react";
import { applyPortraitRelight, createAnalysisThumbnail, PortraitRelightSpec } from "./portrait-relight";
import { applyRealScenePaperComposite, RealScenePaperCompositeSpec } from "./real-scene-paper-composite";

type Scene = {
  id: string;
  name: string;
  eyebrow: string;
  description: string;
  fidelity: string;
  preview: string;
  previewPosition?: string;
  credit: string;
  creditUrl?: string;
  previewNote?: string;
};

type SkillResult = {
  name: string;
  implementation: string;
  sourceUrl?: string;
  analysis: string;
  recipe: string;
};

const scenes: Scene[] = [
  { id: "minimal-zine", name: "极简 Zine", eyebrow: "完整摄影 · 非具象印刷场", description: "保留一块完整、自然的照片材料，让独立抽象印刷、裸纸留白和一种结构色共同完成版面。", fidelity: "完整保留摄影锚点", preview: "/previews/minimal-zine.jpeg", credit: "独立功能实现 · 案例使用你的建筑照片", previewNote: "照片始终保持为一块未滤镜化的真实材料；插画只在周围纸面独立创作，不再把天空、植物或建筑局部压成色块。" },
  { id: "abstract-editorial", name: "结构记忆编辑", eyebrow: "真照 + 抽象记忆", description: "忠实保留原照片，再从画面关系中提炼一块克制的抽象视觉面板。", fidelity: "高度保留原照", preview: "/previews/abstract-editorial.jpg", credit: "独立功能实现 · 案例使用你的建筑照片" },
  { id: "gathered-scenes", name: "拾景纸刊", eyebrow: "一处真照 · 手撕纸拼", description: "用一处宽阔、不对称的真实摄影开口保留主体与现场，在暖白纤维纸上只延续少量同场景印痕。", fidelity: "保留自然摄影与场所关系", preview: "/previews/gathered-scenes.jpg", credit: "个人 Skill · make-scene-paper-collage", previewNote: "竖图默认 3:5、横图默认 5:3；摄影开口保留自然原色，外围只使用一至两个低对比场景印痕，并留下大量裸纸。" },
  { id: "scene-distillation", name: "场景抽象", eyebrow: "提取关系 · 重新创作", description: "提取照片中的主体关系、方向和情绪，重新组织成一张独立纸面插画。", fidelity: "允许大幅创作", preview: "/previews/scene-distillation.jpg", credit: "独立功能实现 · 不使用第三方 Skill 内容" },
  { id: "photo-relic", name: "照片遗迹", eyebrow: "旧相纸 · 时间痕迹", description: "把照片处理成被时间保存过的纸上遗迹，褪色、磨损而克制。", fidelity: "保留主体关系", preview: "/previews/photo-relic.png", credit: "作者 README 示例 · wnby · MIT", creditUrl: "https://github.com/wnby/photo-relic-editorial" },
  { id: "surreal-pop", name: "单一异物波普", eyebrow: "黑白现实 · 巨物拼贴", description: "以真实照片为锚点，只加入一个与场景有关的不可能巨物。", fidelity: "保留主体，大幅创作", preview: "/previews/surreal-pop.jpg", credit: "独立功能实现 · 案例使用你的建筑照片" },
  { id: "doodle-life", name: "微型人物涂鸦", eyebrow: "真实物件 · 原始黑线", description: "保留一个真实核心物件，让微型人物围绕它完成一个小故事。", fidelity: "保留核心物件", preview: "/previews/doodle-life.jpg", credit: "独立功能实现 · 不使用品牌资产" },
  { id: "muted-zine", name: "褪色纸页", eyebrow: "柔和色调 · 诗意纸刊", description: "降低饱和度与对比度，让画面变成温柔、安静的纸上记录。", fidelity: "适度保留原照", preview: "/previews/muted-zine.jpg", credit: "独立功能实现 · 案例使用你的玫瑰照片" },
  { id: "ink-wash", name: "当代水墨转译", eyebrow: "淡墨留白 · 编辑海报", description: "依据照片结构选择纸色和墨法，而不是套一层水彩滤镜。", fidelity: "保留结构，重新绘制", preview: "/previews/ink-wash.jpg", credit: "独立功能实现 · 案例使用你的建筑照片" },
  { id: "portrait-relight", name: "自然人像补光", eyebrow: "曝光修复 · 不重绘五官", description: "分析人物与背景曝光差，只调整光线、肤色和阴影细节。", fidelity: "完整保留人物", preview: "/previews/portrait-relight-safe.jpg", previewPosition: "center", credit: "像素级后期 · 不调用生图模型", previewNote: "实际处理只在你的原图像素上局部补光，保持原构图，不重画人物和背景。" },
];

const textPositions = ["AI 自动", "正上方", "正下方", "左上角", "右上角", "左下角", "右下角"];
const ratios = [
  { id: "original", label: "保持原图" },
  { id: "portrait", label: "竖版" },
  { id: "landscape", label: "横版" },
  { id: "square", label: "方形" },
];

export default function Home() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [selectedScene, setSelectedScene] = useState<Scene | null>(null);
  const [previewScene, setPreviewScene] = useState<Scene | null>(null);
  const [instruction, setInstruction] = useState("");
  const [textPosition, setTextPosition] = useState("AI 自动");
  const [ratio, setRatio] = useState("original");
  const [accessCode, setAccessCode] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("请先上传一张照片，再选择场景。生成按钮会在两项都完成后点亮。");
  const [history, setHistory] = useState<string[]>([]);
  const [skillResult, setSkillResult] = useState<SkillResult | null>(null);
  const [qualityCorrection, setQualityCorrection] = useState("");

  const activePreview = previewScene ?? selectedScene ?? scenes[2];
  const canGenerate = Boolean(source && selectedScene && accessCode.trim() && !isGenerating);
  const selectedRatio = ratios.find((item) => item.id === ratio)?.label ?? "保持原图";

  const sourceStyle = useMemo(
    () => source ? { backgroundImage: `url(${source})` } : { backgroundImage: "url(/og.png)" },
    [source],
  );

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("请选择 JPG、PNG 或 WebP 图片。");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("图片请控制在 10MB 以内。");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setSource(String(reader.result));
      setFileName(file.name);
      setResult(null);
      setSkillResult(null);
      setQualityCorrection("");
      setError("");
      setStatus("照片已就位。现在选择一个你喜欢的场景。");
    };
    reader.readAsDataURL(file);
  }

  function chooseScene(scene: Scene) {
    setSelectedScene(scene);
    setPreviewScene(scene);
    setError("");
    setQualityCorrection("");
    setStatus(source ? `已选择「${scene.name}」。可以补充文字或直接生成。` : `已选择「${scene.name}」。上传照片后即可生成。`);
  }

  async function requestGeneration(mode: "new" | "refine", refinement = "") {
    if (!source || !selectedScene) {
      setError("请先上传照片并选择一个场景。");
      return;
    }
    setIsGenerating(true);
    setError("");
    const inputImage = mode === "refine" && result ? result : source;
    const isPixelRelight = selectedScene.id === "portrait-relight";
    setStatus(isPixelRelight
      ? "正在定位人物并进行像素级补光，原照片不会交给生图模型重绘…"
      : mode === "refine" ? "Skill 正在阅读上一版作品并编译本次修改…" : "Skill 正在阅读照片、选择构图并编译专属方案，然后再生成图片…");

    try {
      const analysisImage = await createAnalysisThumbnail(inputImage);
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: inputImage,
          analysisImage,
          sceneId: selectedScene.id,
          accessCode: accessCode.trim(),
          instruction: mode === "refine" ? refinement : instruction,
          textPosition,
          ratio,
          mode,
          qualityCorrection: mode === "new" ? qualityCorrection : "",
        }),
      });
      const data = await response.json() as {
        image?: string;
        error?: string;
        modelLabel?: string;
        fallbackUsed?: boolean;
        autoRetried?: boolean;
        qualityWarning?: string[];
        qualityCorrection?: string;
        compositeWarning?: string;
        skill?: { name: string; implementation: string; sourceUrl?: string };
        skillAnalysis?: string;
        skillRecipe?: string;
        localEdit?: PortraitRelightSpec;
        localComposite?: RealScenePaperCompositeSpec;
      };
      if (!response.ok || (!data.image && !data.localEdit)) throw new Error(data.error || "生成失败，请稍后重试。");
      const nextImage = data.localEdit
        ? await applyPortraitRelight(inputImage, data.localEdit)
        : data.localComposite
          ? await applyRealScenePaperComposite(inputImage, data.image!, data.localComposite)
          : data.image!;
      setResult(nextImage);
      setQualityCorrection(data.qualityCorrection || "");
      if (data.skill && data.skillAnalysis && data.skillRecipe) {
        setSkillResult({ ...data.skill, analysis: data.skillAnalysis, recipe: data.skillRecipe });
      }
      if (mode === "refine" && refinement.trim()) setHistory((items) => [...items, refinement.trim()]);
      const modelStatus = data.modelLabel
        ? ` · ${data.modelLabel}${data.fallbackUsed ? "（自动切换）" : ""}${data.autoRetried ? "（已自动纠偏一次）" : ""}`
        : "";
      setStatus(data.localEdit
        ? "像素级补光已完成：保留原始人物、五官、手势和背景，没有调用生图模型。"
        : selectedScene.id === "gathered-scenes"
          ? `拾景纸刊已完成${modelStatus}：已直接运行 make-scene-paper-collage，成图不会再经过旧版语义分割或浏览器二次纸裁。`
        : data.localComposite
          ? `结构记忆编辑已完成${modelStatus}：摄影区使用原图真实像素，抽象区只提炼画面关系。`
        : data.compositeWarning
          ? `作品已生成${modelStatus}，但${data.compositeWarning}`
        : data.qualityWarning?.length
            ? `作品已生成${modelStatus}，质量检查发现：${data.qualityWarning.slice(0, 2).join("；")}。点击“再生成一次”会自动带上纠偏要求。`
            : `作品已生成${modelStatus}。满意就下载，不满意可以继续说怎么改。`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "生成失败，请稍后重试。");
      setStatus("这次没有生成成功，你的照片和设置都还保留着。");
    } finally {
      setIsGenerating(false);
    }
  }

  function onRefine(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!instruction.trim()) {
      setError("请先写下你希望怎么修改，例如“文字往左一点”。");
      return;
    }
    void requestGeneration("refine", instruction);
    setInstruction("");
  }

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="拾光后期首页">
          <span className="brand-mark">拾</span>
          <span>拾光后期</span>
        </a>
        <span className="header-note">无需修图经验 · 一次生成一张</span>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <span className="kicker">AI PHOTO RESTYLING STUDIO</span>
          <h1>把普通照片，<br />变成值得留下的一页。</h1>
          <p>上传照片，挑一个喜欢的场景。我们把复杂的后期流程藏起来，只留下选择与表达。</p>
        </div>
        <div className="hero-art" role="img" aria-label="一张旅行照片被转换成多种编辑风格的示例" />
      </section>

      <section className="studio" aria-label="照片创作工作台">
        <div className="studio-step">
          <span>01</span>
          <div><strong>上传照片</strong><small>JPG、PNG、WebP · 最大 10MB</small></div>
        </div>

        <button className={`upload-zone ${source ? "has-image" : ""}`} type="button" onClick={() => fileInput.current?.click()}>
          <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={onFileChange} hidden />
          {source ? <span className="upload-thumb" style={sourceStyle} /> : <span className="upload-icon">＋</span>}
          <span><strong>{source ? "更换照片" : "选择一张照片"}</strong><small>{fileName || "照片只用于当前创作，不会保存到历史记录"}</small></span>
        </button>

        <div className="studio-step scene-heading">
          <span>02</span>
          <div><strong>选择场景</strong><small>悬停预览效果，点击确认选择</small></div>
        </div>

        <div className="scene-buttons" role="radiogroup" aria-label="选择图片处理场景">
          {scenes.map((scene) => (
            <button
              key={scene.id}
              type="button"
              className={selectedScene?.id === scene.id ? "scene-button selected" : "scene-button"}
              role="radio"
              aria-checked={selectedScene?.id === scene.id}
              onMouseEnter={() => setPreviewScene(scene)}
              onMouseLeave={() => setPreviewScene(selectedScene)}
              onFocus={() => setPreviewScene(scene)}
              onClick={() => chooseScene(scene)}
            >
              {selectedScene?.id === scene.id && <span aria-hidden="true">✓</span>}{scene.name}
            </button>
          ))}
        </div>

        <div className="effect-preview">
          <div className="sample-frame">
            <span>原图</span>
            <div className="sample-image source-sample" style={sourceStyle} />
          </div>
          <div className="transform-arrow" aria-hidden="true">→</div>
          <div className="sample-frame">
            <span>{activePreview.name} · 风格参考</span>
            <div
              className="sample-image effect-sample"
              style={{ backgroundImage: `url(${activePreview.preview})`, backgroundPosition: activePreview.previewPosition ?? "center" }}
            />
          </div>
          <div className="preview-copy">
            <span>{activePreview.eyebrow}</span>
            <h2>{activePreview.name}</h2>
            <p>{activePreview.description}</p>
            <small>{activePreview.fidelity}</small>
            <span className="preview-note">{activePreview.previewNote ?? "实际构图会根据你上传照片的主体与比例变化，但应保持同一视觉语言。"}</span>
            {activePreview.creditUrl
              ? <a className="preview-credit" href={activePreview.creditUrl} target="_blank" rel="noreferrer">{activePreview.credit}</a>
              : <span className="preview-credit">{activePreview.credit}</span>}
          </div>
        </div>

        <div className="studio-step options-heading">
          <span>03</span>
          <div><strong>告诉我你还想要什么</strong><small>文字和位置都可以不填</small></div>
        </div>

        <div className="assistant-line">
          <span className="assistant-avatar">拾</span>
          <p>是否需要在图片里面加文字？请写下文字内容并确认位置，例如：在左上角添加“夏日散步”。</p>
        </div>

        <textarea
          className="prompt-box"
          value={instruction}
          onChange={(event) => setInstruction(event.target.value)}
          placeholder={result ? "继续告诉我怎么改，例如：文字往左一点，整体颜色再淡一些…" : "可选：添加文字、描述情绪，或补充你希望保留的画面细节…"}
          rows={3}
        />

        <div className="option-group">
          <span>文字位置</span>
          <div className="chip-row">
            {textPositions.map((position) => <button type="button" key={position} className={textPosition === position ? "chip active" : "chip"} onClick={() => setTextPosition(position)}>{position}</button>)}
          </div>
        </div>

        <div className="option-group">
          <span>画面比例</span>
          <div className="chip-row">
            {ratios.map((item) => <button type="button" key={item.id} className={ratio === item.id ? "chip active" : "chip"} onClick={() => setRatio(item.id)}>{item.label}</button>)}
          </div>
        </div>

        <div className="access-code-box">
          <div>
            <strong>体验邀请码</strong>
            <span>邀请码只用于控制生成权限，不会显示在生成图片中。</span>
          </div>
          <input
            type="password"
            value={accessCode}
            onChange={(event) => setAccessCode(event.target.value)}
            placeholder="请输入邀请码"
            autoComplete="off"
            aria-label="体验邀请码"
          />
        </div>

        <div className="generation-bar">
          <div>
            <strong>{selectedScene?.name ?? "尚未选择场景"}</strong>
            <span>{selectedScene?.id === "portrait-relight" ? "保持原图比例 · 像素级后期" : `${selectedRatio} · ${textPosition}`}</span>
          </div>
          <button className="generate-button" type="button" disabled={!canGenerate} onClick={() => void requestGeneration("new")}>
            {isGenerating ? "生成中…" : "生成图片"}
          </button>
        </div>

        <div className="status-line" aria-live="polite">{status}</div>
        {error && <div className="error-line" role="alert">{error}</div>}

        {result && (
          <section className="result-section" aria-label="生成结果">
            <div className="result-heading">
              <div><span>YOUR RESULT</span><h2>这一张，已经替你完成。</h2></div>
              <div className="result-actions">
                <a className="download-button" href={result} download={`拾光后期-${selectedScene?.id ?? "result"}.jpg`}>下载图片</a>
                <button type="button" onClick={() => void requestGeneration("new")}>再生成一次</button>
              </div>
            </div>
            <div className="result-image-wrap"><img src={result} alt={`使用${selectedScene?.name}生成的图片`} /></div>
            {skillResult && (
              <div className="skill-report">
                <div className="skill-report-title">
                  <span>SKILL RUN</span>
                  <strong>{skillResult.name}</strong>
                  <small>{skillResult.implementation}</small>
                </div>
                <div><strong>读图结果</strong><p>{skillResult.analysis}</p></div>
                <div><strong>本次方案</strong><p>{skillResult.recipe}</p></div>
                {skillResult.sourceUrl && <a href={skillResult.sourceUrl} target="_blank" rel="noreferrer">查看开源工作流来源</a>}
              </div>
            )}
            {history.length > 0 && <div className="edit-history"><strong>本轮修改</strong>{history.map((item, index) => <span key={`${item}-${index}`}>{item}</span>)}</div>}
            <form className="refine-form" onSubmit={onRefine}>
              <label htmlFor="refine">继续修改这张图片</label>
              <div><input id="refine" value={instruction} onChange={(event) => setInstruction(event.target.value)} placeholder="例如：文字往左一点，天空颜色淡一点" /><button disabled={isGenerating}>继续修改</button></div>
            </form>
          </section>
        )}
      </section>

      <footer><span>拾光后期 · 邀请体验版</span><span>照片不保存 · 结果即时下载</span></footer>
    </main>
  );
}
