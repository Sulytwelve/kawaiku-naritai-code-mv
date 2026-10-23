// End-to-end checks for the render-film.mjs CLI contract: dry-run planning for
// encoders, bit depths, subtitle languages and the MV_AUDIO_PATH override.
// These spawn the real entry point so argument parsing, validation order and
// exit codes are covered the same way a user invokes them.
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const ENTRY = path.join(ROOT, 'production/mv/render-film.mjs');
const PLAN = path.join(ROOT, 'qa/mv/film-render-plan.json');
const OUT = 'qa/mv/v-cli-plan.mp4';

const CLEAN_VARIABLES = ['MV_AUDIO_PATH', 'MV_FONT_PATH', 'MV_TITLE_FONT_PATH', 'MV_SOURCE_FONT_PATH'];

function cleanEnv(overrides = {}) {
  const env = {...process.env};
  for (const key of CLEAN_VARIABLES) delete env[key];
  return {...env, ...overrides};
}

function run(extra = [], {env = cleanEnv()} = {}) {
  const result = spawnSync(
    process.execPath,
    [ENTRY, '--output-range', '44', '44.5', '--width', '320', '--preview-release', '--dry-run', '--out', OUT, ...extra],
    {cwd: ROOT, encoding: 'utf8', env},
  );
  return {status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '', error: result.error};
}

function clearPlan() {
  fs.rmSync(PLAN, {force: true});
}

function successfulPlan(extra, options) {
  clearPlan();
  const result = run(extra, options);
  assert.equal(result.status, 0, `dry-run failed:\n${result.stdout}\n${result.stderr}`);
  assert.ok(fs.existsSync(PLAN), 'dry-run must write qa/mv/film-render-plan.json');
  return {result, plan: JSON.parse(fs.readFileSync(PLAN, 'utf8'))};
}

function refused(extra, options) {
  clearPlan();
  const result = run(extra, options);
  assert.equal(result.status, 2, `expected exit 2, got ${result.status}:\n${result.stdout}\n${result.stderr}`);
  assert.match(result.stderr, /REFUSED/);
  assert.equal(fs.existsSync(PLAN), false, 'a refused CLI must not leave a new plan behind');
  return result;
}

function indexOf(sequence, value) {
  return sequence.indexOf(value);
}

// For checks that must not inherit the shared --out/--width/--output-range:
// the CLI reads the first occurrence of each flag, so a conflict case builds its
// own argv instead of appending overrides.
const BASE = ['--output-range', '44', '44.5', '--width', '320'];

function runArgs(argv, {env = cleanEnv()} = {}) {
  const result = spawnSync(process.execPath, [ENTRY, ...argv], {cwd: ROOT, encoding: 'utf8', env});
  return {status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '', error: result.error};
}

function refusedArgs(argv, options) {
  clearPlan();
  const result = runArgs([...argv, '--preview-release', '--dry-run'], options);
  assert.equal(result.status, 2, `expected exit 2, got ${result.status}:\n${result.stdout}\n${result.stderr}`);
  assert.match(result.stderr, /REFUSED/);
  assert.equal(fs.existsSync(PLAN), false, 'a refused CLI must not leave a new plan behind');
  return result;
}

test('default plan uses libx264 8-bit without AMF flags and reports every new field', () => {
  const {plan} = successfulPlan([]);
  assert.equal(plan.encoder.name, 'libx264');
  assert.equal(plan.encoder.family, 'h264');
  assert.equal(plan.encoder.backend, 'cpu');
  assert.equal(plan.encoder.bitDepth, 8);
  assert.equal(plan.encoder.outputPixelFormat, 'yuv420p');
  assert.ok(plan.encoder.params.includes('-preset'));
  assert.ok(plan.encoder.params.includes('-crf'));
  assert.equal(plan.encoder.paddingUnit, null);
  assert.equal(plan.ffmpegArgs.includes('-quality'), false);
  assert.equal(plan.ffmpegArgs.includes('-b:v'), false);
  assert.equal(plan.probe, null);
  assert.equal(plan.formatProbe, null);
  assert.equal(plan.subtitles.enabled, false);
  assert.equal(plan.subtitles.language, null);
  assert.equal(plan.subtitles.stats, null);
  assert.equal(plan.fonts.slots.length, 3);
  assert.equal(plan.audio.source, 'asset-index');
  assert.equal(plan.rendered, false);
  assert.equal(plan.frames, 30);
  assert.equal(plan.audioSeekSeconds, 44);
});

