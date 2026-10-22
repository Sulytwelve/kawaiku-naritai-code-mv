import {describe, it} from 'node:test';
import assert from 'node:assert/strict';

import {
  SRT_LANGUAGES,
  SRT_SOURCES,
  SrtError,
  cropCues,
  formatSrtTime,
  parseSrt,
  resolveSrtLanguage,
  serializeSrt,
} from '../srt.mjs';

const msOf = seconds => Math.round(seconds * 1000);

function assertSrtError(fn, code) {
  assert.throws(fn, error => {
    assert.ok(error instanceof SrtError, `expected SrtError, got ${error?.name}`);
    assert.ok(error instanceof Error, 'SrtError must extend Error');
    assert.equal(error.code, code);
    return true;
  });
}

describe('resolveSrtLanguage', () => {
  it('maps the two supported languages to their declared sources', () => {
    assert.deepEqual(SRT_LANGUAGES, ['ja', 'bilingual']);
    assert.deepEqual(resolveSrtLanguage('ja'), {
      language: 'ja',
      file: 'KAWAIKU NARITAI.ja.srt',
      source: 'assets/subtitles/KAWAIKU NARITAI.ja.srt',
    });
    assert.deepEqual(resolveSrtLanguage('bilingual'), {
      language: 'bilingual',
      file: 'KAWAIKU NARITAI.bilingual.srt',
      source: 'assets/subtitles/KAWAIKU NARITAI.bilingual.srt',
    });
    assert.deepEqual(Object.keys(SRT_SOURCES), ['ja', 'bilingual']);
    // Surrounding CLI whitespace is tolerated; case and unknown words are not.
    assert.equal(resolveSrtLanguage(' ja ').language, 'ja');
  });

  it('refuses unknown values instead of falling back to ja', () => {
    for (const raw of ['zh', 'japanese', '', '   ', 'JA', 'constructor', '__proto__']) {
      assert.throws(
        () => resolveSrtLanguage(raw),
        error => {
          assert.equal(error.code, 'INVALID_SRT_LANGUAGE');
          assert.match(error.message, /ja/);
          assert.match(error.message, /bilingual/);
          return true;
        },
        `expected ${JSON.stringify(raw)} to be refused`,
      );
    }
  });

  it('reports a missing value separately', () => {
    assertSrtError(() => resolveSrtLanguage(undefined), 'MISSING_SRT_VALUE');
    assertSrtError(() => resolveSrtLanguage(null), 'MISSING_SRT_VALUE');
  });
});

describe('parseSrt', () => {
  it('parses BOM/CRLF input and preserves multi-line text', () => {
    const source = '\uFEFF1\r\n00:00:01,170 --> 00:00:05,440\r\nline one\r\nline two\r\n\r\n'
      + '2\r\n01:02:03,004 --> 01:02:04,500\r\nsecond\r\n';
    const cues = parseSrt(source);
    assert.deepEqual(cues.map(cue => ({startMs: msOf(cue.start), endMs: msOf(cue.end), text: cue.text})), [
      {startMs: 1170, endMs: 5440, text: 'line one\nline two'},
      {startMs: 3723004, endMs: 3724500, text: 'second'},
    ]);
  });

  it('accepts index-less blocks and ignores a position hint', () => {
    const cues = parseSrt('00:00:00,500 --> 00:00:01,500 X1:100 X2:200 Y1:10 Y2:20\nhello');
    assert.equal(cues.length, 1);
    assert.equal(msOf(cues[0].start), 500);
    assert.equal(msOf(cues[0].end), 1500);
    assert.equal(cues[0].text, 'hello');
  });

  it('skips unusable blocks and handles empty input', () => {
    const cues = parseSrt('1\nnot a timecode\n\n2\n00:00:02,000 --> 00:00:03,000\nkept');
    assert.equal(cues.length, 1);
    assert.equal(cues[0].text, 'kept');
    assert.deepEqual(parseSrt(''), []);
  });

  it('rejects a missing text value', () => {
    assertSrtError(() => parseSrt(null), 'MISSING_SRT_VALUE');
  });
});

