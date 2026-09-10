import test from 'node:test';
import assert from 'node:assert/strict';
import { readGenerationResponse } from '../app/generation-transport.ts';
const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j4ZkAAAAASUVORK5CYII=';
test('minimal stages deliver image before review and never retry an uncertain image call', async () => {
  process.env.ARK_API_KEY = 'test-key'; process.env.GENERATION_ACCESS_CODE = 'test-code';
  let images = 0, analyses = 0, reviews = 0, failImage = false;
  const imagePrompts = [];
  const imageInputCounts = [];
  const streamModes = [];
  globalThis.fetch = async (url, options) => {
    const body = JSON.parse(options.body);
    if (String(url).endsWith('/images/generations')) {
      images++;
      imagePrompts.push(body.prompt);
      imageInputCounts.push(Array.isArray(body.image) ? body.image.length : -1);
      streamModes.push(body.stream);
      if (failImage) throw new TypeError('fetch failed');
      return new Response('data: '+JSON.stringify({type:'image_generation.partial_succeeded',b64_json:pixel.split(',')[1]})+'\n\n', {headers:{'content-type':'text/event-stream'}});
    }
    if (body.messages[0].content.includes('图片编辑结果质检员')) { reviews++; throw new Error('review timeout'); }
    analyses++;
    return Response.json({ choices: [{ message: { content: JSON.stringify({
      photoAnalysis: '玫瑰照片作为 Medium 保留的 edit target。',
      recipe: 'lower-left-float / 红花从灰阶枝叶中留下 / 撕纸照片裁片 / edge-pressed phrase / 番茄红花瓣 / 半调复印 / 中断细线 / 安静档案感',
      finalPrompt: '3:5 暖白纤维纸，80% 开放纸面，一个小型编辑视觉簇。\n\n把玫瑰照片裁片作为 edit target，以红花从灰阶枝叶中留下为视觉隐喻。\n\n短注记压住照片边缘，番茄红只由花瓣承担，并加入半调复印颗粒。\n\n平视扫描、漫射光、低至中对比，避免广告与样机。',
    }) } }] });
  };
  const { default: worker } = await import('../dist/server/index.js');
  const submit = async extra => readGenerationResponse(await worker.fetch(new Request('http://localhost/api/generate', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: pixel, sceneId: 'minimal-zine', accessCode: 'test-code', ...extra }),
  }), {}, { waitUntil() {}, passThroughOnException() {} }));
  const plan = await submit({ stage: 'plan' });
  assert.equal(analyses, 1); assert.equal(images, 0);
  const candidate = await submit({ stage: 'image', planToken: plan.planToken });
  assert.equal(candidate.image, pixel); assert.equal(reviews, 0); assert.equal(images, 1); assert.equal(analyses, 1);
  assert.equal(imageInputCounts[0], 1); assert.equal(streamModes[0], true);
  assert.match(imagePrompts[0], /GitHub 原版：默认3:5竖版/);
  assert.match(imagePrompts[0], /不存在第二张风格参考图/);
  assert.match(imagePrompts[0], /自行创作一句与当前照片隐喻有关的极短私人注记/);
  const review = await submit({ stage: 'review', candidateImage: pixel });
  assert.match(review.qualityWarning[0], /图片已生成/); assert.equal(images, 1);
  const enlargedPlan = await submit({ stage: 'plan', minimalLayoutMode: 'enlarged' });
  const enlargedCandidate = await submit({ stage: 'image', planToken: enlargedPlan.planToken, minimalLayoutMode: 'enlarged' });
  assert.equal(enlargedCandidate.image, pixel); assert.equal(images, 2); assert.equal(analyses, 2);
  assert.equal(imageInputCounts[1], 1); assert.equal(streamModes[1], true);
  assert.match(imagePrompts[1], /自定义放大版：强制3:5竖版/);
  assert.match(imagePrompts[1], /位于左下区域并占全画布22%至25%/);
  assert.match(imagePrompts[1], /本次必须完全无字/);
  assert.match(imagePrompts[1], /非文字关系/);
  failImage = true;
  await assert.rejects(submit({ stage: 'image', planToken: plan.planToken }), /没有自动重试或切换模型/);
  assert.equal(images, 3);
  await assert.rejects(submit({ stage: 'image', planToken: 'tampered' }), /方案无效/);
  assert.equal(images, 3);
  globalThis.fetch = async () => Response.json({ choices: [{ message: { content: JSON.stringify({
    photoAnalysis: '原景',
    recipe: '只有一个笼统配方',
    finalPrompt: '把完整照片缩小贴到纸上。',
  }) } }] });
  await assert.rejects(submit({ stage: 'plan' }), /没有完成八段变化配方/);
});
