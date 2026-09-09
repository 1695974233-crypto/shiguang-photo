import test from 'node:test';
import assert from 'node:assert/strict';
import { streamResult, readGenerationResponse } from '../app/generation-transport.ts';

test('heartbeats arrive while the single generation is still running', async () => {
  let calls = 0;
  let complete;
  const response = streamResult(async () => { calls++; await new Promise(r => complete = r); return Response.json({ image: 'saved' }); }, 5);
  const reader = response.body.getReader();
  assert.match(new TextDecoder().decode((await reader.read()).value), /heartbeat/);
  assert.match(new TextDecoder().decode((await reader.read()).value), /heartbeat/);
  assert.equal(calls, 1);
  complete();
  assert.match(new TextDecoder().decode((await reader.read()).value), /saved/);
  await reader.cancel();
});
test('HTML gateway response becomes readable error, never raw JSON exception', async () => {
  await assert.rejects(readGenerationResponse(new Response('<!DOCTYPE html>', { status: 504 })), /HTTP 504/);
});
test('truncated heartbeat stream does not retry generation', async () => {
  await assert.rejects(readGenerationResponse(new Response('{"type":"heartbeat"}\n', { headers: { 'content-type': 'application/x-ndjson' } })), /没有自动重复提交/);
});
test('streamed result survives split UTF-8 bytes and heartbeat frames', async () => {
  const bytes = new TextEncoder().encode('{"type":"heartbeat"}\n{"type":"result","data":{"image":"已生成"}}\n');
  const response = new Response(new ReadableStream({ start(c) { for (const byte of bytes) c.enqueue(Uint8Array.of(byte)); c.close(); } }), { headers: { 'content-type': 'application/x-ndjson' } });
  assert.deepEqual(await readGenerationResponse(response), { image: '已生成' });
});
