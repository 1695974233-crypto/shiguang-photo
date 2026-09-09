import assert from 'node:assert/strict';
import test from 'node:test';

const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j4ZkAAAAASUVORK5CYII=';

test('new style runs compiler, image generation, and style-specific review through the HTTP route', async () => {
  const originalFetch = globalThis.fetch;
  const before = { ARK_API_KEY: process.env.ARK_API_KEY, GENERATION_ACCESS_CODE: process.env.GENERATION_ACCESS_CODE, GENERATION_ACCESS_CODES: process.env.GENERATION_ACCESS_CODES };
  process.env.ARK_API_KEY = 'test-only-key';
  process.env.GENERATION_ACCESS_CODE = 'test-only-code';
  process.env.GENERATION_ACCESS_CODES = 'test-only-code';
  const calls = [];
  let retryCase = false;
  let reviews = 0;
  globalThis.fetch = async (url, options) => {
    assert.match(String(url), /^https:\/\/ark\.cn-beijing\.volces\.com\/api\/v3\//);
    const body = JSON.parse(options.body);
    calls.push(body);
    if (String(url).endsWith('/images/generations')) return Response.json({ data: [{ b64_json: pixel.split(',')[1] }] });
    const isReview = body.messages[0].content.includes('图片编辑结果质检员');
    if (isReview) reviews += 1;
    return Response.json({ choices: [{ message: { content: JSON.stringify(isReview
      ? retryCase && reviews === 1
        ? { score: 50, criticalFailure: true, issues: ['多余边框'], correction: '去掉多余边框' }
        : { score: 95, criticalFailure: false, issues: [], correction: '' }
      : { photoAnalysis: '照片主体和色彩分析', recipe: '淡彩水墨纸面插画', finalPrompt: '根据上传照片绘画化。' }) } }] });
  };
  try {
    const { default: worker } = await import('../dist/server/index.js');
    for (const instruction of ['', '不要文字', '整体淡一点']) {
      calls.length = 0;
      reviews = 0;
      retryCase = instruction === '整体淡一点';
      const response = await worker.fetch(new Request('http://localhost/api/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: pixel, sceneId: 'light-ink-wash', accessCode: 'test-only-code', instruction }),
      }), {}, { waitUntil() {}, passThroughOnException() {} });
      const result = await response.json();
      assert.equal(response.status, 200, JSON.stringify(result));
      assert.equal(result.skill.name, '淡彩水墨');
      assert.ok(result.image);
      assert.equal(result.localComposite, undefined);
      assert.equal(calls.length, retryCase ? 5 : 3);
      assert.equal(result.autoRetried, retryCase);
      if (retryCase) {
        assert.match(calls[3].prompt, /去掉多余边框/);
        assert.doesNotMatch(calls[3].prompt, /摄影开口位置与范围/);
      }
      const [compiler, generation, reviewer] = calls;
      assert.match(compiler.messages[1].content[1].text, /默认两行标题是本风格的作品内容/);
      assert.match(generation.prompt, /大形概括/);
      assert.equal(generation.image.length, 1);
      assert.doesNotMatch(reviewer.messages[0].content, /photoDomainPurity|拾景纸刊按九项/);
      assert.match(reviewer.messages[1].content[2].text, /默认两行标题是本风格的作品内容/);
      if (instruction === '不要文字') assert.match(generation.prompt, /用户补充要求：不要文字/);
    }
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(before)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
