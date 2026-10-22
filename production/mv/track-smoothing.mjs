// Temporal conditioning for tracked per-source-frame trajectories.
//
// The tracker samples on the 23.81Hz source frame grid while the compositor
// emits 60Hz. Holding the nearest sample for 2-3 output frames produced
// visible judder, and isolated one-frame tracking outliers produced visible
// pops. Every track is therefore despiked, lightly smoothed and linearly
// resampled instead of held.

export function median(values){
  const s=[...values].sort((a,b)=>a-b),m=s.length>>1;
  return s.length%2?s[m]:(s[m-1]+s[m])/2;
}

// Hampel filter: a sample further than sigma robust standard deviations from
// its local median is replaced by that median. Isolated outliers collapse;
// real motion survives because the local median follows it.
export function hampel(values,{halfWindow=2,sigma=3}={}){
  const out=values.slice();
  for(let i=0;i<values.length;i++){
    const lo=Math.max(0,i-halfWindow),hi=Math.min(values.length,i+halfWindow+1);
    const win=values.slice(lo,hi);
    if(win.length<3)continue;
    const med=median(win),mad=median(win.map(v=>Math.abs(v-med)));
    if(mad<=1e-9){
      // Locally constant signal: the robust scale is degenerate, so a lone
      // impulse is only an outlier when both neighbours agree with each other.
      // This is what removes the one-frame card pop on an otherwise frozen card
      // without flattening the first step of a real ramp.
      const p=values[i-1],n=values[i+1];
      if(p!==undefined&&n!==undefined&&p===n&&values[i]!==p)out[i]=p;
      continue;
    }
    if(Math.abs(values[i]-med)>sigma*1.4826*mad)out[i]=med;
  }
  return out;
}

// Edge-aware median filter. A median preserves a monotonic ramp exactly (the
// middle sample of a monotonic window is the sample itself), so this removes
// impulses one to `halfWindow` samples wide without rounding genuine motion.
// A Hampel filter alone cannot do this: when a track is otherwise perfectly
// still its robust scale degenerates to zero, and a two-sample-wide spike
// leaves neither sample with two equal neighbours.
export function medianFilter(values,halfWindow=1){
  const out=values.slice();
  for(let i=0;i<values.length;i++){
    const lo=Math.max(0,i-halfWindow),hi=Math.min(values.length,i+halfWindow+1);
    out[i]=median(values.slice(lo,hi));
  }
  return out;
}

// [1,2,1]/4 binomial passes; endpoints are held.
export function smooth(values,passes=1){
  let cur=values.slice();
  for(let p=0;p<passes;p++){
    const next=cur.slice();
    for(let i=1;i<cur.length-1;i++)next[i]=(cur[i-1]+2*cur[i]+cur[i+1])/4;
    cur=next;
  }
  return cur;
}

// Discrete label runs shorter than minRun are absorbed by the longer neighbour,
// so a one-sample expression change cannot strobe on screen.
export function debounce(labels,minRun){
  const cur=labels.slice();
  for(let pass=0;pass<16;pass++){
    const runs=[];
    for(let i=0;i<cur.length;){
      let j=i;while(j<cur.length&&cur[j]===cur[i])j++;
      runs.push({v:cur[i],a:i,b:j});i=j;
    }
    let changed=false;
    for(let k=0;k<runs.length;k++){
      const r=runs[k];
      if(r.b-r.a>=minRun)continue;
      const prev=runs[k-1],next=runs[k+1];
      if(!prev&&!next)break;
      const repl=!prev?next.v:!next?prev.v:((prev.b-prev.a)>=(next.b-next.a)?prev.v:next.v);
      for(let i=r.a;i<r.b;i++)if(cur[i]!==repl){cur[i]=repl;changed=true}
    }
    if(!changed)break;
  }
  return cur;
}

export const lerp=(a,b,u)=>a+(b-a)*u;

// Linear resampling between bracketing rows. Holding the previous sample
// instead would re-introduce the 23.81->60Hz stair-step judder.
export function sampleLerp(rows,t,blend){
  if(!rows.length)return null;
  if(t<=rows[0].t)return rows[0];
  if(t>=rows[rows.length-1].t)return rows[rows.length-1];
  let lo=0,hi=rows.length;
  while(lo<hi){const m=(lo+hi)>>1;if(rows[m].t<=t)lo=m+1;else hi=m}
  const a=rows[Math.max(0,lo-1)],b=rows[Math.min(rows.length-1,lo)];
  if(!(b.t>a.t))return a;
  return blend(a,b,(t-a.t)/(b.t-a.t));
}

// Condition one contiguous run rows[i..j) channel-by-channel.
export function conditionRun(rows,i,j,get,set,{halfWindow=2,sigma=3,smoothPasses=1,medianHalfWindows=[2,1]}={}){
  const len=j-i;
  if(len<3)return;
  const width=get(i).length;
  const chans=[];
  for(let c=0;c<width;c++)chans.push(new Array(len));
  for(let k=0;k<len;k++){
    const v=get(i+k);
    for(let c=0;c<width;c++)chans[c][k]=v[c];
  }
  const cleaned=chans.map(v=>{
    let d=hampel(v,{halfWindow,sigma});
    for(const hw of medianHalfWindows)d=medianFilter(d,hw);
    return smoothPasses?smooth(d,smoothPasses):d;
  });
  for(let k=0;k<len;k++){
    const v=new Array(width);
    for(let c=0;c<width;c++)v[c]=cleaned[c][k];
    set(i+k,v);
  }
}

