import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveRenderRange} from '../render-range.mjs';

const FPS = 60;
const SOURCE_START = 0.129;
const SOURCE_END = 10;
const OUTPUT_FRAMES = 600;
const sourceAtOutputFrame = frame => Math.max(SOURCE_START, Math.min(SOURCE_END, frame / FPS - 0.064));
const resolve = options => resolveRenderRange({
  fps: FPS,
  audioOffset: 0.064,
  sourceStart: SOURCE_START,
  sourceEnd: SOURCE_END,
  outputFrames: OUTPUT_FRAMES,
  sourceAtOutputFrame,
  ...options,
});

test('default range keeps the whole output clock and its historical source mapping', () => {
  const plan = resolve({});
  assert.equal(plan.isFull, true);
  assert.equal(plan.startPTS, SOURCE_START);
  assert.equal(plan.endPTS, SOURCE_END);
  assert.equal(plan.frames, OUTPUT_FRAMES);
  assert.equal(plan.audioSeek, 0);
  assert.equal(plan.framePTS(0), SOURCE_START);
  assert.equal(plan.framePTS(OUTPUT_FRAMES - 1), sourceAtOutputFrame(OUTPUT_FRAMES - 1));
});

test('output range rounds endpoints to frame indices and seeks on the output clock', () => {
  const plan = resolve({outputRange: {start: 1.001, end: 1.034}});
  assert.equal(plan.isFull, false);
  assert.equal(plan.outputRangeStartFrame, 60);
  assert.equal(plan.outputRangeEndFrame, 62);
  assert.equal(plan.frames, 2);
  assert.equal(plan.startPTS, sourceAtOutputFrame(60));
  assert.equal(plan.endPTS, sourceAtOutputFrame(61));
  assert.equal(plan.audioSeek, 1);
  assert.equal(plan.framePTS(1), sourceAtOutputFrame(61));
});

test('output range may end exactly at outputFrames, but cannot exceed it', () => {
  const plan = resolve({outputRange: {start: 9.5, end: 10}});
  assert.equal(plan.outputRangeEndFrame, OUTPUT_FRAMES);
  assert.equal(plan.frames, 30);
  assert.equal(plan.endPTS, sourceAtOutputFrame(OUTPUT_FRAMES - 1));
  assert.throws(
    () => resolve({outputRange: {start: 9.5, end: 10.01}}),
    {message: 'invalid --output-range; use an increasing range within the complete film clock.'},
  );
});

test('output range that rounds to zero frames keeps the existing refusal', () => {
  assert.throws(
    () => resolve({outputRange: {start: 1.001, end: 1.002}}),
    {message: 'invalid --output-range; use an increasing range within the complete film clock.'},
  );
});

test('source range retains rounded inclusive frame count, including its sampled tail', () => {
  const plan = resolve({range: {start: 1, end: 1.026}});
  assert.equal(plan.isFull, false);
  assert.equal(plan.startPTS, 1);
  assert.equal(plan.endPTS, 1.026);
  assert.equal(plan.frames, 3);
  assert.equal(plan.audioSeek, 1.064);
  assert.equal(plan.framePTS(2), 1 + 2 / FPS);
});

test('source range clips to the source span and uses the clipped start for audio seek', () => {
  const plan = resolve({range: {start: 0, end: 0.5}});
  assert.equal(plan.startPTS, SOURCE_START);
  assert.equal(plan.endPTS, 0.5);
  assert.equal(plan.frames, Math.round((0.5 - SOURCE_START) * FPS) + 1);
  assert.equal(plan.audioSeek, SOURCE_START + 0.064);
});

test('source range clips its end and clamps a rounded final sample to sourceEnd', () => {
  const start = SOURCE_END - 5.6 / FPS;
  const plan = resolve({range: {start, end: SOURCE_END + 1}});
  assert.equal(plan.startPTS, start);
  assert.equal(plan.endPTS, SOURCE_END);
  assert.equal(plan.frames, 7);
  assert.equal(start + 6 / FPS > SOURCE_END, true);
  assert.equal(plan.framePTS(6), SOURCE_END);
});

test('a one-sided source start defaults its end to the source tail', () => {
  const plan = resolve({rangeStart: 2});
  assert.equal(plan.startPTS, 2);
  assert.equal(plan.endPTS, SOURCE_END);
  assert.equal(plan.audioSeek, 2.064);
});

test('a one-sided source end defaults its start to the first source PTS', () => {
  const plan = resolve({rangeEnd: 2});
  assert.equal(plan.startPTS, SOURCE_START);
  assert.equal(plan.endPTS, 2);
  assert.equal(plan.audioSeek, SOURCE_START + 0.064);
});

test('output range keeps priority when both range forms are provided', () => {
  const plan = resolve({outputRange: {start: 2, end: 2.5}, range: {start: 4, end: 5}});
  assert.equal(plan.frames, 30);
  assert.equal(plan.audioSeek, 2);
  assert.equal(plan.startPTS, sourceAtOutputFrame(120));
});

test('invalid clipped source range retains its entry error text', () => {
  assert.throws(
    () => resolve({range: {start: 20, end: 30}}),
    {message: 'invalid --range; the clipped span 20.000 .. 10.000 is empty. Use increasing source-PTS values within 0.129 .. 10.'},
  );
});