describe('formatSrtTime', () => {
  it('formats whole milliseconds and clamps negatives to zero', () => {
    assert.equal(formatSrtTime(0), '00:00:00,000');
    assert.equal(formatSrtTime(12000), '00:00:12,000');
    assert.equal(formatSrtTime(3661123), '01:01:01,123');
    assert.equal(formatSrtTime(360000000), '100:00:00,000');
    assert.equal(formatSrtTime(-1), '00:00:00,000');
    assert.equal(formatSrtTime(-123456), '00:00:00,000');
  });
});

describe('cropCues', () => {
  const SHIFT_SECONDS = 10;
  const WINDOW_SECONDS = 12;
  const sourceCues = [
    {start: 2, end: 9.9, text: 'before'},
    {start: 8, end: 10, text: 'ends exactly at window start'},
    {start: 9.5, end: 12, text: 'crosses start'},
    {start: 10, end: 11, text: 'starts at window start'},
    {start: 15, end: 17, text: 'inside'},
    {start: 15.5, end: 16.5, text: 'line one\nline two'},
    {start: 15.0001, end: 15.0004, text: 'rounds to zero length'},
    {start: 17, end: 22, text: 'ends exactly at window end'},
    {start: 22, end: 23, text: 'starts at window end'},
    {start: 22.5, end: 24, text: 'after'},
    {start: 19, end: 23, text: 'crosses end'},
    {start: 5, end: 30, text: 'encloses window'},
  ];

  it('handles every boundary of a 12 s window and keeps the output invariant', () => {
    const {cues, stats} = cropCues(sourceCues, {
      shiftSeconds: SHIFT_SECONDS,
      durationSeconds: WINDOW_SECONDS,
    });
    assert.deepEqual(cues, [
      {index: 1, startMs: 0, endMs: 2000, text: 'crosses start'},
      {index: 2, startMs: 0, endMs: 1000, text: 'starts at window start'},
      {index: 3, startMs: 5000, endMs: 7000, text: 'inside'},
      {index: 4, startMs: 5500, endMs: 6500, text: 'line one\nline two'},
      {index: 5, startMs: 7000, endMs: 12000, text: 'ends exactly at window end'},
      {index: 6, startMs: 9000, endMs: 12000, text: 'crosses end'},
      {index: 7, startMs: 0, endMs: 12000, text: 'encloses window'},
    ]);
    assert.deepEqual(stats, {
      input: 12,
      output: 7,
      droppedBefore: 2,
      droppedAfter: 2,
      droppedZeroLength: 1,
      clippedStart: 2,
      clippedEnd: 2,
      firstStartMs: 0,
      lastEndMs: 12000,
      windowStartMs: 0,
      windowEndMs: 12000,
    });
    assert.deepEqual(cues.map(cue => cue.index), [1, 2, 3, 4, 5, 6, 7]);
    assert.equal(stats.output, cues.length);
    for (const cue of cues) {
      assert.ok(Number.isInteger(cue.startMs) && Number.isInteger(cue.endMs), 'ms must be integers');
      assert.ok(
        0 <= cue.startMs && cue.startMs < cue.endMs && cue.endMs <= stats.windowEndMs,
        `invariant violated: ${cue.startMs}..${cue.endMs}`,
      );
    }
  });

  it('serializes the crop into a file whose content matches the stats', () => {
    const {cues, stats} = cropCues(sourceCues, {
      shiftSeconds: SHIFT_SECONDS,
      durationSeconds: WINDOW_SECONDS,
    });
    const text = serializeSrt(cues);
    assert.ok(text.endsWith('\n\n'), 'SRT must end with a blank line');
    const numbering = [...text.matchAll(/(?:^|\n\n)(\d+)\n\d{2}:/g)].map(match => Number(match[1]));
    assert.deepEqual(numbering, [1, 2, 3, 4, 5, 6, 7]);

    const reparsed = parseSrt(text);
    assert.equal(reparsed.length, stats.output);
    assert.deepEqual(
      reparsed.map(cue => ({startMs: msOf(cue.start), endMs: msOf(cue.end), text: cue.text})),
      cues.map(cue => ({startMs: cue.startMs, endMs: cue.endMs, text: cue.text})),
    );
    assert.equal(msOf(reparsed[0].start), stats.firstStartMs);
    assert.equal(msOf(reparsed.at(-1).end), stats.lastEndMs);
  });

  it('uses song time unchanged for a whole film (shift 0, no extra 64 ms)', () => {
    const windowSeconds = 252.25;
    const {cues, stats} = cropCues([
      {start: 1.17, end: 5.44, text: 'first'},
      {start: 44.064, end: 44.5, text: 'offset must not leak in'},
      {start: 252.2, end: 252.25, text: 'ends at film end'},
      {start: 252.24, end: 252.24, text: 'rounds to zero length'},
      {start: 252.25, end: 252.3, text: 'starts at film end'},
      {start: 250, end: 253, text: 'crosses film end'},
    ], {shiftSeconds: 0, durationSeconds: windowSeconds});

    assert.deepEqual(cues, [
      {index: 1, startMs: 1170, endMs: 5440, text: 'first'},
      {index: 2, startMs: 44064, endMs: 44500, text: 'offset must not leak in'},
      {index: 3, startMs: 252200, endMs: 252250, text: 'ends at film end'},
      {index: 4, startMs: 250000, endMs: 252250, text: 'crosses film end'},
    ]);
    // A hidden +64 ms film offset would make the first cue start at 1234.
    assert.equal(cues[0].startMs, 1170);
    assert.deepEqual(stats, {
      input: 6,
      output: 4,
      droppedBefore: 0,
      droppedAfter: 1,
      droppedZeroLength: 1,
      clippedStart: 0,
      clippedEnd: 1,
      firstStartMs: 1170,
      lastEndMs: 252250,
      windowStartMs: 0,
      windowEndMs: 252250,
    });
    for (const cue of cues) {
      assert.ok(0 <= cue.startMs && cue.startMs < cue.endMs && cue.endMs <= 252250);
    }
  });

  it('reports null extrema when nothing intersects the window', () => {
    const {cues, stats} = cropCues(
      [{start: 0, end: 0.5, text: 'past'}, {start: 20, end: 21, text: 'future'}],
      {shiftSeconds: 5, durationSeconds: 12},
    );
    assert.deepEqual(cues, []);
    assert.deepEqual(stats, {
      input: 2,
      output: 0,
      droppedBefore: 1,
      droppedAfter: 1,
      droppedZeroLength: 0,
      clippedStart: 0,
      clippedEnd: 0,
      firstStartMs: null,
      lastEndMs: null,
      windowStartMs: 0,
      windowEndMs: 12000,
    });
    assert.equal(serializeSrt(cues), '');
  });

  it('refuses a missing shift or duration', () => {
    assertSrtError(() => cropCues([]), 'MISSING_SRT_VALUE');
    assertSrtError(() => cropCues([], {durationSeconds: 12}), 'MISSING_SRT_VALUE');
    assertSrtError(() => cropCues([], {shiftSeconds: 0}), 'MISSING_SRT_VALUE');
    assertSrtError(() => cropCues([], {shiftSeconds: 0, durationSeconds: Number.NaN}), 'MISSING_SRT_VALUE');
    assertSrtError(() => cropCues(null, {shiftSeconds: 0, durationSeconds: 12}), 'MISSING_SRT_VALUE');
  });
});

describe('serializeSrt', () => {
  it('writes numbered blocks, blank lines between and after them, and no content for no cues', () => {
    const text = serializeSrt([
      {index: 1, startMs: 0, endMs: 1200, text: 'one\ntwo'},
      {index: 2, startMs: 3661123, endMs: 3662000, text: 'three'},
    ]);
    assert.equal(
      text,
      '1\n00:00:00,000 --> 00:00:01,200\none\ntwo\n\n'
        + '2\n01:01:01,123 --> 01:01:02,000\nthree\n\n',
    );
    assert.equal(serializeSrt([]), '');
  });
});
