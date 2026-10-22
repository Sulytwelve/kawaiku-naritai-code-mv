// Focused tests for production/mv/audio-input.mjs. All audio fixtures are tiny
// synthetic files under os.tmpdir(); no real music, rendering, or font input is
// required. The tracked ASSET_INDEX.json is only read, and its bytes are checked.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {AudioInputError, readDeclaredAudio, resolveAudioInput} from '../audio-input.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const REPO_INDEX = path.join(REPO_ROOT, 'assets', 'ASSET_INDEX.json');
const EMPTY_OVERRIDE_REASON = 'MV_AUDIO_PATH is empty; using ASSET_INDEX.audio';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kawaiku-audio-input-'));
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
  return root;
}

function writeIndex(root, audio) {
  const indexPath = path.join(root, 'assets', 'ASSET_INDEX.json');
  fs.mkdirSync(path.dirname(indexPath), {recursive: true});
  fs.writeFileSync(indexPath, `${JSON.stringify({audio, visualAssets: 'assets/visuals/'}, null, 2)}\n`);
  return indexPath;
}

function writeAudio(root, relativePath) {
  assert.equal(relativePath.includes('\\'), false, 'fixture paths use forward slashes');
  const target = path.join(root, ...relativePath.split('/'));
  fs.mkdirSync(path.dirname(target), {recursive: true});
  fs.writeFileSync(target, 'synthetic audio fixture; never decoded');
  return target;
}

function audioError(fn, code) {
  let caught;
  try {
    fn();
  } catch (error) {
    caught = error;
  }
  assert.ok(caught instanceof AudioInputError, `expected AudioInputError, got ${caught}`);
  assert.equal(caught.code, code);
  return caught;
}

test('MV_AUDIO_PATH wins over ASSET_INDEX.audio', (t) => {
  const root = fixture(t);
  // The manifest points at a missing file so a silent fallback would throw.
  const indexPath = writeIndex(root, 'assets/audio/manifest missing.mp3');
  const override = writeAudio(root, 'assets/audio/override exists.mp3');

  const result = resolveAudioInput({root, indexPath, envAudioPath: override});

  assert.equal(result.enabled, true);
  assert.equal(result.variable, 'MV_AUDIO_PATH');
  assert.equal(result.source, 'environment');
  assert.equal(result.declared, null);
  assert.equal(result.resolvedPath, path.resolve(override));
  assert.equal(result.relativePath, 'assets/audio/override exists.mp3');
  assert.equal(result.exists, true);
  assert.equal(result.reason, null);
});

test('an environment override does not require ASSET_INDEX.json', (t) => {
  const root = fixture(t);
  const indexPath = path.join(root, 'assets', 'ASSET_INDEX.json');
  const override = writeAudio(root, 'assets/audio/no index needed.mp3');

  const result = resolveAudioInput({root, indexPath, envAudioPath: override});

  assert.equal(result.source, 'environment');
  assert.equal(result.exists, true);
  assert.equal(fs.existsSync(indexPath), false, 'resolver must not create the index');
});

test('unset MV_AUDIO_PATH uses the manifest declaration', (t) => {
  const root = fixture(t);
  const declared = 'assets/audio/清单 歌曲.mp3';
  const indexPath = writeIndex(root, declared);
  const target = writeAudio(root, declared);

  for (const envAudioPath of [undefined, null]) {
    const result = resolveAudioInput({root, indexPath, envAudioPath});
    assert.equal(result.enabled, true);
    assert.equal(result.variable, null);
    assert.equal(result.source, 'asset-index');
    assert.equal(result.declared, declared);
    assert.equal(result.resolvedPath, target);
    assert.equal(result.relativePath, declared);
    assert.equal(result.exists, true);
    assert.equal(result.reason, null);
  }
});

test('empty or whitespace-only MV_AUDIO_PATH falls back with a recorded reason', (t) => {
  const root = fixture(t);
  const declared = 'assets/audio/fallback.mp3';
  const indexPath = writeIndex(root, declared);
  const target = writeAudio(root, declared);

  for (const envAudioPath of ['', '   ', '\t\r\n']) {
    const result = resolveAudioInput({root, indexPath, envAudioPath});
    assert.equal(result.source, 'asset-index');
    assert.equal(result.variable, null);
    assert.equal(result.declared, declared);
    assert.equal(result.resolvedPath, target);
    assert.equal(result.exists, true);
    assert.equal(result.reason, EMPTY_OVERRIDE_REASON);
  }
});