test('explicit av1_amf keeps -quality/-b:v, paddingUnit and the size warning', () => {
  const {result, plan} = successfulPlan(['--encoder', 'av1_amf', '--quality', 'speed', '--bitrate', '8M']);
  assert.equal(plan.encoder.name, 'av1_amf');
  assert.equal(plan.encoder.paddingUnit, 16);
  assert.deepEqual(plan.encoder.params, ['-quality', 'speed', '-b:v', '8M']);
  const args = plan.ffmpegArgs;
  const qualityAt = indexOf(args, '-quality');
  const bitrateAt = indexOf(args, '-b:v');
  assert.ok(qualityAt > 0 && bitrateAt > qualityAt);
  assert.equal(args[qualityAt + 1], 'speed');
  assert.equal(args[bitrateAt + 1], '8M');
  assert.match(result.stderr, /WARNING: av1_amf will pad 320x180/);
});

test('other FFmpeg encoders can be planned without a registry edit', () => {
  const {plan}=successfulPlan(['--encoder','ffv1','--encoder-options','{"level":3}']);
  assert.equal(plan.encoder.name,'ffv1');
  assert.deepEqual(plan.encoder.params,['-level','3']);
  assert.equal(plan.ffmpegArgs.includes('-crf'),false);
});

test('10-bit is refused for the default libx264 route and names libx265', () => {
  const result = refused(['--bit-depth', '10']);
  assert.match(result.stderr, /libx265/);
  assert.match(result.stderr, /10-bit/);
});

test('libx265 10-bit plans yuv420p10le after -c:v and still tags bt709', () => {
  const {plan} = successfulPlan(['--bit-depth', '10', '--encoder', 'libx265']);
  assert.equal(plan.encoder.name, 'libx265');
  assert.equal(plan.encoder.bitDepth, 10);
  assert.equal(plan.encoder.outputPixelFormat, 'yuv420p10le');
  const args = plan.ffmpegArgs;
  const codecAt = args.indexOf('-c:v');
  const pixAt = args.lastIndexOf('-pix_fmt');
  const colorAt = args.indexOf('-color_primaries');
  assert.equal(args[codecAt + 1], 'libx265');
  assert.equal(args[pixAt + 1], 'yuv420p10le');
  assert.ok(codecAt < pixAt && pixAt < colorAt, 'order must be codecArgs -> pixelFormatArgs -> colorArgs');
  assert.equal(args[colorAt + 1], 'bt709');
  assert.equal(args[args.indexOf('-color_trc') + 1], 'bt709');
  assert.equal(args[args.indexOf('-colorspace') + 1], 'bt709');
});

test('an invalid bit depth is refused and lists the allowed values', () => {
  const result = refused(['--bit-depth', '9']);
  assert.match(result.stderr, /8, 10/);
});

for (const language of ['zh', 'japanese']) {
  test(`--srt ${language} is refused and lists ja/bilingual`, () => {
    const result = refused(['--srt', language]);
    assert.match(result.stderr, /ja, bilingual/);
  });
}

test('--srt with no value is a missing-value refusal', () => {
  const result = refused(['--srt']);
  assert.match(result.stderr, /missing value for --srt/);
});

