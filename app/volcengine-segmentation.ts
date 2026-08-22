import { Signer } from "@volcengine/openapi";

type EntitySegmentResponse = {
  ResponseMetadata?: { RequestId?: string; Error?: { Code?: string; Message?: string } };
  Result?: {
    code?: number;
    message?: string;
    data?: { binary_data_base64?: string[]; entity_num?: number[]; seg_score?: number[] };
  };
};

export type SubjectSegmentation = {
  masks: string[];
  scores: number[];
  entityCount: number;
  requestId?: string;
};

function dataUrlPayload(image: string) {
  const match = image.match(/^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/s);
  if (!match) throw new Error("主体分割只接受网页上传的图片数据。");
  return match[1];
}

function imageDataUrl(base64: string) {
  const mime = base64.startsWith("iVBOR") ? "image/png" : base64.startsWith("UklGR") ? "image/webp" : "image/jpeg";
  return `data:${mime};base64,${base64}`;
}

export async function segmentPhotoSubjects(image: string): Promise<SubjectSegmentation | undefined> {
  const accessKeyId = process.env.VOLC_ACCESS_KEY_ID?.trim() || process.env.VOLC_ACCESSKEY?.trim();
  const secretKey = process.env.VOLC_SECRET_ACCESS_KEY?.trim() || process.env.VOLC_SECRETKEY?.trim();
  if (!accessKeyId || !secretKey) return undefined;

  const endpoint = process.env.VOLC_CV_ENDPOINT?.trim() || "visual.volcengineapi.com";
  const region = process.env.VOLC_CV_REGION?.trim() || "cn-north-1";
  const body = JSON.stringify({
    req_key: "entity_seg",
    binary_data_base64: [dataUrlPayload(image)],
    max_entity: 5,
    return_format: 3,
    refine_mask: 1,
  });
  const requestData = {
    region,
    method: "POST",
    params: { Action: "EntitySegment", Version: "2024-06-06" },
    headers: { Host: endpoint, "Content-Type": "application/json" },
    body,
  };
  new Signer(requestData, "cv").addAuthorization({ accessKeyId, secretKey });

  const response = await fetch(`https://${endpoint}/?Action=EntitySegment&Version=2024-06-06`, {
    method: "POST",
    headers: requestData.headers,
    body,
    signal: AbortSignal.timeout(25_000),
  });
  const payload = await response.json() as EntitySegmentResponse;
  const serviceError = payload.ResponseMetadata?.Error;
  if (!response.ok || serviceError || payload.Result?.code !== 10000) {
    throw new Error(serviceError?.Message || payload.Result?.message || `主体分割失败（${response.status}）。`);
  }

  // return_format=3 returns the original followed by entity masks; item 0 is not a mask.
  const layers = payload.Result.data?.binary_data_base64 ?? [];
  const masks = layers.slice(1).filter(Boolean).map(imageDataUrl);
  if (masks.length === 0) throw new Error("主体分割没有识别出可用实体。");
  return {
    masks,
    scores: (payload.Result.data?.seg_score ?? []).slice(0, masks.length),
    entityCount: payload.Result.data?.entity_num?.[0] ?? masks.length,
    requestId: payload.ResponseMetadata?.RequestId,
  };
}
