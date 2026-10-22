// Structured font-slot registration diagnostics for the MV renderer.
//
// @napi-rs/canvas can report a failed registerFromPath() attempt by returning
// null/undefined instead of throwing, and a path existing on disk does not mean
// the file is a decodable font. This module records the attempted absolute path,
// where it came from, and the registration outcome, then reports warnings once
// per process. It does not check glyph coverage: a registered family can still
// miss glyphs, so text rendering needs its own visual review.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {GlobalFonts} = require('@napi-rs/canvas');

export class FontSlotError extends Error {
  constructor(message, {code, details} = {}) {
    super(message);
    this.name = 'FontSlotError';
    this.code = code;
    this.details = details;
  }
}

// Canonical order keeps plan/sidecar output stable even though scene.mjs and
// title-scenes.mjs register their slots during module evaluation.
const SLOT_ORDER = ['MV Gothic', 'TitleRound', 'SourceDisplay'];
const ENV_BY_SLOT = {
  'MV Gothic': 'MV_FONT_PATH',
  TitleRound: 'MV_TITLE_FONT_PATH',
  SourceDisplay: 'MV_SOURCE_FONT_PATH',
};

const slotStatuses = new Map();
let warningsReported = false;

// The contract passes the environment variable name (e.g. MV_FONT_PATH). A
// literal path is also accepted so the slot can be probed without mutating
// process.env; an explicit {name, value} pair covers programmatic callers.
function resolveEnvironment(env, slot) {
  if (env && typeof env === 'object') {
    const name = typeof env.name === 'string' && env.name.trim() ? env.name.trim() : null;
    return {env: name, value: typeof env.value === 'string' ? env.value.trim() : ''};
  }
  if (typeof env !== 'string' || !env.trim()) return {env: null, value: ''};
  const text = env.trim();
  const looksLikeName = Object.prototype.hasOwnProperty.call(process.env, text)
    || /^[A-Za-z_][A-Za-z0-9_]*$/.test(text);
  if (looksLikeName) {
    const value = process.env[text];
    return {env: text, value: typeof value === 'string' ? value.trim() : ''};
  }
  // Literal value: keep it in the status, and name the slot's variable in warnings.
  return {env: text, value: text};
}

function environmentVariableName(status) {
  if (typeof status.env === 'string' && /^[A-Za-z_][A-Za-z0-9_]*$/.test(status.env)) return status.env;
  return ENV_BY_SLOT[status.slot] ?? null;
}

function familyIsPresent(family) {
  try {
    const families = GlobalFonts.families;
    if (!Array.isArray(families)) return null;
    return families.some(entry => (typeof entry === 'string' ? entry : entry?.family) === family);
  } catch {
    return null;
  }
}

function describeError(error) {
  if (error instanceof Error) return error.message || error.name;
  return String(error);
}

function defaultSourceFor(defaultSource) {
  return defaultSource === 'platform-default' ? 'platform-default' : 'repository-default';
}

function storeStatus(status) {
  slotStatuses.set(status.slot, status);
  return {...status};
}

/**
 * Attempt to register one font slot and record the outcome. Registration
 * failures never throw: they are reported as status values so coverage and
 * dry-run planning can continue without the font.
 */
