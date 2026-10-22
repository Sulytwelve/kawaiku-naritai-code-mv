// Rebuild the studio light, stand, cable and reflector as opaque vector shapes.
// Complete foreground rigs; canopy, lamp, hub, shaft and stand move as one unit.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const mix=(a,b,u)=>a+(b-a)*u;
function smooth(u){u=clamp(u,0,1);return u*u*(3-2*u)}
function path(g,commands){g.beginPath();for(const [op,...p] of commands)g[op](...p)}
function fillPath(g,commands,fill,stroke='#7995c2',width=2){path(g,commands);g.fillStyle=fill;g.fill();g.strokeStyle=stroke;g.lineWidth=width;g.stroke()}
function drawLightBox(g){
  // Small blue lamp at frame left, with the three vents painted as solid dark-blue slats.
  fillPath(g,[['moveTo',45,262],['lineTo',178,246],['quadraticCurveTo',207,245,210,270],['lineTo',210,332],['lineTo',70,351],['quadraticCurveTo',47,351,45,331],['closePath']], '#8bb9ed','#7594c6',2.5);
  fillPath(g,[['moveTo',46,263],['lineTo',85,260],['quadraticCurveTo',111,261,111,281],['lineTo',111,340],['lineTo',48,349],['closePath']], '#a9cef6','#7897c8',2);
  for(let i=0;i<3;i++){
    const x=127+i*18;
    fillPath(g,[['moveTo',x,290],['quadraticCurveTo',x,284,x+5,283],['lineTo',x+9,282],['quadraticCurveTo',x+14,282,x+14,288],['lineTo',x+14,327],['quadraticCurveTo',x+14,332,x+9,333],['lineTo',x+5,334],['quadraticCurveTo',x,334,x,329],['closePath']], '#6689c3','#d3e7ff',1.4);
    g.fillStyle='#a8c9f0';g.fillRect(x+3,290,3,37);
  }
  fillPath(g,[['moveTo',86,350],['lineTo',132,344],['lineTo',132,366],['quadraticCurveTo',131,382,111,385],['lineTo',95,382],['quadraticCurveTo',85,379,86,369],['closePath']], '#9fc4ef','#7897c8',2);
  g.fillStyle='#597bac';g.beginPath();g.arc(109,369,3.3,0,Math.PI*2);g.fill();
  // Telescopic stand and foot, behind the lamp head.
  fillPath(g,[['moveTo',94,382],['lineTo',126,378],['lineTo',129,501],['lineTo',96,505],['closePath']], '#bad5f5','#7694c1',2);
  g.fillStyle='#7694c1';g.fillRect(97,454,31,6);
  path(g,[['moveTo',112,501],['lineTo',80,518],['lineTo',151,512],['lineTo',124,500]]);g.fillStyle='#91b7e8';g.fill();g.strokeStyle='#7897c8';g.lineWidth=2;g.stroke();
  // Power lead, visible on the inside edge of the stand.
  path(g,[['moveTo',189,326],['bezierCurveTo',205,359,157,382,151,416],['bezierCurveTo',148,443,173,456,160,481],['bezierCurveTo',154,495,145,499,146,512]]);g.strokeStyle='#536f9e';g.lineWidth=3;g.stroke();
}
function drawUmbrella(g){
  // Large reflector canopy, with opaque fabric panels and drawn ribs.
  fillPath(g,[['moveTo',402,33],['quadraticCurveTo',525,-8,653,31],['lineTo',646,311],['quadraticCurveTo',636,383,592,423],['quadraticCurveTo',531,361,471,343],['quadraticCurveTo',424,331,400,286],['closePath']], '#9bc6f4','#7999c8',2.4);
  // Soft segment shading keeps the broad blue fabric readable without transparency holes.
  path(g,[['moveTo',402,33],['quadraticCurveTo',447,19,487,20],['lineTo',477,343],['quadraticCurveTo',422,326,400,286],['closePath']]);g.fillStyle='#a9d0f7';g.fill();
  path(g,[['moveTo',487,20],['quadraticCurveTo',538,16,588,23],['lineTo',592,423],['quadraticCurveTo',531,361,477,343],['closePath']]);g.fillStyle='#94bff0';g.fill();
  path(g,[['moveTo',588,23],['quadraticCurveTo',626,26,653,31],['lineTo',646,311],['quadraticCurveTo',636,383,592,423]]);g.strokeStyle='#7999c8';g.lineWidth=2;g.stroke();
  // Radial seams meet at the hub; all are lines on fabric, never transparent cutouts.
  const hub=[592,111];
  for(const [x,y] of [[404,34],[487,22],[585,24],[650,38],[645,300],[594,420],[477,343],[402,286]]){
    path(g,[['moveTo',...hub],['quadraticCurveTo',(hub[0]+x)/2-7,(hub[1]+y)/2,x,y]]);g.strokeStyle='#7897c6';g.lineWidth=2.1;g.stroke();
  }
  // Cross brace, pole collar and long stand on the right.
  path(g,[['moveTo',500,186],['lineTo',706,18]]);g.strokeStyle='#7293c4';g.lineWidth=18;g.stroke();
  path(g,[['moveTo',500,186],['lineTo',706,18]]);g.strokeStyle='#b5d5f8';g.lineWidth=12;g.stroke();
  g.beginPath();g.arc(592,111,10,0,Math.PI*2);g.fillStyle='#a7cef5';g.fill();g.strokeStyle='#7695c4';g.lineWidth=2;g.stroke();
  fillPath(g,[['moveTo',706,18],['lineTo',744,19],['lineTo',742,72],['quadraticCurveTo',740,84,727,86],['lineTo',713,81],['closePath']], '#9dc6f2','#7897c7',2);
  fillPath(g,[['moveTo',715,81],['lineTo',746,81],['lineTo',759,503],['lineTo',721,505],['closePath']], '#bad7f5','#7594c3',2.4);
  g.fillStyle='#7695c4';g.fillRect(720,186,34,8);g.fillRect(723,383,35,7);
  // Rubber foot is kept just inside the active scene.
  fillPath(g,[['moveTo',720,502],['lineTo',697,516],['lineTo',780,516],['lineTo',759,502],['closePath']], '#8cb4e8','#6f8fbf',2);
  // Trailing cable loops behind the pole and ends at the floor.
  path(g,[['moveTo',735,76],['bezierCurveTo',777,118,753,158,767,204],['bezierCurveTo',789,274,749,314,774,372],['bezierCurveTo',791,414,769,458,786,495]]);g.strokeStyle='#536f9e';g.lineWidth=3.4;g.stroke();
}

