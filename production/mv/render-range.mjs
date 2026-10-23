// Resolve CLI time ranges into the frame and audio window used by the renderer.
// Inputs are normalized by parseCli: finite seconds, positive fps and null for
// omitted ranges. Output-clock ranges intentionally take priority if both range
// forms were supplied; these are existing CLI rules, not general range policy.
// This module is deliberately independent of process state, assets and Canvas.
export function resolveRenderRange({
  outputRange = null,
  range = null,
  rangeStart = null,
  rangeEnd = null,
  fps,
  audioOffset = 0,
  sourceStart,
  sourceEnd,
  outputFrames,
  sourceAtOutputFrame,
}) {
  const outputRangeStartFrame = outputRange === null ? 0 : Math.round(outputRange.start * fps);
  const outputRangeEndFrame = outputRange === null ? 0 : Math.round(outputRange.end * fps);
  if (outputRange !== null && (!Number.isFinite(outputRangeEndFrame)
      || outputRangeStartFrame < 0
      || outputRangeEndFrame <= outputRangeStartFrame
      || outputRangeEndFrame > outputFrames)) {
    throw new Error('invalid --output-range; use an increasing range within the complete film clock.');
  }

  const isFull = range === null && rangeStart === null && rangeEnd === null && outputRange === null;
  const requestedStart = range !== null ? range.start : rangeStart ?? sourceStart;
  const requestedEnd = range !== null ? range.end : rangeEnd ?? sourceEnd;
  const startPTS = outputRange !== null
    ? sourceAtOutputFrame(outputRangeStartFrame)
    : isFull ? sourceStart : Math.max(sourceStart, requestedStart);
  const endPTS = outputRange !== null
    ? sourceAtOutputFrame(outputRangeEndFrame - 1)
    : isFull ? sourceEnd : Math.min(sourceEnd, requestedEnd);
  const frames = outputRange !== null
    ? outputRangeEndFrame - outputRangeStartFrame
    : isFull ? outputFrames : Math.max(1, Math.round((endPTS - startPTS) * fps) + 1);
  const audioSeek = outputRange !== null
    ? outputRangeStartFrame / fps
    : isFull ? 0 : startPTS + audioOffset;

  // Keep the historical distinction: output ranges are sampled by output-frame
  // index, whole-film renders use the song clock, and source ranges advance PTS.
  const framePTS = k => outputRange !== null
    ? sourceAtOutputFrame(outputRangeStartFrame + k)
    : isFull ? sourceAtOutputFrame(k) : Math.min(sourceEnd, startPTS + k / fps);

  if (outputRange === null && !isFull && !(endPTS > startPTS)) {
    throw new Error(`invalid --range; the clipped span ${startPTS.toFixed(3)} .. ${endPTS.toFixed(3)} is empty. Use increasing source-PTS values within ${sourceStart} .. ${sourceEnd}.`);
  }

  return {
    isFull,
    outputRangeStartFrame,
    outputRangeEndFrame,
    startPTS,
    endPTS,
    frames,
    audioSeek,
    framePTS,
  };
}
