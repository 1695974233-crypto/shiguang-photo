import assert from "node:assert/strict";
import test from "node:test";
import {
  confirmedInventedSceneElements,
  isCollageMaterialOnly,
  parseExteriorElementAudit,
  prohibitedExteriorArtifacts,
  scenePaperCollageFullPageTopology,
  scenePaperCollageSeparationContrast,
} from "../app/scene-paper-collage-policy.ts";

test("the page has two content domains and material never becomes a blank third domain", () => {
  assert.match(scenePaperCollageFullPageTopology, /P∪I=C/);
  assert.match(scenePaperCollageFullPageTopology, /不存在第三块未分配画板/);
  assert.match(scenePaperCollageFullPageTopology, /P之外的每一个位置都属于I/);
  assert.match(scenePaperCollageFullPageTopology, /不能只是模型没有生成内容后剩下的默认白纸/);
  assert.match(scenePaperCollageFullPageTopology, /至少两处源图背景结构，或一处宽阔连续的背景表面/);
});

test("photo subject and printed background remain unmistakably different materials", () => {
  assert.match(scenePaperCollageSeparationContrast, /缩略图尺度一眼分清P与I/);
  assert.match(scenePaperCollageSeparationContrast, /闭合、不规则、非矩形摄影岛/);
  assert.match(scenePaperCollageSeparationContrast, /不得让P触碰或占满两条以上成图边缘/);
  assert.match(scenePaperCollageSeparationContrast, /不是原背景的水彩滤镜/);
  assert.match(scenePaperCollageSeparationContrast, /最多使用两种相容印刷语言/);
  assert.match(scenePaperCollageSeparationContrast, /细节密度都必须显著低于P/);
});

test("required paper and print treatments are material, not invented scene elements", () => {
  for (const label of [
    "米白色纸张基底",
    "纸张纹理背景",
    "裸纸留白",
    "手撕纤维边",
    "网点印刷颗粒",
    "轻微套色偏差",
    "warm paper substrate",
    "halftone print grain",
    "scanner grain",
  ]) {
    assert.equal(isCollageMaterialOnly(label), true, label);
  }
});

test("depicted paper objects remain source-traceable scene elements", () => {
  for (const label of ["纸船", "油纸伞", "报纸", "书本", "纸盒", "paper boat", "paper newspaper"]) {
    assert.equal(isCollageMaterialOnly(label), false, label);
  }
});

test("audit hard-blocks only confirmed absent scene semantics", () => {
  const audit = parseExteriorElementAudit([
    { label: "网点化的树", kind: "scene_element", sourceClass: "树", provenance: "absent", evidence: "原图没有树" },
    { label: "网点印刷颗粒", kind: "scene_element", sourceClass: "", provenance: "absent", evidence: "模型误分类" },
    { label: "蓝色方向刷痕", kind: "abstract_mark", sourceClass: "", provenance: "uncertain", evidence: "无法识别为对象" },
    { label: "暖白纸基底", kind: "collage_material", sourceClass: "", provenance: "not_applicable", evidence: "产品材料" },
  ]);

  assert.equal(audit[0]?.kind, "scene_element");
  assert.equal(audit[1]?.kind, "collage_material");
  assert.deepEqual(confirmedInventedSceneElements(audit), ["树"]);
});

test("prohibited presentation artifacts use a separate product gate", () => {
  const audit = parseExteriorElementAudit([
    { label: "立体纸张厚投影", kind: "prohibited_artifact", provenance: "not_applicable", evidence: "违反平面扫描要求" },
    { label: "原图中的墙面", kind: "scene_element", sourceClass: "墙面", provenance: "matched", evidence: "原图右侧可见" },
  ]);
  assert.deepEqual(prohibitedExteriorArtifacts(audit), ["立体纸张厚投影"]);
  assert.deepEqual(confirmedInventedSceneElements(audit), []);
});

test("legacy reviewer output is sanitized without image-specific allowlists", () => {
  assert.deepEqual(
    confirmedInventedSceneElements([], ["纸张纹理背景", "米白色纸张基底", "塔楼"]),
    ["塔楼"],
  );
});
