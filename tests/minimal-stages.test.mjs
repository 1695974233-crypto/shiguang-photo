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
    return Response.json({ choices: [{ message: { content: JSON.stringify({ photoAnalysis: '原景', recipe: '极简', finalPrompt: '保留照片' }) } }] });
  };
  const { default: worker } = await import('../dist/server/index.js');
  const submit = async extra => readGenerationResponse(await worker.fetch(new Request('http://localhost/api/generate', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: pixel, sceneId: 'minimal-zine', accessCode: 'test-code', ...extra }),
  }), {}, { waitUntil() {}, passThroughOnException() {} }));
  const plan = await submit({ stage: 'plan' });
  assert.equal(analyses, 1); assert.equal(images, 0);
  const candidate = await submit({ stage: 'image', planToken: plan.planToken });
  assert.equal(candidate.image, pixel); assert.equal(reviews, 0); assert.equal(images, 1); assert.equal(analyses, 1);
  assert.equal(imageInputCounts[0], 2); assert.equal(streamModes[0], true);
  assert.match(imagePrompts[0], /视觉簇整体外接框必须位于左下区域并占全画布22%至25%/);
  assert.match(imagePrompts[0], /输出必须完全无字/);
  const review = await submit({ stage: 'review', candidateImage: pixel });
  assert.match(review.qualityWarning[0], /图片已生成/); assert.equal(images, 1);
  const randomPlan = await submit({ stage: 'plan', minimalLayoutMode: 'random' });
  const randomCandidate = await submit({ stage: 'image', planToken: randomPlan.planToken, minimalLayoutMode: 'random' });
  assert.equal(randomCandidate.image, pixel); assert.equal(images, 2); assert.equal(analyses, 2);
  assert.equal(imageInputCounts[1], 2); assert.equal(streamModes[1], true);
  assert.match(imagePrompts[1], /用户主动选择随机构图/);
  assert.match(imagePrompts[1], /只能有一个占8%至25%的主要视觉事件/);
  assert.match(imagePrompts[1], /输出必须完全无字/);
  failImage = true;
  await assert.rejects(submit({ stage: 'image', planToken: plan.planToken }), /没有自动重试或切换模型/);
  assert.equal(images, 3);
  await assert.rejects(submit({ stage: 'image', planToken: 'tampered' }), /方案无效/);
  assert.equal(images, 3);
});
