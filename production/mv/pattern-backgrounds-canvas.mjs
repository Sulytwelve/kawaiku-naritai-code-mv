// Reusable deterministic Canvas2D backgrounds for EXT-01.
const CACHE = new Map();
const IMAGE_IDS = new WeakMap();
let nextImageId = 1;
let createCanvasFactory = null;
const imageId = image => {
  if (!image) return 'none';
  if (!IMAGE_IDS.has(image)) IMAGE_IDS.set(image, nextImageId++);
  return IMAGE_IDS.get(image);
};

export function setCanvasFactory(factory) { createCanvasFactory = factory; }

function paintCached(g, kind, painter, opts = {}) {
  const createCanvas = opts.createCanvas ?? createCanvasFactory;
  if (!createCanvas) throw new Error('Provide createCanvas or call setCanvasFactory(createCanvas)');
  const designWidth = opts.designWidth ?? 960;
  const designHeight = opts.designHeight ?? 540;
  const cacheSize = opts.cacheSize ?? {
    width: Math.round(designWidth * 4),
    height: Math.round(designHeight * 4)
  };
  const key = `${kind}:${designWidth}x${designHeight}:${cacheSize.width}x${cacheSize.height}`;
  let canvas = CACHE.get(key);
  if (!canvas) {
    canvas = createCanvas(cacheSize.width, cacheSize.height);
    const c = canvas.getContext('2d');
    c.scale(cacheSize.width / designWidth, cacheSize.height / designHeight);
    painter(c, designWidth, designHeight);
    CACHE.set(key, canvas);
  }
  g.save();
  g.globalAlpha *= opts.alpha ?? 1;
  g.drawImage(canvas, opts.x ?? 0, opts.y ?? 0,
    opts.w ?? designWidth, opts.h ?? designHeight);
  g.restore();
}

export function drawPlaid(g, opts = {}) {
  const dw = opts.designWidth ?? 960, dh = opts.designHeight ?? 540;
  const unit = Math.min(dw / 960, dh / 540);
  paintCached(g, `plaid:${unit.toFixed(6)}`, (c, w, h) => {
    c.fillStyle = '#fffaf9'; c.fillRect(0, 0, w, h);
    const diagonal = Math.hypot(w, h) * 1.2;
    const line = (angle, spacing, width, color, offset = 0) => {
      c.save(); c.translate(w / 2, h / 2); c.rotate(angle);
      c.strokeStyle = color; c.lineWidth = width;
      for (let x = -diagonal + offset; x <= diagonal; x += spacing) {
        c.beginPath(); c.moveTo(x, -diagonal); c.lineTo(x, diagonal); c.stroke();
      }
      c.restore();
    };
    // Several translucent yarn widths make the crossed lines read like fabric.
    line(Math.PI / 4, 25 * unit, 7 * unit, 'rgba(233,146,164,.10)');
    line(-Math.PI / 4, 25 * unit, 7 * unit, 'rgba(233,146,164,.10)');
    line(Math.PI / 4, 50 * unit, 12 * unit, 'rgba(235,151,168,.12)');
    line(-Math.PI / 4, 50 * unit, 12 * unit, 'rgba(235,151,168,.12)');
    line(Math.PI / 4, 12.5 * unit, 1.2 * unit, 'rgba(208,116,143,.23)');
    line(-Math.PI / 4, 12.5 * unit, 1.2 * unit, 'rgba(208,116,143,.23)');
    line(Math.PI / 4, 50 * unit, unit, 'rgba(255,255,255,.72)', 8 * unit);
    line(-Math.PI / 4, 50 * unit, unit, 'rgba(255,255,255,.72)', 8 * unit);
  }, { ...opts, designWidth: dw, designHeight: dh });
}

function drawSunflower(c, x, y, scale = 1, alpha = .10) {
  c.save(); c.translate(x, y); c.scale(scale, scale); c.globalAlpha *= alpha;
  for (let i = 0; i < 12; i++) {
    c.save(); c.rotate(i * Math.PI / 6);
    c.beginPath(); c.ellipse(0, -20, 6, 15, 0, 0, Math.PI * 2);
    c.fillStyle = i % 2 ? '#ffd95d' : '#ffe87a'; c.fill(); c.restore();
  }
  c.beginPath(); c.arc(0, 0, 9, 0, Math.PI * 2); c.fillStyle = '#75523c'; c.fill();
  c.beginPath(); c.arc(-2, -2, 3, 0, Math.PI * 2); c.fillStyle = '#9c714c'; c.fill();
  c.restore();
}