test('a relative override resolves against root, with spaces, Chinese and POSIX separators', (t) => {
  const root = fixture(t);
  const declared = 'assets/audio/manifest only.mp3';
  const indexPath = writeIndex(root, declared);
  writeAudio(root, declared);
  const relative = 'assets/audio/相对 音轨 (preview).mp3';
  const target = writeAudio(root, relative);

  const result = resolveAudioInput({root, indexPath, envAudioPath: relative});

  assert.equal(result.source, 'environment');
  assert.equal(result.resolvedPath, target);
  assert.equal(result.relativePath, relative);
  assert.equal(result.exists, true);
});

test('an absolute override is used directly, even outside root, with spaces and Chinese', (t) => {
  const root = fixture(t);
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'kawaiku-audio-outside-'));
  t.after(() => fs.rmSync(outside, {recursive: true, force: true}));
  const absolute = path.join(outside, '外部 音轨（绝对）.mp3');
  fs.writeFileSync(absolute, 'synthetic audio fixture; never decoded');

  for (const envAudioPath of [absolute, absolute.split(path.sep).join('/'), `  ${absolute}  `]) {
    const result = resolveAudioInput({
      root,
      indexPath: path.join(root, 'assets', 'ASSET_INDEX.json'),
      envAudioPath,
    });
    assert.equal(result.source, 'environment');
    assert.equal(result.resolvedPath, path.resolve(absolute));
    assert.equal(result.relativePath, null);
    assert.equal(result.exists, true);
  }
});

test('Windows backslash relative overrides resolve with native path semantics', {
  skip: process.platform !== 'win32' ? 'Windows-only path form' : false,
}, (t) => {
  const root = fixture(t);
  const relative = path.join('assets', 'audio', '反斜杠 音轨.mp3');
  const target = writeAudio(root, relative.split(path.sep).join('/'));

  const result = resolveAudioInput({root, envAudioPath: relative});

  assert.equal(result.source, 'environment');
  assert.equal(result.resolvedPath, target);
  assert.equal(result.relativePath, 'assets/audio/反斜杠 音轨.mp3');
  assert.equal(result.exists, true);
});

test('a missing MV_AUDIO_PATH raises AUDIO_OVERRIDE_INVALID and never falls back', (t) => {
  const root = fixture(t);
  const declared = 'assets/audio/manifest exists.mp3';
  const indexPath = writeIndex(root, declared);
  writeAudio(root, declared);
  const missing = path.join(root, 'assets', 'audio', 'override missing.mp3');

  const error = audioError(
    () => resolveAudioInput({root, indexPath, envAudioPath: missing}),
    'AUDIO_OVERRIDE_INVALID',
  );

  assert.ok(error.message.includes(missing), 'message should contain the resolved path');
  assert.ok(error.message.includes('source: environment'));
  assert.ok(error.message.includes('MV_AUDIO_PATH'));
  assert.ok(error.message.includes('--no-audio'));
  assert.equal(error.details.source, 'environment');
  assert.equal(error.details.resolvedPath, missing);
  assert.equal(error.details.declared, null);
});

test('a missing manifest audio file raises AUDIO_INDEX_INVALID', (t) => {
  const root = fixture(t);
  const declared = 'assets/audio/declared missing.mp3';
  const indexPath = writeIndex(root, declared);
  const missing = path.resolve(root, declared);

  const error = audioError(() => resolveAudioInput({root, indexPath}), 'AUDIO_INDEX_INVALID');

  assert.ok(error.message.includes(missing), 'message should contain the resolved path');
  assert.ok(error.message.includes('source: asset-index'));
  assert.ok(error.message.includes('MV_AUDIO_PATH'));
  assert.ok(error.message.includes('--no-audio'));
  assert.equal(error.details.source, 'asset-index');
  assert.equal(error.details.declared, declared);
  assert.equal(error.details.resolvedPath, missing);
  assert.equal(error.details.indexPath, indexPath);
});

test('enabled:false reports existence but does not throw', (t) => {
  const root = fixture(t);
  const declared = 'assets/audio/disabled missing.mp3';
  const indexPath = writeIndex(root, declared);

  const byIndex = resolveAudioInput({root, indexPath, envAudioPath: '', enabled: false});
  assert.equal(byIndex.enabled, false);
  assert.equal(byIndex.source, 'asset-index');
  assert.equal(byIndex.variable, null);
  assert.equal(byIndex.declared, declared);
  assert.equal(byIndex.exists, false);
  assert.equal(byIndex.reason, EMPTY_OVERRIDE_REASON);

  const missingOverride = path.join(root, 'assets', 'audio', 'disabled override.mp3');
  const byEnvironment = resolveAudioInput({
    root, indexPath, envAudioPath: missingOverride, enabled: false,
  });
  assert.equal(byEnvironment.enabled, false);
  assert.equal(byEnvironment.source, 'environment');
  assert.equal(byEnvironment.variable, 'MV_AUDIO_PATH');
  assert.equal(byEnvironment.exists, false);
  assert.equal(byEnvironment.reason, null);

  const existing = writeAudio(root, 'assets/audio/disabled present.mp3');
  const present = resolveAudioInput({root, indexPath, envAudioPath: existing, enabled: false});
  assert.equal(present.enabled, false);
  assert.equal(present.exists, true);
});

