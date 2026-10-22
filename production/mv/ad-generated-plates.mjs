// Generated clean scenes. Pixel quads are measured on the actual 1672x941 plates.
const BASE='assets/visuals/backgrounds/';
export const GENERATED_AD_QUADS={
 'city-early':[
 [[222,224],[276,260],[276,446],[222,409]],
 [[669,230],[737,239],[737,361],[669,354]],
 [[767,379],[891,378],[891,607],[767,609]],
 [[953,304],[1055,304],[1055,408],[953,408]],
 [[1299,95],[1361,61],[1361,199],[1299,245]],
 [[1522,120],[1648,58],[1653,337],[1522,390]],
 [[1550,455],[1651,419],[1659,663],[1550,694]]],
 city:[
 [[826,233],[1166,177],[1175,500],[822,528]],
 [[0,71],[208,88],[208,208],[0,192]],[[0,258],[174,218],[168,367],[0,398]],
 [[312,43],[484,60],[480,151],[308,135]],[[305,150],[478,167],[474,249],[300,235]],
 [[294,266],[485,289],[480,374],[288,354]],[[497,278],[652,288],[649,393],[493,382]],
 [[274,432],[479,449],[472,572],[265,561]],[[525,441],[636,447],[634,567],[521,559]],
 [[157,294],[210,288],[195,475],[144,478]],[[170,523],[246,519],[229,792],[150,794]],
 [[264,595],[425,600],[422,741],[254,736]]],
 station:[[[241,159],[948,94],[948,571],[241,558]]],
 hall:[[[182,89],[1479,298],[1479,626],[182,665]]]
};
const QUAD_CACHE=new Map(),SCENES=new Map();
const FILES={'city-early':'ad-city-early-transparent-generated.png',city:'ad-city-late-clean-generated.png',station:'ad-station-clean-generated.png',hall:'ad-hall-clean-moderate-v3.png'};
const F=['fashion-10-green-jacket','fashion-04-casual-clean','fashion-03-hat-glasses','fashion-01-blue-hoodie','fashion-07-coat-drink','fashion-09-blue-shirtdress','fashion-08-purple-dress','fashion-02-pink-coat','fashion-05-scarf-kick-clean'];
function triangle(g,img,src,dst){const[a,b,c]=src,[A,B,D]=dst,den=(b[0]-a[0])*(c[1]-a[1])-(c[0]-a[0])*(b[1]-a[1]);const m1=((B[0]-A[0])*(c[1]-a[1])-(D[0]-A[0])*(b[1]-a[1]))/den,m3=((D[0]-A[0])*(b[0]-a[0])-(B[0]-A[0])*(c[0]-a[0]))/den,m2=((B[1]-A[1])*(c[1]-a[1])-(D[1]-A[1])*(b[1]-a[1]))/den,m4=((D[1]-A[1])*(b[0]-a[0])-(B[1]-A[1])*(c[0]-a[0]))/den;g.save();g.beginPath();const mx=dst.reduce((s,p)=>s+p[0],0)/3,my=dst.reduce((s,p)=>s+p[1],0)/3;dst.forEach(([x,y],i)=>{const d=Math.hypot(x-mx,y-my),xx=x+(x-mx)/d*.7,yy=y+(y-my)/d*.7;i?g.lineTo(xx,yy):g.moveTo(xx,yy)});g.closePath();g.clip();g.transform(m1,m2,m3,m4,A[0]-m1*a[0]-m3*a[1],A[1]-m2*a[0]-m4*a[1]);g.drawImage(img,0,0);g.restore()}
function perspective(g,img,q){const[x0,y0]=q[0],[x1,y1]=q[1],[x2,y2]=q[2],[x3,y3]=q[3],dx1=x1-x2,dx2=x3-x2,dx3=x0-x1+x2-x3,dy1=y1-y2,dy2=y3-y2,dy3=y0-y1+y2-y3,den=dx1*dy2-dx2*dy1,G=(dx3*dy2-dx2*dy3)/den,H=(dx1*dy3-dx3*dy1)/den,A=x1-x0+G*x1,B=x3-x0+H*x3,D=y1-y0+G*y1,E=y3-y0+H*y3;
 const map=(u,v)=>[(A*u+B*v+x0)/(G*u+H*v+1),(D*u+E*v+y0)/(G*u+H*v+1)];for(let j=0;j<12;j++)for(let i=0;i<12;i++){const u=i/12,v=j/12,uu=(i+1)/12,vv=(j+1)/12,src=[[u*img.width,v*img.height],[uu*img.width,v*img.height],[uu*img.width,vv*img.height],[u*img.width,vv*img.height]],dst=[map(u,v),map(uu,v),map(uu,vv),map(u,vv)];triangle(g,img,[src[0],src[1],src[2]],[dst[0],dst[1],dst[2]]);triangle(g,img,[src[0],src[2],src[3]],[dst[0],dst[2],dst[3]])}}
