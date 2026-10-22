// Layout coordinates follow the supplied 960x540 MV reference; caller scales to output resolution.
export const SOCIAL_VARIANTS = {
  selfie: {photoTop:74, likes:'8,628', body:'换了新发型和浅色开衫，\n好像也有一点点不一样了。'},
  sisters: {photoTop:85, likes:'17,828', body:'和朋友来看演出啦～\n今晚要尽情享受！'},
  study: {photoTop:65, likes:'9,617', body:'大家一起学习！\n考试加油……', comments:'查看全部58条评论'},
};

function rect(g,x,y,w,h,c){g.fillStyle=c;g.fillRect(x,y,w,h)}
function txt(g,s,x,y,size=16,c='#151515',bold=false){g.fillStyle=c;g.font=`${bold?'bold ':''}${size}px "MV Gothic", "Microsoft YaHei", sans-serif`;g.textAlign='left';g.textBaseline='alphabetic';g.fillText(s,x,y)}
function cover(g,img,x,y,w,h){if(!img)return;const iw=img.width,ih=img.height,s=Math.max(w/iw,h/ih);g.save();g.beginPath();g.rect(x,y,w,h);g.clip();g.drawImage(img,x+(w-iw*s)/2,y+(h-ih*s)/2,iw*s,ih*s);g.restore()}
function heart(g,x,y,size=19,filled=false){g.save();g.translate(x,y);g.scale(size/20,size/20);g.beginPath();g.moveTo(10,17);g.bezierCurveTo(-5,7,0,-4,9,3);g.bezierCurveTo(18,-4,27,7,10,17);g.strokeStyle='#353d3b';g.fillStyle='#1f2725';g.lineWidth=1.2;if(filled)g.fill();else g.stroke();g.restore()}
function comment(g,x,y){g.beginPath();g.arc(x+10,y+9,10,0,Math.PI*2);g.moveTo(x+17,y+15);g.lineTo(x+22,y+20);g.lineTo(x+15,y+18);g.strokeStyle='#353d3b';g.lineWidth=1.2;g.stroke()}
function bodyLines(g,lines,x,y,size=16,leading=21,c='#151515'){String(lines).split('\n').forEach((s,i)=>txt(g,s,x,y+i*leading,size,c))}
function caption(g,name,body,x,y,width){let xx=x,yy=y;for(const[run,bold]of[[name+' ',true],[body,false]])for(const ch of run){g.font=`${bold?'bold ':''}16px "MV Gothic", "Microsoft YaHei", sans-serif`;const w=g.measureText(ch).width;if(ch==='\n'||xx+w>x+width){xx=x;yy+=21;if(ch==='\n')continue}txt(g,ch,xx,yy,16,'#151515',bold);xx+=w}return yy}

// Draw at phone-local origin. The caller places this at source (292,0) and preserves MV background.
export function drawPostPhone(g,{variant='selfie',photo,avatar,body,likes,username='deepseek_dafeiyu',scrollY=0}={}){
  const v=SOCIAL_VARIANTS[variant];if(!v)throw new Error('Unknown social variant');
  g.save();rect(g,0,0,376,540,'#b7c9ef');
  g.fillStyle='#6963cf';g.beginPath();g.roundRect(157,13,62,9,5);g.fill();
  for(const x of [335,350]){g.beginPath();g.arc(x,17,4.6,0,Math.PI*2);g.fill()}
  g.beginPath();g.rect(23,38,330,502);g.clip();rect(g,23,38,330,502,'#fff');g.translate(0,-scrollY);
  const p=v.photoTop;cover(g,avatar||photo,24,p-35,43,33);txt(g,username,83,p-12,17,'#101417',true);
  if(photo)cover(g,photo,23,p,330,330);else rect(g,23,p,330,330,'#eef3f7');
  const bottom=p+330;heart(g,28,bottom+14);comment(g,63,bottom+15);
  rect(g,23,bottom+42,330,.8,'#b9bfbd');heart(g,28,bottom+54,11,true);
  txt(g,`赞  ${likes||v.likes}`,44,bottom+66,17,'#111',true);
  const lastY=caption(g,username,body||v.body,23,bottom+93,325);
  if(v.comments)txt(g,v.comments,23,lastY+28,15,'#969b98');
  g.restore();
}