// Condition the four memory-card tracks. Each card is only tracked once it is
// visible, so null samples are preserved and every visible stretch is found
// inside the time-contiguous runs rather than assumed to start with one.
export function conditionWindows(rows,{maxGap=0.06}={}){
 const out=rows.map(r=>({t:r.t,quads:(r.quads??[]).map(q=>q?q.map(p=>[p[0],p[1]]):null)}));
 for(let n=0;n<4;n++){
  let i=0;
  while(i<out.length){
   if(!out[i].quads[n]){i++;continue}
   let j=i+1;
   while(j<out.length&&out[j].quads[n]&&out[j].t-out[j-1].t<=maxGap)j++;
   conditionRun(out,i,j,
    k=>{const q=out[k].quads[n];return[q[0][0],q[0][1],q[1][0],q[1][1],q[2][0],q[2][1],q[3][0],q[3][1]]},
    (k,v)=>{const q=out[k].quads[n];q[0][0]=v[0];q[0][1]=v[1];q[1][0]=v[2];q[1][1]=v[3];q[2][0]=v[4];q[2][1]=v[5];q[3][0]=v[6];q[3][1]=v[7]},
    {smoothPasses:1});
   i=j;
  }
 }
 return out;
}

// Condition the fixed-body transform track and stabilise its expression index
// so a one-sample mouth change cannot flash for 1-2 output frames.
//
// entryEnds are the times where a synthetic entry ramp hands over to tracked
// data. Samples before such a handover are never drawn, and their translation
// is meaningless (the body is not matchable until it has settled), so they must
// stay out of the filter: smoothing across that discontinuity would drag the
// bad values into the first frame that is actually shown.
export function conditionBody(rows,{mouthMinRun=3,entryEnds=[70.979,148.169]}={}){
 const out=rows.map(r=>({t:r.t,matrix:r.matrix.map(m=>[...m]),mouth:r.mouth}));
 for(const[i,j]of contiguousRuns(out)){
  let start=i;
  for(const end of entryEnds)if(end>out[i].t&&end<out[j-1].t)while(start<j&&out[start].t<end)start++;
  conditionRun(out,start,j,
   k=>{const m=out[k].matrix;return[m[0][0],m[0][1],m[0][2],m[1][0],m[1][1],m[1][2]]},
   (k,v)=>{const m=out[k].matrix;m[0][0]=v[0];m[0][1]=v[1];m[0][2]=v[2];m[1][0]=v[3];m[1][1]=v[4];m[1][2]=v[5]},
   {smoothPasses:2});
  const labels=debounce(out.slice(i,j).map(r=>r.mouth),mouthMinRun);
  for(let k=i;k<j;k++)out[k].mouth=labels[k-i];
 }
 return out;
}

// Split rows into runs whose samples are no further apart than maxGap seconds.
export function contiguousRuns(rows,{maxGap=0.06}={}){
  const runs=[];
  for(let i=0;i<rows.length;){
    let j=i+1;
    while(j<rows.length&&rows[j].t-rows[j-1].t<=maxGap)j++;
    runs.push([i,j]);
    i=j;
  }
  return runs;
}

// Least-squares affine taking the source rectangle (0,0)-(w,h) onto `quad`.
// One affine transform replaces the two-triangle split, so a tracked
// quadrilateral no longer folds along its diagonal while the card turns.
export function affineFromQuad(quad,w,h){
  const src=[[0,0],[w,0],[w,h],[0,h]];
  const solve=target=>{
    let A00=0,A01=0,A02=0,A11=0,A12=0,A22=0,b0=0,b1=0,b2=0;
    for(let i=0;i<4;i++){
      const u=src[i][0],v=src[i][1],y=target[i];
      A00+=u*u;A01+=u*v;A02+=u;A11+=v*v;A12+=v;A22+=1;
      b0+=u*y;b1+=v*y;b2+=y;
    }
    const M=[[A00,A01,A02,b0],[A01,A11,A12,b1],[A02,A12,A22,b2]];
    for(let c=0;c<3;c++){
      let p=c;
      for(let r=c+1;r<3;r++)if(Math.abs(M[r][c])>Math.abs(M[p][c]))p=r;
      if(p!==c){const tmp=M[p];M[p]=M[c];M[c]=tmp}
      const piv=M[c][c];
      if(Math.abs(piv)<1e-9)return null;
      for(let r=0;r<3;r++){
        if(r===c)continue;
        const f=M[r][c]/piv;
        for(let k=c;k<4;k++)M[r][k]-=f*M[c][k];
      }
    }
    return[M[0][3]/M[0][0],M[1][3]/M[1][1],M[2][3]/M[2][2]];
  };
  const rx=solve(quad.map(p=>p[0])),ry=solve(quad.map(p=>p[1]));
  if(!rx||!ry)return null;
  return[[rx[0],rx[1],rx[2]],[ry[0],ry[1],ry[2]]];
}
