import {sampleScene,computeView} from './spin-transition/src/core.js';
import {createCanvas2DRenderer} from './spin-transition/src/renderer-canvas2d.js';
export const SPIN_FROM=52.45,SPIN_TO=53.896,SPIN_SWITCH=SPIN_FROM+(SPIN_TO-SPIN_FROM)*.52;
let canvas,renderer;
export function drawStudioSpin(g,t,api){
 const width=g.canvas.width,height=g.canvas.height;
 if(!canvas||canvas.width!==width||canvas.height!==height){canvas=api.createCanvas(width,height);renderer=createCanvas2DRenderer(canvas)}
 const u=Math.max(0,Math.min(1,(t-SPIN_FROM)/(SPIN_TO-SPIN_FROM)));
 renderer.render(sampleScene(u),computeView(width,height,{mode:'cover',zoom:1,panX:0,panY:0}),1);
 g.drawImage(canvas,0,0,960,540);
}
