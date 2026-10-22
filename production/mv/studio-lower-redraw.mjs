// The original upper body remains unchanged. Only the cropped trousers continue
// into the registered GPT-Image redraw, under the same studio camera transform.
let upper = null;
export function drawStudioRedrawnActor(g, original, redraw, createCanvas) {
  if (!upper) {
    upper = createCanvas(original.width, original.height);
    const q = upper.getContext('2d');
    q.drawImage(original, 0, 0);
    q.globalCompositeOperation = 'destination-in';
    const mask = q.createLinearGradient(0, 865, 0, 941);
    mask.addColorStop(0, 'rgba(0,0,0,1)');
    mask.addColorStop(1, 'rgba(0,0,0,0)');
    q.fillStyle = mask;
    q.fillRect(0, 0, original.width, original.height);
  }
  g.save();
  g.translate(0, -20);
  g.scale(960 / 1672, 540 / 941);
  g.save();
  g.beginPath();
  g.rect(0, 860, 1672, 1200);
  g.clip();
  g.translate(-629.945, 5);
  g.scale(1.767, 1.767);
  g.drawImage(redraw, 0, 0);
  g.restore();
  g.drawImage(upper, 0, 0);
  g.restore();
}
