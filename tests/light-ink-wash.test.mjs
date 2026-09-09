import assert from 'node:assert/strict';
import test from 'node:test';
import { lightInkWashTextRule } from '../app/light-ink-wash.ts';

test('first generation allows scene-derived captions with bottom placement', () => {
  const rule = lightInkWashTextRule();
  assert.match(rule, /默认添加基于可见场景的简短英文标题/);
  assert.match(rule, /文字位置偏好：底部居中/);
  assert.doesNotMatch(rule, /文字位置偏好：AI 自动/);
});

test('explicit instructions and position survive prompt compilation', () => {
  const rule = lightInkWashTextRule('不要文字，颜色再淡一些', '左上角');
  assert.match(rule, /用户补充要求：不要文字，颜色再淡一些/);
  assert.match(rule, /明确要求无字时完全无字/);
  assert.match(rule, /文字位置偏好：左上角/);
});

test('refinement preserves existing captions or no-text state', () => {
  const rule = lightInkWashTextRule('天空淡一点', 'AI 自动', 'refine');
  assert.match(rule, /保留上一版文案与有字\/无字状态/);
  assert.doesNotMatch(rule, /否则默认添加/);
});