function value(rows,t){if(t<=rows[0][0])return rows[0].slice(1);for(let i=1;i<rows.length;i++)if(t<=rows[i][0]){const a=rows[i-1],b=rows[i],u=(t-a[0])/(b[0]-a[0]);return a.slice(1).map((v,j)=>mix(v,b[j+1],u))}return rows.at(-1).slice(1)}
function drawRearRig(g){
 // Back of the nearer umbrella. Its lamp, collar and stand are all in this local frame.
 fillPath(g,[['moveTo',-155,-360],['quadraticCurveTo',-240,-210,-228,-48],['quadraticCurveTo',-241,196,-139,351],['quadraticCurveTo',-25,411,218,358],['lineTo',220,-360],['closePath']],'#9bc9f4','#7999c8',2.4);
 path(g,[['moveTo',-154,-350],['quadraticCurveTo',-206,-130,-195,100],['quadraticCurveTo',-187,270,-135,351]]);g.strokeStyle='#aed6f8';g.lineWidth=9;g.stroke();
 path(g,[['moveTo',144,-355],['quadraticCurveTo',80,-130,110,88],['quadraticCurveTo',131,280,218,358]]);g.strokeStyle='#7fa5d3';g.lineWidth=2;g.stroke();
 // The existing solid lamp assembly has a continuous yoke and telescopic stand.
 g.save();g.translate(-221,-272);drawLightBox(g);g.restore();
 // Short axle physically joins the lamp nose to its umbrella mount.
 path(g,[['moveTo',-18,14],['lineTo',30,9]]);g.strokeStyle='#7897c8';g.lineWidth=10;g.stroke();g.strokeStyle='#c5e0fa';g.lineWidth=6;g.stroke();
}
/** Draw complete rigs in front of the crew, at original 960x540 coordinates. */
export function drawStudioEquipmentCanvas(g,t){
 if(t<44.582||t>=49.5)return false;
 if(t>=47.25){const [x]=value([[47.25,-180],[47.8,-110],[49,-140],[49.5,-180]],t);g.save();g.translate(x,-30);drawLightBox(g);g.restore()}
 if(t>=47.65)return true;
 // Two foreground assemblies pass the camera in opposite directions, as in the source.
 const [frontX]=value([[44.582,0],[45.8,0],[46.186,0],[46.65,300],[47.15,700],[47.65,1200]],t);
 g.save();g.translate(frontX,0);drawUmbrella(g);g.restore();
 const [rearX]=value([[44.582,450],[45.25,425],[45.8,330],[46.186,240],[46.65,-140],[47.15,-450],[47.65,-750]],t);
 g.save();g.translate(rearX,230);drawRearRig(g);g.restore();
 return true;
}
