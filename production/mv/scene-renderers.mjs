// Bind production implementations to the media-independent content routes.
import {createSceneContentRenderer} from './scene-content-routes.mjs';
import {drawAdCodeMvp} from './ad-code-mvp-scenes.mjs';
import {drawColorGridCanvas} from './color-grid-canvas.mjs';
import {drawBookshop} from './bookshop-scenes.mjs';
import {drawHome} from './home-scenes.mjs';
import {drawOpening} from './opening-scenes.mjs';
import {drawR10} from './r10-scenes.mjs';
import {drawCoreTransition} from './core-transition-scenes.mjs';
import {drawR52, drawBurst} from './r52-scenes.mjs';
import {drawFashion} from './fashion-scenes.mjs';
import {drawTitle} from './title-scenes.mjs';
import {drawPhotos} from './photo-scenes.mjs';
import {drawPerformance} from './performance-scenes.mjs';
import {drawMagazine} from './magazine-scenes.mjs';
import {drawInteraction} from './interaction-scenes.mjs';
import {drawFriends} from './friend-scenes.mjs';

export const drawSceneContent = createSceneContentRenderer({
  drawColorGridCanvas, drawAdCodeMvp, drawBookshop, drawHome, drawOpening,
  drawR10, drawCoreTransition, drawR52, drawBurst, drawFashion, drawTitle,
  drawPhotos, drawPerformance, drawMagazine, drawInteraction, drawFriends,
});