test('a missing index is refused when enabled, while an override works when disabled', (t) => {
  const root = fixture(t);
  const indexPath = path.join(root, 'assets', 'ASSET_INDEX.json');

  const error = audioError(() => resolveAudioInput({root, indexPath, enabled: true}), 'AUDIO_INDEX_INVALID');
  assert.ok(error.message.includes(indexPath));

  const result = resolveAudioInput({
    root,
    indexPath,
    envAudioPath: path.join(root, 'assets', 'audio', 'missing.mp3'),
    enabled: false,
  });
  assert.equal(result.enabled, false);
  assert.equal(result.exists, false);
  assert.equal(result.source, 'environment');
});

test('manifest values containing a slash are project-relative', (t) => {
  const root = fixture(t);
  const declared = 'other/audio/题 目.mp3';
  const indexPath = writeIndex(root, declared);
  const target = writeAudio(root, declared);

  const result = resolveAudioInput({root, indexPath});

  assert.equal(result.source, 'asset-index');
  assert.equal(result.declared, declared);
  assert.equal(result.resolvedPath, target);
  assert.equal(result.relativePath, declared);
  assert.equal(result.exists, true);
});

test('a bare manifest filename means assets/audio/<name>', (t) => {
  const root = fixture(t);
  const declared = 'bare track.mp3';
  const indexPath = writeIndex(root, declared);
  const target = writeAudio(root, 'assets/audio/bare track.mp3');

  const result = resolveAudioInput({root, indexPath});

  assert.equal(result.source, 'asset-index');
  assert.equal(result.declared, declared);
  assert.equal(result.resolvedPath, target);
  assert.equal(result.relativePath, 'assets/audio/bare track.mp3');
  assert.equal(result.exists, true);
});

test('an absolute manifest value is never rebased under root', (t) => {
  const root = fixture(t);
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'kawaiku-audio-manifest-'));
  t.after(() => fs.rmSync(outside, {recursive: true, force: true}));
  const absolute = path.join(outside, 'manifest absolute.mp3');
  fs.writeFileSync(absolute, 'synthetic audio fixture; never decoded');
  const indexPath = writeIndex(root, absolute);

  const result = resolveAudioInput({root, indexPath});

  assert.equal(result.source, 'asset-index');
  assert.equal(result.declared, absolute);
  assert.equal(result.resolvedPath, path.resolve(absolute));
  assert.equal(result.relativePath, null);
  assert.equal(result.exists, true);
});

test('readDeclaredAudio returns the raw declaration and rejects unusable indexes', (t) => {
  const root = fixture(t);
  const declared = 'assets/audio/raw value.mp3';
  const indexPath = writeIndex(root, declared);
  assert.equal(readDeclaredAudio(indexPath), declared);

  const missingIndex = path.join(root, 'assets', 'missing-index.json');
  const missingError = audioError(() => readDeclaredAudio(missingIndex), 'AUDIO_INDEX_INVALID');
  assert.ok(missingError.message.includes(missingIndex));

  const badJson = path.join(root, 'assets', 'bad.json');
  fs.writeFileSync(badJson, '{not json');
  audioError(() => readDeclaredAudio(badJson), 'AUDIO_INDEX_INVALID');

  const noAudio = path.join(root, 'assets', 'no-audio.json');
  fs.writeFileSync(noAudio, JSON.stringify({visualAssets: 'assets/visuals/'}));
  audioError(() => readDeclaredAudio(noAudio), 'AUDIO_INDEX_INVALID');
});

test('resolution never rewrites the tracked ASSET_INDEX.json', () => {
  const before = fs.readFileSync(REPO_INDEX);
  const declared = readDeclaredAudio(REPO_INDEX);
  const result = resolveAudioInput({
    root: REPO_ROOT,
    indexPath: REPO_INDEX,
    envAudioPath: '',
    enabled: false,
  });
  const after = fs.readFileSync(REPO_INDEX);

  assert.ok(before.equals(after), 'assets/ASSET_INDEX.json bytes changed');
  assert.equal(result.source, 'asset-index');
  assert.equal(result.declared, declared);
  assert.equal(result.reason, EMPTY_OVERRIDE_REASON);
});