export function registerFontSlot({slot, family, env, defaultPath, defaultSource} = {}) {
  if (typeof slot !== 'string' || !slot.trim()) {
    throw new FontSlotError('font slot name is required', {code: 'INVALID_FONT_SLOT'});
  }
  if (typeof family !== 'string' || !family.trim()) {
    throw new FontSlotError(`font family is required for slot ${slot}`, {code: 'INVALID_FONT_SLOT'});
  }
  const slotName = slot.trim();
  const familyName = family.trim();
  const environment = resolveEnvironment(env, slotName);
  const configuredDefault = typeof defaultPath === 'string' && defaultPath.length > 0 ? defaultPath : null;

  let source = null;
  let target = null;
  if (environment.value) {
    source = 'environment';
    target = environment.value;
  } else if (configuredDefault) {
    source = defaultSourceFor(defaultSource);
    target = configuredDefault;
  }
  if (!target) {
    return storeStatus({
      slot: slotName,
      family: familyName,
      env: environment.env,
      status: 'not-configured',
      path: null,
      source: null,
      reason: 'no font path configured on this platform',
      verifiedFamilyPresent: null,
    });
  }

  const absolutePath = path.resolve(target);
  if (!fs.existsSync(absolutePath)) {
    return storeStatus({
      slot: slotName,
      family: familyName,
      env: environment.env,
      status: 'missing-file',
      path: absolutePath,
      source,
      reason: 'file not found',
      verifiedFamilyPresent: null,
    });
  }

  let registered;
  let failure = null;
  try {
    registered = GlobalFonts.registerFromPath(absolutePath, familyName);
  } catch (error) {
    failure = `registerFromPath threw: ${describeError(error)}`;
  }

  if (!failure && !registered) {
    failure = registered === null
      ? 'registerFromPath returned null (unreadable or unsupported font)'
      : registered === undefined
        ? 'registerFromPath returned undefined (unreadable or unsupported font)'
        : `registerFromPath returned ${String(registered)} (unreadable or unsupported font)`;
  }
  if (failure) {
    return storeStatus({
      slot: slotName,
      family: familyName,
      env: environment.env,
      status: 'register-failed',
      path: absolutePath,
      source,
      reason: failure,
      verifiedFamilyPresent: null,
    });
  }

  return storeStatus({
    slot: slotName,
    family: familyName,
    env: environment.env,
    status: 'registered',
    path: absolutePath,
    source,
    reason: null,
    // Cross-check only: the alias should appear, but this is not a glyph check.
    verifiedFamilyPresent: familyIsPresent(familyName),
  });
}

/** Snapshot of every registered slot, in canonical order, plus aggregate names. */
export function fontStatuses() {
  const order = status => {
    const index = SLOT_ORDER.indexOf(status.slot);
    return index < 0 ? SLOT_ORDER.length : index;
  };
  const slots = [...slotStatuses.values()]
    .sort((a, b) => order(a) - order(b))
    .map(status => ({...status}));
  return {
    slots,
    registered: slots.filter(status => status.status === 'registered').map(status => status.family),
    unavailable: slots.filter(status => status.status !== 'registered').map(status => status.family),
  };
}

function warningFor(status) {
  const reason = status.reason ?? 'unavailable';
  const envName = environmentVariableName(status);
  if (status.status === 'registered') {
    return `WARNING: font slot "${status.slot}" (family "${status.family}") registered from ${status.path}, `
      + 'but the family is not listed in GlobalFonts.families; canvas text may use a platform fallback. '
      + `Verify the font file or set ${envName ?? 'the slot environment variable'} to another readable .ttf/.otf/.ttc file. `
      + 'Glyph coverage is not checked; inspect rendered text visually.';
  }
  const where = status.path ? ` (${status.source}: ${status.path})` : '';
  const fix = envName
    ? `set ${envName} to a readable .ttf/.otf/.ttc file or install the font`
    : 'set this slot\'s font environment variable to a readable .ttf/.otf/.ttc file or install the font';
  const fallback = status.status === 'not-configured'
    ? 'no font path is configured for this platform, so canvas will use its platform font fallback'
    : 'canvas will use its platform font fallback for this family';
  return `WARNING: font slot "${status.slot}" (family "${status.family}") is unavailable: ${reason}${where}. `
    + `To fix it, ${fix}; ${fallback}. Glyph coverage is not checked; inspect rendered text visually.`;
}

/**
 * Print one WARNING per unavailable slot (or an unexpected verification miss).
 * Repeated calls in the same process are no-ops so per-frame render loops cannot
 * flood stderr.
 */
export function reportFontWarnings({write = console.error} = {}) {
  if (warningsReported) return;
  warningsReported = true;
  for (const status of fontStatuses().slots) {
    if (status.status === 'registered' && status.verifiedFamilyPresent !== false) continue;
    write(warningFor(status));
  }
}