function fit(g,im,w,h,sy=0,sh=im.height,anchor=.5){const sw=im.width,s=Math.max(w/sw,h/sh);g.drawImage(im,0,sy,sw,sh,(w-sw*s)*anchor,(h-sh*s)*.22,sw*s,sh*s)}
// Hall's old top-edge / left-edge ratio included perspective foreshortening twice.
// 3.1 is a rectified poster working aspect, calibrated at the character's face;
// the generated plate has no physical camera calibration. Other scenes keep their prior sizing.
async function artwork(kind,i,q,api){const key=kind+':'+i;if(QUAD_CACHE.has(key))return QUAD_CACHE.get(key);const w=Math.ceil(Math.hypot(q[1][0]-q[0][0],q[1][1]-q[0][1])*3),h=Math.ceil(kind==='hall'?w/3.1:Math.hypot(q[3][0]-q[0][0],q[3][1]-q[0][1])*3),c=api.createCanvas(w,h),g=c.getContext('2d');g.fillStyle=['#ffdfeb','#fff5e5','#e9e7f4'][i%3];g.fillRect(0,0,w,h);
 let file;if(kind==='station')file='a-ad-station.png';else if(kind==='hall')file='a-ad-wall.png';else if(kind==='city'&&i===0)file='a-ad-city.png';else if(kind==='city-early'&&i===2)file='a-cover.png';else file='fashion-models/'+F[i%F.length]+'.png';const im=await api.asset('assets/visuals/'+file);if(kind==='hall'){const bbox={x:0,y:0,w:1634,h:941};const s=h/bbox.h;g.drawImage(im,bbox.x,bbox.y,bbox.w,bbox.h,-1,0,bbox.w*s,bbox.h*s)}else fit(g,im,w,h,0,im.height*(file.startsWith('fashion')&&w/h>.7?.46:1),.5);
 if(kind==='hall'){g.fillStyle='#9873c0';g.font=`${Math.round(h*.09)}px "MV Gothic"`;g.fillText('HoneyWorks',w*.69,h*.37);g.font=`${Math.round(h*.06)}px "MV Gothic"`;g.fillText('可愛くなりたい',w*.69,h*.52)}
 QUAD_CACHE.set(key,c);return c}
async function completeScene(kind,api){if(SCENES.has(kind))return SCENES.get(kind);const c=api.createCanvas(3344,1882),g=c.getContext('2d');g.scale(2,2);g.drawImage(await api.asset(BASE+FILES[kind]),0,0,1672,941);for(let i=0;i<GENERATED_AD_QUADS[kind].length;i++){const q=GENERATED_AD_QUADS[kind][i];perspective(g,await artwork(kind,i,q,api),q)}SCENES.set(kind,c);return c}
export async function drawGeneratedAd(g,kind,t,api){
 if(kind==='city-early'){g.fillStyle='#92dbef';g.fillRect(0,0,960,540);g.fillStyle='rgba(255,255,255,.5)';for(let y=-10;y<550;y+=12)for(let x=-10;x<980;x+=12){g.beginPath();g.arc(x+(y%24?6:0),y,.7,0,Math.PI*2);g.fill()}const u=Math.max(0,Math.min(1,(t-94)/4.8));g.save();g.translate(0,28*u);g.scale(1.025,1.025);g.drawImage(await completeScene(kind,api),0,-8,960,540);g.restore();return}
 g.drawImage(await completeScene(kind,api),0,0,960,540);
}
