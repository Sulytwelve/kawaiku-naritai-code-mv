// A single prearranged strip: identities never depend on detector visibility.
// Centers registered from reliable observations; every card shares one speed.
export const FINALE_FIFO = Object.freeze({
  epoch:235.2, speed:78.6, scale:.75,
  cards:Object.freeze([
    {style:4,x:101.228,y:271.150},
    {style:5,x:282.005,y:265.814},
    {style:6,x:483.010,y:273.060},
    {style:7,x:691.524,y:269.426},
    {style:8,x:868.592,y:263.848},
    {style:9,x:1052.494,y:270.036},
    {style:1,x:1230.633,y:275.208},
    {style:10,x:1437.627,y:274.496},
    {style:2,x:1648.110,y:273.599},
    {style:3,x:1842.423,y:275.764}
  ].map(Object.freeze))
});
export function sampleFinaleFifo(t,styles){
  const shift=(t-FINALE_FIFO.epoch)*FINALE_FIFO.speed;
  return FINALE_FIFO.cards.map((card,index)=>{
    const style=styles.find(s=>s.style===card.style);
    const [w,h]=style.reference_size;
    // Rock about each fixed center, independently of the strip translation.
    const angle=Math.sin((t-FINALE_FIFO.epoch)*Math.PI*2/1.6+index*.85)*Math.PI/60;
    const a=Math.cos(angle)*FINALE_FIFO.scale,b=Math.sin(angle)*FINALE_FIFO.scale;
    const x=card.x-shift,y=card.y;
    return {style:card.style,center:[x,y],matrix:[
      [a,-b,x-a*w/2+b*h/2],
      [b,a,y-b*w/2-a*h/2]
    ]};
  });
}
