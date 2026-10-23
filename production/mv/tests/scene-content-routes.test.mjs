import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSceneContentRenderer} from '../scene-content-routes.mjs';

const names = ['drawAdCodeMvp', 'drawBookshop', 'drawHome', 'drawOpening', 'drawR10',
  'drawCoreTransition', 'drawR52', 'drawBurst', 'drawFashion', 'drawTitle',
  'drawPhotos', 'drawPerformance', 'drawMagazine', 'drawInteraction', 'drawFriends'];
const fields = ['adCode', 'bookshop', 'home', 'opening', 'r10', 'coreTransition',
  'r52', 'burst', 'fashion', 'title', 'performance', 'magazine', 'interaction', 'friends'];
const api = () => ({asset() {}, createCanvas() {}, drawScene() {}, tracks: {scenes: []},
  qa: true, skipLegacyDiamond: true, backgroundTime: 20});

test('all matching content routes run once in compositing order and are awaited', async () => {
  const calls = [], g = {}, scene = Object.fromEntries(fields.map(field => [field, {}]));
  scene.photo = {type: 'mv-photos'};
  let active = false;
  const draw = createSceneContentRenderer(Object.fromEntries(names.map(name => [name,
    async (context, shot, time) => {
      assert.equal(active, false, `${name} overlaps a preceding renderer`);
      active = true;
      assert.equal(context, g);
      assert.equal(shot, scene);
      assert.equal(time, 7);
      calls.push(name);
      await Promise.resolve();
      active = false;
    }])));
  await draw(g, scene, 7, api());
  assert.deepEqual(calls, names);
});

test('empty, false and unrelated photo fields do not invoke content renderers', async () => {
  const draw = createSceneContentRenderer(new Proxy({}, {
    get() { throw Error('Unmatched renderer was accessed'); },
  }));
  for (const scene of [{}, {fashion: false}, {photo: {}}, {photo: {type: 'other'}}]) {
    await draw({}, scene, 0, api());
  }
});

test('renderer failure propagates and stops later content composition', async () => {
  const failure = Error('Cannot load image');
  let laterCalled = false;
  const draw = createSceneContentRenderer({
    async drawHome() { throw failure; },
    async drawOpening() { laterCalled = true; },
  });
  await assert.rejects(draw({}, {home: {}, opening: {}}, 0, api()), error => error === failure);
  assert.equal(laterCalled, false);
});

test('image, recursive and friend routes preserve their original API contracts', async () => {
  const environment = api(), actual = {};
  const draw = createSceneContentRenderer({
    drawAdCodeMvp(g, s, t, env) { actual.image = env; },
    drawHome(g, s, t, env) { actual.recursive = env; },
    drawFriends(g, s, t, env) { actual.friends = env; },
  });
  await draw({}, {adCode: {}, home: {}, friends: {}}, 0, environment);
  const {asset, createCanvas, drawScene, tracks, qa, skipLegacyDiamond} = environment;
  assert.deepEqual(actual.image, {asset, createCanvas});
  assert.deepEqual(actual.recursive, {asset, createCanvas, drawScene, tracks, qa});
  assert.deepEqual(actual.friends, {asset, createCanvas, skipLegacyDiamond});
});

test('burst recursion pins enclosing backgroundTime while preserving other options', async () => {
  const environment = api(), calls = [], context = {}, shot = {};
  environment.drawScene = (...args) => { calls.push(args); return 'nested-result'; };
  const draw = createSceneContentRenderer({
    drawBurst(g, s, t, env) {
      assert.equal(env.asset, environment.asset);
      assert.equal(env.tracks, environment.tracks);
      assert.equal(env.qa, true);
      assert.equal(env.drawScene(context, shot, 8, {qa: false, backgroundTime: 99}), 'nested-result');
      env.drawScene(context, shot, 9);
    },
  });
  await draw({}, {burst: {}}, 3, environment);
  assert.deepEqual(calls, [
    [context, shot, 8, {qa: false, backgroundTime: 20}],
    [context, shot, 9, {backgroundTime: 20}],
  ]);
});

test('color grid draws its recursive underlay first and retains its switch boundary', async () => {
  const environment = api(), calls = [], g = {};
  const fashion = {id: 'fashion-first'}, television = {id: 'tv-room'};
  environment.tracks.scenes = [fashion, television];
  environment.drawScene = async (...args) => { await Promise.resolve(); calls.push(['scene', ...args]); };
  const draw = createSceneContentRenderer({
    drawColorGridCanvas(...args) { calls.push(['grid', ...args]); },
    drawFashion() { calls.push(['fashion']); },
  });
  await draw(g, {colorGrid: true, fashion: {}}, 36.319, environment);
  assert.deepEqual(calls, [
    ['scene', g, fashion, 33.999, {qa: true}], ['grid', g, 36.319], ['fashion'],
  ]);
  calls.length = 0;
  await draw(g, {colorGrid: true}, 36.32, environment);
  assert.deepEqual(calls, [['scene', g, television, 36.32, {qa: true}]]);
});
