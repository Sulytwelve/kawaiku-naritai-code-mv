import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {registerFontSlot, fontStatuses, reportFontWarnings} from '../font-slots.mjs';

const require = createRequire(import.meta.url);
const {GlobalFonts} = require('@napi-rs/canvas');

function systemFontCandidates() {
  const windows = process.env.WINDIR || 'C:/Windows';
  return [
    path.join(windows, 'Fonts', 'arial.ttf'),
    path.join(windows, 'Fonts', 'segoeui.ttf'),
    path.join(windows, 'Fonts', 'msyh.ttc'),
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
    '/System/Library/Fonts/Supplemental/Arial.ttf',
  ];
}

function findSystemFont() {
  return systemFontCandidates().find(candidate => fs.existsSync(candidate)) ?? null;
}

function temporaryDirectory(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'font-slots-test-'));
  t.after(() => fs.rmSync(directory, {recursive: true, force: true}));
  return directory;
}

function withEnvironmentValue(t, name, value) {
  const previous = process.env[name];
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
  t.after(() => {
    if (previous === undefined) delete process.env[name];
    else process.env[name] = previous;
  });
}

test('registered: a decodable system font records the environment source', t => {
  const fontPath = findSystemFont();
  if (!fontPath) {
    t.skip('no system font is available for a successful registration');
    return;
  }
  const envName = 'FONT_SLOTS_TEST_REGISTERED';
  withEnvironmentValue(t, envName, fontPath);
  const family = 'FontSlotsTestRegistered';
  const result = registerFontSlot({
    slot: 'FontSlotsRegistered',
    family,
    env: envName,
    defaultPath: null,
    defaultSource: 'repository-default',
  });

  assert.equal(result.status, 'registered');
  assert.equal(result.family, family);
  assert.equal(result.env, envName);
  assert.equal(result.path, path.resolve(fontPath));
  assert.equal(result.source, 'environment');
  assert.equal(result.reason, null);
  assert.equal(result.verifiedFamilyPresent, true);

  const snapshot = fontStatuses();
  const stored = snapshot.slots.find(status => status.slot === 'FontSlotsRegistered');
  assert.deepEqual(stored, result);
  assert.ok(snapshot.registered.includes(family));
  assert.ok(!snapshot.unavailable.includes(family));
});

test('missing-file: an absent path is recorded without claiming registration', t => {
  const missingPath = path.join(
    temporaryDirectory(t),
    'absent-font.ttf',
  );
  const result = registerFontSlot({
    slot: 'FontSlotsMissing',
    family: 'FontSlotsMissing',
    env: null,
    defaultPath: missingPath,
    defaultSource: 'platform-default',
  });

  assert.equal(result.status, 'missing-file');
  assert.equal(result.path, path.resolve(missingPath));
  assert.equal(result.source, 'platform-default');
  assert.equal(result.reason, 'file not found');
  assert.equal(result.verifiedFamilyPresent, null);
});

test('register-failed: an existing but undecodable file is not reported as registered', t => {
  const directory = temporaryDirectory(t);
  const garbagePath = path.join(directory, 'garbage.ttf');
  fs.writeFileSync(garbagePath, Buffer.from('this is not a font\n'.repeat(256)));

  const result = registerFontSlot({
    slot: 'FontSlotsGarbage',
    family: 'FontSlotsGarbage',
    env: null,
    defaultPath: garbagePath,
    defaultSource: 'repository-default',
  });

  assert.equal(result.status, 'register-failed');
  assert.equal(result.path, path.resolve(garbagePath));
  assert.equal(result.source, 'repository-default');
  assert.match(result.reason, /registerFromPath returned/);
  assert.equal(result.verifiedFamilyPresent, null);
});

test('not-configured: no environment variable and no default path', t => {
  const errorMock = t.mock.method(console, 'error');
  const wrapMock = t.mock.method(console, 'warn');
  const logMock = t.mock.method(console, 'log');
  const result = registerFontSlot({
    slot: 'FontSlotsUnconfigured',
    family: 'FontSlotsUnconfigured',
    env: null,
    defaultPath: null,
  });

  assert.equal(result.status, 'not-configured');
  assert.equal(result.path, null);
  assert.equal(result.source, null);
  assert.match(result.reason, /no font path configured/);
  assert.equal(result.verifiedFamilyPresent, null);
  assert.equal(errorMock.mock.callCount() + wrapMock.mock.callCount() + logMock.mock.callCount(), 0,
    'registerFontSlot must stay silent');
});

test('an environment path takes precedence over the platform default', t => {
  const envName = 'FONT_SLOTS_TEST_PRIORITY';
  const directory = temporaryDirectory(t);
  const envPath = path.join(directory, 'from-env.ttf');
  const defaultPath = path.join(directory, 'platform-default.ttf');
  withEnvironmentValue(t, envName, envPath);

  const result = registerFontSlot({
    slot: 'FontSlotsPriority',
    family: 'FontSlotsPriority',
    env: envName,
    defaultPath,
    defaultSource: 'platform-default',
  });

  assert.equal(result.status, 'missing-file');
  assert.equal(result.source, 'environment');
  assert.equal(result.path, path.resolve(envPath));
  assert.notEqual(result.path, path.resolve(defaultPath));
});