export function drawTealMotifs(g, opts = {}) {
  const { fishImage, fishAlpha = .13, sunflower = true } = opts;
  if (!fishImage) throw new Error('drawTealMotifs requires the copied Da Fei Yu rice-bowl SVG image');
  const dw = opts.designWidth ?? 960, dh = opts.designHeight ?? 540;
  const sx = dw / 960, sy = dh / 540;
  paintCached(g, `teal-motifs:${imageId(fishImage)}:${fishAlpha}:${sunflower}`, (c, w, h) => {
    c.fillStyle = '#38a5b5'; c.fillRect(0, 0, w, h);
    for (let row = -1; row < 40; row++) for (let col = -1; col < 72; col++) {
      const x = (col * 14 + (row % 2) * 7) * sx, y = row * 14 * sy;
      c.beginPath(); c.arc(x, y, 3.0 * Math.min(sx, sy), 0, Math.PI * 2);
      c.fillStyle = 'rgba(226,250,243,.46)'; c.fill();
    }
    const motifs = [[82,72,.95],[286,168,1.1],[516,78,.9],[746,192,1.05],
      [872,62,.82],[142,400,.92],[418,406,1.05],[674,414,.95],[882,442,.9]];
    for (const [x, y, s] of motifs) {
      const d = 82 * s * Math.min(sx, sy);
      c.save(); c.globalAlpha *= fishAlpha;
      c.drawImage(fishImage, x * sx - d / 2, y * sy - d / 2, d, d);
      c.restore();
    }
    if (sunflower) for (const [x,y,s] of [[196,92,.72],[610,275,.7],[344,474,.66],[806,342,.68]]) {
      c.save(); c.translate(x*sx, y*sy); c.scale(Math.min(sx,sy), Math.min(sx,sy));
      drawSunflower(c, 0, 0, s, .22); c.restore();
    }
  }, { ...opts, designWidth: dw, designHeight: dh });
}

export function drawTealDots(g, opts = {}) {
  const dw = opts.designWidth ?? 960, dh = opts.designHeight ?? 540;
  const sx = dw / 960, sy = dh / 540, s = Math.min(sx, sy);
  paintCached(g, 'teal-gallery-dots', (c, w, h) => {
    c.fillStyle = '#92d2cf'; c.fillRect(0, 0, w, h);
    for (let row = -1; row < 42; row++) for (let col = -1; col < 72; col++) {
      const x = (col * 15 + (row % 2) * 7.5) * sx;
      const y = row * 15 * sy;
      c.beginPath(); c.arc(x, y, 2.35 * s, 0, Math.PI * 2);
      c.fillStyle = 'rgba(247,255,250,.78)'; c.fill();
    }
  }, opts);
}

function flower(c, x, y, s, palette, rot = 0, tone = 0) {
  c.save(); c.translate(x, y); c.rotate(rot); c.scale(s, s);
  const petals = 5 + (tone % 3 === 2 ? 1 : 0);
  for (let i = 0; i < petals; i++) {
    c.save(); c.rotate(i * Math.PI * 2 / petals);
    const petalY = -5.4 - ((i + tone) % 2) * .8;
    c.beginPath(); c.ellipse(0, petalY, 4.9 + ((i + tone) % 3) * .45, 5.8 + ((i * 2 + tone) % 3) * .5, 0, 0, Math.PI * 2);
    c.fillStyle = palette.petals[tone % palette.petals.length]; c.fill();
    c.strokeStyle = 'rgba(120,170,151,.12)'; c.lineWidth = .6; c.stroke(); c.restore();
  }
  c.beginPath(); c.arc(0, 0, 3.1 + (tone % 2) * .7, 0, Math.PI * 2); c.fillStyle = palette.center; c.fill();
  c.restore();
}
function leaf(c, x, y, angle, s, color) {
  c.save(); c.translate(x, y); c.rotate(angle); c.scale(s, s);
  c.beginPath(); c.ellipse(0, 0, 4, 9, 0, 0, Math.PI * 2); c.fillStyle = color; c.fill(); c.restore();
}

