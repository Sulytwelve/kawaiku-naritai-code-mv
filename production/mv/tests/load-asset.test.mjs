// The shared loader must name the asset when a public clone is missing an input;
// @napi-rs/canvas alone reports only a URL/protocol or image-type error.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadAsset} from '../load-asset.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

test('a missing file is reported with the repository-relative label', async () => {
  const missing = path.join(os.tmpdir(), `kawaiku-missing-asset-${process.pid}-${Date.now()}.png`);
  await assert.rejects(
    () => loadAsset(missing, 'assets/third-party-derived/home-assets/curled-base.png'),
    /Asset "assets\/third-party-derived\/home-assets\/curled-base\.png" is missing/,
  );
});

test('an existing but undecodable file is reported as such', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'kawaiku-load-asset-'));
  t.after(() => fs.rmSync(directory, {recursive: true, force: true}));
  const file = path.join(directory, 'garbage.png');
  fs.writeFileSync(file, Buffer.from('this is not an image'));
  await assert.rejects(
    () => loadAsset(file, 'fixtures/garbage.png'),
    /Asset "fixtures\/garbage\.png" cannot be decoded/,
  );
});

test('a present asset still loads unchanged', async t => {
  const file = path.join(ROOT, 'assets/visuals/a-tv.png');
  if (!fs.existsSync(file)) {
    t.skip('the committed sample image is not present');
    return;
  }
  const image = await loadAsset(file, 'assets/visuals/a-tv.png');
  assert.ok(image.width > 0 && image.height > 0);
});