test('--srt followed by a flag is a missing-value refusal', () => {
  const result = refused(['--srt', '--no-audio']);
  assert.match(result.stderr, /missing value for --srt/);
  assert.doesNotMatch(result.stderr, /unsupported --srt value "--no-audio"/);
});

test('--srt ja --no-audio plans subtitles without reading cue data', () => {
  const {plan} = successfulPlan(['--srt', 'ja', '--no-audio']);
  assert.equal(plan.subtitles.enabled, true);
  assert.equal(plan.subtitles.language, 'ja');
  assert.equal(plan.subtitles.shiftSeconds, 44);
  assert.equal(plan.subtitles.durationSeconds, 0.5);
  assert.equal(plan.subtitles.stats, null);
  // The public clone ships no lyrics, so the flag must mirror the working copy
  // instead of assuming a prepared subtitle file (which would fail `npm test`
  // on a clean clone with no local media).
  assert.equal(
    plan.subtitles.sourceExists,
    fs.existsSync(path.join(ROOT, 'assets/subtitles/KAWAIKU NARITAI.ja.srt')),
  );
  assert.equal(plan.audio.enabled, false);
});

test('a missing MV_AUDIO_PATH file is planned truthfully under --dry-run', () => {
  const override = 'qa/mv/不存在 的 音轨.mp3';
  const {plan} = successfulPlan([], {env: cleanEnv({MV_AUDIO_PATH: override})});
  assert.equal(plan.audio.source, 'environment');
  assert.equal(plan.audio.variable, 'MV_AUDIO_PATH');
  assert.equal(plan.audio.exists, false);
  assert.equal(plan.audio.path, path.resolve(ROOT, override));
  assert.equal(path.isAbsolute(plan.audio.path), true);
});

test('an empty flag value is refused instead of becoming zero or the repo root', () => {
  for (const flag of ['--out', '--audio-offset', '--srt', '--quality', '--width']) {
    const result = refusedArgs(['--output-range', '44', '44.5', flag, '']);
    assert.match(result.stderr, new RegExp(`missing value for ${flag}`));
  }
});

test('a width without a whole even 16:9 height is refused before planning', () => {
  const result = refusedArgs(['--output-range', '44', '44.5', '--width', '1000']);
  assert.match(result.stderr, /multiple of 32/);
  assert.match(result.stderr, /562\.5/);
});

test('an inverted or out-of-span --range is refused instead of planning one frame', () => {
  for (const values of [['56', '44'], ['300', '400']]) {
    const result = refusedArgs(['--range', ...values, '--width', '320']);
    assert.match(result.stderr, /invalid --range/);
  }
});

test('the delivery guards compare Windows paths case-insensitively', {skip: process.platform !== 'win32'}, () => {
  refusedArgs([...BASE, '--out', 'deliverables/EXT-01_Kawaiku_Naritai_DeepSeek_4K60_AV1.MP4']);
  refusedArgs([...BASE, '--out', 'DELIVERABLES/EXT-01_Kawaiku_Naritai_DeepSeek_4K60_AV1.mp4']);
  refusedArgs([...BASE, '--fill-gaps', '--out', 'DELIVERABLES/slate.mp4']);
  refusedArgs([...BASE, '--fill-gaps', '--out', 'deliverables']);
});

test('Windows trailing dots and spaces cannot bypass the delivery guards', {skip: process.platform !== 'win32'}, () => {
  refusedArgs([...BASE, '--fill-gaps', '--out', 'deliverables./slate-dot.mp4']);
  refusedArgs([...BASE, '--fill-gaps', '--out', 'deliverables /slate-space.mp4']);
  refusedArgs([...BASE, '--out', 'deliverables/EXT-01_Kawaiku_Naritai_DeepSeek_4K60_AV1.mp4.']);
});

test('an existing directory cannot be used as --out', () => {
  const result = refusedArgs([...BASE, '--out', 'qa/mv']);
  assert.match(result.stderr, /must name a file/);
});
