// Pure SRT helpers: language resolution, parsing, window cropping and
// serialization. No filesystem, console or process access lives here; the
// caller owns validation policy, logging and exit codes.

export class SrtError extends Error {
  constructor(message, {code, details}={}) {
    super(message);
    this.name = 'SrtError';
    this.code = code;
    this.details = details;
  }
}

export const SRT_SOURCES = {
  ja: {file: 'KAWAIKU NARITAI.ja.srt', source: 'assets/subtitles/KAWAIKU NARITAI.ja.srt'},
  bilingual: {file: 'KAWAIKU NARITAI.bilingual.srt', source: 'assets/subtitles/KAWAIKU NARITAI.bilingual.srt'},
};
export const SRT_LANGUAGES = Object.keys(SRT_SOURCES);

// Strict mapping: unknown values are refused, never coerced to ja.
export function resolveSrtLanguage(raw) {
  const supported = SRT_LANGUAGES.join(', ');
  if (raw === undefined || raw === null) {
    throw new SrtError(`missing --srt value; expected one of ${supported}`, {
      code: 'MISSING_SRT_VALUE',
      details: {supported: [...SRT_LANGUAGES]},
    });
  }
  const language = typeof raw === 'string' ? raw.trim() : raw;
  if (typeof language !== 'string' || !Object.hasOwn(SRT_SOURCES, language)) {
    throw new SrtError(`unsupported --srt value ${JSON.stringify(raw)}; expected one of ${supported}`, {
      code: 'INVALID_SRT_LANGUAGE',
      details: {value: raw, supported: [...SRT_LANGUAGES]},
    });
  }
  const {file, source} = SRT_SOURCES[language];
  return {language, file, source};
}

// HH:MM:SS,mmm --> HH:MM:SS,mmm, with an optional trailing SRT position hint.
const TIMECODE = /^(\d{2,}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2,}):(\d{2}):(\d{2}),(\d{3})(?:\s.*)?$/;

const secondsOf = (h, m, s, ms) => Number(h) * 3600 + Number(m) * 60 + Number(s) + Number(ms) / 1000;

// Lenient on purpose: a block without a usable timing line is skipped so one
// corrupt cue cannot hide the rest of the file. Index lines are optional.
export function parseSrt(text) {
  if (typeof text !== 'string') {
    throw new SrtError('parseSrt expects SRT text as a string', {
      code: 'MISSING_SRT_VALUE',
      details: {value: text},
    });
  }
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const cues = [];
  for (const block of normalized.split(/\n\s*\n/)) {
    const lines = block.split('\n');
    let first = 0;
    let last = lines.length;
    while (first < last && lines[first].trim() === '') first++;
    while (last > first && lines[last - 1].trim() === '') last--;
    let match = null;
    let timing = -1;
    for (let i = first; i < last; i++) {
      match = TIMECODE.exec(lines[i].trim());
      if (match) {
        timing = i;
        break;
      }
    }
    if (timing < 0) continue;
    cues.push({
      start: secondsOf(match[1], match[2], match[3], match[4]),
      end: secondsOf(match[5], match[6], match[7], match[8]),
      text: lines.slice(timing + 1, last).join('\n'),
    });
  }
  return cues;
}

export function formatSrtTime(ms) {
  const raw = Number(ms);
  const totalMs = Number.isFinite(raw) ? Math.max(0, Math.round(raw)) : 0;
  const h = Math.floor(totalMs / 3600000);
  const m = Math.floor((totalMs % 3600000) / 60000);
  const s = Math.floor((totalMs % 60000) / 1000);
  const pad = (value, width) => String(value).padStart(width, '0');
  return `${pad(h, 2)}:${pad(m, 2)}:${pad(s, 2)},${pad(totalMs % 1000, 3)}`;
}

// Shift cues from song time into the output window [0, durationSeconds) and
// drop/clip everything that does not intersect it. Times are rounded to whole
// milliseconds first, so the window bound is comparable across cues.
export function cropCues(cues, {shiftSeconds, durationSeconds}={}) {
  if (!Array.isArray(cues)) {
    throw new SrtError('cropCues expects an array of cues', {
      code: 'MISSING_SRT_VALUE',
      details: {value: cues},
    });
  }
  if (!Number.isFinite(shiftSeconds)) {
    throw new SrtError('cropCues requires a finite shiftSeconds', {
      code: 'MISSING_SRT_VALUE',
      details: {option: 'shiftSeconds', value: shiftSeconds},
    });
  }
  if (!Number.isFinite(durationSeconds)) {
    throw new SrtError('cropCues requires a finite durationSeconds', {
      code: 'MISSING_SRT_VALUE',
      details: {option: 'durationSeconds', value: durationSeconds},
    });
  }

  const shiftMs = shiftSeconds * 1000;
  // A negative duration is not a useful window; clamping keeps the output
  // invariants true instead of producing a negative window end.
  const windowEndMs = Math.max(0, Math.floor(durationSeconds * 1000));
  const stats = {
    input: cues.length,
    output: 0,
    droppedBefore: 0,
    droppedAfter: 0,
    droppedZeroLength: 0,
    clippedStart: 0,
    clippedEnd: 0,
    firstStartMs: null,
    lastEndMs: null,
    windowStartMs: 0,
    windowEndMs,
  };

  const out = [];
  for (const cue of cues) {
    let startMs = Math.round(cue.start * 1000 - shiftMs);
    let endMs = Math.round(cue.end * 1000 - shiftMs);
    if (endMs <= 0) {
      stats.droppedBefore++;
      continue;
    }
    if (startMs >= windowEndMs) {
      stats.droppedAfter++;
      continue;
    }
    if (startMs < 0) {
      startMs = 0;
      stats.clippedStart++;
    }
    if (endMs > windowEndMs) {
      endMs = windowEndMs;
      stats.clippedEnd++;
    }
    if (endMs <= startMs) {
      stats.droppedZeroLength++;
      continue;
    }
    out.push({index: out.length + 1, startMs, endMs, text: cue.text});
  }

  stats.output = out.length;
  stats.firstStartMs = out.length ? out[0].startMs : null;
  stats.lastEndMs = out.length ? out[out.length - 1].endMs : null;
  return {cues: out, stats};
}

// Standard SRT: numbered blocks separated by blank lines, and a trailing
// blank line after the final block. Multi-line text stays multi-line.
export function serializeSrt(cues) {
  if (!cues.length) return '';
  const blocks = cues.map((cue, i) => {
    const index = Number.isInteger(cue.index) ? cue.index : i + 1;
    return `${index}\n${formatSrtTime(cue.startMs)} --> ${formatSrtTime(cue.endMs)}\n${cue.text}`;
  });
  return `${blocks.join('\n\n')}\n\n`;
}
