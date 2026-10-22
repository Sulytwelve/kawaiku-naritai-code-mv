// Shared image loader that names the asset when decoding fails.
//
// @napi-rs/canvas reports a missing PNG as a URL/protocol TypeError
// (`Protocol "d:" not supported` on Windows, `Invalid URL` on POSIX) without the
// path, and an undecodable file as `Unsupported image type`. Neither is enough
// to locate a missing input in a public clone, so this wrapper adds the
// repository-relative label. Successful loads are unchanged.

import fs from 'node:fs';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {loadImage} = require('@napi-rs/canvas');

export async function loadAsset(absolutePath, label = absolutePath) {
  try {
    return await loadImage(absolutePath);
  } catch (error) {
    const state = fs.existsSync(absolutePath) ? 'cannot be decoded' : 'is missing';
    throw new Error(`Asset "${label}" ${state}: ${error.message}`, {cause: error});
  }
}
