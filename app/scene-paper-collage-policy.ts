export type ExteriorElementKind = "scene_element" | "collage_material" | "abstract_mark" | "prohibited_artifact";
export type ExteriorElementProvenance = "matched" | "absent" | "uncertain" | "not_applicable";

export type ExteriorElementAudit = {
  label: string;
  kind: ExteriorElementKind;
  sourceClass: string;
  provenance: ExteriorElementProvenance;
  evidence: string;
};

export const scenePaperCollageLayerOntology = `拾景纸刊包含四类视觉成分，必须先分类再验收来源：
1. SCENE_ELEMENT 场景元素：属于被描绘世界的人、动物、植物、建筑、器物、地形、天空、水面、道路、栏杆、墙面、地面、光影边界等具有场景语义的实体、表面或结构。只有这一类需要与原图P域之外的背景逐项核对来源。
2. COLLAGE_MATERIAL 拼贴材料：承载画面的暖白或天然纸张基底、纸色、纸纤维、纸纹、裸纸留白、撕口纤维边、干墨吸收、网点/丝网/石墨/拓印的印刷质感、轻微套色偏差和扫描颗粒。它们是产品规定的表现材料，不是原图中的场景对象，来源判定一律为 not_applicable；不得因为原照片里没有纸张或印刷纹理而判定新增对象。
3. ABSTRACT_MARK 抽象印痕：只表达原图色彩、明暗、颗粒、纹理、轮廓节奏或方向，但不足以稳定识别成具体场景元素的非对象化痕迹。来源不确定时标记 uncertain，不得硬判为新增场景对象。
4. PROHIBITED_ARTIFACT 禁止伪影：Logo、水印、网址、广告、界面、样机、立体纸张、翘角、厚投影、层叠卡片、未经允许的标题或完整第二场景。此类不做原图对象匹配，直接作为产品违规项。
分类依据是它在最终画面中的语义角色，而不是颜色、位置或绘画风格。比如“网点化的树”仍是 SCENE_ELEMENT 树；“网点印刷颗粒”才是 COLLAGE_MATERIAL。纸船、纸伞、报纸、书本、纸盒等若作为照片场景中的具体物体，仍属于 SCENE_ELEMENT，不能误当材料。`;

const materialOnlyPatterns = [
  /^(?:暖|米|乳|象牙|自然|浅)?白?(?:色)?(?:天然)?(?:棉|纤维)?(?:纸张|纸面|底纸|纸材|纸质)(?:基底|底色|纹理|肌理|纤维|颗粒|背景|留白)?$/u,
  /^(?:暖|米|乳|象牙|自然|浅)?白?(?:色)?(?:裸纸|裸纸留白|纸张留白|纸面留白|纸纤维|纸纹|纸质纹理|纸张纹理)(?:背景|区域|基底)?$/u,
  /^(?:手撕|撕纸|纸裁)?(?:开口|撕口|撕边|纤维边|毛边|纸边)(?:纹理|效果|边缘)?$/u,
  /^(?:轻微|细微|克制)?(?:干墨|吸墨|墨迹|油墨|网点|半调|丝网|石墨|炭笔|拓印|版画|复印|套色|错版|印刷)(?:印刷)?(?:吸收|颗粒|纹理|肌理|质感|效果|痕迹|偏差|噪点)?$/u,
  /^(?:轻微|细微|克制|平面)?(?:扫描|scanner)(?:颗粒|噪点|纹理|质感|效果)$/iu,
  /^(?:warm|off[- ]?white|ivory|cream|natural|cotton|fibrous)?\s*(?:paper|paper stock|paper substrate|paper base|paper texture|paper grain|blank paper|negative paper space|torn paper edge|torn edge|fibrous edge|deckle edge|print grain|ink absorption|halftone(?: print)?(?: texture| grain)|screenprint(?: texture| grain)|graphite rubbing|registration error|scan grain|scanner grain)$/iu,
];

const depictedPaperObjectPattern = /(纸船|纸伞|油纸伞|纸灯笼|灯笼|折纸|报纸|书本|书页|纸盒|包装盒|纸袋|纸杯|纸巾|卷纸|纸牌|卡片|票据|信件|海报|画纸|宣纸画|paper\s+(?:boat|umbrella|lantern|book|newspaper|box|bag|cup|tissue|card|letter|poster))/iu;

function compact(value: unknown, maximum: number) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, maximum) : "";
}

export function isCollageMaterialOnly(label: string) {
  const normalized = label.trim().replace(/[，。；：、,.!?！？:;()（）【】]/g, " ").replace(/\s+/g, " ");
  if (!normalized || depictedPaperObjectPattern.test(normalized)) return false;
  return materialOnlyPatterns.some((pattern) => pattern.test(normalized));
}

export function parseExteriorElementAudit(value: unknown): ExteriorElementAudit[] {
  if (!Array.isArray(value)) return [];
  const validKinds = new Set<ExteriorElementKind>(["scene_element", "collage_material", "abstract_mark", "prohibited_artifact"]);
  const validProvenance = new Set<ExteriorElementProvenance>(["matched", "absent", "uncertain", "not_applicable"]);
  return value.slice(0, 24).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const raw = item as Record<string, unknown>;
    const label = compact(raw.label, 100);
    if (!label) return [];
    let kind = validKinds.has(raw.kind as ExteriorElementKind) ? raw.kind as ExteriorElementKind : "abstract_mark";
    if (kind === "scene_element" && isCollageMaterialOnly(label)) kind = "collage_material";
    let provenance = validProvenance.has(raw.provenance as ExteriorElementProvenance)
      ? raw.provenance as ExteriorElementProvenance
      : kind === "scene_element" ? "uncertain" : "not_applicable";
    if (kind !== "scene_element") provenance = kind === "abstract_mark" ? "uncertain" : "not_applicable";
    return [{
      label,
      kind,
      sourceClass: compact(raw.sourceClass, 80),
      provenance,
      evidence: compact(raw.evidence, 220),
    }];
  });
}

export function confirmedInventedSceneElements(audit: ExteriorElementAudit[], legacy: unknown = []) {
  const audited = audit
    .filter((item) => item.kind === "scene_element" && item.provenance === "absent")
    .map((item) => item.sourceClass || item.label);
  const legacyItems = Array.isArray(legacy)
    ? legacy.map((item) => compact(item, 100)).filter((item) => item && !isCollageMaterialOnly(item))
    : [];
  return [...new Set([...audited, ...legacyItems])].slice(0, 12);
}

export function prohibitedExteriorArtifacts(audit: ExteriorElementAudit[]) {
  return [...new Set(audit.filter((item) => item.kind === "prohibited_artifact").map((item) => item.label))].slice(0, 12);
}