// Front-facing feed for the tilted phone at 135s. Projective placement is separate from UI drawing.
export function drawSearchFeed(g,{width=400,height=650,photos=[],avatars=[],query='大肥鱼'}={}){
  g.save();g.scale(width/400,height/650);rect(g,0,0,400,650,'#fff');rect(g,0,0,400,28,'#55b5cf');
  txt(g,'●●●●',10,19,12,'#fff');txt(g,'8:00 AM',164,19,12,'#fff');txt(g,'75%',330,19,12,'#fff');rect(g,363,8,24,12,'#fff');rect(g,387,11,3,6,'#fff');rect(g,365,10,17,8,'#55b5cf');
  g.fillStyle='#55b5cf';g.beginPath();g.roundRect(12,38,376,36,12);g.fill();txt(g,query,163,62,18,'#fff');
  const rows=[
    ['路过的鲸鱼','@hello_whale','最近的照片好可爱～\n浅色开衫很适合她呢！',94],
    ['小星光','@starlight','本月杂志也看到她啦！\n发型与搭配都很喜欢～',204],
    ['R.B','@rainy_book','也就照片好看吧？',446],
    ['TSS','@summer_note','我倒是很喜欢她。',550],
  ];
  rows.forEach(([name,handle,body,y],i)=>{
    cover(g,avatars[i]||photos[i%Math.max(1,photos.length)],12,y,45,45);
    txt(g,name,67,y+15,16,'#55a9bf',true);txt(g,handle,67,y+34,13,'#78adbd');
    bodyLines(g,body,67,y+56,16,22,'#5dacc1');
    if(i===1){const cells=photos.slice(0,3);cells.forEach((im,j)=>cover(g,im,67+j*96,y+95,92,106))}
    rect(g,0,i===1?433:y+98,400,1,'#a8cbd5');
  });g.restore();
}

function solve(a,b){const n=b.length;for(let k=0;k<n;k++){let p=k;for(let i=k+1;i<n;i++)if(Math.abs(a[i][k])>Math.abs(a[p][k]))p=i;[a[k],a[p]]=[a[p],a[k]];[b[k],b[p]]=[b[p],b[k]];if(Math.abs(a[k][k])<1e-12)throw new Error('Singular phone quad');const d=a[k][k];for(let j=k;j<n;j++)a[k][j]/=d;b[k]/=d;for(let i=0;i<n;i++){if(i===k)continue;const f=a[i][k];for(let j=k;j<n;j++)a[i][j]-=f*a[k][j];b[i]-=f*b[k]}}return b}
function projective(quad){const a=[],b=[];[[0,0],[1,0],[1,1],[0,1]].forEach(([u,v],i)=>{const[x,y]=quad[i];a.push([u,v,1,0,0,0,-u*x,-v*x]);b.push(x);a.push([0,0,0,u,v,1,-u*y,-v*y]);b.push(y)});const h=solve(a,b);return(u,v)=>{const z=h[6]*u+h[7]*v+1;return[(h[0]*u+h[1]*v+h[2])/z,(h[3]*u+h[4]*v+h[5])/z]}}
function triangle(g,img,s,d){const[[x0,y0],[x1,y1],[x2,y2]]=s,[[X0,Y0],[X1,Y1],[X2,Y2]]=d;const det=x0*(y1-y2)+x1*(y2-y0)+x2*(y0-y1);const A=(X0*(y1-y2)+X1*(y2-y0)+X2*(y0-y1))/det,B=(Y0*(y1-y2)+Y1*(y2-y0)+Y2*(y0-y1))/det,C=(X0*(x2-x1)+X1*(x0-x2)+X2*(x1-x0))/det,D=(Y0*(x2-x1)+Y1*(x0-x2)+Y2*(x1-x0))/det,E=(X0*(x1*y2-x2*y1)+X1*(x2*y0-x0*y2)+X2*(x0*y1-x1*y0))/det,F=(Y0*(x1*y2-x2*y1)+Y1*(x2*y0-x0*y2)+Y2*(x0*y1-x1*y0))/det;g.save();g.beginPath();const cx=(X0+X1+X2)/3,cy=(Y0+Y1+Y2)/3,padded=[[X0,Y0],[X1,Y1],[X2,Y2]].map(([x,y])=>{const dx=x-cx,dy=y-cy,d=Math.hypot(dx,dy);return[x+dx/d*.65,y+dy/d*.65]});g.moveTo(...padded[0]);g.lineTo(...padded[1]);g.lineTo(...padded[2]);g.closePath();g.clip();g.transform(A,B,C,D,E,F);g.drawImage(img,0,0);g.restore()}
// Caller restores the original foreground thumb over this panel. q order: TL,TR,BR,BL.
export function drawPerspectivePanel(g,img,q,{columns=12,rows=18}={}){const p=projective(q),w=img.width,h=img.height;g.save();g.beginPath();g.moveTo(...q[0]);for(const v of q.slice(1))g.lineTo(...v);g.closePath();g.clip();g.fillStyle='#fff';g.fill();for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){const u=x/columns,v=y/rows,U=(x+1)/columns,V=(y+1)/rows;triangle(g,img,[[u*w,v*h],[U*w,v*h],[U*w,V*h]],[p(u,v),p(U,v),p(U,V)]);triangle(g,img,[[u*w,v*h],[U*w,V*h],[u*w,V*h]],[p(u,v),p(U,V),p(u,V)])}g.restore()}
