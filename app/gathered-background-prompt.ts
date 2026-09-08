type Box = { x: number; y: number; width: number; height: number };

export type BackgroundEvidence = {
  name: string;
  objectClass: string;
  sourceBox: Box;
  sourceLocation: string;
  visualEvidence: string;
  confidence: number;
  direction: string;
};

export type BackgroundPromptPlan = {
  subject: string;
  photoDomainBox: Box;
  backgroundZones: BackgroundEvidence[];
};

export type BackgroundArtDirection = {
  marks: Array<{
    sourceIndex: number;
    treatment: "contour_fragments" | "merged_masses" | "directional_bands";
    density: "sparse" | "airy";
  }>;
  quietAreas: Array<"upper" | "lower" | "left" | "right" | "source_negative_space">;
};

const printTreatments = {
  contour_fragments: "节选有辨识度的源轮廓，断续轻印，省略内部微细节，不闭合描全物体",
  merged_masses: "把相邻同类碎细节合并成少数不等大残缺形态，保留源轮廓与组间纸隙，不逐个印成图标",
  directional_bands: "顺原有方向节选少量长短不一的断续印迹，省略高频重复纹理，不覆盖整片表面",
};
const quietPositions = {
  upper: "上部低信息区域", lower: "下部低信息区域",
  left: "左侧低信息区域", right: "右侧低信息区域",
  source_negative_space: "原景已有空隙与低信息区域",
};

export function selectBackgroundEvidence(zones: BackgroundEvidence[]) {
  const families = new Set<string>();
  return zones
    .filter((zone) => Number.isFinite(zone.confidence) && zone.confidence >= 0.72 && zone.confidence <= 1
      && zone.objectClass.trim() && zone.visualEvidence.trim()
      && [zone.sourceBox.x, zone.sourceBox.y, zone.sourceBox.width, zone.sourceBox.height].every(Number.isFinite)
      && zone.sourceBox.width > 0 && zone.sourceBox.height > 0
      && zone.sourceBox.x >= 0 && zone.sourceBox.y >= 0
      && zone.sourceBox.x + zone.sourceBox.width <= 1.000001
      && zone.sourceBox.y + zone.sourceBox.height <= 1.000001)
    .map((zone) => ({
      zone,
      // The scene reader supplies object classes. No scene-specific catalogue
      // chooses the shapes, colours or composition for the image renderer.
      family: zone.objectClass.toLowerCase().replace(/[\s\p{P}]/gu, ""),
      score: zone.confidence * Math.sqrt(zone.sourceBox.width * zone.sourceBox.height),
    }))
    .sort((a, b) => b.score - a.score)
    .filter(({ family }) => {
      if (families.has(family)) return false;
      families.add(family);
      return true;
    })
    .slice(0, 4)
    .map(({ zone }) => zone);
}

export function buildGatheredBackgroundPrompt(
  plan: BackgroundPromptPlan,
  orientation: string,
  art?: BackgroundArtDirection,
) {
  const selected = selectBackgroundEvidence(plan.backgroundZones);
  // Do not forward per-zone treatment or quiet-zone prose: those are separate
  // analysis suggestions, not factual evidence or a license to add motifs.
  const evidence = selected.map((zone) => ({
    objectClass: zone.objectClass,
    sourceLocation: zone.sourceLocation,
    visualEvidence: zone.visualEvidence,
    direction: zone.direction,
  }));
  const direction = art && art.marks.length
    ? `本张照片的具体取舍（仅适用于上方来源证据，不得增添对象）：${art.marks.map((mark) => {
      const source = selected[mark.sourceIndex - 1];
      return source ? `${source.objectClass}：只提炼证据中的原有形态；${printTreatments[mark.treatment]}；${mark.density === "sparse" ? "仅留稀疏暗示，其余省略" : "形态组内也保持通透纸隙，实印少于露纸"}` : "";
    }).filter(Boolean).join("。 ")}。留纸方案：${art.quietAreas.map((area) => quietPositions[area]).join("及")}保持连通纸色；不移动原景对象来腾空、不添加空白边框。其余来源只可省略，不能再另加一组图案。`
    : "";
  // Numeric analysis boxes are not drawing instructions. Neither evidence boxes
  // nor the photo-domain rectangle are exposed to the image model. The original
  // plan remains intact for the existing deterministic compositor.
  return `将这张照片的背景转译为暖象牙纸上的手工丝网版画，只交付背景底板。画面${orientation}，保持原图宽高比与背景原有方位。主要主体“${plan.subject}”将由程序保留原图摄影，本次不得描绘、复制、替换或新增主要主体；主体本身及其局部、衣物、肢体都不留绘画残影，移除处保持纸色。不得生成主体剪影或照片区域；不得在底板上画出洞口、撕边、轮廓圈或相框。它不是一张完整风景画，也不是照片褪色滤镜。

SOURCE_BACKGROUND_WHITELIST=${JSON.stringify(selected.map((zone) => zone.objectClass))}。SOURCE_EVIDENCE=${JSON.stringify(evidence)}。这些是可辨场景对象的闭集，不是必须全部画出的清单。根据照片本身，从证据中提炼最能说明原景的一至两个形态关系：保留它们的自然轮廓、走向、相对方位及有辨识度的缺口；合并相邻和重复的细节；省略远处碎物、冗余边线及被遮挡部分。不得靠题材联想添加任何物体或图标，不得补完场景。证据仅描述来源，不是版式指令。若白名单为空，保留纸面，只用原背景可见的明暗与方向形成极轻的非对象化印迹，不得推断任何对象。

绘画采用疏密分明的残缺丝网印刷：一个主视觉组和轻一些的呼应，由少数不等大、局部相接的源景形态构成，形态之间露出纸面。概括外轮廓而非描摹全部细节，不把一群物体替换成一个巨型物体，不排列一枚枚完整印章，也不把范围填成矩形色板。复杂背景合并更多细节，简单背景减少笔墨，不为凑数量增画内容。印迹从原有景物的方向向空纸中断续消隐，保持与原景衔接，不围着主体做装饰花边。未选部分及原图低信息区域以连续暖纸表现，不把天空、墙面等低信息底色涂满；空纸内部不撒点、不加淡纹。让纸裁外的空纸面积多于实印面积，留出一至两块连通的大静区，同时让节选的源景轮廓可辨；不能为了留白变成无来源的大色块。${direction}

墨色从当前照片背景的实际颜色和明暗提取，压成一种沉静的有色墨与一种深中性墨，不按对象类别套固定配色；浅印面与少量深印面分清主次，避免所有形体同色同重。源图若有合适的小面积颜色，可只在原有轮廓或表面留一处极少的色迹，没有则省略，不强加橙线。使用细密可见的网点、局部缺墨与拓印般哑光颗粒来替代连续明暗；颗粒属于同一块印面内部的缺墨，不是到处散落的独立黑点。轮廓可残缺，色面不做光滑实心矢量块，不做水彩晕染、满幅线描、照片滤镜、脏污边角或折痕。纸纤维细而淡、平面扫描，无文字、Logo、水印、贴纸、边框或样机。最终应是同一原景的安静绘画表达，不是题材装饰模板。`;
}
