// Resolve the soundtrack input from MV_AUDIO_PATH or ASSET_INDEX.audio.
// This module only reads configuration and probes path existence. It never
// edits the tracked asset index, prints, or exits: render-film.mjs owns the
// user-facing decision (REFUSED / exit code).
import fs from 'node:fs';
import path from 'node:path';

const AUDIO_VARIABLE = 'MV_AUDIO_PATH';
const DEFAULT_INDEX = 'assets/ASSET_INDEX.json';
const DEFAULT_AUDIO_DIR = 'assets/audio';
const EMPTY_OVERRIDE_REASON = 'MV_AUDIO_PATH is empty; using ASSET_INDEX.audio';

export class AudioInputError extends Error {
  constructor(message, {code, details}={}) {
    super(message);
    this.name = 'AudioInputError';
    this.code = code;
    this.details = details ?? {};
  }
}

function indexError(indexPath, reason, cause) {
  return new AudioInputError(
    `ASSET_INDEX.audio is invalid at ${indexPath}: ${reason}. ` +
      `Set ${AUDIO_VARIABLE} to an existing audio file, fix the tracked "audio" field, ` +
      'or pass --no-audio to render without sound.',
    {code: 'AUDIO_INDEX_INVALID', details: {indexPath, reason, cause}},
  );
}

// Read ASSET_INDEX.json without changing it. The returned declaration is kept
// verbatim (outer whitespace is trimmed only when it becomes a filesystem path)
// so callers can report exactly what the tracked manifest says.
export function readDeclaredAudio(indexPath) {
  if (typeof indexPath !== 'string' || indexPath.trim() === '') {
    throw indexError(String(indexPath), 'no index path was provided');
  }
  let text;
  try {
    text = fs.readFileSync(indexPath, 'utf8');
  } catch (error) {
    throw indexError(indexPath, `cannot read the file (${error.code ?? error.message})`, error.message);
  }
  let index;
  try {
    index = JSON.parse(text.replace(/^\uFEFF/, ''));
  } catch (error) {
    throw indexError(indexPath, `not valid JSON (${error.message})`, error.message);
  }
  const declared = index && typeof index === 'object' ? index.audio : undefined;
  if (typeof declared !== 'string' || declared.trim() === '') {
    throw indexError(indexPath, 'the "audio" field must be a non-empty string');
  }
  return declared;
}

function resolveRoot(root) {
  return path.resolve(typeof root === 'string' && root.trim() !== '' ? root : process.cwd());
}

function resolveIndexPath(root, indexPath) {
  if (indexPath === undefined || indexPath === null) return path.join(root, DEFAULT_INDEX);
  if (typeof indexPath !== 'string' || indexPath.trim() === '') {
    throw indexError(String(indexPath), 'no index path was provided');
  }
  return path.isAbsolute(indexPath) ? path.normalize(indexPath) : path.resolve(root, indexPath);
}

function resolvePath(root, value) {
  // Absolute inputs are fully resolved without ever being joined to root.
  // Relative inputs are anchored at root.
  return path.isAbsolute(value) ? path.resolve(value) : path.resolve(root, value);
}

// Keep the existing manifest convention: a slash means project-relative,
// a bare filename lives under assets/audio/. Absolute values are never joined
// to root, including Windows drive and UNC paths.
function resolveDeclaredPath(root, declared) {
  const value = declared.trim();
  if (path.isAbsolute(value)) return path.resolve(value);
  if (value.includes('/')) return path.resolve(root, value);
  return path.resolve(root, DEFAULT_AUDIO_DIR, value);
}

// POSIX separators keep dry-run plans and sidecars stable across platforms.
// Paths outside root (for example an absolute override in another directory)
// have no useful relative form and return null.
function relativeToRoot(root, target) {
  const relative = path.relative(root, target);
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    return null;
  }
  return relative.split(path.sep).join('/');
}

function missingInputError({source, variable, declared, resolvedPath, relativePath, indexPath}) {
  const origin = source === 'environment' ? AUDIO_VARIABLE : 'ASSET_INDEX.audio';
  const code = source === 'environment' ? 'AUDIO_OVERRIDE_INVALID' : 'AUDIO_INDEX_INVALID';
  const hint = source === 'environment'
    ? `Fix ${AUDIO_VARIABLE} to point at an existing audio file, or pass --no-audio to render without sound.`
    : `Set ${AUDIO_VARIABLE} to an existing audio file, update ASSET_INDEX.audio` +
      `${indexPath ? ` at ${indexPath}` : ''}, or pass --no-audio to render without sound.`;
  return new AudioInputError(
    `Audio input from ${origin} does not exist or is not a regular file: ${resolvedPath} (source: ${source}). ${hint}`,
    {code, details: {source, variable, declared, resolvedPath, relativePath, indexPath}},
  );
}

export function resolveAudioInput({root, indexPath, envAudioPath, enabled=true}={}) {
  const rootPath = resolveRoot(root);
  const audioEnabled = Boolean(enabled);

  const envProvided = typeof envAudioPath === 'string';
  const envValue = envProvided ? envAudioPath.trim() : '';

  let source;
  let variable;
  let declared;
  let resolvedPath;
  let resolvedIndexPath;
  let reason;

  if (envValue !== '') {
    // A non-empty override wins outright; a broken override is never replaced
    // by the manifest default.
    source = 'environment';
    variable = AUDIO_VARIABLE;
    declared = null;
    resolvedPath = resolvePath(rootPath, envValue);
    resolvedIndexPath = null;
    reason = null;
  } else {
    source = 'asset-index';
    variable = null;
    resolvedIndexPath = resolveIndexPath(rootPath, indexPath);
    declared = readDeclaredAudio(resolvedIndexPath);
    resolvedPath = resolveDeclaredPath(rootPath, declared);
    reason = envProvided ? EMPTY_OVERRIDE_REASON : null;
  }

  const relativePath = relativeToRoot(rootPath, resolvedPath);
  // A directory is not an input any encoder can open, so "exists" means "a
  // regular file exists here" rather than "the path resolves to something".
  const exists = Boolean(fs.statSync(resolvedPath, {throwIfNoEntry: false})?.isFile());
  if (audioEnabled && !exists) {
    throw missingInputError({source, variable, declared, resolvedPath, relativePath, indexPath: resolvedIndexPath});
  }

  return {
    enabled: audioEnabled,
    variable,
    source,
    declared,
    resolvedPath,
    relativePath,
    exists,
    reason,
  };
}