export function drawFloralBackground(g, opts = {}) {
  const variant = opts.variant ?? 'mint';
  const red = variant === 'red' || variant === 'pink';
  const mutedTeal = variant === 'mutedTeal' || variant === 'teal';
  const aqua = variant === 'aqua';
  const fashionPink = variant === 'fashionPink';
  const finale = variant === 'finale';
  const redPanel = variant === 'redPanel';
  const palette = red
    ? { petals: ['#fff8ee','#f4b8c3','#fff1da','#e7d9f4'], center: '#e9c85e', leaf: '#88c9a9' }
    : redPanel
      ? { petals: ['#fff8e9','#f8f4e9','#f4df96','#f6ece1'], center: '#b9b2ad', leaf: '#b6d2d4' }
    : finale
      ? { petals: ['#f38aaa','#f5a3bd','#fff3d9','#d5aedc'], center: '#fff0a8', leaf: '#b5d6ab' }
    : mutedTeal
        ? { petals: ['#fffdf2','#f6d9e3','#eee2f5','#f1edce'], center: '#e8cc72', leaf: '#7cb9a8' }
        : fashionPink
          ? { petals: ['#fff9f0','#e9a8c2','#d9bee4','#f1df8f'], center: '#fff0b0', leaf: '#acd2a7' }
          : { petals: ['#fffdf2','#eeb4cc','#c7addd','#f0df8c'], center: '#f3d86d', leaf: '#81cbb0' };
  const base = redPanel ? '#f36c7d' : red ? '#ed879a' : finale ? '#fff4dc' : fashionPink ? '#f0a3bd' : mutedTeal ? '#9dcac5' : aqua ? '#9fe6dc' : '#c0e9d9';
  const dw = opts.designWidth ?? 960, dh = opts.designHeight ?? 540;
  const sx = dw / 960, sy = dh / 540, s = Math.min(sx, sy);
  paintCached(g, `floral:${variant}`, (c, w, h) => {
    c.fillStyle = base; c.fillRect(0, 0, w, h);
    if (redPanel) {
      for (let row = -1; row < 42; row++) for (let col = -1; col < 74; col++) {
        c.beginPath(); c.arc((col * 13 + (row % 2) * 6.5) * sx, row * 13 * sy, 2.25 * s, 0, Math.PI * 2);
        c.fillStyle = 'rgba(255,248,240,.58)'; c.fill();
      }
      for (let row = -1; row < 8; row++) for (let col = -1; col < 13; col++) {
        const jitterX = ((row * 17 + col * 29) % 17) - 8;
        const jitterY = ((row * 23 + col * 11) % 15) - 7;
        const x = (col * 82 + (row % 2) * 39 + jitterX) * sx;
        const y = (row * 78 + jitterY) * sy;
        const tone = (row * 3 + col) % palette.petals.length;
        const scale = (.86 + ((row * 7 + col * 5) % 5) * .12) * s;
        flower(c, x, y, scale, palette, (row + col) * .14, tone);
        if ((row + col) % 3 !== 0) flower(c, x + 17*sx, y + 13*sy, .56*s, palette, .4, (tone + 1) % palette.petals.length);
        leaf(c, x - 13*sx, y + 11*sy, -.8, .75*s, palette.leaf);
      }
      return;
    }
    const clusters = [
      [60,55],[286,48],[526,54],[770,48],[930,72],
      [170,208],[408,196],[650,210],[864,206],
      [54,378],[290,380],[534,382],[766,376],[950,412],
      [150,515],[418,516],[680,520],[886,512]
    ];
    for (let i = 0; i < clusters.length; i++) {
      const [x0,y0] = clusters[i], x = x0 * sx, y = y0 * sy;
      const rot = (i % 5) * .17;
      flower(c, x, y, 2.05*s, palette, rot, i % palette.petals.length);
      flower(c, x + 25*sx, y + 17*sy, 1.28*s, palette, .35 + rot, (i + 1) % palette.petals.length);
      flower(c, x - 25*sx, y + 20*sy, .92*s, palette, .7 + rot, (i + 2) % palette.petals.length);
      leaf(c, x - 20*sx, y + 31*sy, -.72, 1.5*s, palette.leaf);
      leaf(c, x + 17*sx, y - 26*sy, .76, 1.25*s, palette.leaf);
      if (i % 2 === 0) leaf(c, x + 34*sx, y + 24*sy, .55, .95*s, palette.leaf);
    }
    const fillers = [[110,142],[364,130],[608,142],[846,132],[230,292],[480,300],[718,294],
      [100,470],[368,450],[620,468],[834,470],[252,92],[728,86],[520,248],[60,282],[920,300]];
    for (let i = 0; i < fillers.length; i++) {
      const [x,y] = fillers[i];
      if (i % 2 === 0) flower(c, x*sx, y*sy, .68*s, palette, i*.21, (i + 1) % palette.petals.length);
      else {
        const xx=x*sx, yy=y*sy, fs=.72*s;
        for (let p=0;p<3;p++) {
          c.save(); c.translate(xx,yy); c.rotate(p*2*Math.PI/3);
          c.beginPath(); c.ellipse(0,-4.2*fs,2.8*fs,4.5*fs,0,0,Math.PI*2);
          c.fillStyle='#fffdf4'; c.fill(); c.restore();
        }
      }
    }
  }, { ...opts, designWidth: dw, designHeight: dh });
}