test('null, undefined and thrown registration results all become register-failed', t => {
  const directory = temporaryDirectory(t);
  const fixturePath = path.join(directory, 'fixture.ttf');
  fs.writeFileSync(fixturePath, Buffer.from('not a font\n'.repeat(64)));
  const cases = [
    ['NullResult', () => null, /returned null/],
    ['UndefinedResult', () => undefined, /returned undefined/],
    ['ThrownResult', () => { throw new Error('synthetic font failure'); }, /threw: synthetic font failure/],
  ];

  for (const [suffix, implementation, expectedReason] of cases) {
    t.mock.method(GlobalFonts, 'registerFromPath', implementation);
    const result = registerFontSlot({
      slot: `FontSlots${suffix}`,
      family: `FontSlots${suffix}`,
      env: null,
      defaultPath: fixturePath,
      defaultSource: 'repository-default',
    });
    assert.equal(result.status, 'register-failed');
    assert.match(result.reason, expectedReason);
    assert.equal(result.verifiedFamilyPresent, null);
    t.mock.restoreAll();
  }
});

test('a successful return whose family is absent is flagged by the cross-check', t => {
  const directory = temporaryDirectory(t);
  const fixturePath = path.join(directory, 'fixture.ttf');
  fs.writeFileSync(fixturePath, Buffer.from('fixture bytes\n'));
  t.mock.method(GlobalFonts, 'registerFromPath', () => ({mock: true}));

  const result = registerFontSlot({
    slot: 'FontSlotsUnverified',
    family: 'FontSlotsUnverified',
    env: null,
    defaultPath: fixturePath,
    defaultSource: 'repository-default',
  });

  assert.equal(result.status, 'registered');
  assert.equal(result.verifiedFamilyPresent, false);
  t.mock.restoreAll();
});

test('the three production slots keep independent statuses and paths', t => {
  const directory = temporaryDirectory(t);
  withEnvironmentValue(t, 'MV_FONT_PATH', undefined);
  withEnvironmentValue(t, 'MV_TITLE_FONT_PATH', undefined);
  withEnvironmentValue(t, 'MV_SOURCE_FONT_PATH', undefined);

  const configs = [
    {
      slot: 'MV Gothic',
      family: 'MV Gothic',
      env: 'MV_FONT_PATH',
      defaultPath: path.join(directory, 'mv-gothic.ttf'),
      defaultSource: 'platform-default',
    },
    {
      slot: 'TitleRound',
      family: 'TitleRound',
      env: 'MV_TITLE_FONT_PATH',
      defaultPath: path.join(directory, 'title-round.ttf'),
      defaultSource: 'platform-default',
    },
    {
      slot: 'SourceDisplay',
      family: 'SourceDisplay',
      env: 'MV_SOURCE_FONT_PATH',
      defaultPath: path.join(directory, 'source-display.ttf'),
      defaultSource: 'repository-default',
    },
  ];
  for (const config of configs) {
    const result = registerFontSlot(config);
    assert.equal(result.status, 'missing-file');
  }

  const snapshot = fontStatuses();
  const bySlot = new Map(snapshot.slots.map(status => [status.slot, status]));
  for (const config of configs) {
    const status = bySlot.get(config.slot);
    assert.ok(status, `missing status for ${config.slot}`);
    assert.equal(status.family, config.family);
    assert.equal(status.env, config.env);
    assert.equal(status.path, path.resolve(config.defaultPath));
    assert.equal(status.source, config.defaultSource);
    assert.equal(status.reason, 'file not found');
  }
  assert.equal(new Set(configs.map(config => bySlot.get(config.slot).path)).size, 3);
  for (const family of ['MV Gothic', 'TitleRound', 'SourceDisplay']) {
    assert.ok(snapshot.unavailable.includes(family));
  }
});

test('reportFontWarnings prints each unavailable slot once per process', t => {
  const directory = temporaryDirectory(t);
  withEnvironmentValue(t, 'MV_FONT_PATH', undefined);
  withEnvironmentValue(t, 'MV_TITLE_FONT_PATH', undefined);
  withEnvironmentValue(t, 'MV_SOURCE_FONT_PATH', undefined);
  const configs = [
    ['MV Gothic', 'MV Gothic', 'MV_FONT_PATH', 'mv-gothic.ttf', 'platform-default'],
    ['TitleRound', 'TitleRound', 'MV_TITLE_FONT_PATH', 'title-round.ttf', 'platform-default'],
    ['SourceDisplay', 'SourceDisplay', 'MV_SOURCE_FONT_PATH', 'source-display.ttf', 'repository-default'],
  ];
  for (const [slot, family, env, file, defaultSource] of configs) {
    registerFontSlot({
      slot,
      family,
      env,
      defaultPath: path.join(directory, file),
      defaultSource,
    });
  }

  const lines = [];
  reportFontWarnings({write: line => lines.push(line)});

  assert.ok(lines.length >= 3);
  for (const slot of ['MV Gothic', 'TitleRound', 'SourceDisplay']) {
    assert.ok(lines.some(line => line.includes(`"${slot}"`)), `missing warning for ${slot}`);
  }
  for (const envName of ['MV_FONT_PATH', 'MV_TITLE_FONT_PATH', 'MV_SOURCE_FONT_PATH']) {
    assert.ok(lines.some(line => line.includes(envName)), `missing env variable ${envName} in warnings`);
  }
  assert.ok(lines.every(line => line.startsWith('WARNING: font slot ')));
  assert.ok(lines.every(line => line.includes('Glyph coverage is not checked')));

  const secondPass = [];
  reportFontWarnings({write: line => secondPass.push(line)});
  assert.deepEqual(secondPass, []);
});
