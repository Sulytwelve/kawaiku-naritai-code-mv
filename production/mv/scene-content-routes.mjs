// Content between the scene background and its generic layers. Routes are
// additive and ordered: a scene may deliberately use more than one renderer.
// Keep entry/social/foreground composition in scene.mjs, after generic layers.
// Dependencies are injected so routing can be tested without media or Canvas.
export function createSceneContentRenderer(renderers) {
  const imageApi = ({asset, createCanvas}) => ({asset, createCanvas});
  const recursiveApi = ({asset, createCanvas, drawScene, tracks, qa}) =>
    ({asset, createCanvas, drawScene, tracks, qa});
  const routes = [
    {
      matches: scene => scene.colorGrid,
      async draw(g, scene, t, api) {
        if (t < 36.32) {
          await api.drawScene(g, api.tracks.scenes.find(s => s.id === 'fashion-first'), Math.min(t, 33.999), {qa: api.qa});
          renderers.drawColorGridCanvas(g, t);
        } else {
          await api.drawScene(g, api.tracks.scenes.find(s => s.id === 'tv-room'), t, {qa: api.qa});
        }
      },
    },
    {field: 'adCode', renderer: 'drawAdCodeMvp', api: imageApi},
    {field: 'bookshop', renderer: 'drawBookshop', api: imageApi},
    {field: 'home', renderer: 'drawHome', api: recursiveApi},
    {field: 'opening', renderer: 'drawOpening', api: imageApi},
    {field: 'r10', renderer: 'drawR10', api: recursiveApi},
    {field: 'coreTransition', renderer: 'drawCoreTransition', api: recursiveApi},
    {field: 'r52', renderer: 'drawR52', api: recursiveApi},
    {
      field: 'burst', renderer: 'drawBurst',
      api: api => ({
        ...recursiveApi(api),
        // Freeze the background at the enclosing scene's time, even when a
        // nested renderer overrides its own time or supplies other options.
        drawScene: (g, scene, t, options = {}) =>
          api.drawScene(g, scene, t, {...options, backgroundTime: api.backgroundTime}),
      }),
    },
    {field: 'fashion', renderer: 'drawFashion', api: imageApi},
    {field: 'title', renderer: 'drawTitle', api: imageApi},
    {matches: scene => scene.photo?.type === 'mv-photos', renderer: 'drawPhotos', api: imageApi},
    {field: 'performance', renderer: 'drawPerformance', api: imageApi},
    {field: 'magazine', renderer: 'drawMagazine', api: imageApi},
    {field: 'interaction', renderer: 'drawInteraction', api: imageApi},
    {
      field: 'friends', renderer: 'drawFriends',
      api: ({asset, createCanvas, skipLegacyDiamond}) => ({asset, createCanvas, skipLegacyDiamond}),
    },
  ];

  return async function drawSceneContent(g, scene, t, api) {
    for (const route of routes) {
      if (!(route.matches ? route.matches(scene) : scene[route.field])) continue;
      if (route.draw) await route.draw(g, scene, t, api);
      else await renderers[route.renderer](g, scene, t, route.api(api));
    }
  };
}
