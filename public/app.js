import * as THREE from '/vendor/three.module.min.js';
import {OrbitControls} from '/vendor/OrbitControls.js';
import {moveSwept,pushOutOfBox} from '/physics.js?v=1';
let RAPW=null;// عالم Rapier التجريبي (null = الفيزياء العادية)
import {CHARS,LEG_NAMES,CH_COUNT,CH_ALL,charGeo,charMaterials,makeWalker,charThumbs,CARS,CAR_N,carGeo,carGlassGeo,HATS,BACKS,TAGS,SHOP_SKINS,SKIN_FIRST,chName} from '/chars.js?v=9';
import AU from '/audio.js?v=5';
import {createDistrict} from '/district.js?v=13';
import {createPalaceIn} from '/palace.js?v=1';
import {createGames,QK} from '/games.js?v=14';
import {createFair} from '/fair.js?v=1';
import {createJobs,JAIL_REASONS} from '/jobs.js?v=14';
// 📨 مركز الشكاوي: الحالة (معرّفة بدري لأن updCount يقرأها)
let CC={on:false,n:0,d:null,tab:''};
import {createVoxWorld,PLACE_NAMES} from '/voxworld.js?v=17';
import {createWorlds} from '/worlds.js?v=3';
const WX0W=144;
// 💼 الوظائف/الشرطة/المستشفى (jobs.js) — بديل مؤقت لين ينشئ (عشان أي دالة تنادى بدري ما تنكسر)
let JB={jailed:()=>false,inj:()=>false,spd:()=>1,clamp(){},noCar:()=>false,stopNow:()=>false,crash(){},hurt(){},card(){},label:()=>null,namePrefix:()=>'',chip:()=>'',onNet:()=>false,frame(){},parts(){},signs(){},cellPos:()=>({x:0,z:0}),open(){},myCh:c=>c};

// ================= إعدادات صاحب المدينة =================
const OWNER_NAME='من الصفر';          // الاسم على البرج
const CHANNEL_URL='';                 // حط رابط قناتك هنا (مثال: https://youtube.com/@...) ويظهر زر «تابع القناة»
// ================= ثوابت مشتركة مع السيرفر =================
// الحد الأدنى 48 مربع = ثلاث حلقات كاملة حول البرج (شبكة 7×7) — لازم يطابق server.js
const nBlocks=c=>Math.max(48,Math.ceil((c+120)/4));// لازم تطابق server.js
const PLOT=24,BLK=50,RD=28,STEP=BLK+RD,KS=1.6;// KS = تكبير كل البيوت// الشارع 28م = ثلاث مسارات بكل اتجاه
const TYPE_NAMES=['خيمة','بيت طين','فيلا','برج','قلعة'];
// الجوائز: كل يوم دخول يفتح عنصر بهذا الترتيب (لازم يطابق REWARD_ORDER في server.js)
const REWARD_ORDER='h1 c1 d1 b1 t1 h2 c2 d2 b2 t2 h3 c3 d3 b3 t3 h4 c4 d4 b4 t4 h5 c5 h6 c6 t5 t6'.split(' ');
const HCOL=[null,'#f7c6c6','#bfe3f5','#cfe8c3','#f3dd8a','#d9c3ee','#f2a65a'],HCNAMES=['الأصلي','وردي','سماوي','نعناعي','أصفر','بنفسجي','برتقالي'],HDECOS=['بدون','علم','نخلتين','فوانيس','تمثال ذهبي'];
const ZST=[0,0,0,0,0];
const rewardName=t=>{const k=t[0],n=+t.slice(1);return k==='h'?'قبعة «'+HATS[n]+'»':k==='b'?'«'+BACKS[n]+'» للظهر':k==='t'?'شارة '+TAGS[n]:k==='c'?'لون بيت «'+HCNAMES[n]+'»':'زينة بيت «'+HDECOS[n]+'»';};
const withTag=(name,tag)=>{const t=tag|0,e=t===7?'👑':TAGS[t];return(e?e+' ':'')+name;};// الشارة 7 = تاج صاحب المدينة (حصرية)
// ترتيب المربعات حلزوني حول الساحة (المربع 0 = الساحة)
/* المدينة بلا نهاية: الحلقات تنضاف لحالها كل ما احتجنا مربعات أكثر (كانت 39 حلقة ثابتة = ~25 ألف بيت ثم تنهار المدينة) */
const SPIRAL=[[0,0]],BLOCKIDX=new Map([['0,0',0]]);let SPR=0;
function growSpiral(r){while(SPR<r){SPR++;const ring=[];for(let x=-SPR;x<=SPR;x++)for(let z=-SPR;z<=SPR;z++)if(Math.max(Math.abs(x),Math.abs(z))===SPR)ring.push([x,z]);ring.sort((a,b)=>Math.atan2(a[1],a[0])-Math.atan2(b[1],b[0]));for(const b of ring){BLOCKIDX.set(b[0]+','+b[1],SPIRAL.length);SPIRAL.push(b);}}}
growSpiral(39);
const sp=i=>{while(i>=SPIRAL.length)growSpiral(SPR+1);return SPIRAL[i];};
const SLOT=[[-12.5,-12.5],[12.5,-12.5],[-12.5,12.5],[12.5,12.5]];const faceOf=p=>SLOT[p%4][1]<0?-1:1;// البيت اللي أرضه شمال المربع يواجه الشارع الشمالي، واللي جنوب يواجه الجنوبي
function plotPos(p){const b=sp(1+Math.floor(p/4)),s=SLOT[p%4];return[b[0]*STEP+s[0],b[1]*STEP+s[1]];}
// الحوش: البيت مزاح HOFF للداخل، والحوش (3 سيارات ورا بعض) على الجهة اللي تطل على الشارع الجانبي
const KH=1.36,HOFF=2.2,YQ=9.4,FH=12.15,yardSide=p=>SLOT[p%4][0]<0?-1:1;
function houseXZ(p){const[x,z]=plotPos(p);return[x-yardSide(p)*HOFF,z];}

// ================= قدرة الجهاز =================
const CORES=navigator.hardwareConcurrency||4,MEM=navigator.deviceMemory||8;
const LOW=/Android [4-8]|iPhone OS (9|10|11|12)_/.test(navigator.userAgent)||CORES<=2||MEM<=2;
const MID=!LOW&&(CORES<=4||MEM<=4||Math.min(screen.width,screen.height)<500);
const OUTER=LOW?8:MID?11:14;           // كم حلقة ضواحي حول المدينة (تختفي في الضباب)

// ================= المشهد =================
// الرسومات: لو الجهاز ما قبل الإعدادات العالية نجرّب أخف (بدون تنعيم، طاقة منخفضة) قبل ما نستسلم
let R=null;for(const o of[{antialias:!LOW,powerPreference:'high-performance'},{antialias:false,powerPreference:'default'},{antialias:false,powerPreference:'low-power',precision:'mediump'}]){try{R=new THREE.WebGLRenderer(o);break;}catch(e){window.__glErr=String(e&&e.message||e);}}
if(!R){window.__noGL=1;throw new Error('WebGL unavailable: '+window.__glErr);}
R.setPixelRatio(Math.min(devicePixelRatio,LOW?1:MID?1.5:2));R.setSize(innerWidth,innerHeight);R.shadowMap.enabled=!LOW;R.shadowMap.type=MID?THREE.PCFShadowMap:THREE.PCFSoftShadowMap;R.outputColorSpace=THREE.SRGBColorSpace;
document.body.prepend(R.domElement);
const SKY='#9fd3ef';
const S=new THREE.Scene();S.background=new THREE.Color(SKY);S.fog=new THREE.Fog(SKY,300,950);
const cam=new THREE.PerspectiveCamera(48,innerWidth/innerHeight,1,2200);
// لقطة الافتتاح: منخفضة وبعيدة حتى يبان الأفق والمدينة ممتدة
// (الجوال الطولي يحتاج يرجع أكثر حتى يبان البرج كامل)
{const k=innerHeight>innerWidth?1.15:1;cam.position.set(230*k,135*k,300*k);}
const ctl=new OrbitControls(cam,R.domElement);ctl.target.set(0,45,0);ctl.enableDamping=true;ctl.dampingFactor=.08;ctl.maxPolarAngle=Math.PI*.45;ctl.minDistance=15;ctl.maxDistance=520;ctl.autoRotate=true;ctl.autoRotateSpeed=.35;
const grad=new THREE.DataTexture(new Uint8Array([95,95,95,255,175,175,175,255,255,255,255,255]),3,1,THREE.RGBAFormat);grad.minFilter=grad.magFilter=THREE.NearestFilter;grad.needsUpdate=true;
const toon=c=>new THREE.MeshToonMaterial({color:c,gradientMap:grad});
S.add(new THREE.HemisphereLight('#e2f4ff','#cdb88e',1.1));
const sun=new THREE.DirectionalLight('#fff4e0',2.2);sun.position.set(-90,140,70);sun.castShadow=true;const SMAP=MID?1024:2048;sun.shadow.mapSize.set(SMAP,SMAP);sun.shadow.bias=-.0008;S.add(sun);S.add(sun.target);
const OUT=new THREE.MeshBasicMaterial({color:'#1d1712',side:THREE.BackSide});
const ground=new THREE.Mesh(new THREE.PlaneGeometry(8000,8000),toon('#e3cf9f'));ground.rotation.x=-Math.PI/2;ground.position.y=-.06;ground.receiveShadow=true;S.add(ground);// تحت الإسفلت بمسافة كافية (لا يومض من بعيد)

// ================= أدوات الرسم المتكرر =================
const dummy=new THREE.Object3D();
const GEO={box:(()=>{const g=new THREE.BoxGeometry(1,1,1);g.translate(0,.5,0);return g})(),
 cyl:(()=>{const g=new THREE.CylinderGeometry(.5,.5,1,14);g.translate(0,.5,0);return g})(),
 pyr:(()=>{const g=new THREE.ConeGeometry(.7071,1,4);g.rotateY(Math.PI/4);g.translate(0,.5,0);return g})(),
 cone:(()=>{const g=new THREE.ConeGeometry(.5,1,14);g.translate(0,.5,0);return g})(),
 ball:new THREE.IcosahedronGeometry(.5,1),flat:(()=>{const g=new THREE.BoxGeometry(1,1,1);return g})()};
const layers={};// key -> mesh pair
function setLayer(key,geo,items,{outline=true,shadow=true,mat=null}={}){
 const old=layers[key];if(old){old.forEach(m=>{S.remove(m);m.dispose&&m.dispose();});}
 if(!items.length){delete layers[key];return[];}
 const m=new THREE.InstancedMesh(geo,mat||toon('#ffffff'),items.length);m.castShadow=shadow;m.receiveShadow=shadow;
 const ms=[m];let o=null;if(outline){o=new THREE.InstancedMesh(geo,OUT,items.length);ms.push(o);}
 const col=new THREE.Color();
 items.forEach((it,i)=>{dummy.position.set(it[0],it[1],it[2]);dummy.rotation.set(0,it[6]||0,0);dummy.scale.set(it[3],it[4],it[5]);dummy.updateMatrix();m.setMatrixAt(i,dummy.matrix);if(it[7]){col.set(it[7]);m.setColorAt(i,col);}
  if(o){const k=.22;dummy.scale.set(it[3]+k,it[4]+k,it[5]+k);dummy.position.y=it[1]-k/2*(geo===GEO.flat||geo===GEO.ball?0:1);dummy.updateMatrix();o.setMatrixAt(i,dummy.matrix);}});
 ms.forEach(x=>S.add(x));layers[key]=ms;return ms;}

// ================= أشكال البيوت =================
const rng=s=>{let h=0;for(const c of s)h=(h*31+c.charCodeAt(0))|0;return()=>{h=(h*1103515245+12345)|0;return((h>>>8)&0xffff)/65536;}};
const WALLC=['#f3ead8','#e9dcc2','#f7f3ea','#e7c9a5','#d9b48c','#f0e2cf','#cfd8d6','#e6d3b3'];
const ACC=['#3d8c7c','#c2553a','#2d6fb8','#d8a33a','#7a4f9a','#3aa06a'];
function houseParts(h,P){const[px0,z]=plotPos(h.plot),x=px0-yardSide(h.plot)*HOFF;const r=rng(h.id);const y=.4;const hcol=h.st&&h.st[3]?HCOL[h.st[3]]:null;const wc=hcol||WALLC[Math.floor(r()*WALLC.length)],ac=ACC[Math.floor(r()*ACC.length)];
 const K=KH,F=faceOf(h.plot),YS=yardSide(h.plot)*F;let GM=0,GSH=0;// البيت يلف 180° لو أرضه بالجهة الشمالية عشان بوابته تواجه أقرب شارع
 const B=(dx,dy,dz,sx,sy,sz,c,g='box',ry=0)=>{if(GM===1)dx=-dx;else if(GM===2)dx+=GSH;P[g].push([x+dx*K*F,y+dy*K,z+dz*K*F,sx*K,sy*K,sz*K,ry+(F<0?Math.PI:0),c]);};
 // قطعة بإحداثيات الأرض نفسها (q باتجاه الحوش، v باتجاه الشارع) بالمتر — للسور والحوش
 const BF=(q,dy,v,sq,sy,sv,c,g='box')=>P[g].push([px0+q*yardSide(h.plot),y+dy,z+v*F,sq,sy,sv,0,c]);
 // زينة: لو طاحت بمكان السيارات، الرفيعة تنزاح لطرف السور والعريضة تنقلب للجهة الثانية
 const grp=(ax,thin)=>{const q=-HOFF+ax*YS*K;if(q<=7.9){GM=0;return;}if(thin){GM=2;GSH=(11.2-q)/(K*YS);}else GM=1;};
 const win=(dx,dy,dz,sx,sy,sz)=>P.win.push([x+dx*K*F,y+dy*K,z+dz*K*F,sx*K,sy*K,sz*K,0,'#2f5f83']);
 const lf=(dx,dy,dz,l,c='#3f8f45',s=3,t=.25,w=.85,rad=1.3)=>{if(GM===1)dx=-dx;else if(GM===2)dx+=GSH;P.leaf.push([x+(dx+Math.cos(l)*rad)*K*F,y+dy*K,z+(dz+Math.sin(l)*rad)*K*F,s*K,t*K,w*K,-l+(F<0?Math.PI:0),c]);};
 let top=0;
 switch(h.type){
  case 0:{// خيمة مطوّرة: بيت شعر كبير بسقف مدرّج، مدخل بمظلة، مجلس وسجاد، نار قهوة، فوانيس، جمل وصناديق
   const cl=hcol||['#e9d3a8','#d9b98a','#c9a57a'][Math.floor(r()*3)],dk='#5a3a22',red='#8b2f2f';
   B(0,0,-.6,11.4,.35,9.4,'#6b4a2f');
   B(0,.3,-.6,11,5.2,9,cl,'pyr');B(0,2.6,-.6,5.8,2.9,4.7,red,'pyr');           // سقف + طبقة حمراء
   for(const s2 of[-1,1]){B(s2*5.3,0,-.6,.28,3.2,.28,dk);B(s2*5.3,0,3.5,.28,3.2,.28,dk);B(s2*5.3,0,-4.6,.28,3.2,.28,dk);}   // أعمدة
   B(0,2.9,4.2,6,.3,3,cl);B(-2.8,0,5.5,.28,2.9,.28,dk);B(2.8,0,5.5,.28,2.9,.28,dk);B(0,.3,3.9,2.1,2.4,.2,'#2b1a0e');   // مظلة المدخل + الباب
   B(0,.02,6.6,6.6,.08,3,red);B(0,.1,6.6,5.8,.08,2.3,'#e4b04a');for(const s2 of[-1,1])B(s2*2.3,.1,6.3,1.4,.55,1.1,'#2f6f8f');   // سجادة ووسائد
   B(-6,0,3,1.7,.35,1.7,'#8a8f96','cyl');B(-6,.35,3,1,.55,1,'#ff7a1a','cone');B(-5.2,0,4.4,.7,1,.7,'#c8922e','cyl');   // نار قهوة ودلّة
   for(const s2 of[-1,1]){B(s2*4.6,0,6.8,.22,3,.22,dk);B(s2*4.6,3,6.8,.75,.75,.75,'#ffd34d');}   // فوانيس
   B(4.8,1.4,-5.4,3.4,1.5,1.3,'#c2915a');B(4.8,2.9,-5.4,1,.9,.9,'#b6834c');for(const dx2 of[-1.2,1.2])for(const dz2 of[-.45,.45])B(4.8+dx2,0,-5.4+dz2,.38,1.5,.38,'#a77b4a');   // جمل
   B(6.9,2.4,-5.4,.5,1.9,.5,'#c2915a');B(7.2,4.1,-5.4,1.1,.55,.5,'#c2915a');
   B(-5.6,0,-3.4,1.5,1.1,1.5,'#8a5a2b');B(-4.2,0,-4,1,.8,1,'#a8794a');B(-5.4,0,-5.2,1.2,1.5,1.2,'#6b4a2f','cyl');   // صناديق وبرميل
   top=7.2;break;}
  case 1:{// بيت طين
   const c=hcol||['#c8925a','#bf8550','#d29e66'][Math.floor(r()*3)];B(0,0,0,10,4.2,9,c);B(0,4.2,0,10.6,.7,9.6,c);
   B(0,0,4.55,1.7,2.6,.2,'#6b4423');win(-3,2.3,4.55,1.2,1.0,.2);win(3,2.3,4.55,1.2,1.0,.2);
   for(let k=-2;k<=2;k++)B(k*2.2,3.6,4.7,.2,.2,.9,'#7a5533');// أخشاب السقف
   B(-6.2,0,2,1.6,1.6,1.6,'#a87a4a','cyl');top=5.2;break;}
  case 2:{// فيلا
   B(0,0,-.8,11,7,9.5,wc);B(0,7,-.8,11.5,.7,10,wc);B(2.2,7.7,-1.5,5.5,3.3,6,wc);B(2.2,11,-1.5,6,.6,6.5,wc);
   for(const f of[1.4,4.8])for(const k of[-3.6,0,3.6])win(k,f,3.98,1.5,1.6,.2);win(2.2,9,1.55,1.5,1.4,.2);
   B(0,0,3.98,1.8,2.6,.2,'#6b4423');
   grp(-5,true);B(-5,0,5,.45,5.5,.45,'#9a6e3f');for(let l=0;l<6;l++)lf(-5,5.6,5,l);GM=0;
   top=11.8;break;}
  case 3:{// برج
   const fl=6+Math.floor(r()*5),fh=3.3,H=fl*fh;B(0,0,0,11,H,11,wc);B(0,H,0,11.6,.8,11.6,ac);B(0,H+.8,0,4,2.4,4,wc);
   for(let f=0;f<fl;f++){const yy=1.2+f*fh;for(const k of[-3.3,0,3.3]){win(k,yy,5.55,1.6,1.8,.2);win(k,yy,-5.55,1.6,1.8,.2);win(5.55,yy,k,.2,1.8,1.6);win(-5.55,yy,k,.2,1.8,1.6);}}
   B(0,0,5.56,2.6,2.8,.2,'#3a4d5c');B(0,H+3.2,0,.15,2.5,.15,'#666');top=H+5.5;break;}
  case 4:{// قلعة
   const c=hcol||['#c9b48a','#bfa678','#d2c09a'][Math.floor(r()*3)],T=5.6;
   B(0,0,0,11,5,11,c);// الأسوار
   for(const[a,b]of[[-T,-T],[T,-T],[-T,T],[T,T]]){B(a,0,b,3.6,8,3.6,c,'cyl');B(a,8,b,4.2,.8,4.2,c,'cyl');B(a,8.8,b,3.4,2.6,3.4,ac,'cone');}
   for(let k=-2;k<=2;k++){B(k*2,5,T,1,.9,.6,c);B(k*2,5,-T,1,.9,.6,c);B(T,5,k*2,.6,.9,1,c);B(-T,5,k*2,.6,.9,1,c);}
   B(0,0,0,5,10,5,c);B(0,10,0,5.6,.8,5.6,c);B(0,0,5.55,2.4,3.4,.25,'#5a3a22');
   B(0,10.8,0,.15,3.4,.15,'#555');B(.9,13.2,0,1.8,1.0,.08,ac,'flat');top=14.5;break;}
 }
 // زينة أمام البيت (تنفتح بالجوائز)
 const dc=h.st?h.st[4]:0;
 if(dc){const gx=7.4,gz=7.4;
  if(dc===1){grp(gx,true);B(gx,0,gz,.25,9,.25,'#8a8f96');B(gx-1.6,8,gz,3.2,1.6,.1,ac,'flat');}
  else if(dc===2){for(const sx of[-1,1]){grp(sx*gx,true);B(sx*gx,0,gz,.45,6,.45,'#9a6e3f');for(let l=0;l<6;l++)lf(sx*gx,6.2,gz,l);}}
  else if(dc===3){for(const sx of[-1,1]){grp(sx*gx,true);B(sx*gx,0,gz,.3,3.4,.3,'#3a4750');B(sx*gx,3.4,gz,.9,.9,.9,'#ffd34d');}}
  else if(dc===4){grp(gx,false);B(gx,0,gz,1.6,1.1,1.6,'#d9d2c3');B(gx,1.1,gz,.9,2.2,.9,'#e7b53c','cyl');B(gx,3.3,gz,1.3,1.3,1.3,'#e7b53c','cyl');}GM=0;}
 // سياج لكل بيت (الفيلا لها سورها العالي) — بوابة بالنص يمشي منها الشخص
 {const vil=h.type===2,fc='#efe6d4',fh=vil?3.5:2.1,ft=vil?.7:.56,H=FH,pg=[-HOFF-1.6,-HOFF+1.6],cg=[YQ-2.9,YQ+2.9];
  BF(0,0,-H,2*H,fh,ft,fc);BF(-H,0,0,ft,fh,2*H,fc);BF(H,0,0,ft,fh,2*H,fc);
  for(const[q0,q1]of[[-H,pg[0]],[pg[1],cg[0]],[cg[1],H]])if(q1-q0>.2)BF((q0+q1)/2,0,H,q1-q0,fh,ft,fc);
  for(const q of[pg[0],pg[1]])BF(q,0,H,.8,fh+.8,.8,ac);for(const q of[cg[0],cg[1]])BF(q,0,H,1,fh+1.1,1,ac);
  if(vil)BF(-HOFF,fh+.8,H,3.2+.8,.7,.8,ac);
  BF(YQ,.02,0,6.4,.06,2*H-.6,'#a9adb2');for(const v of[-10.5,-3.5,3.5])BF(YQ,.06,v,5.6,.03,.22,'#f4f4f0');   // أرضية الحوش + خطوط المواقف
  BF(cg[1]+.05,2.4,H+.45,2.2,1,.12,'#2d6fb8','flat');   // لوحة P
  const dz0=DOORZ[h.type]*KH;BF(-HOFF,.03,(dz0+H)/2,2.4,.05,H-dz0,'#d8cfbd');for(const s2 of[-1,1])if(s2*3.9*KH-HOFF<YQ-3.4){BF(-HOFF+s2*5.3,0,H-2,1.8,1.1,1.8,'#8a6a45');BF(-HOFF+s2*5.3,1.1,H-2,1.4,1,1.4,'#3f8f45');}}// ممر من الباب للبوابة + أحواض زرع

 // ديكور مشترى بالعملة (حول البيت)
 for(const d of h.dx||[]){
  if(d==='palm'){grp(-6.9,true);B(-6.9,0,1.5,.5,7,.5,'#9a6e3f','cyl');for(let l=0;l<6;l++)lf(-6.9,7.2,1.5,l,'#2f9e44',3.4,.25,.9,1.5);}
  else if(d==='lamp'){for(const[a,b]of[[7,2.2],[-7,-2.6],[0,-7.4]]){grp(a,true);B(a,0,b,.3,3.8,.3,'#3a4750');B(a,3.8,b,1.1,1.1,1.1,'#fff3a0');}}
  else if(d==='garden'){GM=0;B(0,0,6.9,7,.15,1.5,'#4fae55');['#ff6b81','#ffd34d','#ffffff','#ff9f43','#c56cf0','#ff6b81'].forEach((c,i)=>B(-2.7+i*1.08,.15,6.9+(i%2?.35:-.35),.5,.7,.5,c));}
  else if(d==='fountain'){grp(-5.6,false);B(-5.6,0,-5.6,2.8,.9,2.8,'#d9d2c3','cyl');B(-5.6,.9,-5.6,2.2,.3,2.2,'#4aa8e0','cyl');B(-5.6,.9,-5.6,.5,2.4,.5,'#e0e8ee','cyl');B(-5.6,3.3,-5.6,1.2,.25,1.2,'#7cc8f0','cyl');}
  else if(d==='pool'){grp(5.2,false);B(5.2,0,-5.6,4,.2,4,'#eef4f7');B(5.2,.15,-5.6,3.4,.1,3.4,'#2fa8dd');}
  GM=0;
 }
 return top*K;}

// ================= الضواحي (ديكور حول المدينة، ما تنحجز) =================
// مبانٍ بسيطة بلا حدود سوداء ولا ظلال، تبعد وتخف حتى تذوب في الضباب — تحس إن المدينة ما لها نهاية
const OUTC=['#e8dcc4','#e2d2b4','#efe5d2','#d8c4a0','#dccdb2','#cfd3cc','#e5d6ba'];
const outSkip=i=>{const[bx,bz]=sp(i);return inPlazaBlock(bx,bz)||D.inBlock(bx,bz);};
function outBlock(i,innerR,O){
 if(outSkip(i))return;const[bx,bz]=sp(i);const cx=bx*STEP,cz=bz*STEP;const r=rng('o'+i);
 const ring=Math.max(Math.abs(bx),Math.abs(bz)),far=(ring-innerR)/OUTER;   // 0 قريب ← 1 بعيد
 if(r()<.07){// حديقة نخيل بدل مباني
  for(let k=0;k<5;k++){const px=cx+(r()-.5)*BLK*.7,pz=cz+(r()-.5)*BLK*.7;O.trunk.push([px,.35,pz,.45,6.5,.45,0,'#9a6e3f']);for(let l=0;l<5;l++)O.leaf.push([px+Math.cos(l*1.25)*1.3,6.8,pz+Math.sin(l*1.25)*1.3,3,.25,.85,-l*1.25,'#4a9450']);}
  return;}
 for(const[sx,sz]of SLOT){if(r()<.12)continue;
  const tall=r()<.08*(1-far*.6);const w=(9+r()*5)*1.5,d=(9+r()*5)*1.5,h=tall?16+r()*22:3.5+r()*(9-far*4);
  const c=OUTC[Math.floor(r()*OUTC.length)];const x=cx+sx+(r()-.5)*2,z=cz+sz+(r()-.5)*2;
  if(!tall&&r()<.1){// قصر: أدوار + قبة ذهبية + أربعة أبراج
   const W=(14+r()*2.5)*1.45,Dd=(12+r()*2.5)*1.45,H=8+r()*3;
   O.box.push([x,.35,z,W,H,Dd,0,'#efe6d4']);O.box.push([x,.35+H,z,W+.6,.6,Dd+.6,0,'#e7b53c']);
   O.box.push([x,.95+H,z,W*.55,3.5,Dd*.55,0,'#efe6d4']);O.box.push([x,.95+H+3.5,z,W*.3,2.6,Dd*.3,0,'#e7b53c']);
   for(const[a,b]of[[-1,-1],[1,-1],[-1,1],[1,1]]){O.box.push([x+a*W/2,.35,z+b*Dd/2,2.4,H+4,2.4,0,'#f4eadb']);O.box.push([x+a*W/2,.35+H+4,z+b*Dd/2,2.9,1,2.9,0,'#e7b53c']);}
   O.win.push([x,.35+H*.5,z+Dd/2+.05,W*.7,H*.5,.1,0,'#6f8ea3']);continue;}
  O.box.push([x,.35,z,w,h,d,0,c]);O.box.push([x,.35+h,z,w+.6,.6,d+.6,0,c]);
  if(h>8&&far<.7)O.win.push([x,.35+h*.5,z+d/2+.05,w*.7,h*.6,.1,0,'#6f8ea3']);}}

// ================= تحميل المدينة بالقطع: ما يتحمّل شي إلا لما العميل يقرب منه =================
// القطعة = 4×4 مربعات. بيوتها وشوارعها وضواحيها تُبنى (على دفعات، قطعة بالإطار) لما العميل يصير قريب، وتنحذف لما يبعد.
// البعيد يظهر كمكعب بسيط لكل بيت (طبقة وحدة) عشان منظر المدينة من فوق.
const CHB=3,CK=new Map(),ACT=new Set(),CKL=['box','cyl','pyr','cone','flat','win','leaf','dash','dashY','oBox','oWin','oTrunk','oLeaf'];let CKLAY='',CHPEND=0,CHSYNC=0,CHX=0,CHZ=0,SOLINIT=false;
const MATD=new THREE.MeshBasicMaterial({color:'#f2efe4'}),MATDY=new THREE.MeshBasicMaterial({color:'#f2c230'});
const ckKey=(bx,bz)=>Math.floor(bx/CHB)+','+Math.floor(bz/CHB);
const ckGet=k=>{let c=CK.get(k);if(!c)CK.set(k,c={blocks:[],hs:[],sig:'',sigB:null,on:false,sol:null,stat:null});return c;};
function ckRect(k){const[a,b]=k.split(',').map(Number);return{x0:(a*CHB-.5)*STEP,x1:((a+1)*CHB-.5)*STEP,z0:(b*CHB-.5)*STEP,z1:((b+1)*CHB-.5)*STEP};}
function dropLayer(key){const old=layers[key];if(old){old.forEach(m=>{S.remove(m);m.dispose&&m.dispose();});delete layers[key];}}
// شارع المدينة + نخيل + إنارة لمربع واحد
function cityBlock(i,P,dash,dashY){const[bx,bz]=sp(i);const cx=bx*STEP,cz=bz*STEP;
 for(const[a,b]of[[-1,-1],[1,-1],[-1,1],[1,1]]){const tx=cx+a*(BLK/2-1.2),tz=cz+b*(BLK/2-1.2);P.box.push([tx,.4,tz,.45,7,.45,0,'#9a6e3f']);for(let l=0;l<6;l++)P.leaf.push([tx+Math.cos(l)*1.4,7.4,tz+Math.sin(l)*1.4,3.2,.25,.9,-l,'#3f8f45']);}
 for(const o of[-RD/3,-RD/6,RD/6,RD/3])for(let k=-BLK/2;k<BLK/2;k+=6){if(Math.abs(k+1.5)<5.5)continue;dash.push([cx+k+1.5,.085,cz+STEP/2+o,2.6,.02,.35,0,'#f2efe4']);dash.push([cx+STEP/2+o,.085,cz+k+1.5,.35,.02,2.6,0,'#f2efe4']);}
 for(const sg of[-1,1])for(const o of[-.3,.3]){dashY.push([cx+sg*(BLK/4+2.25),.087,cz+STEP/2+o,BLK/2-4.5,.02,.28,0,'#f2c230']);dashY.push([cx+STEP/2+o,.087,cz+sg*(BLK/4+2.25),.28,.02,BLK/2-4.5,0,'#f2c230']);}
 for(let k=-3;k<=3;k+=1.5){dash.push([cx+k,.085,cz+STEP/2,.7,.022,RD-1.8,0,'#f2efe4']);dash.push([cx+STEP/2,.085,cz+k,RD-1.8,.022,.7,0,'#f2efe4']);}
 for(const[a,b]of[[0,-1],[0,1],[-1,0],[1,0]]){const lx=cx+a*(BLK/2-.4),lz=cz+b*(BLK/2-.4);P.box.push([lx,.4,lz,.28,6,.28,0,'#3a4750']);P.box.push([lx,6.4,lz,1.2,.5,1.2,0,'#fff3c4']);}}
function chunkBuild(k){const c=CK.get(k);if(!c)return;
 const P={box:[],cyl:[],pyr:[],cone:[],flat:[],win:[],leaf:[]},O={box:[],win:[],trunk:[],leaf:[]},dash=[],dashY=[],nbN=CITY.nb,mR=CITY.maxR;
 for(const i of c.blocks){if(i<=nbN)cityBlock(i,P,dash,dashY);else outBlock(i,mR,O);}
 for(const h of c.hs)TOPS.set(h.id,houseParts(h,P));
 if(c.stat)for(const g in c.stat){const d=P[g],src=c.stat[g];for(let q=0;q<src.length;q++)d.push(src[q]);}
 const L=(key,geo,items,o)=>setLayer(key+'@'+k,geo,items,o);
 L('box',GEO.box,P.box);L('cyl',GEO.cyl,P.cyl);L('pyr',GEO.pyr,P.pyr);L('cone',GEO.cone,P.cone);L('flat',GEO.flat,P.flat);
 L('win',GEO.flat,P.win,{outline:false,shadow:false});L('leaf',GEO.flat,P.leaf,{shadow:true});
 L('dash',GEO.flat,dash,{outline:false,shadow:false,mat:MATD});L('dashY',GEO.flat,dashY,{outline:false,shadow:false,mat:MATDY});
 L('oBox',GEO.box,O.box,{outline:false,shadow:false});L('oWin',GEO.flat,O.win,{outline:false,shadow:false});L('oTrunk',GEO.box,O.trunk,{outline:false,shadow:false});L('oLeaf',GEO.flat,O.leaf,{outline:false,shadow:false});
 const sol=[];for(const g of['box','cyl','cone'])for(const it of P[g])if(it[4]>=.6&&it[3]>=.2&&it[5]>=.2)sol.push([it,1]);
 for(const it of P.pyr)sol.push([it,.75]);for(const it of O.box)sol.push([it,1]);for(const it of O.trunk)sol.push([it,1]);
 c.sol=sol;c.on=true;c.sigB=c.sig;ACT.add(k);}
function chunkDrop(k){for(const key of CKL)dropLayer(key+'@'+k);const c=CK.get(k);if(c){c.on=false;c.sol=null;}ACT.delete(k);}
function rebuildSolids(){SOL.length=0;SGRID=new Map();
 for(const k of ACT){const c=CK.get(k);if(!c||!c.sol)continue;for(const[it,m]of c.sol){const r=it[6]||0,cs=Math.abs(Math.cos(r)),sn=Math.abs(Math.sin(r)),hx=(cs*it[3]+sn*it[5])/2*m,hz=(sn*it[3]+cs*it[5])/2*m;addSolidBox([it[0]-hx,it[0]+hx,it[2]-hz,it[2]+hz,it[1],it[1]+it[4]]);}}
 D.reg();if(RAPW){const t0=performance.now();RAPW.setSolids(SOL);if(performance.now()-t0>30)console.log('[rapier] setSolids',SOL.length,(performance.now()-t0).toFixed(0)+'ms');}}
const HLOD=['#e9d3a8','#c8925a','#efe6d4','#a9bccb','#c9b48a'],HLH=[4,5,8,24,14];
function lodBuild(){const items=[];for(const h of HOUSES){if(h.ck&&ACT.has(h.ck))continue;const[x,z]=houseXZ(h.plot);items.push([x,.4,z,8.5,HLH[h.type]||5,10,0,HLOD[h.type]||HLOD[0]]);}
 setLayer('lod',GEO.box,items,{outline:false,shadow:false});}
// يحدّد أي القطع قريبة من العميل: يبني (قطعة بالإطار) ويحذف البعيد. force = ابنِ الكل الحين (بعد انتقال)
function chunkSync(force){if(!CK.size)return;const f=WK.on?WK.p:ctl.target,R=WK.on?(CAR.on?430:300):(cam.position.distanceTo(ctl.target)<420?300:0),want=new Set();
 if(R>0)for(const[k]of CK){const r=ckRect(k),dx=Math.max(r.x0-f.x,0,f.x-r.x1),dz=Math.max(r.z0-f.z,0,f.z-r.z1);if(dx*dx+dz*dz<=R*R)want.add(k);}
 let changed=false;
 for(const k of[...ACT])if(!want.has(k)){chunkDrop(k);changed=true;}
 for(const k of[...ACT]){const c=CK.get(k);if(c&&c.sig!==c.sigB){chunkBuild(k);changed=true;}}
 const need=[...want].filter(k=>!ACT.has(k)).map(k=>{const r=ckRect(k);return[k,Math.hypot((r.x0+r.x1)/2-f.x,(r.z0+r.z1)/2-f.z)];}).sort((a,b)=>a[1]-b[1]);
 let n=0;for(const[k]of need){if(!force&&n>=1)break;chunkBuild(k);n++;changed=true;}
 CHPEND=need.length-n;if(changed||!SOLINIT){SOLINIT=true;rebuildSolids();lodBuild();}}
window.__chunks=()=>({act:ACT.size,all:CK.size,pend:CHPEND});
// فحص الفيزياء (للاختبار): يرجع القطع المرتفعة اللي ما لها تصادم قرب اللاعب، مجمّعة حسب الطبقة
window.__layers=()=>layers;
window.__audit=(radius=150)=>{const f=WK.p,res={},m=new THREE.Matrix4(),pos=new THREE.Vector3(),q=new THREE.Quaternion(),sc=new THREE.Vector3();
 for(const key in layers){const kk=key.replace(/@.*/,'');if(/win|leaf|flat|lod|plinth|plots|asphalt|dash|oPlinth|plazaF|ball|^box$/.test(kk)&&kk!=='box')continue;const mesh=layers[key][0];if(!mesh||!mesh.isInstancedMesh)continue;
  for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,m);m.decompose(pos,q,sc);const x=pos.x+mesh.position.x,z=pos.z+mesh.position.z,y=pos.y+mesh.position.y;if(Math.hypot(x-f.x,z-f.z)>radius)continue;
   if(sc.y<2.2||sc.x<.5||sc.z<.5||y>2.5)continue;const p={x,z};collide(p,y,.3);if(Math.hypot(p.x-x,p.z-z)<.02)(res[kk]=res[kk]||[]).push([+x.toFixed(1),+z.toFixed(1),+sc.x.toFixed(1),+sc.y.toFixed(1),+sc.z.toFixed(1)]);}}
 return res;};

// ================= الساحة (مكان تجمّع اللاعبين + موقف سيارات) =================
// 5×5 مربعات برّا حافة المدينة بحلقتين (ناحية +z)، ممهّدة كلها بدون مباني
const plazaFor=maxR=>{const bz=maxR+5;return{x:0,z:bz*STEP,bz,h:105};};
let PLAZA=plazaFor(3);
const inPlazaBlock=(bx,bz)=>Math.abs(bx)<=2&&Math.abs(bz-PLAZA.bz)<=2;
const inPlaza=(x,z,m=0)=>Math.abs(x-PLAZA.x)<=PLAZA.h+m&&Math.abs(z-PLAZA.z)<=PLAZA.h+m;
const carSlot=i=>[PLAZA.x-63+i*18,PLAZA.z+60];
const CAMOCC=[];// [x,z,نصف العرض,الطول]
function plazaParts(P,F){const{x:px,z:pz,h}=PLAZA,y=.3;CAMOCC.length=0;GM.parts(P,F);FAIR.parts(P,F);WLD.parts(P,F);JB.parts(P,F);// قسم الألعاب (NE)
 F.push([px,0,pz,h*2,y,h*2,0,'#eadfc6']);
 // بلاط بلونين (يميّز الساحة عن الصحرا)
 {const n=12,s=h*2/n;for(let a=0;a<n;a++)for(let b=0;b<n;b++)if((a+b)%2)F.push([px-h+s*(a+.5),y,pz-h+s*(b+.5),s-.4,.015,s-.4,0,'#ddd0b4']);}
 F.push([px,y,pz,h*2-6,.02,9,0,'#dcc8a0']);F.push([px,y,pz,9,.02,h*2-6,0,'#dcc8a0']);// ممرات
 P.cyl.push([px,y,pz,66,.05,66,0,'#d9c49c']);
 // النافورة
 P.cyl.push([px,y,pz,20,1.3,20,0,'#d3dade']);P.cyl.push([px,y+1.3,pz,18.4,.08,18.4,0,'#5fb7e6']);
 P.cyl.push([px,y+1.3,pz,2,4,2,0,'#eef1f3']);P.cyl.push([px,y+5.3,pz,7,.5,7,0,'#d3dade']);P.cyl.push([px,y+5.8,pz,6.2,.06,6.2,0,'#5fb7e6']);
 P.cone.push([px,y+5.8,pz,1.6,3.6,1.6,0,'#a9defa']);
 // نخيل حول النافورة + كراسي
 for(let k=0;k<12;k++){const a=k/12*Math.PI*2,tx=px+Math.cos(a)*27,tz=pz+Math.sin(a)*27;P.box.push([tx,y,tz,.5,8,.5,0,'#9a6e3f']);CAMOCC.push([tx,tz,.45,9]);for(let l=0;l<6;l++)P.leaf.push([tx+Math.cos(l)*1.5,y+8.3,tz+Math.sin(l)*1.5,3.4,.25,.95,-l,'#3f8f45']);}
 for(let k=0;k<8;k++){const a=(k+.5)/8*Math.PI*2,bx=px+Math.cos(a)*18,bz=pz+Math.sin(a)*18;P.box.push([bx,y,bz,.9,.55,2.8,-a,'#9a6e3f']);P.box.push([bx+Math.cos(a)*.45,y+.55,bz+Math.sin(a)*.45,.15,.6,2.8,-a,'#7a5533']);}
 // أعمدة إنارة على الأطراف
 for(let s=-h+10;s<=h-10;s+=26)for(const[lx,lz]of[[s,-h+3],[s,h-3],[-h+3,s],[h-3,s]]){P.box.push([px+lx,y,pz+lz,.3,6.5,.3,0,'#3a4750']);CAMOCC.push([px+lx,pz+lz,.35,7.3]);P.box.push([px+lx,y+6.5,pz+lz,1,.8,1,0,'#fff3c4']);}
 // بوابة الدخول (من ناحية المدينة)
 const gz=pz-h+2;P.box.push([px-15,y,gz,2.6,11,2.6,0,'#c9b48a']);P.box.push([px+15,y,gz,2.6,11,2.6,0,'#c9b48a']);P.box.push([px,y+11,gz,33,2.4,2.6,0,'#c9b48a']);
 P.cone.push([px-15,y+13.4,gz,2.2,2.6,2.2,0,'#e7b53c']);P.cone.push([px+15,y+13.4,gz,2.2,2.6,2.2,0,'#e7b53c']);
 // ===== تفاصيل إضافية بالساحة =====
 // أحواض ورد حول النافورة
 for(let k=0;k<24;k++){const a=k/24*Math.PI*2,fx=px+Math.cos(a)*14.5,fz=pz+Math.sin(a)*14.5;P.box.push([fx,y,fz,2.6,.45,2.6,0,'#6b8f4a']);P.box.push([fx,y+.45,fz,1.7,.6,1.7,0,['#e94f8b','#ffd34d','#ff7414','#ffffff','#b06be0'][k%5]]);}
 // أعمدة إنارة حلقة حول النافورة
 for(let k=0;k<8;k++){const a=k/8*Math.PI*2+.2,lx=px+Math.cos(a)*36,lz=pz+Math.sin(a)*36;P.box.push([lx,y,lz,.3,6.5,.3,0,'#3a4750']);P.box.push([lx,y+6.5,lz,1,.8,1,0,'#fff3c4']);}
 // سوق: 6 بسطات على كل جانب (طاولة + أعمدة + مظلة مخططة + بضاعة)
 for(const sd of[-1,1])for(let k=0;k<6;k++){const sx=px+sd*(h-16),sz=pz-h+34+k*18,col=['#e94f3b','#2d6fb8','#f2c230','#3aa06a','#e7873a','#8a52c4'][(k+(sd>0?2:0))%6];
  P.box.push([sx,y,sz,3.4,1.5,6.2,0,'#a8794a']);
  for(const[ax,az]of[[-1.6,-3],[1.6,-3],[-1.6,3],[1.6,3]])P.box.push([sx+ax,y,sz+az,.25,3.6,.25,0,'#7a5533']);
  P.box.push([sx,y+3.6,sz,4.2,.3,7.2,0,col]);for(let i=0;i<3;i++)P.box.push([sx,y+3.9,sz-2.4+i*2.4,4.3,.1,.9,0,'#ffffff']);
  for(let i=0;i<3;i++)P.box.push([sx+(i-1)*.1,y+1.5,sz-2+i*2,1.1,.6,1.1,0,['#e94f3b','#ffd34d','#3aa06a','#ff7414','#b06be0'][(k+i)%5]]);}
 // برج الساعة بمؤخرة الساحة
 {const tx=px,tz=pz+h-16;P.box.push([tx,y,tz,9,32,9,0,'#cbb68c']);P.box.push([tx,y+32,tz,10.4,1.2,10.4,0,'#e7b53c']);P.box.push([tx,y+33.2,tz,7,7,7,0,'#cbb68c']);
  P.pyr.push([tx,y+40.2,tz,8.6,8,8.6,0,'#c2553a']);P.cone.push([tx,y+48.2,tz,.7,6,.7,0,'#e7b53c']);
  for(let f=0;f<4;f++){const yy=y+5+f*6.5;for(const sg of[-1,1]){P.win.push([tx,yy,tz+sg*4.55,1.4,2.6,.2,0,'#2f5f83']);P.win.push([tx+sg*4.55,yy,tz,.2,2.6,1.4,0,'#2f5f83']);}}}
 // (انحذفت المظلات/الأعمدة القديمة: مكانها مدينة الألعاب)
 // أعلام ملوّنة على جنبات الممر الرئيسي
 for(let k=0;k<6;k++){const bz=pz-h+14+k*11;for(const sx of[-9,9]){P.box.push([px+sx,y,bz,.28,8,.28,0,'#8a8f96']);P.flat.push([px+sx+(sx>0?-1.4:1.4),y+7,bz,2.6,1.2,.1,0,['#e94f3b','#2d6fb8','#f2c230','#3aa06a'][(k+(sx>0?1:0))%4]]);}}
 // عمودين للوحة «موقف السيارات»
 P.box.push([px-12.5,y,pz+44,.5,8.5,.5,0,'#3a4750']);P.box.push([px+12.5,y,pz+44,.5,8.5,.5,0,'#3a4750']);
 // موقف السيارات: خطوط بيضاء
 for(let i=0;i<=CAR_N;i++){const[cx,cz]=carSlot(i);F.push([cx-9,y,cz,.3,.02,8,0,'#ffffff']);}
 F.push([px,y,pz+60-4.2,CAR_N*18,.02,.3,0,'#ffffff']);}
// لوحة «الساحة» على البوابة (الوجهين)
let PSIGN=null,PEXTRA=null;
function placePlazaSign(){if(!PSIGN){const mat=new THREE.MeshBasicMaterial({map:textTex('🏟️ الساحة',1024,180,'#1d2b36','#ffd34d',120)});PSIGN=[0,1].map(()=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(24,4.2),mat);S.add(m);return m;});}
 const gz=PLAZA.z-PLAZA.h+2;PSIGN[0].position.set(PLAZA.x,.3+12.2,gz-1.35);PSIGN[0].rotation.y=Math.PI;PSIGN[1].position.set(PLAZA.x,.3+12.2,gz+1.35);
 if(!PEXTRA){const clk=new THREE.MeshBasicMaterial({map:textTex('🕒',512,512,'#ffffff','#1d2b36',330)}),park=new THREE.MeshBasicMaterial({map:textTex('🚗 موقف السيارات',1024,180,'#1d2b36','#ffffff',110)});
  PEXTRA={clocks:[0,1,2,3].map(()=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(5.6,5.6),clk);S.add(m);return m;}),park:new THREE.Mesh(new THREE.PlaneGeometry(24,4.2),park)};S.add(PEXTRA.park);}
 const{x:px,z:pz,h}=PLAZA,tz=pz+h-16;PEXTRA.clocks.forEach((m,k)=>{const a=k*Math.PI/2;m.position.set(px+Math.sin(a)*3.58,.3+36.7,tz+Math.cos(a)*3.58);m.rotation.y=a;});
 PEXTRA.park.position.set(px,.3+9.2,pz+44);PEXTRA.park.rotation.y=Math.PI;GM.signs();FAIR.signs();WLD.signs();JB.signs();}

// ================= المدينة =================
let OCACHE=null,OKEY='';let TOWER_TOP=120;let HOUSES=[],BYPLOT=new Map(),MYID=null,HASPIN=false,COUNT=0;
let dev;try{dev=localStorage.getItem('mnalsifr_dev');}catch{}
if(!dev){try{const m=document.cookie.match(/(?:^|; )mnalsifr_dev=([A-Za-z0-9-]{8,64})/);if(m)dev=m[1];}catch{}}
if(!dev)dev=(crypto.randomUUID?crypto.randomUUID():String(Math.random()).slice(2)+Date.now());
try{localStorage.setItem('mnalsifr_dev',dev);}catch{}
try{document.cookie='mnalsifr_dev='+dev+'; max-age=31536000; path=/; SameSite=Lax'+(location.protocol==='https:'?'; Secure':'');}catch{}
const TOPS=new Map();
function buildCity(){
 const nb=nBlocks(HOUSES.length),cap=nb*4;
 let maxR=0;for(let i=0;i<=nb;i++)maxR=Math.max(maxR,Math.abs(sp(i)[0]),Math.abs(sp(i)[1]));
 const ext=(2*maxR+1)*STEP+RD;
 PLAZA=plazaFor(maxR);// الساحة برّا المدينة بحلقتين، وتبعد لحالها لو كبرت المدينة
 D.onShop=()=>{if($('p30').style.display!=='block')openMarket();};D.build();secInit();if(D.vip){D.vip.houses=VIPH;D.vip.setPass(VIP.pass);}
 const outR=Math.max(maxR+OUTER,PLAZA.bz+5);growSpiral(outR+1);const lastO=Math.min((2*outR+1)**2-1,SPIRAL.length-1),extO=(2*outR+1)*STEP+RD;
 D.place(ground,extO);// الأرض والإسفلت فيهم فتحة للبحيرة
 setLayer('asphalt',GEO.flat,[[0,.055,0,ext,.03,ext,0,'#3b4148']],{outline:false,shadow:false});
 CITY={nb,maxR,outR,ext,lim:Math.max((maxR+Math.max(3,OUTER*.45))*STEP,PLAZA.z+760)};
 // قواعد المربعات والأراضي طبقات خفيفة (وحدة لكل المدينة)؛ التفاصيل بالقطع
 {const plinth=[],plots=[];for(let i=0;i<=nb;i++){const[bx,bz]=sp(i);plinth.push([bx*STEP,0,bz*STEP,BLK,.4,BLK,0,i===0?'#e8dcc0':'#d9d2c3']);}
  for(let p=0;p<cap;p++){const[x,z]=plotPos(p);plots.push([x,.41,z,PLOT-1,.05,PLOT-1,0,BYPLOT.has(p)?'#cfc6b4':'#cbbf9e']);}
  setLayer('plinth',GEO.box,plinth,{shadow:false});setLayer('plots',GEO.box,plots,{outline:false,shadow:false});}
 // تخطيط القطع (يتغيّر نادراً: لما تكبر المدينة حلقة جديدة أو تتحرك الساحة)
 const lay=maxR+'|'+outR+'|'+PLAZA.bz;
 if(lay!==CKLAY){for(const k of[...ACT])chunkDrop(k);CK.clear();CKLAY=lay;
  const oP=[];for(let i=1;i<=lastO;i++){if(outSkip(i))continue;const[bx,bz]=sp(i);ckGet(ckKey(bx,bz)).blocks.push(i);oP.push([bx*STEP,0,bz*STEP,BLK,.35,BLK,0,'#d6ccb8']);}
  ckGet(ckKey(0,0)).blocks.unshift(0);
  setLayer('oPlinth',GEO.box,oP,{outline:false,shadow:false});
  // البرج والساحة: مجسمات ثابتة توزّع على القطع حسب مكانها
  const P={box:[],cyl:[],pyr:[],cone:[],flat:[],win:[],leaf:[]};
 // ===== برج صاحب المدينة =====
 {const G='#7fa9c9',W='#f4f1ea',D='#2f5f83',GOLD='#e7b53c';let y=.4;
  P.box.push([0,y,0,26,6,26,0,W]);P.box.push([0,y+6,0,27,.8,27,0,GOLD]);y+=6.8;
  const tiers=[[17,44],[13.5,34],[10,26],[7,18],[4.5,10]];
  for(const[w,h]of tiers){P.box.push([0,y,0,w,h,w,0,G]);
   for(let k=3;k<h;k+=3.4){for(const sgn of[-1,1]){P.win.push([0,y+k,sgn*(w/2+.06),w*.86,.35,.2,0,W]);P.win.push([sgn*(w/2+.06),y+k,0,.2,.35,w*.86,0,W]);}}
   for(const sgn of[-1,1]){P.win.push([0,y+h/2,sgn*(w/2+.08),.5,h*.96,.2,0,D]);P.win.push([sgn*(w/2+.08),y+h/2,0,.2,h*.96,.5,0,D]);}
   y+=h;P.box.push([0,y,0,w+1.2,.9,w+1.2,0,GOLD]);y+=.9;}
  P.cyl.push([0,y,0,3.2,3,3.2,0,GOLD]);y+=3;P.cone.push([0,y,0,2.2,26,2.2,0,'#dfe6ea']);TOWER_TOP=y+26;
  // تاج ذهبي
  for(let k=0;k<8;k++){const a=k/8*Math.PI*2;P.cone.push([Math.cos(a)*2.6,y-1,Math.sin(a)*2.6,1,3.2,1,0,GOLD]);}
  // نخيل حول البرج
  for(const[a,b]of[[-14.5,-14.5],[14.5,-14.5],[-14.5,14.5],[14.5,14.5],[0,15.5],[-15.5,0],[15.5,0]])P.box.push([a,.4,b,.45,7,.45,0,'#9a6e3f']),[0,1,2,3,4,5].forEach(l=>P.leaf.push([a+Math.cos(l)*1.4,7.4,b+Math.sin(l)*1.4,3.2,.25,.9,-l,'#3f8f45']));
 }
  const PF=[];plazaParts(P,PF);setLayer('plazaF',GEO.box,PF,{outline:false});placePlazaSign();
  for(const g in P)for(const it of P[g]){const c=ckGet(ckKey(Math.round(it[0]/STEP),Math.round(it[2]/STEP)));c.stat=c.stat||{};(c.stat[g]=c.stat[g]||[]).push(it);}
  for(const c of CK.values())c.sigB=null;SOLINIT=false;}
 // البيوت → قطعها؛ القطعة تنبني من جديد بس لو تغيّر شي فيها
 for(const c of CK.values()){c.hs.length=0;c.hn=0;}
 for(const[k,c]of CK){let cb=0;for(const i of c.blocks)if(i<=nb)cb++;c.cb=cb;}
 for(const h of HOUSES){const[bx,bz]=sp(1+Math.floor(h.plot/4));const k=ckKey(bx,bz);h.ck=k;const c=ckGet(k);c.hs.push(h);}
 for(const c of CK.values()){let sg=c.cb+'|';for(const h of c.hs)sg+=h.id+h.type+(h.st||ZST).join('')+(h.dx||[]).join('')+';';c.sig=sg;}
 ensureCars();buildLife();
 if(!S.userData.tower){S.userData.tower=true;
  const tex=textTex(OWNER_NAME,1024,256,'#ff7414','#ffffff',150);const bm=new THREE.MeshBasicMaterial({map:tex});
  const yb=.4+6.8+44+.9+34*.55;// لوحة الاسم على الطابق الثاني من الأربع جهات
  for(let k=0;k<4;k++){const a=k*Math.PI/2;const m=new THREE.Mesh(new THREE.PlaneGeometry(12.6,3.2),bm);m.position.set(Math.sin(a)*6.86,yb,Math.cos(a)*6.86);m.rotation.y=a;S.add(m);
   const m2=new THREE.Mesh(new THREE.PlaneGeometry(16,4),bm);const y1=.4+6.8+44*.8;m2.position.set(Math.sin(a)*8.62,y1,Math.cos(a)*8.62);m2.rotation.y=a;S.add(m2);}
  const ent=new THREE.Mesh(new THREE.PlaneGeometry(14,3.4),new THREE.MeshBasicMaterial({map:textTex('مدينة '+OWNER_NAME,1024,250,'#1d2b36','#ffd34d',120)}));ent.position.set(0,4.2,13.06);S.add(ent);
  const bc=new THREE.Mesh(new THREE.SphereGeometry(.9,12,8),new THREE.MeshBasicMaterial({color:'#ff2a2a'}));bc.position.set(0,TOWER_TOP+.6,0);S.add(bc);S.userData.beacon=bc;
  const ol=new THREE.Sprite(new THREE.SpriteMaterial({map:textTex('👑 '+OWNER_NAME,768,192,null,'#ffd34d',110),transparent:true,depthWrite:false}));ol.position.set(0,TOWER_TOP+9,0);ol.scale.set(32,8,1);ol.renderOrder=6;S.add(ol);S.userData.ownerLabel=ol;}
 // الظل يغطي المدينة القابلة للبناء فقط (الضواحي بلا ظلال)
 CITY_EXT=ext;CITY_SH=Math.min(ext/2+20,400);if(!WK.on)setShadow(CITY_SH);
 ctl.maxDistance=Math.max(520,ext*1.3);
 COUNT=HOUSES.length;updCount();
 chunkSync(true);
}
function textTex(txt,w,h,bg,fg,size){const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');if(bg){x.fillStyle=bg;x.beginPath();x.roundRect(0,0,w,h,h*.3);x.fill();}
 x.font=`900 ${size}px Cairo, sans-serif`;{const mw=x.measureText(txt).width,lim=w*.9;if(mw>lim){size=Math.max(10,Math.floor(size*lim/mw));x.font=`900 ${size}px Cairo, sans-serif`;}}x.textAlign='center';x.textBaseline='middle';x.direction='rtl';if(!bg){x.lineWidth=size*.22;x.strokeStyle='#14100c';x.lineJoin='round';x.strokeText(txt,w/2,h/2+size*.06);}x.fillStyle=fg;x.fillText(txt,w/2,h/2+size*.06);
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.generateMipmaps=false;t.minFilter=THREE.LinearFilter;return t;}

// ================= أسماء فوق أقرب البيوت =================
const LABELS=[];const LN=LOW?80:160;const FR=new THREE.Frustum(),PM=new THREE.Matrix4(),TV=new THREE.Vector3();
for(let i=0;i<LN;i++){const sp=new THREE.Sprite(new THREE.SpriteMaterial({transparent:true,depthWrite:false}));sp.visible=false;sp.renderOrder=5;S.add(sp);LABELS.push({sp,id:null});}
const texCache=new Map();
// اسم فوق راس اللاعب/البيت؛ لو محظور يكتب بعده «محظور» بالأحمر (العربي يُقرأ من اليمين: الاسم يمين، «محظور» يساره)
function nameTex(name,color,blocked){if(!blocked)return textTex(name,512,128,null,color,76);
 const size=76,c=document.createElement('canvas');c.width=512;c.height=128;const x=c.getContext('2d');x.font=`900 ${size}px Cairo, sans-serif`;
 const tag='محظور',w1=x.measureText(name).width,w2=x.measureText(tag).width,gap=22,total=w1+gap+w2,sc=Math.min(1,490/total),xr=total/2;
 x.textBaseline='middle';x.direction='rtl';x.lineJoin='round';x.lineWidth=size*.22;x.strokeStyle='#14100c';x.save();x.translate(256,64+size*.06);x.scale(sc,sc);
 x.textAlign='right';x.strokeText(name,xr,0);x.fillStyle=color;x.fillText(name,xr,0);
 x.textAlign='left';x.strokeText(tag,-xr,0);x.fillStyle='#ff3b30';x.fillText(tag,-xr,0);x.restore();
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.generateMipmaps=false;t.minFilter=THREE.LinearFilter;return t;}
function labelTex(h){let t=texCache.get(h.id);if(!t){t=nameTex(withTag(h.name,h.ch>=11&&h.ch<=15?8+(h.ch-11):(h.st||ZST)[2]),h.id===MYID?'#ffd34d':'#ffffff',h.id!==MYID&&BLOCKED.has(h.id));texCache.set(h.id,t);if(texCache.size>400){const k=texCache.keys().next().value;texCache.get(k).dispose();texCache.delete(k);}}return t;}
function dropLabel(id){const t=texCache.get(id);if(t){t.dispose();texCache.delete(id);}LABELS.forEach(L=>{if(L.id===id)L.id=null;});}
function updLabels(){cam.updateMatrixWorld();PM.multiplyMatrices(cam.projectionMatrix,cam.matrixWorldInverse);FR.setFromProjectionMatrix(PM);const cp=cam.position;
 const list=[];for(const h of HOUSES){const[x,z]=houseXZ(h.plot);TV.set(x,(TOPS.get(h.id)||6),z);if(!FR.containsPoint(TV))continue;list.push({h,x,z,d:TV.distanceToSquared(cp)});}list.sort((a,b)=>a.d-b.d);list.length=Math.min(list.length,LN);
 let made=0;LABELS.forEach((L,i)=>{const it=list[i];if(!it){L.sp.visible=false;return;}if(L.id!==it.h.id){if(!texCache.has(it.h.id)&&made++>=3){L.sp.visible=false;L.id=null;return;}/* بحد أقصى 3 صور أسماء جديدة بالمرة: ما نسوّي حشرة وقت المشي بالشارع */L.sp.material.map=labelTex(it.h);L.sp.material.needsUpdate=true;L.id=it.h.id;}
  // حجم الاسم: نص الحجم القديم (كان 7.5×1.9)
  const ds=Math.max(1,Math.sqrt(it.d)/55);L.sp.position.set(it.x,(TOPS.get(it.h.id)||6)+1.2*ds,it.z);L.sp.scale.set(3.6*ds,.9*ds,1);L.sp.visible=true;});}

// ================= الشبكة =================
const post=(u,b)=>fetch(u,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});
/* طلب بمهلة: النت الضعيف (متصفح تيك توك) كان يعلّق التحميل = شاشة بيضاء */
/* المهلة بس لين يرد السيرفر (الترويسات) — تحميل البيانات نفسه ما ينقطع أبداً حتى على النت البطيء */
const tfetch=(u,o={},ms=15000)=>{let ac=null;try{ac=new AbortController();}catch{}const tm=ac&&setTimeout(()=>{try{ac.abort();}catch{}},ms);return fetch(u,ac?{...o,signal:ac.signal}:o).finally(()=>clearTimeout(tm));};
let LOADRT=null,LOADN=0;
let ETAG='';
// يسأل السيرفر بـ If-None-Match: لو ما تغيّر شي يرجع 304 بدون بيانات
const unpackH=v=>({id:v[0],plot:v[1],type:v[2]|0,name:v[3],days:v[4]||1,likes:v[5]||0,ch:v[6]||0,st:v[7]||[0,0,0,0,0],dx:v[8]||[],pk:v[9]||[]});/* صيغة /api/h المضغوطة (3× أصغر) */
async function load(){try{const r=await tfetch('/api/h',{cache:'no-store',headers:ETAG?{'If-None-Match':ETAG}:{}},15000+LOADN*15000);
 if(r.status===304)return;if(!r.ok)throw new Error(r.status);ETAG=r.headers.get('ETag')||'';const d=await r.json();d.houses=(d.h||[]).map(unpackH);
 const sig=x=>x.map(h=>h.id+h.type+(h.st||ZST).join('')+(h.dx||[]).join('')).join('');if(d.count!==HOUSES.length||!HOUSES.length||sig(d.houses)!==sig(HOUSES)){HOUSES=d.houses;BYPLOT=new Map(HOUSES.map(h=>[h.plot,h]));texCache.forEach(t=>t.dispose());texCache.clear();LABELS.forEach(L=>L.id=null);buildCity();updLabels();}else{const m=new Map(d.houses.map(h=>[h.id,h]));HOUSES.forEach(h=>{const n=m.get(h.id);if(n){h.likes=n.likes;h.days=n.days;h.ch=n.ch;}});}}catch(e){if(!HOUSES.length){if(!LOADN)buildCity();LOADN++;clearTimeout(LOADRT);LOADRT=setTimeout(()=>load().catch(()=>{}),3000);}}}
let LIKED=new Set(),NEXT=null,UPG=false,PROGTXT='';
let VIPH=[];const VIP={pass:false,mine:[],sel:null};
let ECO=null,LB=null,ECOCAR=false;const IN={on:false,h:null,own:false,group:null,boxes:[],bed:null,x:0,z:0,hw:8,hd:7,H:5,out:null},KNOCKS=[];const SEC=[[120,60],[120,-70],[96,-150],[110,95],[-200,140],[0,-140],[90,150],[-300,-140],[60,-106],[0,18,1]],SECM=[],SECPEND=new Set(),SECHINT=new Map();// الثالث=1 يعني إحداثيات مطلقة (البرج)
function adoptMine(house){const old=MYID;MYID=house.id;if(old&&old!==MYID)dropLabel(old);dropLabel(MYID);
 const i=HOUSES.findIndex(h=>h.id===MYID);if(i>=0&&HOUSES[i].type!==house.type){HOUSES[i]=house;BYPLOT.set(house.plot,house);buildCity();}else if(i>=0)HOUSES[i]=house;}
async function mine(){try{const d=await(await tfetch('/api/mine',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({device:dev})},10000)).json();LIKED=new Set(d.liked||[]);
 if(d.house){NEXT=d.next;HASPIN=!!d.hasPin;adoptMine(d.house);UPG=d.upgraded;UNL=new Set(d.unl||[]);DAYS=d.days||0;NRW=d.nrw||null;if(d.rw)NEWRW=d.rw;setMine();syncWalker();}}catch{}}
function loseMine(){if(MYID)dropLabel(MYID);MYID=null;HASPIN=false;$('add').style.display='';$('find').style.display='';$('mine').style.display='none';$('share').style.display='none';PROGTXT='';updCount();}
function myHouse(){return HOUSES.find(h=>h.id===MYID);}
function setMine(){$('add').style.display='none';$('find').style.display='none';$('wBuild').style.display='none';$('wFind').style.display='none';$('mine').style.display='';$('share').style.display='';
 const h=myHouse();if(!h)return;
 PROGTXT=NEXT&&h.type<TYPE_NAMES.length-1?`${TYPE_NAMES[h.type]} • باقي ${NEXT-(h.days||1)} ${NEXT-(h.days||1)===1?'يوم':'أيام'} لـ${TYPE_NAMES[h.type+1]}`:`${TYPE_NAMES[h.type]} 🏰 وصلت أعلى مستوى`;updCount();}

// ================= واجهة الإضافة =================
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let selType=0,MODE='view',pick=null,marker=null;

const show=(id,on)=>$(id).style.display=on?'block':'none';
// ⚠️ تأكيد قبل أي إجراء يأثر على لاعب: sure('حظر {n} من الكتابة ساعة', اسمه, سطر توضيح) → Promise<true|false>
const SURE=document.createElement('div');SURE.id='sureBox';SURE.style.cssText='position:fixed;inset:0;z-index:60;display:none;align-items:center;justify-content:center;background:rgba(10,16,24,.55);padding:16px';document.body.appendChild(SURE);let SUREcb=null;
function sure(act,name,extra,ok){return new Promise(res=>{if(SUREcb)SUREcb(false);SUREcb=res;const nm=String(name||'').replace(/^📡 /,'').split(' • ')[0].replace(/^[🟢⚪👑🏰]\s*/u,'').trim();
 const q=esc(act).split('{n}').join(nm?`<b style="color:#e02424">«${esc(nm)}»</b>`:'هذا الشخص');
 SURE.innerHTML=`<div style="background:#fff;border-radius:20px;padding:18px 16px 14px;max-width:360px;width:100%;text-align:center;box-shadow:0 10px 40px rgba(0,0,0,.4)"><div style="font-size:40px;line-height:1">⚠️</div><div style="font-size:17px;font-weight:800;margin:8px 0 4px;line-height:1.7">هل أنت متأكد من ${q}؟</div>${extra?`<div style="font-size:13px;color:#66717d;margin:0 0 4px">${esc(extra)}</div>`:''}<div style="display:flex;gap:8px;margin-top:12px"><button data-sy="1" style="flex:1;padding:11px;background:#e02424;color:#fff;border:0;border-radius:14px;font-weight:900;font-size:15px">${esc(ok||'نعم، متأكد')}</button><button data-sy="0" style="flex:1;padding:11px;border-radius:14px;font-weight:800;font-size:15px">إلغاء</button></div></div>`;SURE.style.display='flex';});}
SURE.onclick=e=>{const b=e.target.closest('[data-sy]');if(!b&&e.target!==SURE)return;const v=!!b&&b.dataset.sy==='1';SURE.style.display='none';const f=SUREcb;SUREcb=null;if(f)f(v);};
window.sure=sure;
const bar=on=>$('bar').style.display=on&&!WK.on?'flex':'none';// وقت المشي الشريط مخفي
let TIPT=0;const TIPS=[];
function toast(t){const e=$('toast');e.textContent=t;e.style.opacity=1;clearTimeout(e._t);e._t=setTimeout(()=>e.style.opacity=0,Math.min(6000,1900+String(t).length*45));TIPT=Date.now();}
// 💡 نصائح غير مستعجلة: تنتظر لين تبدأ تلعب (8ث)، وحدة كل 9ث، وما تطلع فوق لوحة مفتوحة ولا داخل عالم البناء
function tip(t){if(!TIPS.includes(t))TIPS.push(t);}window.tip=tip;
setInterval(()=>{if(!TIPS.length||!WK.on||WK.intro||document.body.classList.contains('vox')||Date.now()-TIPT<9000||Date.now()-(WK.t0||Date.now())<8000)return;if([...document.querySelectorAll('.panel')].some(p=>p.style.display==='block'))return;toast(TIPS.shift());},1000);
let selCh=0;
$('add').onclick=()=>{ctl.autoRotate=false;show('p1',1);if($('have1'))$('have1').style.display=MYID?'none':'';bar(0);try{$('name').value=localStorage.getItem('mnalsifr_name')||'';}catch{};selCh=myCh;renderChars($('chars1'),selCh,c=>selCh=c);};
let AUTOB=false;
$('cancel1').onclick=()=>{show('p1',0);bar(1);if(AUTOB){AUTOB=false;enterWalk(true,'plaza');}};
if($('have1'))$('have1').onclick=()=>{AUTOB=false;show('p1',0);openFind();};
$('next').onclick=()=>{const n=$('name').value.trim();if(n.length<2){$('msg1').textContent='اكتب اسمك (حرفين على الأقل)';return;}
 if(!G.linked&&$('pin').value.trim().length<4){$('msg1').textContent='اختر رمز سري لبيتك (4 خانات أو أكثر)';return;}$('msg1').textContent='';try{localStorage.setItem('mnalsifr_name',n)}catch{};
 show('p1',0);show('p2',1);MODE='pick';$('freeN').textContent='⏳ ندوّر لك أرض فاضية…';
 // نحدّث البيوت أول (اللي بنوا بعد ما فتحت الصفحة) عشان ما نوديك لأرض أحد أخذها
 load().catch(()=>{}).finally(()=>{if(MODE!=='pick')return;showFree(true);FREEL=freeList();gotoFree(0);});};
$('cancel2').onclick=()=>{show('p2',0);show('p1',1);MODE='view';showFree(false);clearMarker();};
$('confirm').onclick=async()=>{if(pick===null)return;$('confirm').disabled=true;$('msg2').textContent='';
 try{const r=await post('/api/house',{name:$('name').value.trim(),pin:G.linked?'':$('pin').value.trim(),plot:pick,device:dev,ch:selCh,ref:REF});const d=await r.json();
  if(!r.ok){$('msg2').textContent=d.error||'صار خطأ';$('confirm').disabled=false;if(r.status===409)await load();showFree(true);FREEL=freeList();gotoFree(Math.min(FREEI,FREEL.length-1));return;}
  MYID=d.house.id;HASPIN=true;NEXT=2;$('pin').value='';HOUSES.push(d.house);BYPLOT.set(d.house.plot,d.house);buildCity();updLabels();show('p2',0);bar(1);setMine();MODE='view';showFree(false);clearMarker();
  myCh=selCh;try{localStorage.setItem('mnalsifr_ch',String(selCh));}catch{}netHi();// الناس يشوفون اسم بيتي
  const[x,z]=plotPos(d.house.plot);celebrate(x,z);toast('مبروك! بيتك صار في المدينة 🎉 لا تنسى رمزك');
  enterWalk(true,'plaza');// أول ما يبني: ينزل فوراً بالساحة ويتمشى (بدون وضع الطيران)
 }catch{$('msg2').textContent='تعذّر الاتصال، جرّب مرة ثانية';$('confirm').disabled=false;}};
$('mine').onclick=()=>{const h=HOUSES.find(h=>h.id===MYID);if(!h)return;const[x,z]=plotPos(h.plot);flyTo(x,z,60);ctl.autoRotate=false;};

// ================= الرمز السري: «هذا بيتي» + التحكم ببيتي =================
let CLAIM=null;   // البيت اللي يحاول يسترجعه
let FROM_FIND=false;
function openClaim(h,ff){CLAIM=h;FROM_FIND=!!ff;$('p4t').textContent=`🔑 بيت «${h.name}» بيتك؟`;$('pin4').value='';$('msg4').textContent='';show('card',0);show('p4',1);bar(0);$('pin4').focus();}
$('cancel4').onclick=()=>{show('p4',0);if(FROM_FIND)openFind();else bar(1);};
$('claim').onclick=async()=>{const pin=$('pin4').value.trim();if(pin.length<4){$('msg4').textContent='اكتب رمز بيتك';return;}
 $('claim').disabled=true;$('msg4').textContent='';
 try{const r=await post('/api/claim',{id:CLAIM.id,pin,device:dev});const d=await r.json();
  if(!r.ok){$('msg4').textContent=d.error||'صار خطأ';}
  else{show('p4',0);bar(1);await load();await mine();updLabels();netHi();
   const h=myHouse();if(h){const[x,z]=plotPos(h.plot);flyTo(x,z,60);celebrate(x,z);}toast('رجع لك بيتك 🎉');FROM_FIND=false;try{localStorage.setItem('mnalsifr_welcomed','1');}catch{}
   $('wBuild').style.display='none';$('wFind').style.display='none';if(WK.on)placeAtSpawn('home');
   if(NEWRW){const rw=NEWRW;NEWRW=null;setTimeout(()=>toast('🎁 جائزة اليوم: '+rewardName(rw)+' — البسها من 👕'),3200);}}
 }catch{$('msg4').textContent='تعذّر الاتصال، جرّب مرة ثانية';}
 $('claim').disabled=false;};

function openManage(){const h=myHouse();if(!h)return;show('card',0);bar(0);$('msg5').textContent='';$('pin5').value='';$('pinNew').value='';
 $('setPinBox').style.display=HASPIN||G.linked?'none':'block';$('manageBox').style.display=HASPIN||G.linked?'block':'none';$('pin5').style.display=$('pin5L').style.display=G.linked?'none':'';$('newName').value=h.name;show('p5',1);}
$('cancel5').onclick=()=>{show('p5',0);bar(1);};
$('savePin').onclick=async()=>{const pin=$('pinNew').value.trim();if(pin.length<4){$('msg5').textContent='الرمز 4 خانات أو أكثر';return;}
 try{const r=await post('/api/pin',{device:dev,pin});const d=await r.json();if(!r.ok){$('msg5').textContent=d.error||'صار خطأ';return;}
  HASPIN=true;toast('انحفظ رمز بيتك 🔑');openManage();}catch{$('msg5').textContent='تعذّر الاتصال';}};
async function manage(action,extra){const pin=$('pin5').value.trim();if(!G.linked&&pin.length<4){$('msg5').textContent='اكتب رمز بيتك';return null;}
 try{const r=await post('/api/manage',{id:MYID,pin:G.linked?'':pin,device:dev,action,...extra});const d=await r.json();if(!r.ok){$('msg5').textContent=d.error||'صار خطأ';return null;}return d;}catch{$('msg5').textContent='تعذّر الاتصال';return null;}}
$('rename').onclick=async()=>{const n=$('newName').value.trim();if(n.length<2){$('msg5').textContent='اكتب الاسم الجديد';return;}
 const d=await manage('rename',{name:n});if(!d)return;dropLabel(MYID);const h=myHouse();if(h)h.name=d.house.name;try{localStorage.setItem('mnalsifr_name',d.house.name)}catch{};updLabels();show('p5',0);bar(1);toast('تغيّر اسم بيتك ✅');netHi();};
$('del').onclick=async()=>{if(!await sure('حذف بيتك نهائياً','','ما ينرجع أبداً','نعم، احذفه'))return;const d=await manage('delete');if(!d)return;
 const id=MYID;loseMine();HOUSES=HOUSES.filter(h=>h.id!==id);BYPLOT=new Map(HOUSES.map(h=>[h.plot,h]));buildCity();updLabels();show('p5',0);bar(1);toast('انحذف بيتك');netHi();};

// ================= أول مرة من جهاز جديد: ترحيب + البحث عن بيتي بالاسم =================
const normAr=x=>String(x).toLowerCase().replace(/[ً-ٟـ]/g,'').replace(/[أإآٱ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/\s+/g,'');
function openFind(){['card','p1','p2','p3','p4','p5','p6','p9','p10'].forEach(id=>show(id,0));$('q11').value='';renderFind();show('p11',1);}
function renderFind(){const q=normAr($('q11').value),box=$('res11');
 if(!q){box.innerHTML='<div class="info" style="margin:6px 0">اكتب أول حروف اسم بيتك 👆</div>';return;}
 const list=HOUSES.filter(x=>normAr(x.name).includes(q)).sort((a,b)=>(normAr(b.name).startsWith(q)-normAr(a.name).startsWith(q))||((b.days||0)-(a.days||0))).slice(0,25);
 box.innerHTML=list.length?list.map(x=>`<div data-id="${esc(x.id)}"><span>${esc(withTag(x.name,(x.st||ZST)[2]))} <small style="color:#8a97a0">${TYPE_NAMES[x.type]} • ${x.days||1} ${(x.days||1)===1?'يوم':'أيام'}</small></span><b>🔑</b></div>`).join(''):'<div class="info" style="margin:6px 0">ما لقينا بيت بهذا الاسم 🤔 جرّب جزء ثاني من الاسم</div>';}
$('q11').addEventListener('input',renderFind);
$('res11').onclick=e=>{const d=e.target.closest('[data-id]');if(!d)return;const x=HOUSES.find(v=>v.id===d.dataset.id);if(!x)return;show('p11',0);openClaim(x,true);};
$('cancel11').onclick=()=>{show('p11',0);bar(1);};
$('find').onclick=()=>{ctl.autoRotate=false;openFind();};$('wFind').onclick=openFind;
const G={on:false,linked:false,em:''};
function paintG(){const w=$('wlG');if(w)w.style.display=G.on&&!G.linked?'':'none';const b=$('g16');if(!b)return;b.style.display=G.on?'block':'none';
 $('g16t').innerHTML=G.linked?'✅ <b>حسابك موثّق</b>'+(G.em?' بـ '+esc(G.em):'')+' — بيتك وتقدمك محفوظين وتقدر تدخل من أي جهاز.':'<b style="color:#d32f2f">⚠️ حسابك غير مربوط</b><br>اربطه بإيميل قوقل عشان ما يضيع بيتك وتقدمك، وتدخل من أي جوال. ما نشوف رمز قوقل ولا نحمّل شي منه.';
 const ws=$('wSet');if(ws)ws.classList.toggle('warn',G.on&&!G.linked);const wm=$('wMore');if(wm)wm.classList.toggle('warn',G.on&&!G.linked);
 $('g16b').style.display=G.linked?'none':'';}
async function gStatus(){try{const r=await fetch('/api/g/status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({device:dev})}),j=await r.json();G.on=!!j.on;G.linked=!!j.linked;G.em=j.em||'';}catch{}paintG();if(G.on&&!G.linked)gDaily();if(G.linked&&!G.syncd){G.syncd=true;gSyncInit();}}
function gDaily(){let d='';try{d=new Date(Date.now()+3*3600e3).toISOString().slice(0,10);if(localStorage.getItem('mnalsifr_gnote')===d)return;localStorage.setItem('mnalsifr_gnote',d);}catch{return;}setTimeout(()=>{if($('p10').style.display!=='block')toast('⚠️ حسابك غير مربوط بقوقل — ادخل ⚙️ الإعدادات وربطه عشان ما يضيع بيتك وتقدمك');},1200);}
async function gGo(){try{const r=await fetch('/api/g/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({device:dev})}),j=await r.json();if(j.url){location.href=j.url;return;}toast(j.error||'تعذّر الربط');}catch{toast('تعذّر الاتصال');}}
// ===== المحظورين + أفضل النتائج تنحفظ بحساب قوقل وتنتقل بين الأجهزة =====
const GSK=['snake','memory','whack','g2048'];let GSYT=0;
const gScores=()=>{const o={};for(const k of GSK){try{const v=parseInt(localStorage.getItem('mnalsifr_g_'+k));if(v>0)o[k]=v;}catch{}}return o;};
async function gSync(mode){if(!G.linked)return;try{const r=await fetch('/api/g/sync',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({device:dev,mode,bl:[...BLOCKED].slice(-300),gs:gScores()})});if(!r.ok)return;const j=await r.json();
  if(mode!=='set'&&Array.isArray(j.bl)){BLOCKED.clear();for(const x of j.bl)BLOCKED.add(x);saveBlocked(true);}
  for(const k of GSK)if(j.gs&&j.gs[k]){try{localStorage.setItem('mnalsifr_g_'+k,String(j.gs[k]));}catch{}}
  try{localStorage.setItem('mnalsifr_gsynced','1');}catch{}}catch{}}
function gSyncSoon(){if(!G.linked)return;clearTimeout(GSYT);GSYT=setTimeout(()=>gSync('set'),2500);}
window.addEventListener('mnalsifr-score',gSyncSoon);
function gSyncInit(){let had=false;try{had=!!localStorage.getItem('mnalsifr_gsynced');}catch{}gSync(had?'adopt':'union');}
$('wlG').onclick=gGo;$('g16b').onclick=gGo;
function openWelcome(){gStatus();try{localStorage.setItem('mnalsifr_welcomed','1');}catch{}if(!MYID&&$('p12').style.display!=='block')show('p10',1);}
$('wlHave').onclick=()=>{show('p10',0);openFind();};
$('wlNew').onclick=()=>{show('p10',0);if(WK.on)exitWalk();setTimeout(()=>$('add').click(),300);};
$('wlLook').onclick=()=>show('p10',0);

// ================= تبليغ عن لاعب =================
const REASONS=['كلام سيء','تحرش أو ملاحقة','يطلب أرقام أو حسابات','اسم غير لائق','إزعاج','غير ذلك'];
let REP=null;
function openReport(t){REP=t;$('p13t').textContent=`🚩 تبليغ عن «${t.name}»`;$('msg13').textContent='';$('reasons').innerHTML=REASONS.map((r,i)=>`<button type="button" data-r="${i}">${r}</button>`).join('');show('p7',0);show('card',0);show('p13',1);}
$('rep7').onclick=()=>{const p=PEERS.get(TALK);if(!p){toast('الشخص طلع من المكان');return;}openReport({peer:p.id,name:p.n,home:p.h});};
$('cancel13').onclick=()=>show('p13',0);
$('reasons').onclick=async e=>{const b=e.target.closest('[data-r]');if(!b||!REP)return;b.disabled=true;
 try{const r=await post('/api/report',{device:dev,reason:+b.dataset.r,...(REP.peer?{peer:REP.peer}:{house:REP.house})});const d=await r.json();
  if(!r.ok){$('msg13').textContent=d.error||'صار خطأ';b.disabled=false;return;}
  show('p13',0);setBlocked(REP.peer||null,REP.home||null,true);toast(d.dup?'بلّغت عنه من قبل — شكراً 🙏':'وصل بلاغك للمشرف 🙏 وحظرناه عنك');REP=null;
 }catch{$('msg13').textContent='تعذّر الاتصال';b.disabled=false;}};

// ================= لوحة المشرف: اضغط مطوّل على العدّاد فوق (أو افتح الموقع بـ ?admin) وادخل رمز المدير =================
let ADMIN=null;try{ADMIN=sessionStorage.getItem('mnalsifr_admin')||localStorage.getItem('mnalsifr_admin');}catch{}
const adm=(p,body)=>fetch('/api/admin/'+p,{method:body?'POST':'GET',headers:{'X-Admin':ADMIN||'','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
function adminForget(){const was=ADMIN_OK;ADMIN_OK=false;if(was){syncWalker();if(NET.ws)NET.ws.close();}ADMIN=null;try{sessionStorage.removeItem('mnalsifr_admin');localStorage.removeItem('mnalsifr_admin');}catch{}}
function adminView(inn){$('adminLogin').style.display=inn?'none':'block';$('adminMain').style.display=inn?'block':'none';$('adminOut').style.display=inn?'block':'none';if(!inn)setTimeout(()=>$('adminTok').focus(),50);}
function openAdmin(){['card','p1','p3','p4','p5','p6','p7','p8','p9','p10','p11','p13'].forEach(id=>show(id,0));ctl.autoRotate=false;$('msg12').textContent='';show('p12',1);if(ADMIN)adminRefresh();else adminView(false);}
async function adminRefresh(){try{const r=await adm('state');const d=await r.json();
 if(!r.ok){adminForget();$('msg12').textContent=d.error||'صار خطأ';adminView(false);return;}
 $('msg12').textContent='';adminView(true);renderAdmin(d);if(!ADMIN_OK){ADMIN_OK=true;netHi();syncWalker();toast('👑 أهلاً صاحب المدينة');}}catch{$('msg12').textContent='تعذّر الاتصال';}}
// 📊 تقرير اللعب اليومي (أرقام مجمّعة من السيرفر)
function statsHtml(S){if(!S||!S.length)return '<div class="lbl">📊 إحصاءات اللعب</div><div class="info">تبدأ الأرقام تتجمّع من الحين</div>';const t=S[0],n=x=>(+x||0).toLocaleString('ar'),dn=d=>{const k=Math.round((Date.parse(S[0].d)-Date.parse(d))/864e5);return k===0?'اليوم':k===1?'أمس':d.slice(5).replace('-','/');};
 const tile=(i,v,l)=>`<div style="flex:1 1 30%;background:#f3f6fa;border-radius:12px;padding:6px 4px;text-align:center"><div style="font-size:18px;font-weight:900">${i} ${v}</div><div style="font-size:11px;color:#66717d;font-weight:700">${l}</div></div>`;
 const zt=t.z.reduce((a,b)=>a+b[1],0)||1,zs=t.z.map(([z,m])=>`<div style="display:flex;align-items:center;gap:6px;font-size:12px;margin:2px 0"><span style="width:118px;flex:none">${esc(z)}</span><span style="flex:1;background:#eef1f5;border-radius:6px;height:10px"><i style="display:block;height:10px;border-radius:6px;background:#2c6fd1;width:${Math.max(3,Math.round(m/zt*100))}%"></i></span><b style="width:34px;text-align:left">${Math.round(m/zt*100)}%</b></div>`).join('');
 const hmax=Math.max(1,...t.h),hb=t.h.map((v,i)=>`<i title="${i}:00 — ${v}" style="flex:1;background:${v?'#22c55e':'#e6ebf1'};height:${Math.max(2,Math.round(v/hmax*34))}px;border-radius:2px"></i>`).join('');
 const th='style="padding:4px 5px;font-size:11px;color:#66717d;white-space:nowrap"',td='style="padding:4px 5px;text-align:center;white-space:nowrap"';
 const rows=S.map(x=>`<tr style="border-top:1px solid #eef1f5"><td ${td}><b>${dn(x.d)}</b></td><td ${td}>${n(x.u)}</td><td ${td}>${n(x.nw)}</td><td ${td}>${n(x.rb)}</td><td ${td}>${n(x.s)}</td><td ${td}>${x.avg}د</td><td ${td}>${n(x.s5)}</td><td ${td}>${n(x.s30)}</td><td ${td}>${n(x.pk)}</td><td ${td}>${n(x.nb)}</td></tr>`).join('');
 return `<div class="lbl">📊 إحصاءات اللعب — ${dn(t.d)} (أرقام فقط)</div><div style="display:flex;flex-wrap:wrap;gap:5px;margin:0 0 8px">${tile('👥',n(t.u),'دخلوا')}${tile('🆕',n(t.nw),'أول مرة')}${tile('🔁',n(t.rb),'رجعوا من أمس')}${tile('⏱️',t.avg+'د','متوسط الجلسة')}${tile('⌛',n(t.s30),'جلسات +30 دقيقة')}${tile('📈',n(t.pk),'أعلى متصلين')}${tile('🎉',n(t.evm|0),'دقائق حضور فعاليات')}</div>
 ${t.tut?`<div style="font-size:12px;font-weight:800;margin:4px 0">🎓 البداية السريعة اليوم (من ${n(t.nw)} جديد)</div><div style="display:flex;flex-wrap:wrap;gap:5px;margin:0 0 6px">${['🏠 بيت','⭕ لعبة','🚗 سيارة','💬 رسالة','🏁 كلها'].map((l,i)=>tile(l.split(' ')[0],n(t.tut[i]|0),l.split(' ')[1])).join('')}</div>`:''}
 ${zs?'<div style="font-size:12px;font-weight:800;margin:4px 0">📍 وين يقضون وقتهم</div>'+zs:''}<div style="font-size:12px;font-weight:800;margin:8px 0 3px">🕐 المتصلين بكل ساعة</div><div style="display:flex;align-items:flex-end;gap:2px;height:36px;direction:ltr">${hb}</div><div style="display:flex;justify-content:space-between;font-size:10px;color:#8a95a1;direction:ltr"><span>0</span><span>6</span><span>12</span><span>18</span><span>23</span></div>
 <div style="overflow-x:auto;margin:8px 0 6px"><table style="border-collapse:collapse;font-size:12.5px;width:100%"><tr><th ${th}>اليوم</th><th ${th}>دخلوا</th><th ${th}>جدد</th><th ${th}>رجعوا</th><th ${th}>جلسات</th><th ${th}>متوسط</th><th ${th}>+5د</th><th ${th}>+30د</th><th ${th}>ذروة</th><th ${th}>بيوت</th></tr>${rows}</table></div>`;}
function renderAdmin(d){const banBtn=(k,on)=>on?`<button data-a="unban" data-k="${esc(k)}">✅ فك المنع</button>`:`<button data-a="ban" data-k="${esc(k)}">🚫 منع كتابة</button>`;
 const reps0=d.reports.map(r=>`<div class="rep"><b>${esc(r.name)}</b>${r.home?' 🏠':''} <small>• ${r.count} بلاغ</small>${r.banned?' <small style="color:#ff3b30">• ممنوع</small>':''}
  <div class="rs">${Object.entries(r.reasons).map(([k,v])=>esc(REASONS[k]||'؟')+' ×'+v).join(' • ')}</div>
  ${r.log.length?`<div class="lg">${r.log.map(l=>'• '+esc(l.x)).join('<br>')}</div>`:''}
  <div class="ra">${banBtn(r.k,r.banned)}${r.home?`<button class="danger" data-a="delhouse" data-id="${esc(r.home)}">🗑️ حذف البيت</button>`:''}<button data-a="dismiss" data-k="${esc(r.k)}">☑️ تجاهل</button></div></div>`).join('')||'<div class="info">ما فيه بلاغات جديدة 🎉</div>';
 const on=d.online.map(o=>`<div class="rep"><b>${esc(o.name)}</b>${o.home?' 🏠':''} <small>• ${o.mins} د</small>${o.banned?' <small style="color:#ff3b30">• ممنوع</small>':''}<div class="ra">${banBtn(o.k,o.banned)}<button data-a="kick" data-id="${esc(o.id)}">⏏️ طرد</button></div></div>`).join('')||'<div class="info">ما فيه أحد متصل</div>';
 const bn=d.bans.map(b=>`<div class="rep"><b>${esc(b.name||b.k)}</b> <small>• ${b.auto?'🤖 الفلتر التلقائي':'مشرف'} • ${b.until?'باقي '+Math.ceil((b.until-Date.now())/60000)+' د':'دائم'}</small>${(b.ev||[]).length?`<div class="lg">${b.ev.map(evLine).join('')}</div>`:''}<div class="ra">${banBtn(b.k,true)}</div></div>`).join('')||'<div class="info">ما فيه ممنوعين</div>';
 $('adminMain').innerHTML=`<div class="lbl">📢 إعلان يشوفه كل اللاعبين</div><div class="row" style="align-items:center"><input id="annTxt" maxlength="160" placeholder="اكتب إعلانك…" style="flex:3"><button class="main" id="annGo" style="flex:1">📢 أرسل</button></div><label class="lbl" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="annPush" style="width:auto"> 📲 وكمان إشعار لجوالات اللي مو داخلين اللعبة</label><div class="stack" style="margin:4px 0"><button id="pushTest">🔔 إشعار تجربة لجوالي</button></div><div class="stack" style="margin:6px 0 10px"><button id="awTg">${awTxt()}</button></div><div class="info">🏠 ${d.houses} بيت • 📋 ${d.reports.length} بلاغ جديد • 👥 ${d.online.length} متصل</div><div class="stack" style="margin:6px 0"><button class="main" id="ccOpen">📨 مركز الشكاوي${CC.n?' ('+CC.n+')':''}</button></div>${statsHtml(d.stats)}<div class="lbl">👥 المتصلين الآن</div>${on}<div class="lbl">🚫 الممنوعين من الكتابة</div>${bn}<div class="stack"><button id="adminRef">🔄 تحديث</button></div>`;}
$('adminMain').onclick=async e=>{if(e.target.id==='adminRef'){adminRefresh();return;}if(e.target.id==='ccOpen'){show('p12',0);openCC();return;}
 if(e.target.id==='annGo'){const x=($('annTxt').value||'').trim();if(!x){toast('اكتب الإعلان أول');return;}if(!await sure('إرسال هذا الإعلان لكل اللاعبين','',x,'نعم، أرسله'))return;netSend({t:'ab',x,p:!!($('annPush')&&$('annPush').checked)});$('annTxt').value='';return;}
 if(e.target.id==='pushTest'){netSend({t:'pt'});return;}
 if(e.target.id==='awTg'){netSend({t:'aw',on:!AW});return;}const b=e.target.closest('[data-a]');if(!b)return;
 {const a=b.dataset.a,rn=((b.closest('.rep')||{}).querySelector?.('b')||{}).textContent||'';const Q={ban:['منع {n} من الكتابة للأبد','لين تفك المنع بنفسك'],kick:['طرد {n} من اللعبة','ينقطع اتصاله الحين'],delhouse:['حذف بيت {n} نهائياً','ما ينرجع أبداً']}[a];if(Q&&!await sure(Q[0],rn,Q[1]))return;}
 try{const r=await adm('act',{a:b.dataset.a,k:b.dataset.k,id:b.dataset.id});if(!r.ok){const d=await r.json();$('msg12').textContent=d.error||'صار خطأ';return;}
  if(b.dataset.a==='delhouse')load();adminRefresh();}catch{$('msg12').textContent='تعذّر الاتصال';}};
$('adminGo').onclick=()=>{const t=$('adminTok').value.trim();if(!t)return;ADMIN=t;$('adminTok').value='';try{sessionStorage.setItem('mnalsifr_admin',t);if($('adminRem').checked)localStorage.setItem('mnalsifr_admin',t);}catch{}adminRefresh();};
$('adminTok').addEventListener('keydown',e=>{if(e.key==='Enter')$('adminGo').click();});
$('adminOut').onclick=()=>{adminForget();adminView(false);$('msg12').textContent='تم تسجيل الخروج';};
$('cancel12').onclick=()=>{show('p12',0);bar(1);};
{let t0=null;const c=$('count'),clr=()=>{clearTimeout(t0);t0=null;};c.addEventListener('pointerdown',()=>{clr();t0=setTimeout(()=>{t0=null;openAdmin();},1500);});['pointerup','pointerleave','pointercancel'].forEach(n=>c.addEventListener(n,clr));}

// الأراضي الفاضية (تظهر بالأخضر وقت الاختيار)
let freeMesh=null;
// الأماكن المتاحة: نرتبها من الأقرب لوسط المدينة، ونطير الكاميرا لأول مكان، وأسهم ◀ ▶ تنقل لمكان ثاني
let FREEL=[],FREEI=0,freeBeam=null;
function freeList(){const cap=nBlocks(HOUSES.length)*4,fr=[];for(let p=0;p<cap;p++)if(!BYPLOT.has(p)){const[x,z]=plotPos(p);fr.push({p,x,z,d:Math.hypot(x,z)});}return fr.sort((a,b)=>a.d-b.d||a.p-b.p);}
function gotoFree(i){if(!FREEL.length){$('freeN').textContent='ما فيه أماكن متاحة';return;}FREEI=(i+FREEL.length)%FREEL.length;const f=FREEL[FREEI];setMarker(f.p);flyTo(f.x,f.z,75);
 $('freeN').textContent=`مكان ${FREEI+1} من ${FREEL.length}`;$('p2t').textContent=`بيت «${$('name').value.trim()}» هنا — تأكيد؟ (أو غيّر المكان بالأسهم أو اضغط أي أرض خضراء)`;}
$('nextFree').onclick=()=>gotoFree(FREEI+1);$('prevFree').onclick=()=>gotoFree(FREEI-1);
function showFree(on){if(freeBeam){S.remove(freeBeam);freeBeam.dispose();freeBeam=null;}if(freeMesh){S.remove(freeMesh);freeMesh.dispose();freeMesh=null;}if(!on)return;const cap=nBlocks(HOUSES.length)*4;const fr=[];for(let p=0;p<cap;p++)if(!BYPLOT.has(p))fr.push(p);
 freeMesh=new THREE.InstancedMesh(new THREE.BoxGeometry(14,.3,14),new THREE.MeshBasicMaterial({color:'#5fd16a',transparent:true,opacity:.75}),fr.length);fr.forEach((p,i)=>{const[x,z]=plotPos(p);dummy.position.set(x,.6,z);dummy.rotation.set(0,0,0);dummy.scale.set(1,1,1);dummy.updateMatrix();freeMesh.setMatrixAt(i,dummy.matrix);});S.add(freeMesh);
 if(fr.length<=400){freeBeam=new THREE.InstancedMesh(new THREE.BoxGeometry(1.4,45,1.4),new THREE.MeshBasicMaterial({color:'#5fd16a',transparent:true,opacity:.5,depthWrite:false}),fr.length);fr.forEach((p,i)=>{const[x,z]=plotPos(p);dummy.position.set(x,23,z);dummy.rotation.set(0,0,0);dummy.scale.set(1,1,1);dummy.updateMatrix();freeBeam.setMatrixAt(i,dummy.matrix);});S.add(freeBeam);}}
function clearMarker(){if(marker){S.remove(marker);marker=null;}pick=null;$('confirm').disabled=true;$('p2t').textContent='اضغط على أي أرض خضراء';}
function setMarker(p){clearMarker();pick=p;const P={box:[],cyl:[],pyr:[],cone:[],flat:[],win:[],leaf:[]};houseParts({id:'preview',plot:p,type:selType},P);
 marker=new THREE.Group();const mat=new THREE.MeshToonMaterial({color:'#ffd34d',gradientMap:grad,transparent:true,opacity:.75});
 for(const k in P)for(const it of P[k]){const g=k==='win'||k==='leaf'?GEO.flat:GEO[k];const m=new THREE.Mesh(g,mat);m.position.set(it[0],it[1],it[2]);m.scale.set(it[3],it[4],it[5]);m.rotation.y=it[6]||0;marker.add(m);}
 S.add(marker);$('confirm').disabled=false;$('p2t').textContent=`بيت «${$('name').value.trim()}» هنا — تأكيد؟`;}

// الضغط على الأرض
const ray=new THREE.Raycaster(),ndc=new THREE.Vector2(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),0),hit=new THREE.Vector3();
// نقر شبحي: لمسة سريعة على شخص تفتح لوحة تحت إصبعك، وبعدها المتصفح يرسل «click» متأخر ينزل على زر من اللوحة (رسالة جاهزة تنرسل لحالها). نمنع أي click لمدة قصيرة بعد فتح اللوحة من الشاشة.
let TAPGUARD=0;document.addEventListener('click',e=>{if(performance.now()-TAPGUARD<650){e.stopPropagation();e.preventDefault();}},true);window.__tapguard=()=>{TAPGUARD=performance.now();};
let down=null;R.domElement.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY,t:performance.now()};ctl.autoRotate=false;});
R.domElement.addEventListener('pointerup',e=>{if(!down)return;const moved=Math.hypot(e.clientX-down.x,e.clientY-down.y);down=null;if(moved>8)return;
 if(MODE==='view'){const pk=pickPeer(e.clientX,e.clientY);if(pk){TAPGUARD=performance.now();if(pk.hitBub&&HIST.has(pk.id))openHist(pk.id);else openTalk(pk.id);return;}const bk=pickBot(e.clientX,e.clientY);if(bk){toast('🤖 هذا شخص آلي من الديكور، مو لاعب حقيقي');return;}}// ضغط على شخص
 ndc.set(e.clientX/innerWidth*2-1,-(e.clientY/innerHeight)*2+1);ray.setFromCamera(ndc,cam);
 if(MODE==='view'&&!IN.on){const hh=pickHouse();if(hh){TAPGUARD=performance.now();openCard(hh);return;}}
 if(!ray.ray.intersectPlane(plane,hit))return;
 const p=plotAt(hit.x,hit.z);
 if(MODE==='view'&&Math.abs(hit.x)<14&&Math.abs(hit.z)<14){TAPGUARD=performance.now();openOwner();return;}
 if(MODE==='pick'){if(p===null||p>=nBlocks(HOUSES.length)*4){toast('اختر أرض خضراء');return;}if(BYPLOT.has(p)){toast('هذي الأرض محجوزة');return;}setMarker(p);{const j=FREEL.findIndex(f=>f.p===p);if(j>=0){FREEI=j;$('freeN').textContent=`مكان ${j+1} من ${FREEL.length}`;}}return;}
 const h=p!==null&&BYPLOT.get(p);if(h)openCard(h);else show('card',0);});
const HBOX=new THREE.Box3(),HV=new THREE.Vector3();
function pickHouse(){const o=ray.ray.origin;let best=null,bd=260;for(const q of HOUSES){const[x,z]=houseXZ(q.plot);if(Math.abs(x-o.x)>bd+12||Math.abs(z-o.z)>bd+12)continue;HBOX.min.set(x-8.5,0,z-8.5);HBOX.max.set(x+8.5,Math.max(4,TOPS.get(q.id)||6),z+8.5);if(!HBOX.containsPoint(o)&&ray.ray.intersectBox(HBOX,HV)){const d=HV.distanceTo(o);if(d<bd){bd=d;best=q;}}}return best;}
window.__pickHouse=(cx,cy)=>{ndc.set(cx/innerWidth*2-1,-(cy/innerHeight)*2+1);ray.setFromCamera(ndc,cam);const q=pickHouse();return q&&q.id;};
function openOwner(){$('cName').textContent='👑 برج '+OWNER_NAME;$('cInfo').textContent='صاحب المدينة • أطول برج فيها';const a=$('cActs');a.innerHTML='';
 if(CHANNEL_URL){const l=document.createElement('a');l.href=CHANNEL_URL;l.target='_blank';l.rel='noopener';l.innerHTML='<button class="main" style="padding:7px 16px;font-size:15px">▶️ تابع القناة</button>';a.appendChild(l);}show('card',1);}
function openCard(h){$('cName').textContent=h.name;$('cInfo').textContent=`${TYPE_NAMES[h.type]} • ${h.days||1} ${(h.days||1)===1?'يوم':'أيام'} • ❤️ ${h.likes||0}`;
 const a=$('cActs');a.innerHTML='';
 if(h.id===MYID){const b=document.createElement('button');b.textContent='📤 رابط بيتي';b.onclick=shareMine;a.appendChild(b);
  const k=document.createElement('button');k.textContent='⚙️ تحكم';k.onclick=openManage;a.appendChild(k);}
 else{const b=document.createElement('button');b.className='heart'+(LIKED.has(h.id)?' on':'');b.textContent=LIKED.has(h.id)?'❤️ عجبني':'🤍 لايك';b.onclick=()=>like(h,b);a.appendChild(b);
  if(!MYID){const k=document.createElement('button');k.textContent='🔑 بيتي';k.title='هذا بيتك؟ استرجعه برمزك';k.onclick=()=>openClaim(h);a.appendChild(k);}
  {const k=document.createElement('button');const was=BLOCKED.has(h.id);k.textContent=was?'✅ فك الحظر':'🚫 حظر';k.onclick=()=>{setBlocked(null,h.id,!was);toast(was?`✅ فكّينا الحظر عن «${h.name}»`:`🚫 حظرت «${h.name}» — ما توصلك رسايله`);openCard(h);};a.appendChild(k);}
  {const k=document.createElement('button');k.textContent='🚩 تبليغ';k.onclick=()=>openReport({house:h.id,name:h.name,home:h.id});a.appendChild(k);}}
 show('card',1);}
$('cX').onclick=()=>show('card',0);
async function like(h,b){b.disabled=true;try{const r=await post('/api/like',{id:h.id,device:dev});const d=await r.json();
 if(!r.ok){toast(d.error||'صار خطأ');}else{h.likes=d.likes;if(d.liked){LIKED.add(h.id);const[x,z]=plotPos(h.plot);hearts(x,(TOPS.get(h.id)||6),z);}else LIKED.delete(h.id);openCard(h);}}catch{toast('تعذّر الاتصال');}b.disabled=false;}
async function shareMine(){const h=myHouse();if(!h)return;const url=location.origin+'/?h='+h.id;const text=`شوف بيتي «${h.name}» في مدينة من الصفر 🏠 وحط بيتك جنبي!`;
 try{if(navigator.share){await navigator.share({title:'مدينة من الصفر',text,url});return;}}catch(e){if(e&&e.name==='AbortError')return;}
 try{await navigator.clipboard.writeText(text+' '+url);toast('انسخ الرابط ✅ أرسله لأصحابك');}catch{toast(url);}}
$('share').onclick=shareMine;
$('top').onclick=()=>{const list=[...HOUSES].sort((a,b)=>(b.likes||0)-(a.likes||0)).slice(0,15);
 $('lb').innerHTML=list.length?list.map((h,i)=>`<div data-id="${esc(h.id)}"><span>${i+1}. ${esc(h.name)} <small style="color:#8a97a0">${TYPE_NAMES[h.type]}</small></span><b>❤️ ${h.likes||0}</b></div>`).join(''):'<div>ما فيه بيوت للحين</div>';
 show('p3',1);bar(0);ctl.autoRotate=false;};
$('lb').onclick=e=>{const d=e.target.closest('[data-id]');if(!d)return;const h=HOUSES.find(x=>x.id===d.dataset.id);if(!h)return;show('p3',0);bar(1);const[x,z]=plotPos(h.plot);flyTo(x,z,60);openCard(h);};
$('cancel3').onclick=()=>{show('p3',0);bar(1);};

function plotAt(x,z){const bx=Math.round(x/STEP),bz=Math.round(z/STEP);const i=BLOCKIDX.get(bx+','+bz);if(!i)return null;const lx=x-bx*STEP,lz=z-bz*STEP;if(Math.abs(lx)>BLK/2||Math.abs(lz)>BLK/2)return null;return(i-1)*4+(lz>0?2:0)+(lx>0?1:0);}

// ================= المشي بالشخصية (منظور الشخص الثالث) =================
let CITY={nb:48,maxR:4,outR:10,lim:300},CITY_SH=200,CITY_EXT=600;
function setShadow(r){Object.assign(sun.shadow.camera,{left:-r,right:r,top:r,bottom:-r,near:1,far:1200});sun.shadow.camera.updateProjectionMatrix();}
// الأجسام الصلبة (ما يمشي من خلالها): صناديق [minX,maxX,minZ,maxZ,minY,maxY] في شبكة للبحث السريع
const SOL=[];let SGRID=new Map();const SC=16;
function addSolidBox(b){const i=SOL.push(b)-1;
 for(let gx=Math.floor(b[0]/SC);gx<=Math.floor(b[1]/SC);gx++)for(let gz=Math.floor(b[2]/SC);gz<=Math.floor(b[3]/SC);gz++){const key=gx*4096+gz;let a=SGRID.get(key);if(!a)SGRID.set(key,a=[]);a.push(i);}}
function nearSolids(x,z,cb){const gx=Math.floor(x/SC),gz=Math.floor(z/SC);for(let a=gx-1;a<=gx+1;a++)for(let b=gz-1;b<=gz+1;b++){const arr=SGRID.get(a*4096+b);if(arr)for(const i of arr)if(cb(SOL[i]))return true;}return false;}
const PR=.55;// نصف قطر الشخصية
function collide(p,y,R=PR){if(IN.on){inCollide(p,R,y);return;}for(let n=0;n<2;n++)nearSolids(p.x,p.z,b=>{if(b[5]<y+.35||b[4]>y+2)return;pushOutOfBox(p,b,R);});}
// السيارات الواقفة صلبة: كل سيارة = دائرتين (قدّام وورا)
// ⚙️ تجربة فيزياء Rapier: افتراضياً على نطاق beta، وبالحية بإضافة ?phys=rapier (وللمقارنة على beta: ?phys=legacy). لو فشل التحميل نكمل بالفيزياء العادية.
const USE_RAPIER=/beta/.test(location.hostname)?!/[?&]phys=legacy/.test(location.search):/[?&]phys=rapier/.test(location.search);
if(USE_RAPIER)Promise.all([import('/vendor/rapier.es.js?v=1'),import('/rapier-world.js?v=1')]).then(async([r,m])=>{
 const w=await m.createRapierWorld(r.default||r);const t0=performance.now();w.setSolids(SOL);RAPW=w;
 console.log('[rapier] ready',SOL.length,'solids',(performance.now()-t0).toFixed(1)+'ms');toast('⚙️ فيزياء Rapier (تجريبي)');}).catch(e=>console.error('[rapier] disabled',e));
function hitCars(p,R,skip){for(const c of PARKED){if(c===skip)continue;const fx=Math.sin(c.yaw),fz=Math.cos(c.yaw);
 for(const s of[1.5,-1.5]){const cx=c.x+fx*s,cz=c.z+fz*s,dx=p.x-cx,dz=p.z-cz,d=Math.hypot(dx,dz),m=R+1.3;if(d<m&&d>1e-6){p.x=cx+dx/d*m;p.z=cz+dz/d*m;}}}}
// الكاميرا ما تدخل جوا المباني: أول نقطة تصطدم على الخط من الراس للكاميرا (الأسوار والأشياء القصيرة تعدّيها من فوق)
function camHit(ax,ay,az,bx,by,bz){const N=16;for(let i=1;i<=N;i++){const t=i/N,x=ax+(bx-ax)*t,y=ay+(by-ay)*t,z=az+(bz-az)*t;
 if(nearSolids(x,z,b=>b[5]>3.4&&x>b[0]-.35&&x<b[1]+.35&&z>b[2]-.35&&z<b[3]+.35&&y>b[4]-.35&&y<b[5]+.35))return(i-1)/N;
 if(y<9.5)for(const o of CAMOCC)if(y<o[3]&&Math.abs(x-o[0])<o[2]+.3&&Math.abs(z-o[1])<o[2]+.3)return(i-1)/N;}return 1;}
function groundAt(x,z,y=0){if(IN.on&&Math.abs(x-IN.x)<IN.hw+3&&Math.abs(z-IN.z)<IN.hd+3)return WK.emote===6?IN.bed.y:(IN.gf?IN.gf(x,z,y):.3);const dg=D.ground(x,z,y);if(dg!==null)return dg;if(inPlaza(x,z))return .3;const bx=Math.round(x/STEP),bz=Math.round(z/STEP);if(Math.abs(x-bx*STEP)>BLK/2||Math.abs(z-bz*STEP)>BLK/2)return Math.max(Math.abs(x),Math.abs(z))<CITY.ext/2?.07:.04;
 if(Math.max(Math.abs(bx),Math.abs(bz))>CITY.outR)return 0;const i=BLOCKIDX.get(bx+','+bz);return i<=CITY.nb?.44:.35;}
const lerpAng=(a,b,k)=>{const d=((b-a+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI;return a+d*k;};
const DOORZ=[5.2,4.55,3.98,5.56,5.55];// مكان الباب (قدّام البيت) حسب نوعه
function doorOf(h){const[x,z]=houseXZ(h.plot);return[x,z+DOORZ[h.type]*KH*faceOf(h.plot)];}

const CM=charMaterials(grad);
let myCh=(()=>{try{const v=parseInt(localStorage.getItem('mnalsifr_ch'));return (v>=0&&v<CH_COUNT)||(v>=11&&v<=15)?v:0;}catch{return 0;}})();
let ADMIN_OK=false;const OWNER_ST=[7,5,7,0,0];
const playerCh=()=>{if(ADMIN_OK)return 10;const h=myHouse();return h?(h.ch|0):myCh;};
const pst=()=>{if(ADMIN_OK)return OWNER_ST;const h=myHouse();return h&&h.st?h.st:ZST;};
function syncWalker(){const w=WK.walker;if(!w)return;const st=pst(),c=JB.myCh(playerCh()),hat=MODF&&!ADMIN_OK?3:st[0];if(w.key!==c+':'+hat+':'+st[1])w.set(c,hat,st[1]);}
let UNL=new Set(),DAYS=0,NRW=null,NEWRW=null;
const CAMD=innerHeight>innerWidth?12.5:10.5,CAMP=.36,CAMLA=4.5;// CAMLA: كم متر قدّام الشخصية تطالع الكاميرا// بعد وارتفاع الكاميرا الافتراضي
const WK={jy:0,vy:0,jumpReq:false,on:false,p:new THREE.Vector3(),y:.4,yaw:0,camYaw:0,pitch:CAMP,dist:CAMD,cur:CAMD,phase:0,amt:0,lastDrag:-9,intro:null,walker:null,look:new THREE.Vector3(),edge:false};
const TOUCH=matchMedia('(pointer:coarse)').matches;
const WFOG=Math.min(340,OUTER*.6*STEP+90);
// 'home': قدّام باب بيته (الفيلا: برّا البوابة) ووجهه للبيت. 'plaza': عند بوابة الساحة ووجهه للنافورة
function spawnPoint(where,hh){const h=hh||myHouse();
 if(where==='home'&&h){const[x,z]=houseXZ(h.plot),f=faceOf(h.plot);return{x,z:z+f*(DOORZ[h.type]*KH+3.2),yaw:f>0?Math.PI:0,cam:f>0?0:Math.PI};}
 for(let k=0;k<40;k++){const m=PLAZA.h-14,x=PLAZA.x+(Math.random()*2-1)*m,z=PLAZA.z+(Math.random()*2-1)*m;let blk=false;
  for(const d of[[0,0],[1.4,0],[-1.4,0],[0,1.4],[0,-1.4]])if(nearSolids(x+d[0],z+d[1],b=>x+d[0]>=b[0]-.4&&x+d[0]<=b[1]+.4&&z+d[1]>=b[2]-.4&&z+d[1]<=b[3]+.4&&b[4]<1.6&&b[5]>.15)){blk=true;break;}
  if(blk||groundAt(x,z)>1.2||(D.lakeDist&&D.lakeDist(x,z)<4))continue;
  const yaw=Math.atan2(PLAZA.x-x,PLAZA.z-z);return{x,z,yaw,cam:yaw+Math.PI};}   // نطالع لوسط الساحة
 return{x:PLAZA.x+(Math.random()-.5)*14,z:PLAZA.z-PLAZA.h+16,yaw:0,cam:Math.PI};}
function placeAtSpawn(where='plaza',hh){if(JB.jailed()){const c=JB.cellPos();placeAt(c.x,c.z,0);return;}SW.on=false;D.swimHud(null);WK.emote=0;if(FAIR.on)FAIR.leave(null,true);if(RIDE)endRide();if(CAR.on)leaveCar();resetCars();const s=spawnPoint(where,hh);WK.p.set(s.x,0,s.z);WK.y=groundAt(s.x,s.z);WK.yaw=s.yaw;WK.camYaw=s.cam;WK.pitch=CAMP;WK.dist=CAMD;WK.cur=WK.dist;WK.where=where;WK.jy=0;WK.vy=0;}

// ================= السيارات =================
const PARKED=[];// السيارات بالموقف (محلية: كل لاعب عنده نسخته)
const CAR={on:false,car:null,speed:0,near:null};
const GLASS=new THREE.MeshBasicMaterial({color:'#bfe3f2',transparent:true,opacity:.26,depthWrite:false});// زجاج السيارة: يبان اللي جواها
function carMesh(i){const g=carGeo(i),grp=new THREE.Group(),m=new THREE.Mesh(g,CM.body),o=new THREE.Mesh(g,CM.line);m.castShadow=true;grp.add(m,o);const gl=new THREE.Mesh(carGlassGeo(i),GLASS);gl.renderOrder=2;grp.add(gl);grp.rotation.order='YXZ';return grp;}
function ensureCars(){if(!PARKED.length)for(let i=0;i<CAR_N;i++){const g=carMesh(i);S.add(g);PARKED.push({i,g,x:0,z:0,yaw:Math.PI,y:.3});}resetCars();}
function resetCars(){for(const c of PARKED){if(CAR.on&&CAR.car===c)continue;const[x,z]=carSlot(c.i);c.x=x;c.z=z;c.yaw=Math.PI;c.y=.3;c.vy=0;c.air=false;c.pitch=0;c.g.position.set(x,.3,z);c.g.rotation.set(0,c.yaw,0);}}
function enterCar(c){if(JB.noCar())return;if(!ECOCAR){ECOCAR=true;netSend({t:'ev',e:'car'});}WK.jy=0;WK.vy=0;CAR.on=true;CAR.car=c;CAR.speed=0;WK.walker.root.visible=true;WK.p.set(c.x,0,c.z);WK.yaw=c.yaw;WK.dist=14;WK.cur=14;WK.camYaw=c.yaw+Math.PI;WK.pitch=.3;updCarBtn();
 toast(TOUCH?'الدائرة: فوق بنزين • تحت فرامل ورجوع • يمين ويسار تلف':'W/↑ بنزين • S/↓ فرامل ورجوع • A/D تلف • Shift تيربو • E تنزل');}
function leaveCar(){const c=CAR.car;CAR.on=false;CAR.car=null;CAR.speed=0;if(!c)return;
 // ينزل من جنب السيارة (يسار السائق)
 const sx=Math.cos(c.yaw),sz=-Math.sin(c.yaw);WK.p.set(c.x+sx*2.6,0,c.z+sz*2.6);collide(WK.p,WK.y);hitCars(WK.p,PR,null);
 WK.walker.root.visible=WK.on;WK.walker.root.scale.setScalar(1);WK.yaw=c.yaw;WK.dist=CAMD;updCarBtn();}
function updCarBtn(){$('jumpBtn').style.display=WK.on&&!WK.intro&&!CAR.on&&!RIDE&&!FAIR.on?'block':'none';{const drv=WK.on&&!WK.intro&&CAR.on&&!RIDE,dd=drv?'flex':'none';if($('brakeBtn').style.display!==dd){$('brakeBtn').style.display=dd;$('gasBtn').style.display=dd;document.body.classList.toggle('drv',drv);}if(!drv){CAR.brake=false;CAR.gas=false;}const ro=$('raceOut'),rr=D.racing&&D.racing()?'block':'none';if(ro.style.display!==rr)ro.style.display=rr;}const b=$('carBtn');if(!WK.on||WK.intro){b.style.display='none';return;}
 if(RIDE){b.style.display='block';b.textContent='🚪 انزل من السيارة';return;}
 if(CAR.on){b.style.display='block';b.textContent='🚪 انزل';return;}
 let best=null,bd=4.6;const own=myCar().o;for(const c of PARKED){if(!own.includes(c.i))continue;const d=Math.hypot(c.x-WK.p.x,c.z-WK.p.z);if(d<bd){bd=d;best=c;}}CAR.near=best;
 let pb=null,pd=best?bd:7;for(const p of PEERS.values()){if(p.v<0||p.seat)continue;const d=Math.hypot(p.x-WK.p.x,p.z-WK.p.z);if(d<pd){pd=d;pb=p;}}CAR.nearPeer=pb;// سيارة فيها أحد جنبك: تركب معه بزر واحد
 const dsp=pb||best?'block':'none',txt=pb?`🚗 اركب مع ${pb.n}`:best?`🚗 اركب ${CARS[best.i].n} ${carStars(best.i)}`:'';if(b.style.display!==dsp)b.style.display=dsp;if(txt&&b.textContent!==txt)b.textContent=txt;}
const CAR_ST=[[13,34],[14,33],[17,36],[26,46],[15,35],[12,33],[18,38],[28,48]];// [تسارع، سرعة قصوى] لكل سيارة: الرياضية أسرع بكثير من الجيب والهايلكس
const CAR_PRICE=[250,150,0,600,120,300,80,700],CAR_FREE=2,CAR_EN_COST=[100,200,350,550];// لازم تطابق server.js
const myCar=()=>(ECO&&ECO.car)||{o:[CAR_FREE],s:CAR_FREE,en:0};
const carStars=i=>'⚡'.repeat(Math.max(1,Math.round((CAR_ST[i]||[15])[0]/6)));
function carFrame(dt,t,ix,iz,run){const W=WK,c=CAR.car,en=myCar().en|0,[ACC0,TOP0]=CAR_ST[c.i]||[15,32],ACC=ACC0*(1+.08*en),TOP=TOP0*(1+.06*en);/* 🔧 مستوى المحرك يزيد التسارع والسرعة */let sp=CAR.speed;
 if(D.raceLock()){ix=0;iz=0;sp=0;}// عدّ السباق: السيارة مقفولة
 // الدعّاسات تتدرّج مثل الدعسة الحقيقية: السرعة تكبر خلال ربع ثانية وترجع أسرع، والفرامل أسرع استجابة
 CAR.gasA=CAR.gas?Math.min(1,(CAR.gasA||0)+dt*4.5):Math.max(0,(CAR.gasA||0)-dt*7);CAR.brkA=(CAR.brake||KEY.Space||JB.stopNow())?Math.min(1,(CAR.brkA||0)+dt*9):Math.max(0,(CAR.brkA||0)-dt*12);
 if(CAR.gasA>.02&&!D.raceLock()){iz=Math.max(iz,CAR.gasA);if(CAR.gasA>.6)run=true;}// زر السرعة: دعسة تتدرّج + سرعة قصوى (اللف يبقى بالجويستيك/الأسهم)
 if(CAR.brkA>.02){iz=0;sp-=Math.sign(sp)*Math.min(Math.abs(sp),62*CAR.brkA*dt);}// زر الفرامل: يوقف السيارة بسرعة بدون ما يرجّعها لورا
 const surf=D.carSurf(c.x,c.z);CAR.boostT=Math.max(0,(CAR.boostT||0)-dt);
 if(surf===2&&CAR.boostT<.6){CAR.boostT=1.6;sp=Math.min(Math.max(sp,TOP*.7)+12,TOP*1.5);AU.boost();}// مسرّع
 const bst=CAR.boostT>0,MAX=TOP*(run?1.3:1)*(bst?1.4:1)*(surf===1?.6:1),A=ACC*(bst?2.2:1);
 if(iz>.05)sp+=(sp<-.5?45:A)*iz*dt;else if(iz<-.05)sp-=(sp>.5?45:12)*-iz*dt;else sp-=Math.sign(sp)*Math.min(Math.abs(sp),8*dt);
 sp=sp>MAX?sp+(MAX-sp)*Math.min(1,dt*(surf===1?3:2)):Math.max(-10,sp);
 // اللف: يعتمد على السرعة (واقفة ما تلف) وينعكس وهي ترجع لورا
 CAR.st=(CAR.st||0)+(ix-(CAR.st||0))*Math.min(1,dt*(Math.abs(ix)>=Math.abs(CAR.st||0)?10:15));// تنعيم اللف: يدخل بسرعة ويرجع للنص أسرع (إحساس أحسن)
 c.yaw+=-CAR.st*Math.min(1,Math.abs(sp)/4)*Math.sign(sp||1)*(1.9-Math.min(.8,Math.abs(sp)/MAX*.8))*dt;
 const fx=Math.sin(c.yaw),fz=Math.cos(c.yaw),nx=c.x+fx*sp*dt,nz=c.z+fz*sp*dt;
 const dxm=nx-c.x,dzm=nz-c.z,f={x:c.x+fx*1.6,z:c.z+fz*1.6},k={x:c.x-fx*1.6,z:c.z-fz*1.6};
 moveSwept(f,dxm,dzm,q=>collide(q,c.y,1.25));moveSwept(k,dxm,dzm,q=>collide(q,c.y,1.25));hitCars(f,1.25,c);hitCars(k,1.25,c);D.carBlock(f);D.carBlock(k);
 let cx=(f.x+k.x)/2,cz=(f.z+k.z)/2;if(Math.hypot(cx-nx,cz-nz)>.02){if(Math.abs(sp)>9&&t-(CAR.crT||0)>.35){CAR.crT=t;AU.crash(Math.abs(sp)/40);JB.crash(Math.abs(sp)/TOP);}sp*=.55;}// صدمة
 const L=CITY.lim;cx=Math.max(-L,Math.min(L,cx));cz=Math.max(-L,Math.min(L,cz));
 c.x=cx;c.z=cz;
 // رأسي: تلحق الأرض، ولو طلعت من سلّم القفز تطير (جاذبية)
 const g=groundAt(cx,cz,c.y);
 if(c.air){c.vy-=26*dt;c.y+=c.vy*dt;if(c.y<=g){const v=-c.vy;c.y=g;c.air=false;c.vy=0;c.vyg=0;if(v>3){AU.land();AU.crash(Math.min(.5,v/16));}}}
 else{const vg=Math.min(22,(g-c.y)/Math.max(dt,1e-3));
  if(g<c.y-.12&&(c.vyg||0)>1.5){c.air=true;c.vy=c.vyg;}
  else{c.vyg=vg>0?vg:0;c.y=g>c.y?g:c.y+(g-c.y)*Math.min(1,dt*12);}}
 CAR.speed=sp;const pt=-Math.atan2(c.air?c.vy:(c.vyg||0),Math.max(10,Math.abs(sp)))*.8;c.pitch=(c.pitch||0)+(pt-(c.pitch||0))*Math.min(1,dt*10);
 c.g.position.set(c.x,c.y,c.z);c.g.rotation.set(c.pitch,c.yaw,0);
 W.p.set(c.x,0,c.z);W.y=c.y;W.yaw=c.yaw;W.mv=0;
 if(t-W.lastDrag>1.2)W.camYaw=lerpAng(W.camYaw,c.yaw+Math.PI-(CAR.st||0)*.85*Math.min(1,Math.abs(sp)/12)*(sp<0?-1:1),Math.min(1,dt*4));// الكاميرا تميل شوي لجهة اللفة (تشوف الطريق)
 seatPlace(W.walker,c.i,0,c.x,c.y,c.z,c.yaw);
 AU.engine(true,Math.abs(sp)/(TOP*1.3),Math.max(0,iz),bst);}
function enterWalk(intro=true,where='plaza'){if(WK.on)return;['p1','p2','p3','p4','p5','card'].forEach(id=>show(id,0));MODE='view';showFree(false);clearMarker();
 if(!WK.walker){const st=pst();WK.walker=makeWalker(playerCh(),CM,st[0],st[1]);WK.walker.root.rotation.order='YXZ';S.add(WK.walker.root);}else{syncWalker();WK.walker.root.visible=true;}
 placeAtSpawn(where);WK.amt=0;WK.on=true;ctl.enabled=false;ctl.autoRotate=false;fly=null;
 WK.intro=intro?{t0:performance.now()+500,cp:cam.position.clone(),ct:ctl.target.clone()}:null;
 cam.near=.5;cam.far=1200;cam.fov=62;cam.updateProjectionMatrix();setShadow(LOW?40:60);
 WK.t0=Date.now();$('bar').style.display='none';$('whud').style.display='flex';$('wBuild').style.display=MYID?'none':'';$('wFind').style.display=MYID?'none':'';$('joy').style.display=TOUCH?'block':'none';updNPC();updLabels();
 setTimeout(()=>toast(TOUCH?'حرّك بالدائرة يسار • اسحب الشاشة تلف الكاميرا • ⬆️ قفز':'امشِ بالأسهم أو WASD • Shift للجري • Space قفز • اسحب بالماوس تلف'),intro?2600:200);}
function exitWalk(){if(!WK.on)return;if(VOXW.fp)VOXW.leave();if(IN.on)leaveHouse();GM.close(true);if(FAIR.on)FAIR.leave(null,true);if(RIDE)endRide();WK.emote=0;SW.on=false;D.swimHud(null);D.zoneHud('');if(CAR.on)leaveCar();resetCars();$('carBtn').style.display='none';$('jumpBtn').style.display='none';show('p9',0);WK.on=false;WK.intro=null;dropBubble(WK);WK.wave=0;WK.walker.root.visible=false;JOY.on=false;JOY.x=JOY.y=0;$('knob').style.transform='';for(const k in KEY)KEY[k]=false;
 cam.near=1;cam.far=2200;cam.fov=48;cam.updateProjectionMatrix();setShadow(CITY_SH);
 ctl.target.set(WK.p.x,0,WK.p.z);ctl.enabled=true;flyTo(WK.p.x,WK.p.z,110);
 $('whud').style.display='none';$('joy').style.display='none';show('p6',0);$('bar').style.display='flex';updNPC();}
function walkFrame(dt,t){const W=WK,wk=W.walker;
 if(VOXW.fp)VOXW.jumpIn=!!(KEY.Space||W.jumpReq);
 // قفز: سرعة رأسية + جاذبية (أقصى ارتفاع ~1.3 متر — يعدّي الكراسي والأحواض)
 if(CAR.on||W.intro||RIDE||FAIR.on||VOXW.fp){W.jy=0;W.vy=0;W.jumpReq=false;}
 else{if(SW.on){W.jumpReq=false;W.jy=0;W.vy=0;}else{if((KEY.Space||W.jumpReq)&&W.jy===0){W.vy=7.6;W.jy=.001;AU.jump();}W.jumpReq=false;
  if(W.jy>0){W.vy-=24*dt;W.jy+=W.vy*dt;if(W.jy<=0){W.jy=0;W.vy=0;AU.land();}}}}
 let ix=0,iz=0,run=KEY.ShiftLeft||KEY.ShiftRight;
 if(KEY.KeyW||KEY.ArrowUp)iz+=1;if(KEY.KeyS||KEY.ArrowDown)iz-=1;if(KEY.KeyD||KEY.ArrowRight)ix+=1;if(KEY.KeyA||KEY.ArrowLeft)ix-=1;
 if(JOY.on){ix=JOY.x;iz=JOY.y;run=Math.hypot(ix,iz)>.88;}if(JB.inj())run=false;// 🤕 المصاب ما يجري
 let m=Math.hypot(ix,iz);if(m>1){ix/=m;iz/=m;m=1;}if(W.intro)m=0;
 if(CAR.on)carFrame(dt,t,W.intro?0:ix,W.intro?0:iz,run);else if(RIDE)rideFrame(dt,t);else if(FAIR.on)fairRide();else if(VOXW.fp)VOXW.move(dt,ix,iz,run);else{// راكب سيارة: السيارة تتحرك بدل الشخصية
 const moving=m>.08,gh0=groundAt(W.p.x,W.p.z,W.y+W.jy),deep=D.built&&gh0<-1.3,wade=!deep&&gh0<D.WATER+.1&&!!D.lakeInfo(W.p.x,W.p.z);swimTick(dt,deep,moving);if(moving||W.jy>0||deep)W.emote=0;W.mv=moving?(deep?3:run?2:1):(W.emote||0);// يوصل للناس الثانيين (واقف/يمشي/يجري)
 if(moving){const fx=-Math.sin(W.camYaw),fz=-Math.cos(W.camYaw),rx=Math.cos(W.camYaw),rz=-Math.sin(W.camYaw);
  const mx=fx*iz+rx*ix,mz=fz*iz+rz*ix,ml=Math.hypot(mx,mz)||1,sp=(deep?(run?6.5:4.6):wade?(run?9.5:4.8):(run?16:8))*Math.min(1,m*1.3)*JB.spd();
  {const sdx=mx/ml*sp*dt,sdz=mz/ml*sp*dt;if(RAPW&&!IN.on)RAPW.move(W.p,W.y+W.jy,sdx,sdz);else moveSwept(W.p,sdx,sdz,q=>collide(q,W.y+W.jy));}W.yaw=lerpAng(W.yaw,Math.atan2(mx,mz),Math.min(1,dt*12));
  // الكاميرا تلحق ورا الشخصية بهدوء لما يمشي لقدّام (إلا لو المستخدم يلف الكاميرا بنفسه)
  if(t-W.lastDrag>1.2&&iz>.2)W.camYaw=lerpAng(W.camYaw,W.yaw+Math.PI,Math.min(1,dt*1.6*iz));}
 collide(W.p,W.y+W.jy);hitCars(W.p,PR,null);JB.clamp(W.p);
 const L=CITY.lim;if(!IN.on&&(Math.abs(W.p.x)>L||Math.abs(W.p.z)>L)){W.p.x=Math.max(-L,Math.min(L,W.p.x));W.p.z=Math.max(-L,Math.min(L,W.p.z));if(!W.edge){W.edge=true;toast('هنا آخر الضواحي 🙂 ارجع للمدينة');setTimeout(()=>W.edge=false,4000);}}
 W.y+=((deep?D.WATER-1.05:groundAt(W.p.x,W.p.z,W.y+W.jy))-W.y)*Math.min(1,dt*(deep?6:14));
 W.amt+=((moving?(run?1:.8):0)-W.amt)*Math.min(1,dt*8);if(moving)W.phase+=dt*(deep?6:run?13:9);else if(W.emote===4)W.phase+=dt*7;else W.phase*=Math.max(0,1-dt*6);const stp=Math.floor(W.phase/Math.PI);if(moving&&!deep&&W.jy===0&&stp!==W.lastSt)AU.step(run);W.lastSt=stp;
 wk.pose(W.phase,W.amt,t);actPose(wk,W.mv,W.phase,t);
  if(W.jy>0){wk.bob=0;wk.legL.rotation.x=.7;wk.legR.rotation.x=-.25;wk.armL.rotation.x=-2.3;wk.armR.rotation.x=-2.3;}// بالهواء: يرفع يديه ويثني رجوله
  wk.root.position.set(W.p.x,W.y+W.jy+wk.bob,W.p.z);wk.root.rotation.y=W.yaw;}
 if(t-(W.cbT||0)>.2){W.cbT=t;updCarBtn();}
 // الكاميرا ورا الشخصية
 const hx=W.p.x,hy=W.y+W.jy+1.75,hz=W.p.z,cp=Math.cos(W.pitch),dx=Math.sin(W.camYaw)*cp*W.dist,dy=Math.sin(W.pitch)*W.dist,dz=Math.cos(W.camYaw)*cp*W.dist;
 const want=Math.max(1.3,W.dist*camHit(hx,hy,hz,hx+dx,hy+dy,hz+dz));W.cur=want<W.cur?want:W.cur+(want-W.cur)*Math.min(1,dt*3);
 const s=W.cur/W.dist;TV.set(hx+dx*s,Math.max(hy+dy*s,W.y+.5),hz+dz*s);
 if(IN.on){const m=.8;TV.x=Math.max(IN.x-IN.hw+m,Math.min(IN.x+IN.hw-m,TV.x));TV.z=Math.max(IN.z-IN.hd+m,Math.min(IN.z+IN.hd-m,TV.z));TV.y=Math.max(.9,Math.min(IN.H-.4,TV.y));}
 if(W.intro){const k=Math.max(0,Math.min(1,(performance.now()-W.intro.t0)/2200)),e=k*k*(3-2*k);
  cam.position.lerpVectors(W.intro.cp,TV,e);W.look.lerpVectors(W.intro.ct,new THREE.Vector3(hx-Math.sin(W.camYaw)*CAMLA*s,hy+.7*s,hz-Math.cos(W.camYaw)*CAMLA*s),e);if(k>=1)W.intro=null;}
 else{cam.position.copy(TV);W.look.set(hx-Math.sin(W.camYaw)*CAMLA*s,hy+.7*s,hz-Math.cos(W.camYaw)*CAMLA*s);}// النظر فوق الراس شوي: الشخصية تنزل تحت ويبان الشارع قدّامها
 cam.lookAt(W.look);if(FAIR.on)FAIR.camera(cam);else if(VOXW.fp)VOXW.camera();// رؤية الشخص الأول على الألعاب وبعالم البناء
 sun.target.position.set(hx,0,hz);sun.position.set(hx-150,260,hz+110);
 const fk=W.intro?Math.max(0,Math.min(1,(performance.now()-W.intro.t0)/2200)):1;// الضباب ينزل مع الطيران
 const WF=CAR.on?440:WFOG,fq=Math.min(1,fk*(W.intro?1:dt*3));S.fog.near=S.fog.near+(WF*.3-S.fog.near)*fq;S.fog.far=S.fog.far+(WF-S.fog.far)*fq;}

// التحكم: لوحة المفاتيح + سحب الكاميرا + عصا اللمس
const KEY={};
addEventListener('keydown',e=>{if(!WK.on||window.__gameOpen||/INPUT|TEXTAREA/.test(document.activeElement?.tagName||''))return;KEY[e.code]=true;if(e.code==='Space'&&!e.repeat)WK.jumpReq=true;if(/^Arrow|^Space/.test(e.code))e.preventDefault();});
addEventListener('keyup',e=>{KEY[e.code]=false;});addEventListener('blur',()=>{for(const k in KEY)KEY[k]=false;});
let cdrag=null;
R.domElement.addEventListener('pointerdown',e=>{if(WK.on)cdrag={id:e.pointerId,x:e.clientX,y:e.clientY};});
addEventListener('pointermove',e=>{if(!WK.on||!cdrag||e.pointerId!==cdrag.id)return;const dx=e.clientX-cdrag.x,dy=e.clientY-cdrag.y;cdrag.x=e.clientX;cdrag.y=e.clientY;
 WK.camYaw-=dx*.006;WK.pitch=Math.max(.02,Math.min(1.25,WK.pitch+dy*.004));WK.lastDrag=clock.elapsedTime;});
const endDrag=e=>{if(cdrag&&e.pointerId===cdrag.id)cdrag=null;};addEventListener('pointerup',endDrag);addEventListener('pointercancel',endDrag);
R.domElement.addEventListener('wheel',e=>{if(!WK.on)return;e.preventDefault();WK.dist=Math.max(3.5,Math.min(26,WK.dist*(e.deltaY>0?1.1:.9)));},{passive:false});
const JOY={on:false,x:0,y:0,id:null};
{const joy=$('joy'),knob=$('knob');
 const mv=e=>{const r=joy.getBoundingClientRect(),h=r.width/2;let dx=(e.clientX-r.left-h)/h,dy=(e.clientY-r.top-h)/h;const l=Math.hypot(dx,dy);if(l>1){dx/=l;dy/=l;}JOY.x=dx;JOY.y=-dy;knob.style.transform=`translate(${dx*h*.55}px,${dy*h*.55}px)`;};
 joy.addEventListener('pointerdown',e=>{e.preventDefault();JOY.id=e.pointerId;try{joy.setPointerCapture(e.pointerId);}catch{}JOY.on=true;mv(e);});
 joy.addEventListener('pointermove',e=>{if(JOY.on&&e.pointerId===JOY.id)mv(e);});
 const end=e=>{if(e.pointerId!==JOY.id)return;JOY.on=false;JOY.id=null;JOY.x=JOY.y=0;knob.style.transform='';};
 joy.addEventListener('pointerup',end);joy.addEventListener('pointercancel',end);}
$('walk').onclick=()=>enterWalk(true,'plaza');// «تمشّى» يوديك الساحة
$('wExit').onclick=exitWalk;
$('wMore').onclick=()=>document.body.classList.toggle('whMore');
$('whud').addEventListener('click',e=>{const b=e.target.closest('.w2');if(b)setTimeout(()=>document.body.classList.remove('whMore'),0);});
// زر 🏠: يسألك وين تروح — الساحة أو بيتك
$('wHome').onclick=()=>{show('card',0);$('goHome').disabled=!MYID;$('goHome').textContent=MYID?'🏠 بيتي':'🏠 بيتي (ابنِ بيتك أول)';show('p9',1);};
$('goPlaza').onclick=()=>{show('p9',0);placeAtSpawn('plaza');toast('🏟️ وصلت الساحة');};
$('goHome').onclick=()=>{show('p9',0);if(MYID){placeAtSpawn('home');toast('🏠 وصلت بيتك');}};
$('cancel9').onclick=()=>show('p9',0);
// ===== طلب مرافقة: أختار مكان + أشخاص (الأقرب أول)؛ اللي يوافق ننتقل أنا وهو للمكان =====
const CQ_DESTS=[['plaza','🏟️ الساحة'],['mall','🏬 المول'],['craft','⛏️ عالم البناء'],['fair','🎡 مدينة الألعاب'],['track','🏁 الحلبة'],['games','🎮 قسم الألعاب'],['home','🏠 بيتي']];
const CQ={d:'plaza',sel:new Set()},CQQ=[];
function goDest(d,hid,w){if(JB.jailed()){toast('🔒 أنت مسجون — ما تقدر تروح مكان لين تطلع');return;}if(IN.on)leaveHouse();if(d!=='wp'&&VOXW.fp)VOXW.leave();
 if(d==='wp'&&w){VOXW.teleport(w[1],w[2],w[3]);toast('📍 وصلتم '+PLACE_NAMES[w[0]]+' (عالم البناء)');return;}
 if(d==='mall'){const p=D.mallDoor();placeAt(p.x,p.z,-Math.PI/2);toast('🏬 وصلتم مدخل المول');}
 else if(d==='craft'){const p=WLD.spot();placeAt(p.x,p.z,Math.PI/2);toast('⛏️ وصلتم حدّ عالم البناء');}
 else if(d==='fair'){const p=FAIR.spot();placeAt(p.x,p.z,-Math.PI/2);toast('🎡 وصلتم مدينة الألعاب');}
 else if(d==='track'){const p=D.startSpot();placeAt(p.x,p.z,Math.PI/2);toast('🏁 وصلتم خط البداية');}
 else if(d==='games'){const p=GM.spot();placeAt(p.x,p.z,Math.PI);toast('🎮 وصلتم قسم الألعاب');}
 else if(d==='home'){const hh=hid?HOUSES.find(x=>x.id===hid):myHouse();if(hh){placeAtSpawn('home',hh);toast('🏠 وصلتم البيت');}else{placeAtSpawn('plaza');toast('🏟️ وصلتم الساحة');}}
 else{placeAtSpawn('plaza');toast('🏟️ وصلتم الساحة');}}
function cqPaint(){$('cqDest').innerHTML=CQ.wp?`<div class="sel">📍 ${PLACE_NAMES[CQ.wp[0]]} (عالم البناء)</div>`:CQ_DESTS.map(([k,t])=>`<div data-d="${k}" class="${CQ.d===k?'sel':''}">${t}</div>`).join('');
 const me=WK.on?WK.p:ctl.target,list=[...PEERS.values()].filter(p=>!blockedFor(p.id,p.h)).map(p=>({p,d:Math.hypot(p.x-me.x,p.z-me.z)})).sort((x,y)=>x.d-y.d).slice(0,12);
 $('cqPpl').innerHTML=list.length?list.map(({p,d})=>`<div data-id="${esc(p.id)}" class="${CQ.sel.has(p.id)?'sel':''}"><span>${CQ.sel.has(p.id)?'✅':'⬜'} ${p.tag===7?'👑 ':p.h?'🏠 ':''}${esc(p.n)}</span><b>${Math.round(d)} م</b></div>`).join(''):'<div>ما فيه أحد قريب منك الحين</div>';}
function openCq(pre,wp){CQ.wp=wp||null;['card','p1','p2','p3','p4','p5','p6','p7','p8','p9'].forEach(id=>show(id,0));CQ.sel=new Set(pre&&PEERS.has(pre)?[pre]:[]);cqPaint();show('p21',1);}
$('goCq').onclick=()=>{show('p9',0);openCq();};
$('cq7').onclick=()=>{const id=TALK;show('p7',0);if(!id||!PEERS.has(id)){toast('الشخص طلع من المكان');return;}openCq(id);};
$('cqDest').onclick=e=>{const b=e.target.closest('[data-d]');if(b){CQ.d=b.dataset.d;cqPaint();}};
$('cqPpl').onclick=e=>{const b=e.target.closest('[data-id]');if(!b)return;const id=b.dataset.id;CQ.sel.has(id)?CQ.sel.delete(id):CQ.sel.add(id);cqPaint();};
$('cancel21').onclick=()=>show('p21',0);
$('cqSend').onclick=()=>{if(!CQ.sel.size){toast('اختر شخص يرافقك');return;}if(CQ.d==='home'&&!MYID){toast('ابنِ بيتك أول عشان تطلب مرافقة لبيتك');return;}netSend({t:'cq',d:CQ.wp?'wp':CQ.d,w:CQ.wp||undefined,to:[...CQ.sel]});show('p21',0);};
function showCq(){const now=Date.now();while(CQQ.length&&now-CQQ[0].t>55000)CQQ.shift();const k=CQQ[0],b=$('cqBox');if(!k){b.style.display='none';return;}
 const dn=(CQ_DESTS.find(x=>x[0]===k.d)||[0,'مكان'])[1];$('cqT').textContent='🤝 '+k.n+' يطلب مرافقتك إلى '+(k.d==='wp'?'📍 '+PLACE_NAMES[k.w[0]]+' بعالم البناء':k.d==='home'?'بيته 🏠':dn.replace(/^S+ /,''));b.style.display='block';}
function answerCq(ok){const k=CQQ.shift();if(k)netSend({t:'cr',f:k.f,ok});showCq();}
$('cqYes').onclick=()=>answerCq(true);$('cqNo').onclick=()=>answerCq(false);setInterval(showCq,5000);
// ===== الإعدادات: شريط مستوى الصوت + شريط جودة الصور (يتذكّرها الجهاز) =====
const QN=['أدنى (أخف شي)','منخفضة','متوسطة','عالية','أعلى (الأصلية)'];
let QL=LOW?1:MID?3:4;try{const v=parseInt(localStorage.getItem('mnalsifr_q'));if(v>=0&&v<=4)QL=v;}catch{}
function applyQuality(q){QL=q;const dpr=devicePixelRatio||1,base=[.5,.75,Math.min(dpr,1),Math.min(dpr,1.5),Math.min(dpr,LOW?1:MID?1.5:2)][q],sh=q>=2&&!LOW;
 R.setPixelRatio(base);R.setSize(innerWidth,innerHeight);R.shadowMap.enabled=sh;sun.castShadow=sh;}
function paintSettings(){$('q16').value=QL;$('qTxt').textContent=QN[QL];$('vol16').value=Math.round(AU.getVolume()*100);$('volTxt').textContent=AU.isMuted()?'(مكتوم)':Math.round(AU.getVolume()*100)+'٪';$('mute16').textContent=AU.isMuted()?'🔊 شغّل الصوت':'🔇 كتم الصوت';}
$('wSet').onclick=()=>{show('card',0);paintSettings();gStatus();show('p16',1);};$('inst16').onclick=()=>{show('p16',0);doInstall();};$('inv16').onclick=()=>{show('p16',0);ECOTAB='invite';openEco();};$('close16').onclick=()=>show('p16',0);
$('vol16').oninput=e=>{AU.unlock();AU.setVolume(+e.target.value/100);paintSettings();};
$('q16').oninput=e=>{const q=+e.target.value;try{localStorage.setItem('mnalsifr_q',String(q));}catch{}applyQuality(q);paintSettings();};
$('mute16').onclick=()=>{AU.unlock();AU.toggle();paintSettings();};
applyQuality(QL);
$('goMall').onclick=()=>{show('p9',0);const d=D.mallDoor();placeAt(d.x,d.z,-Math.PI/2);toast('🏬 وصلت مدخل المول');};
$('goCraft').onclick=()=>{show('p9',0);const d=WLD.spot();placeAt(d.x,d.z,Math.PI/2);toast('⛏️ وصلت حدّ عالم البناء — كمّل شرقاً وبتدخل العالم (شخص أول)');};
$('goGames').onclick=()=>{show('p9',0);const d=GM.spot();placeAt(d.x,d.z,Math.PI);toast('🎮 وصلت قسم الألعاب — اقترب من أي جهاز واضغط العب');};
$('goTrack').onclick=()=>{show('p9',0);const d=D.startSpot();placeAt(d.x,d.z,Math.PI/2);toast('🏁 وصلت خط البداية — اركب سيارة وتعالَ مع أصحابك');};
window.__q={apply:applyQuality};
document.addEventListener('click',e=>{if(e.target.closest&&e.target.closest('button')&&true)AU.click();});
// ➕ حط بيتك (للي ما عنده بيت): يطلع لمنظر المدينة ويفتح نافذة البناء
$('wBuild').onclick=()=>{exitWalk();setTimeout(()=>$('add').click(),300);};
// اركب / انزل (زر أو حرف E)
function toggleCar(){if(!WK.on||WK.intro)return;if(RIDE){endRide();return;}if(CAR.on)leaveCar();else if(CAR.nearPeer)netSend({t:'ride',to:CAR.nearPeer.id});else if(CAR.near)enterCar(CAR.near);}
for(const[id,k]of[['brakeBtn','brake'],['gasBtn','gas']]){const b=$(id);b.addEventListener('pointerdown',e=>{e.preventDefault();CAR[k]=true;b.classList.add('on');try{if(navigator.vibrate&&(!navigator.userActivation||navigator.userActivation.hasBeenActive))navigator.vibrate(12);}catch{}try{b.setPointerCapture(e.pointerId);}catch{}});['pointerup','pointercancel','lostpointercapture'].forEach(n=>b.addEventListener(n,()=>{CAR[k]=false;b.classList.remove('on');}));b.addEventListener('contextmenu',e=>e.preventDefault());}
$('raceOut').onclick=()=>{if(D.raceLeave())toast('🏳️ انسحبت من السباق');};
$('carBtn').onclick=toggleCar;$('jumpBtn').addEventListener('pointerdown',e=>{e.preventDefault();WK.jumpReq=true;});addEventListener('keydown',e=>{if(e.code==='KeyE'&&WK.on&&!window.__gameOpen&&!/INPUT|TEXTAREA/.test(document.activeElement?.tagName||''))toggleCar();});
$('wChar').onclick=()=>{show('card',0);renderChars($('chars6'),playerCh(),pickChar);renderLegend();renderShopSkins();netSend({t:'eco'});renderWardrobe();$('msg6').textContent='';show('p6',1);};
const WROWS=[['🎩 القبعة','h',HATS,0],['🎒 الظهر','b',BACKS,1],['🏷️ شارة بجانب اسمك','t',TAGS.map(t=>t||'بدون'),2],['🎨 لون بيتك','c',HCNAMES,3],['🏡 زينة بيتك','d',HDECOS,4]];
function renderWardrobe(){const el=$('wardrobe');
 if(!MYID){el.innerHTML='<div class="info">🎁 ابنِ بيتك وتفتح لك جائزة جديدة كل يوم تدخل فيه: قبعات وألوان للبيت وشارات!</div>';return;}
 const st=pst();let html=`<div class="info" style="margin:8px 0">🎁 أيام دخولك: <b>${DAYS}</b>${NRW?` • جائزة اللي بعده: <b>${esc(rewardName(NRW))}</b>`:' • فتحت كل الجوائز 🏆'}</div>`;
 for(const[title,k,names,idx]of WROWS){html+=`<div class="lbl">${title}</div><div class="opts">`;
  names.forEach((nm,v)=>{if((k==='h'&&v===7)||(k==='b'&&v===5)||(k==='t'&&v>6))return;const tok=k+v,bought=!!(ECO&&ECO.own&&(ECO.own[k]||[]).includes(v)),locked=v>0&&!UNL.has(tok)&&!bought,dayLock=REWARD_ORDER.includes(tok);
   html+=locked&&!dayLock?`<button type="button" data-mko="${k==='h'?'hat':k==='b'?'back':k==='t'?'tag':'house'}" class="mko">🛒 ${esc(String(nm))}</button>`:`<button type="button" data-k="${idx}" data-v="${v}" class="${st[idx]===v?'sel':''}"${locked?' disabled':''}>${locked?'🔒 يوم '+(REWARD_ORDER.indexOf(tok)+1):esc(String(nm))}</button>`;});
  html+='</div>';}
 el.innerHTML=html;}
$('wardrobe').onclick=async e=>{const mo=e.target.closest('[data-mko]');if(mo){openMarket(mo.dataset.mko);return;}const b=e.target.closest('[data-k]');if(!b||b.disabled)return;const st=pst().slice();st[+b.dataset.k]=+b.dataset.v;
 try{const r=await post('/api/style',{device:dev,st});const d=await r.json();if(!r.ok){$('msg6').textContent=d.error||'صار خطأ';return;}
  const h=myHouse();if(!h)return;const old=h.st||ZST;h.st=d.house.st;$('msg6').textContent='';renderWardrobe();syncWalker();updNPC();netSend({t:'c',c:playerCh()});
  if(old[2]!==h.st[2]){dropLabel(h.id);updLabels();}
  if(old[3]!==h.st[3]||old[4]!==h.st[4])buildCity();
 }catch{$('msg6').textContent='تعذّر الاتصال';}};
$('cancel6').onclick=()=>show('p6',0);
async function pickChar(c){
 if(MYID){try{const r=await post('/api/char',{device:dev,ch:c});const d=await r.json();if(!r.ok){$('msg6').textContent=d.error||'صار خطأ';return;}const h=myHouse();if(h){h.ch=d.house.ch;dropLabel(h.id);updLabels();}}catch{$('msg6').textContent='تعذّر الاتصال';return;}}
 myCh=c;try{localStorage.setItem('mnalsifr_ch',String(c));}catch{}
 syncWalker();updNPC(true);netSend({t:'c',c});show('p6',0);toast(`صرت «${chName(c)}» 👕${c>=11&&c<=15?' '+TAGS[8+(c-11)]:''}`);}
function renderShopSkins(){const el=$('shop6');if(!el)return;const th=charThumbs(grad),sel=playerCh(),own=(ECO&&ECO.own&&ECO.own.ch)||[];
 el.innerHTML='<h4 style="margin:10px 0 4px">🛍️ سكنات السوق</h4><div class="chars">'+SHOP_SKINS.map((n,k)=>{const i=SKIN_FIRST+k,o=own.includes(i);return `<button type="button" data-ch="${i}" data-own="${o?1:0}" class="${i===sel?'sel':''} ${o?'':'lockd'}"><img src="${th[i]}" alt=""><span>${o?'':'🔒 '}${n}</span></button>`;}).join('')+'</div>';
 el.onclick=e=>{const b=e.target.closest('[data-ch]');if(!b)return;if(b.dataset.own!=='1'){openMarket('skin','ch:'+b.dataset.ch);return;}pickChar(+b.dataset.ch);};}
// السكنات الأسطورية: تظهر بس لحسابات اللي كانوا معنا اليوم وبكره (السيرفر يقرر ECO.lg ويتحقق عند الاختيار)
function renderLegend(){const el=$('leg6');if(!ECO||!ECO.lg){el.style.display='none';el.innerHTML='';return;}const th=charThumbs(grad),sel=playerCh();el.style.display='block';
 el.innerHTML='<h4 style="margin:10px 0 4px">🌟 سكناتك الأسطورية — حصرية لك، ولكل سكن شارة اسم</h4><div class="chars">'+LEG_NAMES.map((n,k)=>{const i=11+k;return `<button type="button" data-ch="${i}" class="${i===sel?'sel':''}"><img src="${th[i]}" alt=""><span>${TAGS[8+k]} ${n}</span></button>`;}).join('')+'</div>';
 el.onclick=e=>{const b=e.target.closest('[data-ch]');if(!b)return;pickChar(+b.dataset.ch);};}
// شبكة اختيار الشخصية (صور مصغّرة تترسم مرة وحدة)
function renderChars(el,sel,onPick){const th=charThumbs(grad);
 el.innerHTML=CHARS.map((n,i)=>`<button type="button" data-ch="${i}" class="${i===sel?'sel':''}"><img src="${th[i]}" alt=""><span>${n}</span></button>`).join('');
 el.onclick=e=>{const b=e.target.closest('[data-ch]');if(!b)return;el.querySelectorAll('button').forEach(x=>x.classList.toggle('sel',x===b));onPick(+b.dataset.ch);};}

// أصحاب البيوت واقفين عند أبوابهم بشخصياتهم (أقرب البيوت فقط)
const NPC=[];const NN=0;
for(let i=0;i<NN;i++){const g0=charGeo(0).npc,m=new THREE.Mesh(g0,CM.body),o=new THREE.Mesh(g0,CM.line);m.castShadow=true;const g=new THREE.Group();g.add(m,o);g.visible=false;S.add(g);NPC.push({g,m,o,id:null,ch:0,ry:0,seed:i*1.7});}
function updNPC(){}// حذفنا الشخصيات الواقفة عند أبواب البيوت (بدون صاحبها) — ما لها داعي وتثقل الأداء
function npcFrame(dt,t){for(const n of NPC){if(!n.g.visible)continue;let want=0;
 if(WK.on){const dx=WK.p.x-n.g.position.x,dz=WK.p.z-n.g.position.z;if(dx*dx+dz*dz<64)want=Math.atan2(dx,dz);}// يلتفت لك لما تقرب
 n.ry=lerpAng(n.ry,want,Math.min(1,dt*4));n.g.rotation.y=n.ry;n.m.scale.y=n.o.scale.y=1+Math.sin(t*1.8+n.seed)*.012;}}

// ================= اللعب المباشر: الناس يشوفون بعض + رسائل جاهزة =================
// ما فيه كتابة حرة: الرسالة رقم من هذي القائمة (لازم تطابق SAY_N في server.js)
const SAYS=['مرحبا 👋','السلام عليكم','هلا والله 😄','وش اسمك؟','من وين أنت؟','اسمي …','أنا من …','تعال بيتي 🏠','بيتك حلو 😍','يلا نتمشى 🚶','ههههه 😂','تمام 👍','شكراً 🌹','مع السلامة 👋','صباح الخير ☀️','مساء الخير 🌙','كيف حالك؟','الحمد لله بخير 😊','وعليكم السلام ورحمة الله','يا هلا والله ومرحبا 🌹','نورت المدينة ✨','وش هوايتك؟','وش لعبتك المفضلة؟','من متى وأنت بالمدينة؟','أول مرة تدخل؟','تعرف تلعب إكس أو؟','شكلك لطيف 😄','تشرفنا بمعرفتك 🤝','ودي أتعرف عليك','تبي نصير أصحاب؟ 🤝','أنا جديد هنا، ساعدني 🙏','وش أحلى مكان بالمدينة؟','تعال الساحة 🏟️','تعال المول 🏬','تعال البحيرة 🏊','يلا نتسابق بالحلبة 🏁','تعال قسم الألعاب 🎮','وين بيتك؟','ممكن أزور بيتك؟ 🚪','تفضل بيتي 🏠','خلنا نركب سيارة 🚗','ركّبني معك 🚗','تلعب معي؟ 🎮','يلا نلعب إكس أو ⭕','أحسنت! 👏','لعبة حلوة 😍','حظ أوفر 😅','جولة ثانية؟','فزت عليك 😎','ما شاء الله عليك 💪','ما شاء الله 🌟','تبارك الله 💛','جميل جداً 😍','ممتاز 👌','يا سلام 😮','فكرة حلوة 💡','أضحكتني 😂','هههههه صح','ما عليك زود 🌹','العفو 🌹','آسف 🙏','لا عليك','طيب','أبشر','موافق ✅','لا شكراً','ثواني وأرجع ⏳','استنى شوي','وين رحت؟','تصبح على خير 🌙','الله يحفظك 🤲','بالتوفيق 🍀','مبروك 🎉','كل عام وأنتم بخير 🎊','نشوفك قريب إن شاء الله 👋','أشوفك بعدين 👋','الله يعطيك العافية 💪','تحياتي لك 🌹','اشتركت بالقناة 🔔','من متابعين القناة 🎬'];// لازم عددها = SAY_N بالسيرفر (80)
const SAY_GROUPS=[['👋 تحيات',[0,1,2,14,15,18,19,20,16,17]],['🤝 تعارف',[3,4,5,6,21,22,23,24,28,29,27,26,30,31]],['🏠 أماكن وبيوت',[7,8,9,32,33,34,35,36,37,38,39,40,41]],['🎮 ألعاب',[42,43,25,44,45,46,47,48,49]],['💬 ردود ومجاملات',[10,11,12,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68]],['🌙 وداع ومناسبات',[13,69,70,71,72,73,74,75,76,77]],['🔔 القناة',[78,79]]];
const SAY_NAME=5,SAY_COUNTRY=6,WAVE=new Set([0,1,2,13,14,15,18,19,74,75]);// التحيات: الشخصية تلوّح بيدها
const COUNTRIES=['السعودية','الكويت','الإمارات','قطر','البحرين','عُمان','اليمن','العراق','الأردن','سوريا','لبنان','فلسطين','مصر','السودان','ليبيا','تونس','الجزائر','المغرب','موريتانيا','الصومال','جيبوتي','جزر القمر','برّا الوطن العربي'];
const sayText=(k,a,n)=>k===SAY_NAME?`اسمي ${n}`:k===SAY_COUNTRY?`أنا من ${COUNTRIES[a]||''}`:SAYS[k]||'';
let MODF=false;const MQ={};let CANTYPE=false;const TPON={};// الكتابة الحرة: للمشرف ولمن يفتحها له المشرف فقط
const NET={ws:null,id:null,name:'',on:0,retry:0,lastSend:0,lastFull:0,lastKey:''};
const PEERS=new Map(),META=new Map(),MUTED=new Set();let ONLINE_HOMES=new Set();
const PEER_MAX=LOW?10:30;
let COUNTHTML='';
function updCount(){const pc=plazaCount(),chip=(t)=>`<span class="ch">${t}</span>`,n=x=>x.toLocaleString('ar');

 const html=(CC.on?`<span class="mkt ccb" data-cc="1" title="مركز الشكاوي">📨${CC.n?`<i class="jbdg">${CC.n>99?'99+':CC.n}</i>`:''}</span>`:'')+(ECO?`<span class="box" data-eco="1" title="محفظتي ومهامي">🪙 ${n(ECO.c)}</span><span class="lvs" data-eco="1" title="مستواك — يزيد واحد كل يوم تدخل فيه"><i>⭐</i><b style="font-size:${(ECO.lv||1)>99?8.5:(ECO.lv||1)>9?10:11.5}px">${n(ECO.lv||1)}</b></span>${JB.chip()}${NET.on>1||pc||PROGTXT?'<span class="sep"></span>':''}`:'')+(NET.on>1?chip(`👥 ${n(NET.on)}`):'')+(pc?chip(`🏟️ ${n(pc)}`):'')+(PROGTXT&&(NET.on>1||pc)?`<span class="sep"></span>`:'')+(PROGTXT?`<span class="hm" title="بيتك">🏡</span>`:'');
 if(html!==COUNTHTML){COUNTHTML=html;$('count').innerHTML=html;}}// ما نعيد الرسم لو ما تغيّر شي (عشان الضغطة على 🏡 ما تضيع)
$('count').addEventListener('click',e=>{if(e.target.closest('[data-cc]')){openCC();return;}if(e.target.closest('[data-jobs]')){JB.open();return;}if(e.target.closest('[data-mkt]')){openMarket();return;}if(e.target.closest('[data-eco]')){openEco();return;}if(e.target.closest('.ch')){const ch=e.target.closest('.ch').textContent;toast(ch.startsWith('🏠')?'🏠 عدد البيوت بالمدينة':ch.startsWith('👥')?'👥 المتواجدين الحين':'🏟️ اللي بالساحة');return;}if(e.target.closest('.hm')&&PROGTXT)toast('🏡 بيتك: '+PROGTXT);});
function netConnect(){if(NET.ws||document.hidden)return;let ws;try{ws=new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host+'/ws');}catch{return;}
 NET.ws=ws;ws.onopen=()=>{NET.retry=0;netHi();reHouse();};
 ws.onmessage=e=>{let m;try{m=JSON.parse(e.data);}catch{return;}onNet(m);};
 ws.onclose=()=>{if(NET.ws===ws)NET.ws=null;NET.id=null;clearPeers();setTimeout(netConnect,Math.min(15000,1500*2**NET.retry++));};
 ws.onerror=()=>{};}
function netSend(o){if(NET.ws&&NET.ws.readyState===1)NET.ws.send(JSON.stringify(o));if(o&&o.t==='died')setTimeout(()=>JB.hurt(1),400);}// موت بعالم البناء = إصابة 🤕
// بعد انقطاع الاتصال السيرفر ينسى مين داخل البيت: صاحب البيت يسجّل دخوله من جديد، والزائر يطلع (وإلا يبقى «شبح» داخل البيت ما يقدر صاحبه يشوفه ولا يطرده)
function reHouse(){if(!IN.on||!IN.h)return;if(IN.own)netSend({t:'in',h:IN.h.id});else leaveHouse('🔌 انقطع الاتصال فطلعت من البيت');}
function netHi(){if(D.raceReset)D.raceReset();let n='';try{n=localStorage.getItem('mnalsifr_name')||'';}catch{}netSend({t:'hi',d:dev,c:playerCh(),n});if(ADMIN_OK&&ADMIN)netSend({t:'admin',k:ADMIN});NET.lastKey='';}
// يرسل مكاني ~8 مرات بالثانية (ولو ما تحركت: مرة كل 5 ثواني بس)
function netFrame(t){if(!NET.ws||NET.ws.readyState!==1||t-NET.lastSend<.125)return;NET.lastSend=t;
 const o=WK.on&&!WK.intro?{t:'p',x:+WK.p.x.toFixed(2),z:+WK.p.z.toFixed(2),y:+(WK.y+WK.jy).toFixed(2),r:+Math.atan2(Math.sin(WK.yaw),Math.cos(WK.yaw)).toFixed(2),m:WK.mv||0,v:CAR.on?CAR.car.i:-1}
  :{t:'v',x:Math.round(ctl.target.x),z:Math.round(ctl.target.z)};
 const k=JSON.stringify(o);if(k===NET.lastKey&&t-NET.lastFull<5)return;NET.lastKey=k;NET.lastFull=t;netSend(o);}
function onNet(m){switch(m.t){
 case 'cwx':toast('🛡️ أول ٣٠ مربع من حدود العالم محمية — ما تقدر تبني ولا تحفر فيها');break;
 case 'hk':{const hh=HOUSES.find(x=>x.id===m.id);if(hh){hh.pk=m.pk||[];syncYard();}break;}
 case 'mcs':case 'cwe':case 'cwb':case 'cts':case 'ctg':case 'ctn':case 'ctd':case 'hurt':case 'kill':case 'hfx':VOXW.onNet(m);break;
 case 'me':NET.id=m.id;NET.name=m.n;if(m.ts)FAIR.setClock(m.ts);break;
 case 's':{if(m.m)for(const[id,n,c,h,hat,back,tag,md,jj,ff]of m.m)META.set(id,{n,c,h,hat:hat|0,back:back|0,tag:tag|0,mod:md===1,j:typeof jj==='string'?jj:'',f:ff|0});if(m.on!==undefined){NET.on=m.on;updCount();}
  const seen=new Set();let k=0;
  for(const[id,x,z,y,r,mv,v,sa,dr]of m.p){const me=META.get(id);if(!me||k>=PEER_MAX)continue;k++;seen.add(id);let p=PEERS.get(id);
   if(!p)p=newPeer(id,me,x/10,z/10,y/100,r/100);else if(p.c!==me.c||p.n!==me.n||p.h!==me.h||p.hat!==me.hat||p.back!==me.back||p.tag!==me.tag||p.j!==me.j||p.f!==me.f)peerMeta(p,me);
   p.tx=x/10;p.tz=z/10;p.ty=y/100;p.tr=r/100;p.mv=mv;p.v=Number.isInteger(v)&&v>=0&&v<CAR_N?v:-1;p.seat=sa|0;p.drv=dr||null;}
  for(const id of[...PEERS.keys()])if(!seen.has(id))removePeer(id);
  ONLINE_HOMES=new Set([...PEERS.values()].map(p=>p.h).filter(Boolean));break;}
 case 'race':case 'rk':case 'rfin':case 'rlap':D.raceNet(m);break;
 case 'ride':onRide(m);break;
 case 'g':if(GM.net)GM.net(m);break;
 case 'msg':gotMsg(m);break;
 case 'sent':{const mt=m.x!==undefined?m.x:sayText(m.k,m.a,NET.name);myBubble(mt);chatAdd({n:'أنت',x:mt,mine:1});if(WAVE.has(m.k))WK.wave=1.6;toast(m.heard?`انرسلت ✅ يشوفها ${m.heard} حولك`:'انرسلت — بس ما فيه أحد قريب منك الحين');$('say7').value='';show('p7',0);break;}
 case 'mkl':MK=m.items;renderMarket();break;
 case 'mkok':mkApply(m);break;
 case 'evt':evtOn(m);break;
 case 'eco':ECO=m.s;if($('p15').style.display==='block')renderCarList();if($('p30').style.display==='block')renderMarket();if($('p6').style.display==='block'){renderLegend();renderShopSkins();}if(m.ev){toast(m.ev);try{AU.win&&AU.win();}catch{}}ecoRender();goalRender();updCount();break;
 case 'lb':LB=m;ecoRender();break;
 case 'boost':load();break;
 case 'vh':VIP.tour=m.tour|0;VIP.lk=!!m.lk;VIPH=(m.l||[]).map(x=>({...x,vip:true}));VIP.mine=Array.isArray(m.mine)?m.mine:(m.mine?[m.mine]:[]);VIP.pass=!!m.pass;if(D.vip){D.vip.setHouses(VIPH);D.vip.setPass(VIP.pass);}renderVip();break;
 case 'vip':VIP.pass=true;if(D.vip)D.vip.setPass(true);if(m.tour){VIP.tour=1;show('p20',0);}toast(m.nog?'💡 وثّق حسابك بقوقل من ⚙️ عشان يرتبط قصرك بحسابك وبيتك':m.tour?'🏰 أهلاً! زيارتك المجانية لمدينة المشتركين '+m.tour+' دقيقة — استمتع بالتفرّج':m.guest?'🏰 سمح لك صاحب المدينة — تفرّج على المدينة!':'🏰 أهلاً '+(m.name||'')+' — انفتحت البوابة'+(m.n>1?' ('+m.n+' قصور بدعوتك)':''));AU.door();renderVip();break;
 case 'vkn':if(VIP.mine.length){KNOCKS.push({f:m.f,n:m.n,vip:1});AU.door();showKnock();}break;
 case 'vkd':toast('🚫 صاحب المدينة ما فتح لك البوابة');break;
 case 'ct':CANTYPE=!!m.on;paintTyped();break;
 case 'so':MODF=!!m.on;syncWalker();if(MODF)toast('🛡️ صرت مشرف: تقدر تمنع من يخالف من الكتابة (اضغط على اسمه)');break;
 case 'sq':MQ[m.f]={mod:!!m.mod,ban:!!m.ban};if(TALK===m.f)paintMod();break;
 case 'tq':TPON[m.f]=!!m.on;if(TALK===m.f)paintTp();break;
 case 'cqi':if(!idBlocked(m.f)&&CQQ.length<5){CQQ.push({f:m.f,n:m.n,d:m.d,h:m.h,w:m.w,t:Date.now()});AU.door();showCq();}break;
 case 'cqs':toast('📨 أُرسل طلب المرافقة لـ '+m.n+(m.n===1?' شخص':' أشخاص')+' — ننتظر الرد');break;
 case 'cx':toast(m.gone?'⌛ انتهى هذا الطلب':'🙏 '+m.n+' اعتذر عن المرافقة');break;
 case 'cg':if(m.me&&!m.first){toast('✅ '+m.n+' وافق وانضم لك');break;}goDest(m.d,m.h,m.w);toast(m.me?'✅ '+m.n+' وافق — انتقلتم':'🤝 انتقلت لمرافقة '+m.n);break;
 case 'vipend':VIP.pass=false;VIP.tour=2;if(D.vip)D.vip.setPass(false);toast('🏰 انتهت زيارتك المجانية — القصور خاصة بمشتركي تيك توك');renderVip();break;
 case 'vtw':toast('⏳ باقي أقل من دقيقتين على نهاية زيارتك المجانية');break;
 case 'vipno':VIP.tour=2;if($('p20').style.display!=='block')openVip();else renderVip();toast('🏰 القصور خاصة بمشتركي تيك توك');break;
 case 'vipout':if(!VIP.pass&&D.vip){const g=D.vip.gate();placeAt(PLAZA.x+g.x,PLAZA.z+g.z,0);toast('🏰 القصور خاصة بمشتركين تيك توك');openVip();}break;
 case 'in':{const h=HOUSES.find(x=>x.id===m.h)||VIPH.find(x=>x.id===m.h);if(h)enterHouse(h,m.s);break;}
 case 'kd':toast('🚫 '+(m.n||'صاحب البيت')+' ما فتح لك الباب');break;
 case 'out':leaveHouse(m.k===1?'🚪 صاحب البيت طردك':'🚪 صاحب البيت طلع من البيت');break;
 case 'kn':if(IN.on&&IN.own){KNOCKS.push({f:m.f,n:m.n});AU.door();showKnock();}break;
 case 'hv':$('inList').innerHTML=m.l.length?m.l.map(([id,n])=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 4px"><span>${esc(n)}</span><button data-k="${esc(id)}" class="danger">طرد</button></div>`).join(''):'<div class="info">ما فيه أحد معك بالبيت</div>';break;
 case 'ann':showAnn(m);break;
 case 'bn':showBn(m);break;
 case 'bapn':toast('📢 '+m.n+' يتظلّم من الحظر — افتح 📨 مركز الشكاوي');break;
 case 'ccn':ccNet(m);break;
 case 'ccl':CC.d=m;paintCC();break;
 case 'jpn':if(CC.on){toast('📢 '+m.n+' يعترض على سجنه — افتح 📨 مركز الشكاوي');break;}JB.onNet(m);break;
 case 'pkey':PUSH.k=m.k;PUSH.has=!!m.has;pushSync();paintPush();break;
 case 'aw':AW=!!m.on;try{localStorage.setItem('mnalsifr_aw',AW?'1':'');}catch{}toast(AW?'📡 صارت توصلك رسائل الكل (بالدردشة فوق)':'📡 وقّفت عرض رسائل الكل');if($('awTg'))$('awTg').textContent=awTxt();break;
 case 'admin':if(m.ok&&AW)netSend({t:'aw',on:true});break;
 case 'jb':case 'jl':case 'jx':case 'jm':case 'jof':case 'jfull':case 'jst':case 'jhl':case 'th':case 'thw':JB.onNet(m);break;
 case 'err':toast(m.m||NET_ERR[m.e]||'تعذّر الإرسال');break;}}

// ================= 🪙 العملة والمهام والكنوز (السيرفر يحسب كل شي؛ هنا عرض فقط) =================
const fmtT=ms=>Math.floor(ms/60000)+':'+String(Math.floor(ms/1000)%60).padStart(2,'0')+'.'+Math.floor(ms%1000/100);
const BADGE_UI=[['🌴','نخلة ذهبية',0,'تجيك من النخلة الذهبية المخفية'],['💎','ماسة',120],['🏎️','سباق',80],['🔥','نار',60],['⭐','نجمة',100],['🗝️','صائد الكنوز',0,'لقِ الصناديق الثمانية كلها'],['🗼','سر البرج',0,'لقِ السر المخفي تحت البرج']];
const TUT_UI=['حط بيتك بالمدينة 🏠','العب لعبة بقسم الألعاب 🎮','نزّل سيارة وسوق 🚗','ارسل رسالة جاهزة 💬'];
// ================= 🛒 السوق: سكنات، قبعات، أشياء الظهر، شارات، ألوان البيت، ديكور الحوش، تغيير الاسم =================
let MK=null,MKCAT='skin',MKSEL=null;
const MK_CATS=[['skin','🧍 سكنات'],['hat','🎩 قبعات'],['back','🎒 الظهر'],['tag','🏷️ شارات'],['house','🏠 البيت'],['yard','🌴 الحوش'],['service','✏️ خدمات']];
const MK_YARD={palm:'🌴',lamp:'💡',garden:'🌷',fountain:'⛲',pool:'🏊'},MK_DEC=['','🚩','🌴','🏮','🗿'],MK_SI={h:0,b:1,t:2,c:3,d:4};
const mkParse=it=>{const[k,v]=it.i.split(':');return{k,v:v===undefined?null:(k==='x'?v:+v)};};
function mkOwned(it){const{k,v}=mkParse(it),o=(ECO&&ECO.own)||{};if(k==='ch')return(o.ch||[]).includes(v);if(MK_SI[k]!==undefined)return(o[k]||[]).includes(v)||UNL.has(k+v);if(k==='x'){const mh=myHouse();return!!(mh&&(mh.dx||[]).includes(v));}return false;}
function mkWorn(it){const{k,v}=mkParse(it);if(k==='ch')return playerCh()===v;if(MK_SI[k]!==undefined)return pst()[MK_SI[k]]===v;return false;}
function mkThumb(it,big){const{k,v}=mkParse(it),th=charThumbs(grad),sz=big?'mk-th big':'mk-th';
 if(k==='ch')return`<div class="${sz}"><img src="${th[v]}" alt=""></div>`;if(k==='h'&&th.hat&&th.hat[v])return`<div class="${sz}"><img src="${th.hat[v]}" alt=""></div>`;if(k==='b'&&th.back&&th.back[v])return`<div class="${sz}"><img src="${th.back[v]}" alt=""></div>`;
 if(k==='t')return`<div class="${sz} emo">${TAGS[v]}</div>`;if(k==='c')return`<div class="${sz}"><i class="mk-sw" style="background:${HCOL[v]}"></i></div>`;if(k==='d')return`<div class="${sz} emo">${MK_DEC[v]}</div>`;if(k==='x')return`<div class="${sz} emo">${MK_YARD[v]||'🏡'}</div>`;
 return`<div class="${sz} emo">${it.i==='rename'?'✏️':'⏩'}</div>`;}
const mkFmt=p=>Number(p).toLocaleString('en');
const mkTier=p=>p>=50000?'leg':p>=10000?'rare':p>=2000?'good':'';
function openMarket(cat,sel){['card','p18','p6','p16','p7'].forEach(x=>show(x,0));if(cat)MKCAT=cat;MKSEL=sel||null;show('p30',1);if(!MK)netSend({t:'mkl'});netSend({t:'eco'});renderMarket();}
function renderMarket(){if($('p30').style.display!=='block')return;const coins=ECO?ECO.c:0;$('mkCoins').textContent='🪙 '+mkFmt(coins);
 $('mkTabs').innerHTML=MK_CATS.map(([k,n])=>`<button data-mc="${k}" class="${MKCAT===k?'on':''}">${n}</button>`).join('');
 if(!MK){$('mkGrid').innerHTML='<div class="info">جاري فتح السوق…</div>';$('mkSheet').style.display='none';return;}
 if(!MYID){$('mkGrid').innerHTML='<div class="info">🏠 ابنِ بيتك أول عشان تقدر تشتري من السوق — وكل يوم تدخل تاخذ ذهب 🪙</div>';$('mkSheet').style.display='none';return;}
 const list=MK.filter(it=>it.cat===MKCAT).sort((x,y)=>x.p-y.p);
 $('mkGrid').innerHTML=list.map(it=>{const own=mkOwned(it),worn=own&&mkWorn(it);return`<button class="mk-it ${mkTier(it.p)} ${own?'own':''} ${worn?'worn':''}" data-mi="${it.i}">${mkThumb(it)}<b>${esc(it.n)}</b><span class="mk-p">${worn?'✔ لابسه':own?(it.cat==='yard'?'✅ عندك':'👕 عندك'):'🪙 '+mkFmt(it.p)}</span></button>`;}).join('');
 const it=MKSEL&&MK.find(x=>x.i===MKSEL);const sh=$('mkSheet');if(!it){sh.style.display='none';return;}
 const own=mkOwned(it),worn=own&&mkWorn(it),can=coins>=it.p,mh=myHouse();
 let act='';
 if(it.i==='rename')act=`<input id="mkName" maxlength="18" placeholder="الاسم الجديد" value="${esc(mh?mh.name:'')}"><button class="mk-buy" data-buy="1" ${can?'':'disabled'}>✏️ غيّر الاسم بـ 🪙 ${mkFmt(it.p)}</button>`;
 else if(worn)act='<button class="mk-buy" disabled>✔ لابسه الحين</button>';
 else if(own)act=`<button class="mk-buy wear" data-buy="1">${it.cat==='yard'?'✅ موجود بحوشك':'👕 البسه'}</button>`;
 else act=`<button class="mk-buy" data-buy="1" ${can?'':'disabled'}>اشترِ بـ 🪙 ${mkFmt(it.p)}</button>`;
 sh.innerHTML=`<div class="mk-card ${mkTier(it.p)}">${mkThumb(it,1)}<h4>${esc(it.n)}</h4><div class="mk-meta">${own?'✅ عندك':'السعر: 🪙 '+mkFmt(it.p)} • رصيدك: 🪙 ${mkFmt(coins)}</div>${!own&&!can?`<div class="mk-need">تحتاج 🪙 ${mkFmt(it.p-coins)} زيادة — خلّص مهامك اليومية وادعُ أصحابك 🎁</div>`:''}${act}<button class="mk-x" data-x="1">رجوع</button></div>`;sh.style.display='flex';}
function mkApply(m){const mh=myHouse();if(mh&&m.house){const old={st:(mh.st||ZST).slice(),dx:(mh.dx||[]).slice(),name:mh.name,type:mh.type};Object.assign(mh,{st:m.house.st,ch:m.house.ch,name:m.house.name,dx:m.house.dx,days:m.house.days,type:m.house.type});
  if(m.house.name!==old.name){NET.name=m.house.name;try{localStorage.setItem('mnalsifr_name',m.house.name);}catch{}}
  syncWalker();netSend({t:'c',c:playerCh()});dropLabel(mh.id);updLabels();
  if(old.st[3]!==mh.st[3]||old.st[4]!==mh.st[4]||old.dx.length!==(mh.dx||[]).length||old.type!==mh.type)buildCity();}
 if(m.wear)toast('👕 لبسته!');try{AU.win&&AU.win();}catch{}MKSEL=null;renderMarket();if($('p6').style.display==='block')renderWardrobe();}
$('mkTabs').onclick=e=>{const b=e.target.closest('[data-mc]');if(!b)return;MKCAT=b.dataset.mc;MKSEL=null;renderMarket();$('mkGrid').scrollTop=0;};
$('mkGrid').onclick=e=>{const b=e.target.closest('[data-mi]');if(!b)return;MKSEL=b.dataset.mi;renderMarket();};
$('mkSheet').onclick=e=>{if(e.target.closest('[data-x]')||e.target===$('mkSheet')){MKSEL=null;renderMarket();return;}const b=e.target.closest('[data-buy]');if(!b||b.disabled||!MKSEL)return;
 const msg={t:'mk',i:MKSEL};if(MKSEL==='rename'){const v=($('mkName').value||'').trim();if(v.length<2){toast('اكتب اسم من حرفين أو أكثر');return;}msg.n=v;}
 b.disabled=true;b.textContent='…';netSend(msg);setTimeout(()=>{if(MKSEL)renderMarket();},2500);};
$('cancel30').onclick=()=>{show('p30',0);MKSEL=null;};
// ================= 📲 حط اللعبة بشاشة الجوال (تطبيق) =================
const INST={ev:null};
const isStandalone=()=>{try{return matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;}catch{return false;}};
const isIOS=()=>/iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
try{if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});}catch{}
addEventListener('beforeinstallprompt',e=>{e.preventDefault();INST.ev=e;instMaybe();});
addEventListener('appinstalled',()=>{INST.ev=null;INST.want=false;$('instBar').style.display='none';try{localStorage.setItem('mnalsifr_inst2',JSON.stringify({done:1}));}catch{}try{localStorage.setItem('mnalsifr_inst','done');}catch{}toast('✅ انضافت اللعبة لشاشة جوالك');});
const instDone=()=>{if(isStandalone())return true;try{return JSON.parse(localStorage.getItem('mnalsifr_inst2')||'{}').done||localStorage.getItem('mnalsifr_inst')==='done';}catch{return false;}};
const ITOUCH=(()=>{try{return matchMedia('(pointer:coarse)').matches;}catch{return false;}})();
function instMaybe(){INST.want=!INST.hide&&!instDone()&&(!!INST.ev||isIOS()||ITOUCH);
 $('instTxt').textContent=INST.ev?'تدخلها بضغطة وحدة مثل أي تطبيق':isIOS()?'بسفاري: زر المشاركة ⬆️ ثم «إضافة إلى الشاشة الرئيسية»':'من قائمة المتصفح ⋮ اختر «إضافة إلى الشاشة الرئيسية»';
 $('instGo').textContent=INST.ev?'ثبّت':'كيف؟';instShow();}
// يختفي مؤقتاً وقت ما تكون فيه لوحة مفتوحة (عشان ما يغطي أزرارها) ويرجع بعدها
function instShow(){const b=$('instBar');if(!b)return;const busy=[...document.querySelectorAll('.panel')].some(p=>p.style.display==='block');const on=INST.want&&!busy&&!isStandalone();const d=on?'flex':'none';if(b.style.display!==d)b.style.display=d;}
setInterval(instShow,700);
async function doInstall(){if(isStandalone()){toast('✅ اللعبة مثبّتة عندك');return;}
 if(INST.ev){const e=INST.ev;INST.ev=null;$('instBar').style.display='none';try{e.prompt();const r=await e.userChoice;if(r&&r.outcome==='accepted'){INST.want=false;try{localStorage.setItem('mnalsifr_inst2',JSON.stringify({done:1}));}catch{}}else instMaybe();}catch{}return;}
 if(isIOS()){toast('📲 بالآيفون: اضغط زر المشاركة ⬆️ تحت بسفاري، ثم «إضافة إلى الشاشة الرئيسية»');return;}
 toast('📲 من قائمة المتصفح (⋮) اختر «إضافة إلى الشاشة الرئيسية» أو «تثبيت التطبيق»');}
$('instGo').onclick=doInstall;$('instX').onclick=()=>{INST.hide=true;INST.want=false;$('instBar').style.display='none';};
setTimeout(instMaybe,1200);
// 🎁 دعوة صديق: رابط فيه رقم بيتك؛ اللي يدخل منه ويفتح بيت جديد → تاخذ 100 🪙
const REF=(()=>{try{const r=new URLSearchParams(location.search).get('r');if(r&&/^[0-9a-f]{10}$/.test(r)){localStorage.setItem('mnalsifr_ref',r);history.replaceState(null,'',location.pathname);}return localStorage.getItem('mnalsifr_ref')||'';}catch{return '';}})();
const inviteLink=()=>MYID?location.origin+'/?r='+MYID:'';
async function shareInvite(){const l=inviteLink();if(!l){toast('ابنِ بيتك أول عشان يصير لك رابط دعوة 🏠');return;}const txt='تعال ابنِ بيتك معي في «مدينة من الصفر» 🏙️ مجاناً:';
 try{if(navigator.share){await navigator.share({title:'مدينة من الصفر',text:txt,url:l});return;}}catch(e){if(e&&e.name==='AbortError')return;}
 try{await navigator.clipboard.writeText(txt+' '+l);toast('📋 انسخ رابط دعوتك — أرسله لأصحابك');}catch{prompt('انسخ رابط دعوتك:',l);}}
let ECOTAB='tasks';
function ecoRender(){if($('p18').style.display!=='block')return;const e=ECO;if(!e){$('eco18').innerHTML='<div class="info">جاري التحميل…</div>';return;}
 const pb=(p,g,c)=>`<div class="wl-pb"><i style="width:${Math.min(100,Math.round(p/g*100))}%;${c?'background:'+c:''}"></i></div>`;
 let h=`<div class="wl-stats"><div class="wl-st gold"><b>🪙 ${e.c}</b><small>ذهب</small></div><div class="wl-st"><b>🔥 ${e.s}</b><small>يوم ورا بعض</small></div><div class="wl-st"><b>⭐ ${e.lv||1}</b><small>المستوى</small></div></div>`;
 const tabs=[['tasks','📋 مهامي'],['shop','🛒 المتجر'],['invite','🎁 ادعُ صديق'],['top','🏆 الأبطال']];
 h+='<div class="wl-tabs">'+tabs.map(([k,n])=>`<button data-tab="${k}" class="${ECOTAB===k?'on':''}">${n}</button>`).join('')+'</div>';
 if(ECOTAB==='tasks'){
  const done=e.tk.filter(t=>t.ok).length;
  h+=`<div class="wl-card"><div class="wl-h">📋 مهام اليوم <span>${done}/${e.tk.length}</span></div>`+e.tk.map(t=>`<div class="wl-task ${t.ok?'ok':''}"><div class="wl-tn"><span>${t.ok?'✅':'⬜'} ${esc(t.n)}</span><small>${t.p}/${t.g}</small></div>${pb(t.p,t.g,t.ok?'#2fb344':'')}</div>`).join('')+`<div class="wl-note">${e.bx?'🎁 استلمت صندوق المهام اليوم!':'🎁 خلّص المهام كلها وتاخذ صندوق جائزة'}</div></div>`;
  h+=`<div class="wl-card"><div class="wl-h">📅 جائزة الدخول اليومي</div><div class="wl-note">كل يوم تدخل الجائزة تكبر: 10، 20، 30… واليوم السابع صندوق 100 🪙 — لو فاتك يوم ترجع من الأول</div></div>`;
  const tu=e.tut.map((x,i)=>!!x||(i===0&&!!MYID)),td=tu.filter(x=>x).length;if(td<4)h+=`<div class="wl-card"><div class="wl-h">🎓 البداية السريعة <span>${td}/4</span></div>`+TUT_UI.map((t,i)=>`<div class="wl-task ${tu[i]?'ok':''}"><div class="wl-tn"><span>${tu[i]?'✅':'⬜'} ${t}</span></div></div>`).join('')+'</div>';// عندك بيت = «حط بيتك» خالصة
  const fn=e.fnd.filter(x=>x<8).length;h+=`<div class="wl-card"><div class="wl-h">🗝️ الكنوز المخفية <span>${fn}/8</span></div>${pb(fn,8,'#f59f00')}<div class="wl-note">${e.fnd.includes(8)?'🌴 لقيت النخلة الذهبية • ':''}${e.fnd.includes(9)?'🗼 لقيت سر البرج • ':''}صناديق مخفية حول الساحة والحلبة، ونخلة ذهبية، وسر تحت البرج — لما تقترب يطلع لك تنبيه 🔔</div></div>`;
 }else if(ECOTAB==='shop'){
  h+=`<button class="wl-buy" data-open-market="1" style="margin:0 0 10px">🛒 افتح السوق — سكنات وقبعات ولبس وتغيير الاسم</button>`;
  h+=`<div class="wl-card"><div class="wl-h">⏩ تسريع بيتك</div><div class="wl-note">يكبر بيتك يوم كامل على طول</div><button class="wl-buy" data-b="boost">تسريع يوم — ${e.bc} 🪙</button></div>`;
  h+='<div class="wl-card"><div class="wl-h">🏅 الشارات <small>(تظهر قدّام اسمك وفوق راسك)</small></div><div class="wl-grid">'+BADGE_UI.map(([em,n,p],i)=>{const own=e.o.includes(i);return own?`<button data-q="${i}" class="wl-item ${e.bd===i?'on':''}"><b>${em}</b>${n}<small>${e.bd===i?'✔ لابسها':'البس'}</small></button>`:p?`<button data-b="${i}" class="wl-item"><b>${em}</b>${n}<small>${p} 🪙</small></button>`:`<button disabled class="wl-item" title="${esc(BADGE_UI[i][3]||'')}"><b>${em}</b>${n}<small>🔒 ${esc(BADGE_UI[i][3]||'')}</small></button>`;}).join('')+'</div>'+(e.bd>=0?'<button class="wl-sm" data-q="-1">إزالة الشارة</button>':'')+'</div>';
  {const mh=myHouse(),own=(mh&&mh.dx)||[];h+='<div class="wl-card"><div class="wl-h">🏡 ديكور بيتك <small>(يشوفه كل الناس)</small></div>'+(mh?'<div class="wl-grid">'+[['palm','🌴','نخلة',40],['lamp','💡','إنارة',60],['garden','🌷','حديقة ورد',80],['fountain','⛲','نافورة',100],['pool','🏊','مسبح',150]].map(([id,em,n,p])=>own.includes(id)?`<button disabled class="wl-item on"><b>${em}</b>${n}<small>✅ عندك</small></button>`:`<button data-b="x:${id}" class="wl-item"><b>${em}</b>${n}<small>${p} 🪙</small></button>`).join('')+'</div>':'<div class="wl-note">ابنِ بيتك أول عشان تزيّنه 🏠</div>')+'</div>';}
 }else if(ECOTAB==='invite'){
  const l=inviteLink();
  h+=`<div class="wl-card wl-inv"><div class="wl-big">🎁 ادعُ صديق واكسب <b>${e.rfg||100} 🪙</b></div><div class="wl-note">أرسل رابطك لأصحابك — أول ما يدخل صديقك من رابطك ويفتح بيت جديد، ياخذ حسابك ${e.rfg||100} ذهب على طول.</div>`+(l?`<div class="wl-link" dir="ltr">${esc(l)}</div><button class="wl-buy" id="invShare">📤 شارك رابطي</button><div class="wl-note">👥 دعوت <b>${e.rf||0}</b> ${(e.rf||0)===1?'صديق':'أصدقاء'} • الدعوة تنحسب لو صديقك فتح بيت من جهاز وشبكة غير حقّك</div>`:'<div class="wl-note">🏠 ابنِ بيتك أول عشان يصير لك رابط دعوة</div>')+'</div>';
 }else{
  h+=`<div class="wl-card"><div class="wl-h">🏆 لوحة الأسبوع ${LB?`<small>(تتصفّر بعد ${LB.left} يوم)</small>`:''}</div><div class="wl-note">فوزك هالأسبوع: <b>${e.xo}</b> • أسرع سباق لك: <b>${e.rc?fmtT(e.rc):'—'}</b></div></div>`;
  if(LB){const row=(arr,f)=>arr.length?arr.map(([n,v],i)=>`<div class="wl-lb"><span>${['🥇','🥈','🥉'][i]||(i+1)+'.'} ${esc(n)}</span><b>${f(v)}</b></div>`).join(''):'<div class="wl-note">ما فيه أحد للحين — كن الأول!</div>';
   h+=`<div class="wl-card"><div class="wl-h">⭕ أكثر فوز</div>${row(LB.xo,v=>v+' فوز')}</div><div class="wl-card"><div class="wl-h">🏁 أسرع سباق</div>${row(LB.rc,fmtT)}</div>`;}
 }
 $('eco18').innerHTML=h;const sb=$('invShare');if(sb)sb.onclick=shareInvite;}
// 🎯 هدفك الجاي: السيرفر يرسل ECO.ng = {k,n,p,g,a}؛ نعرضه كشريط دايم وقت المشي، والضغط ينفّذ الفعل
let GOALK='';const GOAL_CAT={h:'hat',t:'tag',b:'back',c:'house',d:'house'};
function goalRender(){const el=$('goal'),g=ECO&&ECO.ng;if(!el)return;
 const vis=!!g&&WK.on&&!WK.intro&&!CAR.on&&!IN.on&&!VOXW.fp;el.style.display=vis?'flex':'none';document.body.classList.toggle('hasGoal',vis);if(!g)return;
 el.querySelector('.gl-t').textContent='🎯 '+g.n+(g.g?`  ${Math.min(g.p,g.g)}/${g.g}`:'');
 el.querySelector('.gl-b').style.display=g.g?'block':'none';el.querySelector('.gl-b i').style.width=(g.g?Math.round(100*Math.min(g.p,g.g)/g.g):0)+'%';
 const key=g.k+':'+(g.i??g.n);if(GOALK&&GOALK!==key){el.classList.remove('done');void el.offsetWidth;el.classList.add('done');}GOALK=key;}
function goalAct(){const g=ECO&&ECO.ng;if(!g||!WK.on)return;const a=g.a||'plaza';
 if(a==='build'){$('wBuild').click();return;}
 if(a==='car'){$('wCar').click();return;}
 if(a==='chat'){$('wChat').click();return;}
 if(a==='boost'){const c=ECO.c|0;if(c<g.g){toast(`ناقصك ${g.g-c} 🪙 للتسريع — العب بقسم الألعاب واحضر الفعاليات 🎉 (أو ارجع بكرة ويتقدّم بيتك لحاله)`);return;}
  if(confirm(`تسرّع بيتك يوم بـ${g.g} 🪙؟`))netSend({t:'buy',i:'boost'});return;}
 if(a.startsWith('mk:')){const id=a.slice(3);openMarket(GOAL_CAT[id.split(':')[0]]||null,id);return;}
 if(['games','track','plaza','mall','fair','craft','home'].includes(a))goDest(a);}
$('goal').onclick=goalAct;
setInterval(goalRender,700);
// 🎉 الفعاليات المجدولة: السيرفر يرسل {t:'evt',on,id,n,d,left,nx:{n,d,in}} عند الدخول وعند كل تغيير؛ العدّاد محلي
let EVT=null,EVTID='';const mmss=ms=>{const s=Math.max(0,Math.round(ms/1000));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');};
function evtOn(m){EVT={...m,at:Date.now()};if(m.on&&EVTID!==m.id&&WK.on)toast('🎉 بدأت فعالية «'+m.n+'» — احضرها واكسب 🪙 (اضغط الشريط تروح)');EVTID=m.on?m.id:'';evtRender();}
function evtRender(){const el=$('evt');if(!el)return;const vis=!!EVT&&WK.on&&!WK.intro&&!CAR.on&&!IN.on;el.style.display=vis?'flex':'none';document.body.classList.toggle('hasEvt',vis);if(!vis)return;
 const el2=Date.now()-EVT.at;el.classList.toggle('on',!!EVT.on);
 el.textContent=EVT.on?`🎉 الحين: ${EVT.n} — باقي ${mmss(EVT.left-el2)}`:EVT.nx?`⏳ الفعالية الجاية: ${EVT.nx.n} بعد ${mmss(EVT.nx.in-el2)}`:'';}
$('evt').onclick=()=>{if(!EVT||!WK.on)return;const d=EVT.on?EVT.d:EVT.nx&&EVT.nx.d;if(d)goDest(d);};
setInterval(evtRender,1000);
window.__evt=()=>({EVT,shown:$('evt').style.display,txt:$('evt').textContent});
window.__goal=()=>({ng:ECO&&ECO.ng,shown:$('goal').style.display});
function openEco(){show('card',0);show('p18',1);ecoRender();netSend({t:'eco'});netSend({t:'lb'});}
$('cancel18').onclick=()=>show('p18',0);
$('eco18').onclick=e=>{if(e.target.closest('[data-open-market]')){show('p18',0);openMarket();return;}const tb=e.target.closest('[data-tab]');if(tb){ECOTAB=tb.dataset.tab;ecoRender();return;}const b=e.target.closest('[data-b]'),q=e.target.closest('[data-q]');if(b)netSend({t:'buy',i:b.dataset.b==='boost'||b.dataset.b.startsWith('x:')?b.dataset.b:+b.dataset.b});else if(q)netSend({t:'eq',i:+q.dataset.q});};
// ---- كنوز مخفية (إحداثيات محلية بالنسبة للساحة، آخر واحد = النخلة الذهبية) ----
function secInit(){if(SECM.length)return;const lam=c=>new THREE.MeshLambertMaterial({color:c}),gold=new THREE.MeshLambertMaterial({color:0xffc83d,emissive:0x664400});
 SEC.forEach((_,i)=>{const g=new THREE.Group();
  if(i===8){const t=new THREE.Mesh(new THREE.CylinderGeometry(.3,.45,6,8),gold);t.position.y=3;g.add(t);for(let k=0;k<6;k++){const l=new THREE.Mesh(new THREE.BoxGeometry(.5,.12,3.4),gold);l.position.set(Math.sin(k*1.047)*1.6,6.1,Math.cos(k*1.047)*1.6);l.rotation.y=k*1.047;l.rotation.x=.35;g.add(l);}}
  else{const b=new THREE.Mesh(new THREE.BoxGeometry(1.5,.9,1.05),lam(0x8a5a2b));b.position.y=.45;const l=new THREE.Mesh(new THREE.BoxGeometry(1.6,.4,1.15),gold);l.position.y=1.1;const k=new THREE.Mesh(new THREE.BoxGeometry(.25,.3,.12),lam(0xffffff));k.position.set(0,.8,.6);g.add(b,l,k);}
  g.visible=false;S.add(g);SECM.push(g);});}
function secFrame(t){if(!SECM.length||!WK.on||WK.intro){SECM.forEach(g=>{g.visible=false;});return;}
 SEC.forEach(([lx,lz,ab],i)=>{const g=SECM[i],x=ab?lx:PLAZA.x+lx,z=ab?lz:PLAZA.z+lz,d=Math.hypot(WK.p.x-x,WK.p.z-z);
  if(d<45&&ECO&&!ECO.fnd.includes(i)&&t-(SECHINT.get(i)||-99)>60){SECHINT.set(i,t);toast(i===8?'🌴 حاسّ إن فيه شي ذهبي قريب منك…':i===9?'🗼 فيه سر قريب من البرج… دوّر':'🔔 فيه كنز مخفي قريب منك! دوّر حولك');}
  if((ECO&&ECO.fnd.includes(i))||d>70){g.visible=false;return;}
  if(!g.visible||g.userData.px!==x||g.userData.pz!==z){g.userData.y=groundAt(x,z,5);g.userData.px=x;g.userData.pz=z;g.position.set(x,g.userData.y,z);}
  g.visible=true;g.rotation.y=t*.8;g.position.y=g.userData.y+Math.sin(t*2+i)*.08;
  if(d<(i===8?4:3)&&ECO&&!SECPEND.has(i)){SECPEND.add(i);netSend({t:'fd',i});setTimeout(()=>SECPEND.delete(i),3000);}});}

// ================= دخول البيوت =================
// الداخل غرفة مبنية عند الطلب بإحداثيات بعيدة (لكل بيت مكان حسب رقم أرضه)، وتنحذف لما تطلع. ما يتحمّل شي منها إلا لما أحد يدخل.
const INSZ=[[34,26],[38,28],[48,34],[44,40],[54,44]];// عرض × عمق الغرفة لكل نوع بيت (خيمة، طين، فيلا، برج، قلعة)
const TMC=new Map(),tm=c=>{let m=TMC.get(c);if(!m){m=toon(c);TMC.set(c,m);}return m;};
const intOrigin=slot=>[8000+(slot%200)*64,8000+Math.floor(slot/200)*64];// بعيد جداً عن المدينة والضواحي (ما يتداخل مع شي)// السيرفر يعطي نفس الرقم لكل من داخل البيت
function buildInterior(h,slot){if(h.vip){const[px,pz]=intOrigin(slot),b=buildPalace(h,px,pz);S.add(b.group);return{...b,ox:px,oz:pz};}
 const[ox,oz]=intOrigin(slot),[w,d]=INSZ[h.type]||INSZ[1],H=[9,9.5,11,12,13][h.type]||9.5,g=new THREE.Group();g.position.set(ox,0,oz);// سقف عالي: يحس الداخل إنه وسيع
 const hc=h.st&&h.st[3]?HCOL[h.st[3]]:null,wall=hc||['#efe3cc','#e8d6b5','#f3ead8','#dccbab','#e6dcc6'][h.type%5],boxes=[];
 const add=(x,y,z,sx,sy,sz,c,solid)=>{const m=new THREE.Mesh(GEO.box,tm(c));m.position.set(x,y,z);m.scale.set(sx,sy,sz);g.add(m);if(solid)boxes.push([ox+x-sx/2,ox+x+sx/2,oz+z-sz/2,oz+z+sz/2]);return m;};
 add(0,0,0,w+1.2,.3,d+1.2,['#8a6a45','#a07a4f','#c9a676','#8f98a3','#7d746a'][h.type%5]);
 add(0,.3,-d/2,w,H,.4,wall);add(-w/2,.3,0,.4,H,d,wall);add(w/2,.3,0,.4,H,d,wall);
 const gw=5;for(const sg of[-1,1])add(sg*(w/2+gw/2)/2,.3,d/2,w/2-gw/2,H,.4,wall);add(0,.3+4.4,d/2,gw,H-4.4,.4,wall);
 add(0,.3,d/2,gw,4.4,.15,'#6b4423');add(1.7,2.5,d/2-.1,.35,.35,.25,'#e7b53c');
 for(const[x,z,sx,sz]of[[0,-d/2+.3,w,.3],[-w/2+.3,0,.3,d],[w/2-.3,0,.3,d]])add(x,.3,z,sx,.5,sz,'#7a5a3a');// أرضية خشبية: لوح سفلي
 // السقف: ظاهر (ما فيه سماء) + عوارض خشب + ثريات
 add(0,.3+H,0,w+.8,.4,d+.8,'#f4ecd9');for(let i=-3;i<=3;i++)add(i*w/7,.3+H-.4,0,.6,.4,d,'#7a5a3a');
 for(const[px,pz]of[[-w/4,-d/5],[w/4,-d/5],[0,d/5],[-w/4,d/3],[w/4,d/3]]){add(px,.3+H-1.7,pz,.3,1.7,.3,'#4a3a2a');add(px,.3+H-2.4,pz,2,.6,2,'#fff0b8');}
 // نوافذ
 for(const sg of[-1,1]){add(sg*w/4,H*.3,-d/2+.22,3.6,2.4,.1,'#7fb4d6');add(sg*(w/2-.22),H*.3,-d/4,.1,2.4,3.6,'#7fb4d6');add(sg*(w/2-.22),H*.3,d/4,.1,2.4,3.6,'#7fb4d6');}
 // سجادة
 add(-1,.32,2,w*.42,.05,d*.4,'#b5413b');add(-1,.35,2,w*.42-1.4,.05,d*.4-1.4,'#e4c06a');add(-1,.38,2,w*.42-3,.05,d*.4-3,'#b5413b');
 // السرير
 const bx=-w/2+4.5,bz=-d/2+5.8;add(bx,.3,bz,6.2,.6,8.6,'#7a5533',true);add(bx,.9,bz,5.9,.45,8.3,'#f4f1ea');add(bx,1.35,bz-3,4.4,.35,1.5,'#9ec5e8');add(bx,1.35,bz+1.2,5.9,.2,5,'#c94f4f');
 add(bx+4.6,.3,bz-3,2.2,1.6,2.2,'#7a5533',true);add(bx+4.6,1.9,bz-3,.5,1,.5,'#fff3a0');// كومدينو + مصباح
 // مجلس (كنبة + طاولة)
 add(w/2-3.4,.3,-d/6,4.2,1.1,10,'#4f6d8f',true);add(w/2-1.5,.3,-d/6,1.2,2.8,10,'#44607f',true);add(w/2-9,.3,-d/6,4.8,1,4,'#8b5a2b',true);add(w/2-9,1.3,-d/6,.5,1.8,.5,'#fff3a0');
 add(w/2-3.4,.3,-d/6+9,4.2,1.1,6,'#4f6d8f',true);
 // مكتبة
 add(2,.3,-d/2+1,9,4,1.6,'#7a5533',true);['#c94f4f','#3b7bc4','#e7b53c','#3aa06a','#8e5bd0','#c94f4f','#3b7bc4','#e7b53c'].forEach((c,i)=>add(-1.6+i*1.1,2.2,-d/2+1,.8,1.4,1,c));
 // طاولة طعام + كراسي
 add(-w/6,.3,d/4,8,1.2,4.4,'#8b5a2b',true);for(const sx of[-2.6,0,2.6])for(const sz of[-3.1,3.1])add(-w/6+sx,.3,d/4+sz,1.4,1,1.4,'#a8794a');
 if(h.type>=2){add(w/4,.3,d/3,4,.6,4,'#4a9450',true);add(w/4,.9,d/3,.6,3.2,.6,'#7a5533');add(-w/2+3,.3,d/2-4,5,1.6,2,'#7a5533',true);}
 if(h.type>=3){for(const sg of[-1,1])add(sg*(w/2-2.4),.3,d/2-4,2,H,2,'#e7b53c',true);add(0,.3,-d/2+5,6,.6,5,'#e7b53c',true);add(0,.9,-d/2+5.6,2.4,2.6,.8,'#b5413b');}
 if(h.type>=4){for(const sg of[-1,1])add(sg*(w/2-2.4),.3,-d/2+4,2,H,2,'#e7b53c',true);}
 const sp=new THREE.Mesh(new THREE.PlaneGeometry(9,1.8),new THREE.MeshBasicMaterial({map:textTex(h.name,512,128,'#1d2b36','#ffd34d',70),transparent:true}));sp.position.set(-2,H*.62,-d/2+.26);g.add(sp);
 S.add(g);return{group:g,boxes,bed:{x:ox+bx,z:oz+bz,y:1.42},hw:w/2,hd:d/2,ox,oz,H:H+.1};}
function inCollide(p,R,y){const x0=IN.x-IN.hw+R+.25,x1=IN.x+IN.hw-R-.25,z0=IN.z-IN.hd+R+.25,z1=IN.z+IN.hd-R-.25;p.x=Math.max(x0,Math.min(x1,p.x));p.z=Math.max(z0,Math.min(z1,p.z));if(WK.emote===6)return;// نايم على السرير: ما يندفع
 for(const b of IN.boxes){if(b[5]!==undefined&&y!==undefined&&(b[5]<y+.35||b[4]>y+2))continue;const cx=Math.max(b[0],Math.min(p.x,b[1])),cz=Math.max(b[2],Math.min(p.z,b[3])),dx=p.x-cx,dz=p.z-cz,d2=dx*dx+dz*dz;if(d2>=R*R)continue;
  if(d2<1e-6){const l=p.x-b[0],r=b[1]-p.x,u=p.z-b[2],dn=b[3]-p.z,m=Math.min(l,r,u,dn);if(m===l)p.x=b[0]-R;else if(m===r)p.x=b[1]+R;else if(m===u)p.z=b[2]-R;else p.z=b[3]+R;}
  else{const d=Math.sqrt(d2),k=(R-d)/d;p.x+=dx*k;p.z+=dz*k;}}}
function enterHouse(h,slot){if(IN.on||!WK.on||WK.intro||!h||!Number.isInteger(slot))return;
 if(CAR.on)leaveCar();if(RIDE)endRide();SW.on=false;WK.emote=0;GM.close(true);show('p9',0);
 const b=buildInterior(h,slot);Object.assign(IN,{on:true,h,own:h.vip?VIP.mine.includes(h.id):h.id===MYID,group:b.group,boxes:b.boxes,bed:b.bed,x:b.ox,z:b.oz,hw:b.hw,hd:b.hd,H:b.H,gf:b.gf||null});
 const pv=!!h.vip;WK.p.set(b.ox,0,b.oz+b.hd-(pv?15:4));WK.y=.3;WK.yaw=Math.PI;WK.camYaw=0;WK.dist=pv?13:6.5;WK.cur=WK.dist;WK.pitch=pv?.5:.42;WK.jy=0;WK.vy=0;
 chunkSync(true);updInUI();AU.door();toast(IN.own?(h.vip?'🏰 أهلاً في قصرك':'🏠 أهلاً في بيتك'):(h.vip?'🏰 دخلت قصر «'+h.name+'»':'🏠 دخلت بيت «'+h.name+'»'));}
function leaveHouse(note){if(!IN.on)return;const h=IN.h;S.remove(IN.group);IN.group=null;IN.on=false;IN.boxes=[];IN.h=null;WK.emote=0;netSend({t:'out'});
 IN.gf=null;let px,pz,f,ez;if(h.vip){const q=(D.vip?D.vip.palaces():[]).find(x=>x.id===h.id);if(q){px=PLAZA.x+q.door.x;ez=PLAZA.z+q.door.z;f=1;}else{px=PLAZA.x;ez=PLAZA.z+330;f=1;}}else{[px,pz]=houseXZ(h.plot);f=faceOf(h.plot);ez=pz+f*(PLOT/2+4.5);}// نطلع للشارع قدّام البوابة
 WK.p.set(px,0,ez);WK.y=groundAt(px,ez);WK.yaw=f>0?0:Math.PI;WK.camYaw=f>0?Math.PI:0;WK.dist=CAMD;WK.cur=CAMD;WK.pitch=CAMP;WK.jy=0;WK.vy=0;
 chunkSync(true);updInUI();AU.door();if(note)toast(note);}
const nearBed=()=>IN.on&&IN.bed&&Math.hypot(WK.p.x-IN.bed.x,WK.p.z-IN.bed.z)<4.2&&Math.abs(WK.y-(IN.bed.y-2.3))<3;
function updInUI(){const on=IN.on;$('inBox').style.display=on?'flex':'none';$('inPpl').style.display=on&&IN.own?'':'none';$('inSleep').textContent=WK.emote===6?'⏰ قم':'😴 نام';
 if(!on)show('p19',0);if(on)$('doorBtn').style.display='none';}
let DOORH=null,DOORT=0;
function updDoorBtn(t){const b=$('doorBtn');if(t-DOORT<.3)return;DOORT=t;
 if(!WK.on||WK.intro||CAR.on||RIDE||SW.on||IN.on||window.__gameOpen){if(b.style.display!=='none')b.style.display='none';DOORH=null;return;}
 let h=null,bd=10;for(const q of HOUSES){const[px,pz]=plotPos(q.plot);if(Math.abs(px-WK.p.x)>22||Math.abs(pz-WK.p.z)>26)continue;const[dx,dz]=doorOf(q),d=Math.hypot(dx-WK.p.x,dz-WK.p.z);if(d<bd){bd=d;h=q;}}// أقرب باب (10م)
 // بوابة مدينة مشتركي تيك توك (الحوش) + أبواب القصور
 if(D.vip&&D.vip.state===2){const lx=WK.p.x-PLAZA.x,lz=WK.p.z-PLAZA.z;
  if(D.vip.inCourt(lx,lz)){DOORH={gate:true};const tx=VIP.pass?'🏰 مدينة مشتركي تيك توك (مفتوحة لك)':'🏰 بوابة مدينة مشتركي تيك توك';if(b.textContent!==tx)b.textContent=tx;if(b.style.display!=='block')b.style.display='block';return;}
  if(VIP.pass){let pb=null,pd=13;for(const q of D.vip.palaces()){const d=Math.hypot(PLAZA.x+q.door.x-WK.p.x,PLAZA.z+q.door.z-WK.p.z);if(d<pd){pd=d;pb=q;}}if(pb)h=pb;}}
 DOORH=h||null;if(!h){if(b.style.display!=='none')b.style.display='none';return;}
 const mine=h.vip?VIP.mine.includes(h.id):h.id===MYID,txt=h.vip?(mine?'🚪 ادخل قصرك':'✊ اطرق باب قصر «'+h.name+'»'):(mine?'🚪 ادخل بيتك':'✊ اطرق باب «'+h.name+'»');if(b.textContent!==txt)b.textContent=txt;if(b.style.display!=='block')b.style.display='block';}
$('doorBtn').onclick=()=>{const h=DOORH;if(!h)return;if(h.gate){openVip();return;}const mine=h.vip?VIP.mine.includes(h.id):h.id===MYID;if(mine){netSend({t:'in',h:h.id});}else{netSend({t:'kn',h:h.id});AU.door();}};
$('inExit').onclick=()=>leaveHouse();
$('inSleep').onclick=()=>{if(!IN.on)return;if(WK.emote===6){WK.emote=0;updInUI();return;}if(!nearBed()){toast('🛏️ اقترب من السرير أول');return;}
 WK.p.set(IN.bed.x,0,IN.bed.z);WK.yaw=0;WK.emote=6;updInUI();toast('😴 تصبح على خير… حرّك الشخصية عشان تقوم');};
$('inPpl').onclick=()=>{netSend({t:'hl'});show('p19',1);};$('cancel19').onclick=()=>show('p19',0);
$('inList').onclick=e=>{const b=e.target.closest('[data-k]');if(b){const hn=(b.parentElement&&b.parentElement.querySelector('span')||{}).textContent||'';sure('طرد {n} من بيتك',hn,'','نعم، اطرده').then(y=>{if(!y)return;netSend({t:'ko',f:b.dataset.k});toast('🚪 طردته');setTimeout(()=>netSend({t:'hl'}),400);});}};
function showKnock(){const k=KNOCKS[0],b=$('knockBox');if(!k){b.style.display='none';return;}$('knockT').textContent=k.vip?'🏰 '+k.n+' يطرق باب مدينة المشتركين':'✊ '+k.n+' يطرق الباب';b.style.display='block';}
function answerKnock(ok){const k=KNOCKS.shift();if(k)netSend(k.vip?{t:'vka',f:k.f,ok}:{t:'ka',f:k.f,ok});showKnock();}
$('knockYes').onclick=()=>answerKnock(true);$('knockNo').onclick=()=>answerKnock(false);

// ================= بوابة مدينة مشتركي تيك توك: اختر بيتك + رمزه، أو اطرق الباب؛ والمشرف يضيف القصور =================
const buildPalace=createPalaceIn({GEO,tm,textTex});
const TT_SUB='';// رابط الاشتراك بالتيك توك (طلب المالك)
function renderVip(){if($('p20').style.display!=='block')return;const el=$('vip20');let h='';
 if(VIP.pass){const mhs=VIPH.filter(x=>VIP.mine.includes(x.id));h+=`<div class="info" style="margin:6px 0">${VIP.lk?'🔗 حسابك موثّق بقوقل • ':''}✅ <b>البوابة مفتوحة لك</b> ${mhs.length?'• '+(mhs.length>1?'قصورك ('+mhs.length+'):':'قصرك:'):'• ضيف: تتفرّج على المدينة (تدخل القصور لو سمح لك أصحابها)'}</div>`;
  if(mhs.length||MYID)h+=`<div class="says" style="margin:4px 0">${mhs.map(x=>`<div data-go="${esc(x.id)}">🚶 اذهب لقصر «${esc(x.name)}»</div>`).join('')}${MYID?'<div data-go="home">🏠 اذهب لبيتي الأساسي</div>':''}</div>`;
  h+=`<div class="info" style="margin:4px 0">🚶 امش بالشارع الرئيسي وانظر القصور. اقترب من باب أي قصر: «ادخل» لقصرك أو «اطرق» لغيرك.</div>`;}
 else{h+=`<div class="info" style="margin:4px 0">🔒 مدينة خاصة بمشتركي القناة. اختر بيتك من القائمة واكتب رمزه (اللي أعطاك إياه صاحب المدينة):</div><div class="says" id="vipList" style="max-height:170px;overflow:auto">${VIPH.length?VIPH.map(x=>`<div data-vid="${esc(x.id)}" class="${VIP.sel===x.id?'sel':''}" style="${VIP.sel===x.id?'background:#ffe6b8;':''}">${x.adm?'👑':'🏰'} ${esc(x.name)}</div>`).join(''):'<div>ما فيه بيوت للحين</div>'}</div>
  <div class="row" style="margin-top:6px"><input id="vipPin" type="password" placeholder="رمز بيتك" autocomplete="off" style="flex:1;padding:10px;font-size:16px;border-radius:12px;border:1px solid #ccd"><button class="main" data-a="join">🔑 ادخل</button></div>
  ${VIP.tour===0?'<div class="row" style="margin-top:6px"><button class="main" data-a="tour">🚪 ادخل زيارة مجانية (مرة وحدة)</button></div><div class="info" style="margin:4px 0;font-size:12px">لكل شخص زيارة وحدة بس — تتفرّج على المدينة والقصور</div>':'<div class="info" style="margin:6px 0;color:#b3261e;font-weight:800">🏰 القصور خاصة بمشتركي تيك توك — خلّصت زيارتك المجانية. اشترك بالقناة وخذ رمز قصرك.</div><div class="row" style="margin-top:6px"><button data-a="sub" style="background:#111;color:#fff;font-weight:900">🎵 اشترك بالتيك توك</button></div>'}`;}
 if(ADMIN_OK){h+=`<h4 style="margin:12px 0 4px">👑 إدارة قصور المشتركين</h4><div class="row"><input id="vipN" placeholder="اسم القصر" maxlength="18" style="flex:1;padding:8px;border-radius:10px;border:1px solid #ccd"><input id="vipP" placeholder="الرمز" style="flex:1;padding:8px;border-radius:10px;border:1px solid #ccd"></div>
  <div class="row" style="margin-top:6px"><button data-a="add">➕ أضف قصر مشترك</button><button data-a="addk">👑 أضف قصر المشرف الكبير</button></div>
  <div class="info" style="margin:4px 0;font-size:12px">ℹ️ نفس الرمز لأكثر من قصر = دعوة وحدة تملك كل هالقصور</div><div class="says" style="max-height:120px;overflow:auto;margin-top:6px">${VIPH.map(x=>`<div style="display:flex;justify-content:space-between;align-items:center"><span>${x.adm?'👑':'🏰'} ${esc(x.name)} <small>(مكان ${x.lot}${VIPH.filter(y=>y.inv===x.inv).length>1?' • دعوة مشتركة':''})</small></span><button class="danger" data-del="${esc(x.id)}" style="padding:4px 10px">حذف</button></div>`).join('')}</div>`;}
 el.innerHTML=h;}
function openVip(){['card','p1','p2','p3','p4','p5','p6','p7','p8','p9'].forEach(id=>show(id,0));VIP.sel=null;show('p20',1);netSend({t:'vl'});renderVip();}
$('cancel20').onclick=()=>show('p20',0);
$('vip20').onclick=e=>{const v=e.target.closest('[data-vid]'),d=e.target.closest('[data-del]'),a=e.target.closest('[data-a]'),go=e.target.closest('[data-go]');
 if(go){const id=go.dataset.go;show('p20',0);if(id==='home'){placeAtSpawn('home');return;}const q=D.vip&&D.vip.palaces().find(x=>x.id===id);if(q){placeAt(PLAZA.x+q.door.x,PLAZA.z+q.door.z,Math.PI/2);toast('🏰 وصلت قصر «'+q.name+'»');}return;}
 if(v){VIP.sel=v.dataset.vid;renderVip();return;}
 if(d){const qn=(d.parentElement&&d.parentElement.querySelector('span')||{}).textContent||'';sure('حذف قصر {n}',qn.split(' (')[0],'يطلع منه اللي داخل وما ينرجع','نعم، احذفه').then(y=>{if(y)netSend({t:'vd',i:d.dataset.del});});return;}
 if(!a)return;const k=a.dataset.a;
 if(k==='join'){if(!VIP.sel){toast('اختر بيتك من القائمة أول');return;}const pin=($('vipPin').value||'').trim();if(!pin){toast('اكتب رمز بيتك');return;}netSend({t:'vp',i:VIP.sel,p:pin});}
 else if(k==='tour'){netSend({t:'vt'});}
 else if(k==='sub'){try{if(TT_SUB)window.open(TT_SUB,'_blank','noopener,noreferrer');}catch{}}
 else if(k==='add'||k==='addk'){const n=($('vipN').value||'').trim(),p=($('vipP').value||'').trim();if(!n||!p){toast('اكتب الاسم والرمز');return;}netSend({t:'va',n,p,adm:k==='addk'});$('vipN').value='';$('vipP').value='';}};
const HIST=new Map();let HISTID=null;// آخر رسائل كل شخص (للعرض الكامل)
function pushHist(id,name,txt){let a=HIST.get(id);if(!a)HIST.set(id,a={n:name,l:[]});a.n=name;a.l.push({x:txt,t:Date.now()});if(a.l.length>10)a.l.shift();if(HIST.size>60)HIST.delete(HIST.keys().next().value);}
const agoTxt=t=>{const s=Math.round((Date.now()-t)/1000);return s<60?'قبل '+s+' ث':'قبل '+Math.round(s/60)+' د';};
function openHist(id){const a=HIST.get(id);if(!a||!a.l.length){toast('ما فيه رسائل منه للحين');return;}HISTID=id;
 $('p14t').textContent=`📜 آخر رسائل «${a.n}»`;$('hist14').innerHTML=[...a.l].reverse().map(m=>`<div><small>${agoTxt(m.t)}</small><div>${esc(m.x)}</div></div>`).join('');show('card',0);show('p7',0);show('p14',1);}
$('cancel14').onclick=()=>show('p14',0);$('rep14').onclick=()=>{show('p14',0);openTalk(HISTID);};
// ===== الدردشة بالأعلى: آخر 100 رسالة (تنزل وتطلع) =====
const CHATMAX=100;
function chatAdd(o){const box=$('chat'),list=$('chatlist');box.style.display='block';document.body.classList.add('hasChat');const near=list.scrollTop+list.clientHeight>=list.scrollHeight-30;
 const d=document.createElement('div');if(o.f)d.dataset.f=o.f;d.innerHTML=`<b style="color:${o.mine?'#9fd8ff':o.ann?'#ff9f43':o.far?'#b8c4d0':'#ffd34d'}">${esc(o.n)}</b>: ${o.ann?'<b>'+esc(o.x)+'</b>':esc(o.x)}`+((ADMIN_OK||MODF)&&o.ak?`<button class="cb" data-ak="${esc(o.ak)}" data-an="${esc(o.n)}">${BANK.has(o.ak)?'✅ فك':'🚫 حظر'}</button>`:'');list.append(d);
 while(list.children.length>CHATMAX)list.firstChild.remove();if(near||o.mine)list.scrollTop=list.scrollHeight;$('chatCnt').textContent='('+list.children.length+')';}
// ===== 📢 إعلان صاحب المدينة: شريط كبير للكل =====
let AW=false;try{AW=localStorage.getItem('mnalsifr_aw')==='1';}catch{}
const awTxt=()=>AW?'📡 رسائل الجميع: شغّالة — اضغط توقّفها':'📡 اعرض لي رسائل الجميع';
const ANN=document.createElement('div');ANN.id='annBox';ANN.style.cssText='position:fixed;left:50%;transform:translateX(-50%);top:calc(var(--t,48px) + 50px);z-index:12;display:none;max-width:92vw;width:440px;background:linear-gradient(180deg,#ffcf4d,#ff9f1a);color:#2a1a00;border:3px solid #fff;border-radius:18px;padding:10px 14px;text-align:center;font-weight:900;box-shadow:0 8px 26px rgba(0,0,0,.4);cursor:pointer';document.body.appendChild(ANN);ANN.onclick=()=>{ANN.style.display='none';};
function showAnn(m){ANN.innerHTML=`<div style="font-size:13px">📢 إعلان من 👑 ${esc(m.n)}</div><div style="font-size:17px;margin-top:3px;line-height:1.5">${esc(m.x)}</div>`;ANN.style.display='block';clearTimeout(ANN._t);ANN._t=setTimeout(()=>ANN.style.display='none',12000);chatAdd({n:'📢 👑 '+m.n,x:m.x,ann:1});try{AU.door();}catch{}}
// ===== 🔔 إشعارات الجوال: الإذن + الاشتراك (المفتاح من السيرفر) — السيرفر يرسل التذكير اليومي/الوظيفة/الفعاليات/إعلاناتي =====
const PUSH={k:'',has:false};
const pushOK=()=>'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
const pushPerm=()=>{try{return Notification.permission;}catch{return 'denied';}};
const pushWant=()=>{try{return localStorage.getItem('mnalsifr_push')!=='0';}catch{return true;}};
const u8key=b=>{const s=atob(b.replace(/-/g,'+').replace(/_/g,'/')+'==='.slice((b.length+3)%4));return Uint8Array.from(s,c=>c.charCodeAt(0));};
async function pushSub(){const reg=await navigator.serviceWorker.ready;let sub=await reg.pushManager.getSubscription();
 if(sub){const k=sub.options&&sub.options.applicationServerKey;if(k&&PUSH.k&&btoa(String.fromCharCode(...new Uint8Array(k))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')!==PUSH.k){await sub.unsubscribe();sub=null;}}
 if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:u8key(PUSH.k)});
 const j=sub.toJSON();netSend({t:'ps',e:j.endpoint,p:j.keys.p256dh,a:j.keys.auth});return true;}
async function pushOn(){if(!pushOK()){toast(isIOS()&&!isStandalone()?'📲 بالآيفون: ثبّت اللعبة على الشاشة الرئيسية أول (⚙️ ← حط اللعبة بشاشة جوالك)، وافتحها من هناك وفعّل الإشعارات':'🔕 جهازك أو متصفحك ما يدعم الإشعارات');return false;}
 if(!PUSH.k){toast('شوي شوي 🙂 جرّب بعد ثواني');return false;}
 let p=pushPerm();if(p==='default'){try{p=await Notification.requestPermission();}catch{p='denied';}}
 if(p!=='granted'){toast('🔕 الإشعارات مقفلة من المتصفح — فعّلها من إعدادات المتصفح للموقع');paintPush();return false;}
 try{localStorage.setItem('mnalsifr_push','1');}catch{}
 try{await pushSub();toast('🔔 تم! بنذكّرك بجوائزك اليومية وفعاليات المدينة');}catch(e){toast('🔕 ما قدرنا نفعّل الإشعارات على هذا الجهاز');}paintPush();return true;}
async function pushOff(){try{localStorage.setItem('mnalsifr_push','0');}catch{}try{const reg=await navigator.serviceWorker.ready;const sub=await reg.pushManager.getSubscription();if(sub)await sub.unsubscribe();}catch{}netSend({t:'px'});toast('🔕 قفلنا الإشعارات');paintPush();}
// عنده إذن من قبل والسيرفر ما عنده اشتراكه (جهاز جديد للحساب/اشتراك انتهى) → نجدده بصمت
function pushSync(){if(!pushOK()||!PUSH.k||PUSH.has||pushPerm()!=='granted'||!pushWant())return;pushSub().catch(()=>{});}
const pushOnNow=()=>PUSH.has&&pushPerm()==='granted'&&pushWant();
function paintPush(){const b=$('push16');if(!b)return;b.textContent=pushOnNow()?'🔔 الإشعارات شغّالة — اضغط تقفلها':pushPerm()==='denied'?'🔕 الإشعارات مقفلة من المتصفح':'🔔 فعّل إشعارات الجوال';}
// اقتراح التفعيل: لصاحب البيت بعد ما يلعب شوي (مرة كل 3 أيام لو قال «لاحقاً»)
const PBOX=document.createElement('div');PBOX.id='pushAsk';PBOX.style.cssText='position:fixed;left:50%;transform:translateX(-50%);bottom:calc(max(16px,env(safe-area-inset-bottom)) + 130px);z-index:9;display:none;width:340px;max-width:92vw;background:#fff;border-radius:18px;padding:12px 14px;box-shadow:0 6px 24px rgba(0,0,0,.35);text-align:center;font-weight:800';
PBOX.innerHTML='<div style="font-size:16px">🔔 تبي نذكّرك بجوائزك اليومية وفعاليات المدينة؟</div><div style="font-size:12px;font-weight:600;color:#55606c;margin:4px 0 8px">إشعارين باليوم بالكثير — وتقدر تقفلها من ⚙️ وقت ما تبي</div><button class="main" id="pushYes" style="margin:0 4px">✅ إيه ذكّرني</button><button id="pushLater" style="margin:0 4px">لاحقاً</button>';document.body.appendChild(PBOX);
$('pushYes').onclick=()=>{PBOX.style.display='none';pushOn();};$('pushLater').onclick=()=>{PBOX.style.display='none';try{localStorage.setItem('mnalsifr_pushask',String(Date.now()));}catch{}};
let PASKT=0;setInterval(()=>{if(PBOX.style.display==='block'||!MYID||!WK.on||WK.intro||document.body.classList.contains('vox')||CAR.on||!PUSH.k||!pushOK()||pushPerm()!=='default')return;if(++PASKT<5)return;
 try{if(Date.now()-(+localStorage.getItem('mnalsifr_pushask')||0)<3*864e5)return;}catch{}if([...document.querySelectorAll('.panel')].some(p=>p.style.display==='block'))return;PBOX.style.display='block';try{localStorage.setItem('mnalsifr_pushask',String(Date.now()));}catch{}},5000);
if($('push16'))$('push16').onclick=()=>{pushOnNow()?pushOff():pushOn();};paintPush();
try{navigator.serviceWorker&&navigator.serviceWorker.addEventListener('message',e=>{if(e.data&&e.data.push)window.__lastPush=e.data.push;});}catch{}
// ===== 🚫 حظر من الدردشة: اختيار المدة (ساعة/يوم/للأبد لصاحب المدينة) + تظلّم المحظور =====
const BPICK=document.createElement('div');BPICK.id='banPick';BPICK.style.cssText='position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:20;display:none;width:300px;max-width:92vw;background:#fff;border-radius:18px;padding:14px;box-shadow:0 8px 30px rgba(0,0,0,.45);text-align:center;font-weight:800';document.body.appendChild(BPICK);
function banPick(k,n){const was=BANK.has(k);BPICK.innerHTML=`<div style="font-size:16px;margin-bottom:8px">🚫 حظر «${esc(String(n).replace(/^📡 /,'').split(' • ')[0])}» من الكتابة</div><div class="stack">${was?'<button data-bk="u">✅ فك الحظر</button>':''}<button class="danger" data-bk="60">⏱️ ساعة</button><button class="danger" data-bk="1440">📅 يوم</button>${ADMIN_OK?'<button class="danger" data-bk="0">⛔ للأبد</button>':''}<button data-bk="x">إلغاء</button></div>`;BPICK.dataset.k=k;BPICK.dataset.n=n;BPICK.style.display='block';}
BPICK.onclick=e=>{const b=e.target.closest('[data-bk]');if(!b)return;const k=BPICK.dataset.k,v=b.dataset.bk;BPICK.style.display='none';if(v==='x')return;
 const done=()=>document.querySelectorAll('#chatlist [data-ak]').forEach(x=>{if(x.dataset.ak===k)x.textContent=BANK.has(k)?'✅ فك':'🚫 حظر';});
 if(v==='u'){netSend({t:'ku',k});BANK.delete(k);done();return;}
 sure('حظر {n} من الكتابة '+({60:'ساعة',1440:'يوم',0:'للأبد'}[v]),BPICK.dataset.n||'','ما يقدر يرسل رسائل طول المدة').then(y=>{if(!y)return;netSend({t:'kb',k,mins:+v});BANK.add(k);done();});};
// المحظور: شريط فيه المدة + زر «📢 تظلّم» (مرة لكل منع)
const BNB=document.createElement('div');BNB.id='bnBox';BNB.style.cssText='position:fixed;left:50%;transform:translateX(-50%);bottom:calc(max(16px,env(safe-area-inset-bottom)) + 140px);z-index:9;display:none;width:330px;max-width:92vw;background:#2b1d1d;color:#fff;border:2px solid #e02424;border-radius:16px;padding:10px 12px;text-align:center;font-weight:800;font-size:14px';document.body.appendChild(BNB);
function showBn(m){if(!m.on){BNB.style.display='none';return;}const l=m.left<0?'للأبد':(m.left>=3600e3?Math.ceil(m.left/3600e3)+' ساعة':Math.ceil(m.left/60000)+' دقيقة');
 BNB.innerHTML=`🚫 انمنعت من الكتابة — ${m.left<0?'دائم':'باقي '+l}<div style="font-size:12px;font-weight:600;opacity:.85;margin:3px 0 6px">ما تقدر ترسل رسائل لين يخلص المنع — ولو شايف إنه ظلم:</div>${m.ap?'<button disabled style="padding:6px 12px">📢 انرسل تظلّمك</button>':'<button data-bap="1" style="padding:6px 12px;background:#ffd34d;color:#2a1a00;border:0;border-radius:10px;font-weight:900">📢 تظلّم من الحظر</button>'} <button data-bx="1" style="padding:6px 12px">✖</button>`;BNB.style.display='block';}
BNB.onclick=e=>{if(e.target.closest('[data-bap]')){netSend({t:'bap'});return;}if(e.target.closest('[data-bx]'))BNB.style.display='none';};
// صاحب المدينة/المشرف: صندوق التظلّمات
const BAPS=[],BAPB=document.createElement('div');BAPB.id='bapBox';BAPB.style.cssText='position:fixed;right:12px;top:calc(var(--t,48px) + 46px);z-index:9;display:none;max-width:300px;background:#fff;border-radius:16px;padding:10px;box-shadow:0 6px 24px rgba(0,0,0,.3);font-size:13px';document.body.appendChild(BAPB);
function paintBap(){if(!BAPS.length){BAPB.style.display='none';return;}BAPB.innerHTML='<b>📢 تظلّم من الحظر</b>'+BAPS.map(a=>`<div style="border-top:1px solid #eef1f5;padding:6px 0"><b>${esc(a.n)}</b> <small>• ${a.left<0?'دائم':'باقي '+Math.ceil(a.left/60000)+' د'}${a.by?' • منعه '+esc(a.by):''}</small>${(a.log||[]).length?'<div style="color:#55606c;font-size:12px">'+a.log.map(x=>'• '+esc(x)).join('<br>')+'</div>':''}<div style="margin-top:4px"><button data-bu="${esc(a.k)}" style="padding:5px 10px">✅ فك المنع</button> <button data-bi="${esc(a.k)}" style="padding:5px 10px">✖ تجاهل</button></div></div>`).join('');BAPB.style.display='block';}
BAPB.onclick=e=>{const u=e.target.closest('[data-bu]'),i=e.target.closest('[data-bi]');const k=(u&&u.dataset.bu)||(i&&i.dataset.bi);if(!k)return;if(u){netSend({t:'ku',k});BANK.delete(k);}const j=BAPS.findIndex(a=>a.k===k);if(j>=0)BAPS.splice(j,1);paintBap();};
const BANK=new Set();// مفاتيح اللي حظرتهم أنا كمشرف (للتبديل حظر/فك)
// ================= 📨 مركز الشكاوي (صاحب المدينة + المشرفين + المدير العام) =================
// السيرفر يرسل ccn {n} (عدد المفتوح) أو {off} لو ما لك صلاحية، و ccl القائمة كاملة. الإجراءات: cca {a,k,mins}
{const st=document.createElement('style');st.textContent=`.mkt.ccb{position:relative;border-color:#e02424;background:linear-gradient(180deg,#fff0f0,#ffd6d6);box-shadow:0 2px 6px rgba(224,36,36,.25)}
#p42{max-height:88vh;overflow:auto}#p42 h3{display:flex;justify-content:space-between;align-items:center}#p42 h3 small{font-size:12px;color:#7a8794;font-weight:700}
#p42 .cct{display:flex;gap:5px;margin:0 0 10px;flex-wrap:wrap}#p42 .cct button{flex:1 1 22%;padding:8px 4px;font-size:13px;border-radius:12px;background:#eef2f7;position:relative;white-space:nowrap}#p42 .cct button.on{background:#1d2b36;color:#fff}
#p42 .cct i{font-style:normal;display:inline-block;min-width:18px;margin-right:4px;border-radius:9px;background:#e02424;color:#fff;font-size:11px;line-height:18px;padding:0 4px}#p42 .cct i.z{background:#b8c2cc}
.ccc{border:2px solid #e6ebf1;border-radius:16px;padding:10px 12px;margin:0 0 9px;background:#fbfcfe}.ccc.hot{border-color:#ff9b9b;background:#fff8f8}
.ccc .ch{display:flex;align-items:center;gap:6px;font-weight:900;font-size:16px}.ccc .ch b{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ccc .dot{width:9px;height:9px;border-radius:50%;background:#c3cad2;flex:none}.ccc .dot.on{background:#22c55e;box-shadow:0 0 0 3px rgba(34,197,94,.18)}
.ccc .num{font-size:12px;font-weight:900;background:#e02424;color:#fff;border-radius:10px;padding:2px 8px;flex:none}.ccc .num.b{background:#ff8a00}.ccc .num.j{background:#2c6fd1}
.ccc .mt{font-size:12px;color:#66717d;margin:3px 0 6px}.ccc .rs{display:flex;flex-wrap:wrap;gap:4px;margin:0 0 6px}.ccc .rs span{font-size:12px;font-weight:800;background:#ffe8e8;color:#b01818;border-radius:9px;padding:2px 8px}
.ccc .lg{font-size:12.5px;color:#33404c;background:#f1f4f8;border-radius:10px;padding:6px 9px;margin:0 0 7px;line-height:1.6;max-height:120px;overflow:auto}.ccc .lg small{color:#7a8794;font-weight:800}
.ccc .ac{display:flex;flex-wrap:wrap;gap:5px}.ccc .ac button{flex:1 1 30%;padding:7px 6px;font-size:13px;border-radius:11px}.ccc .ac .bn{background:#ffe2e2;color:#a31212}.ccc .ac .ok{background:#dcf7e6;color:#0c6b35}.ccc .ac .dg{background:#e02424;color:#fff}
.ccc .pt{font-size:12px;font-weight:800;color:#2c6fd1}.cce{text-align:center;color:#7a8794;padding:22px 6px;font-weight:800}.cce div{font-size:34px;margin-bottom:6px}
.cch{display:flex;gap:8px;align-items:flex-start;padding:7px 2px;border-bottom:1px solid #eef1f5;font-size:13px}.cch small{color:#7a8794;flex:none}
.ev{display:flex;gap:5px;align-items:baseline;padding:2px 0;border-bottom:1px dashed #e1e6ec}.ev:last-child{border-bottom:0}.ev i{font-style:normal;flex:none}.ev span{flex:1;word-break:break-word}.ev small{flex:none;color:#8a95a1;font-size:10.5px;max-width:42%;text-align:left}
.ev-b{background:#ffe9e9;color:#a31212;border-radius:7px;padding:2px 4px;margin:1px 0}.ev-s span{color:#4b5763}.ccw{font-size:12px;font-weight:800;color:#2c6fd1;margin:0 0 5px}.ccg{font-size:11px;color:#7a8794;text-align:center;margin:-4px 0 8px}`;document.head.appendChild(st);
 const p=document.createElement('div');p.className='panel';p.id='p42';p.innerHTML='<h3><span>📨 مركز الشكاوي</span><small id="ccSub"></small></h3><div class="cct" id="ccTabs"></div><div id="ccBody"></div><div class="row"><button id="ccRef">🔄 تحديث</button><button id="cancel42">إغلاق</button></div>';document.body.appendChild(p);}
window.__cc=CC;const ccOpenNow=()=>$('p42').style.display==='block';
function ccNet(m){if(m.off){CC.on=false;CC.n=0;if(ccOpenNow())show('p42',0);}else{const up=CC.on&&m.n>CC.n;CC.on=true;CC.n=m.n|0;if(up){try{AU.door();}catch{}}if(ccOpenNow())netSend({t:'cc'});}COUNTHTML='';updCount();}
function openCC(){['card','p7','p12','p18','p30','p40','p9'].forEach(x=>{try{show(x,0);}catch{}});show('p42',1);if(!CC.d)$('ccBody').innerHTML='<div class="cce"><div>⏳</div>لحظة…</div>';netSend({t:'cc'});}
const ccAgo=t=>{const d=Math.max(0,Date.now()-t)/60000;return d<1?'الحين':d<60?'قبل '+Math.round(d)+' د':d<1440?'قبل '+Math.round(d/60)+' س':'قبل '+Math.round(d/1440)+' يوم';};
// 🧾 سطر دليل: ✍️ مكتوبة، 💬 جاهزة، 🎮 لعبة، 🚫 محجوبة بالفلتر — مع المكان والوقت
const EVI={w:'✍️',s:'💬',g:'🎮',b:'🚫'};
function evLine(l){if(typeof l==='string')l={k:'w',x:l};const k=l.k||'w';let x=l.x;
 if(x===undefined){if(k==='s')x=l.i===SAY_COUNTRY?String(SAYS[SAY_COUNTRY]).replace('…',COUNTRIES[l.a]||'…'):(SAYS[l.i]||'؟');else if(k==='g')x=QK[l.i]||'؟';else x='';}
 const tag=k==='b'?`<b>محجوبة${l.e==='contact'?' (رقم/رابط/حساب)':' (كلام بذيء)'}${l.g?' بلعبة':''}:</b> `:k==='g'?'<b>بلعبة:</b> ':'';
 return `<div class="ev ev-${k}"><i>${EVI[k]||'✍️'}</i><span>${tag}${esc(x)}</span><small>${l.w?esc(l.w):''}${l.w&&l.t?' • ':''}${l.t?ccAgo(l.t):''}</small></div>`;}
const ccLeft=l=>l<0?'دائم':l>=3600e3?'باقي '+Math.ceil(l/3600e3)+' س':'باقي '+Math.ceil(l/60000)+' د';
function paintCC(){const d=CC.d;if(!d)return;const tabs=[['r','🚩 البلاغات',d.reps.length],['b','📢 التظلّمات',d.aps.length]];if(d.jp)tabs.push(['j','🚔 السجن',d.jails.length]);tabs.push(['h','📜 السجل',-1]);
 if(!tabs.some(t=>t[0]===CC.tab))CC.tab='';if(!CC.tab)CC.tab=(tabs.find(t=>t[2]>0)||tabs[0])[0];
 $('ccTabs').innerHTML=tabs.map(([k,n,c])=>`<button data-cct="${k}" class="${CC.tab===k?'on':''}">${n}${c>=0?`<i class="${c?'':'z'}">${c}</i>`:''}</button>`).join('');
 const tot=d.reps.length+d.aps.length+(d.jp?d.jails.length:0);$('ccSub').textContent=tot?tot+' مفتوحة':'كله تمام ✅';
 const emp=(e,t)=>`<div class="cce"><div>${e}</div>${t}</div>`,dot=o=>`<span class="dot${o?' on':''}" title="${o?'متصل الحين':'مو متصل'}"></span>`,K=k=>esc(k);let H='';
 if(CC.tab==='r')H=d.reps.length?d.reps.map(r=>`<div class="ccc${r.c>=3?' hot':''}"><div class="ch">${dot(r.on)}<b>${esc(r.n||'—')}${r.h?' 🏠':''}</b><span class="num">🚩 ${r.c}</span></div>
  <div class="mt">آخر بلاغ ${ccAgo(r.t)}${r.c>1?' • أول بلاغ '+ccAgo(r.t0):''}${r.ban?' • <b style="color:#e02424">🚫 محظور</b>':''}</div>
  <div class="rs">${Object.entries(r.rs).map(([k,v])=>`<span>${esc(REASONS[k]||'؟')}${v>1?' ×'+v:''}</span>`).join('')}</div>
  ${r.w?`<div class="ccw">📍 كان وقت البلاغ: ${esc(r.w)}</div>`:''}
  ${r.log.length?`<div class="lg"><small>🧾 آخر رسائله${r.lv?' (الحين — البلاغ نفسه ما كان معه رسائل)':' وقت البلاغ'}:</small>${r.log.map(evLine).join('')}</div>`:'<div class="lg"><small>🧾 ما أرسل أي رسالة آخر يومين — البلاغ غالباً عن تصرّف (سيارة/ملاحقة/اسم)</small></div>'}
  <div class="ac">${r.p?'<span class="pt">🛡️ مشرف — ما ينحظر</span>':r.ban?`<button class="ok" data-cca="unb" data-k="${K(r.k)}">✅ فك الحظر</button>`:`<button class="bn" data-cca="ban" data-m="60" data-k="${K(r.k)}">🚫 ساعة</button><button class="bn" data-cca="ban" data-m="1440" data-k="${K(r.k)}">🚫 يوم</button>${d.adm?`<button class="dg" data-cca="ban" data-m="0" data-k="${K(r.k)}">⛔ للأبد</button>`:''}`}
  ${d.adm&&r.on&&!r.p?`<button data-cca="kick" data-k="${K(r.k)}">⏏️ طرد</button>`:''}${r.h&&!r.p&&(d.adm||d.dl>0)?`<button class="dg" data-cca="delh" data-k="${K(r.k)}">🗑️ حذف البيت${d.adm?'':` (باقي ${d.dl})`}</button>`:''}<button data-cca="dis" data-k="${K(r.k)}">☑️ تجاهل</button></div></div>`).join(''):emp('🎉','ما فيه بلاغات مفتوحة');
 else if(CC.tab==='b')H=d.aps.length?d.aps.map(a=>`<div class="ccc"><div class="ch">${dot(a.on)}<b>${esc(a.n||'—')}</b><span class="num b">📢 تظلّم</span></div>
  <div class="mt">تظلّم ${ccAgo(a.t)} • الحظر ${ccLeft(a.left)}${a.by?' • حظره '+esc(a.by):''}</div>
  ${a.log.length?`<div class="lg"><small>🧾 آخر رسائله:</small>${a.log.map(evLine).join('')}</div>`:'<div class="lg"><small>🧾 ما فيه رسائل محفوظة</small></div>'}
  <div class="ac"><button class="ok" data-cca="unb" data-k="${K(a.k)}">✅ فك الحظر</button><button data-cca="apx" data-k="${K(a.k)}">✖ رفض التظلّم</button></div></div>`).join(''):emp('🕊️','ما فيه تظلّمات');
 else if(CC.tab==='j')H=d.jails.length?d.jails.map(j=>`<div class="ccc"><div class="ch">${dot(j.on)}<b>${esc(j.n||'—')}</b><span class="num j">🔒 مسجون</span></div>
  <div class="mt">${esc(JAIL_REASONS[j.r]||'')} • سجنه ${esc(j.bn)} • باقي ${Math.ceil(j.left/60000)} د</div>
  <div class="ac"><button class="ok" data-cca="jrl" data-k="${K(j.k)}">🔓 أطلقه</button><button data-cca="jpx" data-k="${K(j.k)}">✖ رفض الاعتراض</button></div></div>`).join(''):emp('🚔','ما فيه اعتراضات على السجن');
 else H=d.hist.length?d.hist.map(([t,n,a,by])=>`<div class="cch"><span style="flex:1"><b>${esc(by)}</b>: ${esc(a)}${n?' — '+esc(n):''}</span><small>${ccAgo(t)}</small></div>`).join(''):emp('📜','ما فيه شي بالسجل للحين');
 if(CC.tab==='r'||CC.tab==='b')H='<div class="ccg">✍️ مكتوبة • 💬 جاهزة • 🎮 بلعبة • 🚫 محجوبة بالفلتر (ما وصلت لأحد)</div>'+H;
 $('ccBody').innerHTML=H;}
$('p42').onclick=e=>{const t=e.target.closest('[data-cct]');if(t){CC.tab=t.dataset.cct;paintCC();return;}
 if(e.target.id==='ccRef'){netSend({t:'cc'});return;}if(e.target.id==='cancel42'){show('p42',0);return;}
 const b=e.target.closest('[data-cca]');if(!b)return;const a=b.dataset.cca,k=b.dataset.k;
 const cn=((b.closest('.ccc')||{}).querySelector?.('.ch b')||{}).textContent||'';const dur={60:'ساعة',1440:'يوم',0:'للأبد'}[b.dataset.m];
 const Q={ban:['حظر {n} من الكتابة '+dur,'ما يقدر يرسل رسائل طول المدة'],kick:['طرد {n} من اللعبة','ينقطع اتصاله الحين'],delh:['حذف بيت {n} نهائياً','ما ينرجع أبداً'+(CC.d&&!CC.d.adm?` — باقي لك ${CC.d.dl} حذف اليوم`:'')],apx:['رفض تظلّم {n}','يبقى محظور لين تخلص المدة'],jpx:['رفض اعتراض {n} على السجن','']}[a];
 (Q?sure(Q[0],cn.replace(/ 🏠$/,''),Q[1]):Promise.resolve(true)).then(y=>{if(!y)return;
 if(a==='ban')BANK.add(k);if(a==='unb')BANK.delete(k);b.disabled=true;netSend({t:'cca',a,k,mins:b.dataset.m!==undefined?+b.dataset.m:undefined});});};
$('chatlist').onclick=async e=>{const b=e.target.closest('[data-ak]');
 if(b){e.stopPropagation();banPick(b.dataset.ak,b.dataset.an||'');return;}
 const d=e.target.closest('[data-f]');if(d)openHist(d.dataset.f);};
$('chatTog').onclick=()=>{const m=document.body.classList.toggle('chatMin');$('chatTog').textContent=m?'▴':'▾';};
const NET_ERR={slow:'شوي شوي 🙂 استنى ثانية',gone:'الشخص طلع من المكان',bad:'الرسالة فيها كلام غير لائق 🚫',contact:'لحمايتكم: ممنوع الروابط والأرقام والحسابات 🔒',long:'الرسالة طويلة (80 حرف بالكثير)',empty:'اكتب رسالتك',guest:'الكتابة الحرة مقفولة 🔒 — اختر من الرسائل الجاهزة الكثيرة 💬',banned:'تم منعك من الكتابة بقرار المشرف 🚫'};
// اسم المشرف: «🛡️ مشرف» بالأحمر فوق الاسم
function modNameTex(name){return roleNameTex('🛡️ مشرف','#e01e1e',name);}
// سطر فوق الاسم (المشرف بالأحمر، الوظائف بألوانها): top = النص، col = اللون
function roleNameTex(top,col,name){const c=document.createElement('canvas');c.width=512;c.height=128;const x=c.getContext('2d');x.textAlign='center';x.textBaseline='middle';x.direction='rtl';x.lineJoin='round';
 const fit=(t,sz,maxW)=>{x.font=`900 ${sz}px Cairo, sans-serif`;const w=x.measureText(t).width;return w>maxW?sz*maxW/w:sz;};
 let s1=fit(top,46,480);x.font=`900 ${s1}px Cairo, sans-serif`;x.lineWidth=s1*.24;x.strokeStyle='#ffffff';x.strokeText(top,256,30);x.fillStyle=col;x.fillText(top,256,30);
 let s2=fit(name,58,490);x.font=`900 ${s2}px Cairo, sans-serif`;x.lineWidth=s2*.22;x.strokeStyle='#14100c';x.strokeText(name,256,90);x.fillStyle='#ffffff';x.fillText(name,256,90);
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;}
function peerLabel(me,blocked){const nm=(blocked?'':JB.namePrefix(me))+withTag(me.n,me.tag),role=!blocked&&!me.mod&&JB.label(me);return new THREE.SpriteMaterial({map:me.mod&&!blocked?modNameTex(nm):role?roleNameTex(role[0],role[1],nm):nameTex(nm,me.h||me.tag===7?'#ffd34d':'#ffffff',!!blocked),transparent:true,depthWrite:false});}
function newPeer(id,me,x,z,y,r){const w=makeWalker(me.c,CM,me.hat,me.back);w.root.rotation.order='YXZ';w.root.position.set(x,y,z);S.add(w.root);
 const lab=new THREE.Sprite(peerLabel(me,blockedFor(id,me.h)));lab.renderOrder=6;S.add(lab);
 const p={id,w,lab,n:me.n,c:me.c,h:me.h,hat:me.hat,back:me.back,tag:me.tag,mod:!!me.mod,j:me.j,f:me.f,x,z,y,r,tx:x,tz:z,ty:y,tr:r,mv:0,phase:0,amt:0,wave:0,bub:null,bubT:0};PEERS.set(id,p);return p;}
function peerMeta(p,me){if(p.c!==me.c||p.hat!==me.hat||p.back!==me.back)p.w.set(me.c,me.hat,me.back);if(p.n!==me.n||p.h!==me.h||p.tag!==me.tag||p.mod!==!!me.mod||p.j!==me.j||p.f!==me.f){p.lab.material.map.dispose();p.lab.material.dispose();p.lab.material=peerLabel(me,blockedFor(p.id,me.h));}p.n=me.n;p.c=me.c;p.h=me.h;p.hat=me.hat;p.back=me.back;p.tag=me.tag;p.mod=!!me.mod;p.j=me.j;p.f=me.f;}
function dropBubble(o){if(o.bub){S.remove(o.bub);o.bub.material.map.dispose();o.bub.material.dispose();o.bub=null;}}
function removePeer(id){const p=PEERS.get(id);if(!p)return;S.remove(p.w.root);if(p.car)S.remove(p.car);S.remove(p.lab);p.lab.material.map.dispose();p.lab.material.dispose();dropBubble(p);PEERS.delete(id);if(TALK===id)show('p7',0);}
function clearPeers(){for(const id of[...PEERS.keys()])removePeer(id);ONLINE_HOMES=new Set();NET.on=0;updCount();}
// فقاعة كلام فوق الراس
function makeBubble(txt){const f=56,LH=f*1.25,MAXW=620,c=document.createElement('canvas'),x=c.getContext('2d');x.font=`800 ${f}px Cairo, sans-serif`;
 // الرسائل الطويلة تنقسم على كذا سطر
 const lines=[];let cur='';for(const wd of txt.split(' ')){const t=cur?cur+' '+wd:wd;if(cur&&x.measureText(t).width>MAXW){lines.push(cur);cur=wd;}else cur=t;}if(cur)lines.push(cur);lines.length=Math.min(lines.length,7);
 const w=Math.ceil(Math.max(...lines.map(l=>Math.min(MAXW+80,x.measureText(l).width))))+64,h=lines.length*LH+44;c.width=w;c.height=h+20;
 x.fillStyle='#ffffff';x.strokeStyle='#14100c';x.lineWidth=5;x.beginPath();x.roundRect(3,3,w-6,h-6,Math.min(50,(h-6)/2));x.fill();x.stroke();
 x.beginPath();x.moveTo(w/2-14,h-5);x.lineTo(w/2,h+16);x.lineTo(w/2+14,h-5);x.closePath();x.fill();
 x.font=`800 ${f}px Cairo, sans-serif`;x.fillStyle='#1d2b36';x.textAlign='center';x.textBaseline='middle';x.direction='rtl';
 lines.forEach((l,i)=>x.fillText(l,w/2,22+LH*(i+.5)+2,MAXW+80));
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
 const s=new THREE.Sprite(new THREE.SpriteMaterial({map:t,transparent:true,depthWrite:false,depthTest:false}));s.renderOrder=8;s.visible=false;s.userData.a=c.width/c.height;s.userData.k=c.height/(f+64);S.add(s);return s;}   // مخفية لين أول تحديد مكانها فوق الراس (كانت تومض بمكان غلط لإطار واحد)
function setBubble(o,txt){dropBubble(o);o.bub=makeBubble(txt);o.bubT=5;}
function myBubble(txt){if(WK.on)setBubble(WK,txt);}
const waveArm=(w,t)=>{w.armR.rotation.x=-2.7;w.armR.rotation.z=.35+Math.sin(t*14)*.35;};
function bubbleAt(o,x,y,z,dt){if(!o.bub)return;o.bubT-=dt;if(o.bubT<=0)return dropBubble(o);const d=cam.position.distanceTo(o.bub.position),ds=Math.max(1,d/30);
 const H=.7*ds*o.bub.userData.k;o.bub.position.set(x,y+3.45+.4*(ds-1)+H/2,z);o.bub.scale.set(H*o.bub.userData.a,H,1);o.bub.material.opacity=Math.min(1,o.bubT*2);o.bub.visible=true;}
function peersFrame(dt,t){const k=Math.min(1,dt*10);
 for(const p of PEERS.values()){if((p.tx-p.x)**2+(p.tz-p.z)**2>400){p.x=p.tx;p.z=p.tz;}// انتقل فجأة (رجع لبيته): نقفز
  p.x+=(p.tx-p.x)*k;p.z+=(p.tz-p.z)*k;p.y+=(p.ty-p.y)*k;p.r=lerpAng(p.r,p.tr,k);
  p.amt+=((p.mv?(p.mv===2?1:.8):0)-p.amt)*Math.min(1,dt*8);if(p.mv)p.phase+=dt*(p.mv===2?13:9);
  p.w.pose(p.phase,p.amt,t);actPose(p.w,p.seat>0?5:p.mv,p.phase,t);if(p.wave>0){p.wave-=dt;waveArm(p.w,t);}
  p.w.root.position.set(p.x,p.y+p.w.bob,p.z);p.w.root.rotation.y=p.r;
  // راكب سيارة: السيارة زجاجها شفاف والناس يجلسون داخلها (سائق + ركاب)
  if(p.seat>0){if(p.car){S.remove(p.car);p.car=null;}const dc=p.drv===NET.id&&CAR.on&&CAR.car?CAR.car:null;seatPlace(p.w,p.v,p.seat,dc?dc.x:p.x,dc?dc.y:p.y,dc?dc.z:p.z,dc?dc.yaw:p.r);p.w.root.visible=true;}
  else if(p.v>=0){if(!p.car||p.carI!==p.v){if(p.car)S.remove(p.car);p.car=carMesh(p.v);p.carI=p.v;S.add(p.car);}p.car.position.set(p.x,p.y,p.z);p.car.rotation.set(0,p.r,0);seatPlace(p.w,p.v,0,p.x,p.y,p.z,p.r);p.w.root.visible=true;}
  else{if(p.car){S.remove(p.car);p.car=null;}p.w.root.scale.setScalar(1);p.w.root.visible=true;}
  const d=cam.position.distanceTo(p.w.root.position),ds=Math.max(1,d/40);p.lab.position.set(p.x,p.y+2.9+.5*(ds-1),p.z);p.lab.scale.set(3*ds,.75*ds,1);
  bubbleAt(p,p.x,p.y,p.z,dt);}
 if(WK.on){if(WK.wave>0){WK.wave-=dt;waveArm(WK.walker,t);}bubbleAt(WK,WK.p.x,WK.y,WK.p.z,dt);}}
// الضغط على شخص (أو على اسمه) يفتح الرسائل
function pickPeer(cx,cy){let best=null,bd=50*50,onB=false;for(const p of PEERS.values()){
 for(const hy of[1.2,2.9]){TV.set(p.x,p.y+hy,p.z).project(cam);if(TV.z>1)continue;const d=((TV.x+1)/2*innerWidth-cx)**2+((1-TV.y)/2*innerHeight-cy)**2;if(d<bd){bd=d;best=p;onB=false;}}
 if(p.bub){TV.copy(p.bub.position).project(cam);if(TV.z<=1){const d=((TV.x+1)/2*innerWidth-cx)**2+((1-TV.y)/2*innerHeight-cy)**2;if(d<80*80&&d<=bd){bd=d;best=p;onB=true;}}}}
 if(best)best.hitBub=onB;return best;}
let TALK=null;
// id = شخص معيّن (تنعلّم له «لك»)، أو null = للي حولك. بالحالتين يشوفها كل اللي قريبين
function openTalk(id){const p=id?PEERS.get(id):null;if(id&&!p){toast('الشخص طلع من المكان');return;}TALK=p?id:undefined;show('card',0);show('p8',0);
 $('p7t').textContent=p?`💬 رسالة لـ «${p.n}» (يشوفها اللي حولك)`:'💬 رسالة للي حولك';$('mute7').style.display=p?'':'none';$('mute7').textContent=p&&blockedFor(p.id,p.h)?'✅ فك الحظر':'🚫 حظر';$('rep7').style.display=p?'':'none';$('cq7').style.display=p?'':'none';$('ride7').style.display=p&&p.v>=0&&!p.seat&&!CAR.on&&!RIDE?'':'none';$('countries').style.display='none';$('says').style.display='grid';
 $('says').innerHTML=SAY_GROUPS.map(([t,ks])=>`<div class="gh">${t}</div>`+ks.map(k=>`<button type="button" data-k="${k}">${esc(k===SAY_NAME?`اسمي ${NET.name||'…'}`:SAYS[k])}</button>`).join('')).join('');$('p7top').style.display=p?'':'none';paintTyped();$('tp7').style.display=ADMIN_OK&&p?'':'none';if(ADMIN_OK&&p){paintTp();netSend({t:'tq',f:id});}paintMod();if((ADMIN_OK||MODF)&&p)netSend({t:'sq',f:id});JB.card(p?id:null);show('p7',1);}
function paintTyped(){$('typedLbl').style.display=$('typedRow').style.display=CANTYPE?'':'none';}
function paintMod(){const q=MQ[TALK]||{},p=TALK&&PEERS.get(TALK),on=!!p;const isM=ADMIN_OK||MODF;$('ma7').style.display=ADMIN_OK&&on?'':'none';$('ma7').textContent=q.mod?'🛡️ ألغِ إشرافه':'🛡️ حوّله مشرف';$('mrow7').style.display=isM&&on&&!(q.mod)?'':'none';$('mb7h').style.display=q.ban?'none':'';$('mb7d').style.display=q.ban?'none':'';$('mb7u').style.display=q.ban?'':'none';}
const talkN=()=>{const p=TALK&&PEERS.get(TALK);return p?p.n:'';};
$('ma7').onclick=()=>{if(!TALK)return;const q=MQ[TALK]||{},f=TALK;sure(q.mod?'إلغاء إشراف {n}':'تحويل {n} مشرف',talkN(),q.mod?'يرجع لاعب عادي':'يقدر يمنع الناس من الكتابة').then(y=>{if(y)netSend({t:'sa',f,on:!q.mod});});};
$('mb7h').onclick=()=>{if(!TALK)return;const f=TALK;sure('منع {n} من الكتابة ساعة',talkN()).then(y=>{if(y)netSend({t:'sb',f,on:true,mins:60});});};
$('mb7d').onclick=()=>{if(!TALK)return;const f=TALK;sure('منع {n} من الكتابة يوم',talkN()).then(y=>{if(y)netSend({t:'sb',f,on:true,mins:1440});});};
$('mb7u').onclick=()=>{if(TALK)netSend({t:'sb',f:TALK,on:false});};
function paintTp(){const on=TPON[TALK];$('tp7').textContent=on?'✅ الكتابة مفتوحة له — اضغط تقفلها':'✍️ افتح له الكتابة الحرة';}
$('tp7').onclick=()=>{if(!TALK)return;netSend({t:'tp',f:TALK,on:!TPON[TALK]});};
$('says').onclick=e=>{const b=e.target.closest('[data-k]');if(!b)return;const k=+b.dataset.k;
 if(k===SAY_COUNTRY){const c=$('countries');c.innerHTML=COUNTRIES.map((n,i)=>`<button type="button" data-a="${i}">${esc(n)}</button>`).join('');c.style.display='grid';$('says').style.display='none';return;}
 netSend({t:'say',to:TALK,k});show('p7',0);};
$('countries').onclick=e=>{const b=e.target.closest('[data-a]');if(!b)return;netSend({t:'say',to:TALK,k:SAY_COUNTRY,a:+b.dataset.a});show('p7',0);};
$('cancel7').onclick=()=>show('p7',0);
$('ride7').onclick=()=>{const p=PEERS.get(TALK);show('p7',0);if(!p){toast('الشخص طلع من المكان');return;}netSend({t:'ride',to:p.id});};
// رسالة مكتوبة (السيرفر يفلترها قبل ما توصل)
function sendTyped(){if(!CANTYPE){toast(NET_ERR.guest);return;}const x=$('say7').value.trim();if(!x){toast('اكتب رسالتك');return;}if(x.length>80){toast(NET_ERR.long);return;}netSend({t:'say',to:TALK,x});}
$('send7').onclick=sendTyped;$('say7').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();sendTyped();}});
// ===== حظر لاعب =====
let BLOCKED;try{BLOCKED=new Set(JSON.parse(localStorage.getItem('mnalsifr_blocked')||'[]'));}catch{BLOCKED=new Set();}
const saveBlocked=(quiet)=>{try{localStorage.setItem('mnalsifr_blocked',JSON.stringify([...BLOCKED].slice(-300)));}catch{}if(!quiet&&typeof gSyncSoon==='function')gSyncSoon();};
const blockedFor=(id,home)=>MUTED.has(id)||!!(home&&BLOCKED.has(home));
const idBlocked=id=>{const p=PEERS.get(id);if(p)return blockedFor(p.id,p.h);if(MUTED.has(id))return true;const me=META.get(id);return !!(me&&me.h&&BLOCKED.has(me.h));};
function relabelPeer(q){q.lab.material.map.dispose();q.lab.material.dispose();q.lab.material=peerLabel({n:q.n,tag:q.tag,h:q.h},blockedFor(q.id,q.h));}
// id = لاعب بالجلسة، home = رقم بيته (لو عنده بيت الحظر يثبت حتى لو رجع بجلسة ثانية)
function setBlocked(id,home,on){if(id){on?MUTED.add(id):MUTED.delete(id);}if(home){on?BLOCKED.add(home):BLOCKED.delete(home);saveBlocked();}
 for(const q of PEERS.values())if((id&&q.id===id)||(home&&q.h===home)){if(!on)MUTED.delete(q.id);else dropBubble(q);relabelPeer(q);}
 if(home){dropLabel(home);updLabels();}}
$('mute7').onclick=async()=>{let p=PEERS.get(TALK);if(!p){show('p7',0);return;}const was=blockedFor(p.id,p.h);if(!was&&!await sure('حظر {n}',p.n,'ما تشوف رسائله ولا يوصلك منه شي'))return;p=PEERS.get(TALK)||p;setBlocked(p.id,p.h,!was);show('p7',0);
 toast(was?`✅ فكّينا الحظر عن «${p.n}»`:`🚫 حظرت «${p.n}» — ما توصلك رسايله${p.h?'':' (لهالجلسة بس، لأنه ما عنده بيت)'}`);};
// رسالة وصلتني: فقاعة فوق المرسل + بطاقة فيها «رد»
function gotMsg(m){if(idBlocked(m.f)){chatAdd({n:m.n,x:'xxxxx',ak:m.ak});return;}const txt=m.x!==undefined?String(m.x):sayText(m.k,m.a,m.n),p=PEERS.get(m.f);
 if(m.far){chatAdd({f:m.f,n:'📡 '+m.n+' • '+(m.w||''),x:txt,ak:m.ak,far:1});return;}// 📡 رسالة من بعيد (صاحب المدينة يشوف رسائل الكل): بالدردشة بس
 pushHist(m.f,m.n,txt);AU.pop();if(p){setBubble(p,txt);if(WAVE.has(m.k))p.wave=1.6;}
 chatAdd({f:m.f,n:m.n+(m.to===NET.id?' ← لك':''),x:txt,ak:m.ak});}
// قائمة الناس اللي حولي
$('wPeople').onclick=()=>{const me=WK.on?WK.p:ctl.target;const list=[...PEERS.values()].map(p=>({p,d:Math.hypot(p.x-me.x,p.z-me.z)})).sort((a,b)=>a.d-b.d);
 if(!list.length){toast('ما فيه أحد قريب منك الحين');return;}
 $('ppl').innerHTML=list.map(({p,d})=>`<div data-id="${esc(p.id)}"><span>${p.tag===7?'👑 ':p.h?'🏠 ':''}${esc(p.n)}${blockedFor(p.id,p.h)?' <small style="color:#ff3b30">محظور</small>':''}</span><b>${Math.round(d)} م</b></div>`).join('');show('card',0);show('p8',1);};
$('ppl').onclick=e=>{const d=e.target.closest('[data-id]');if(d)openTalk(d.dataset.id);};
$('cancel8').onclick=()=>show('p8',0);
$('wChat').onclick=()=>openTalk(null);

// ================= حياة المدينة: سيارات تمشي، ناس بالشوارع، زوّار آليين بالساحة، طيور وغيوم =================
// كلها ديكور عندك أنت بس (ما تنرسل للسيرفر) — الزوّار الآليين عليهم 🤖 وإذا ضغطت عليهم يقولك إنهم آليين
const LIFE={cars:[],peds:[],bots:[],built:false,birds:null,clouds:null};
const NCARS=LOW?3:MID?6:10,NPEDS=LOW?2:MID?4:6,NBOTS=LOW?3:6;
const BOTNAMES=['سلطان','نورة','ريم','فهد','لولوة','عبدالله','مها','خالد','سارة','ماجد','هند','ياسر'];
const rnd=(a,b)=>a+Math.random()*(b-a);
const focus=()=>WK.on?WK.p:ctl.target;
function newTraffic(c){c.axis=Math.random()<.5?0:1;c.dir=Math.random()<.5?1:-1;const R=Math.max(1,CITY.maxR);c.line=Math.floor(rnd(-R,R));c.pos=rnd(-1,1)*(R+.5)*STEP;c.sp=rnd(9,13);c.cur=c.sp;c.ln=Math.floor(Math.random()*3);}
const PL=BLK/2+.6;
function perim(sv){const L=PL,P8=8*L;sv=((sv%P8)+P8)%P8;const side=Math.floor(sv/(2*L)),u=sv-side*2*L-L;return side===0?[u,-L,Math.PI/2]:side===1?[L,u,0]:side===2?[-u,L,-Math.PI/2]:[-L,-u,Math.PI];}
function newPed(p){const nb=Math.max(1,CITY.nb),f=focus();let bi=0;for(let k=0;k<10;k++){bi=Math.floor(Math.random()*(nb+1));const[bx,bz]=sp(bi);if(Math.hypot(bx*STEP-f.x,bz*STEP-f.z)<130)break;}
 const[bx,bz]=sp(bi);p.cx=bx*STEP;p.cz=bz*STEP;p.s=rnd(0,8*PL);p.sp=rnd(2,3);p.dir=Math.random()<.5?1:-1;}
function pickBotTarget(b){b.t=0;const h=PLAZA.h;for(let k=0;k<14;k++){const x=PLAZA.x+rnd(-(h-26),h-26),z=PLAZA.z+rnd(-h+14,30);if(Math.hypot(x-PLAZA.x,z-PLAZA.z)>24){b.tx=x;b.tz=z;return;}}b.tx=PLAZA.x+50;b.tz=PLAZA.z-40;}
function newBot(i){const ch=Math.floor(rnd(0,CH_COUNT)),hat=Math.random()<.5?Math.floor(rnd(1,HATS.length)):0,back=Math.random()<.3?Math.floor(rnd(1,BACKS.length)):0;
 const w=makeWalker(ch,CM,hat,back);S.add(w.root);const lab=new THREE.Sprite(new THREE.SpriteMaterial({map:textTex('🤖 '+BOTNAMES[i%BOTNAMES.length],512,128,null,'#cfe9ff',76),transparent:true,depthWrite:false}));lab.renderOrder=6;S.add(lab);
 const b={w,lab,x:PLAZA.x+rnd(-60,60),z:PLAZA.z-PLAZA.h+rnd(20,60),r:0,tx:0,tz:0,wait:rnd(0,3),ph:0,amt:0,t:0,sayT:0,bub:null,bubT:0,wave:0};pickBotTarget(b);LIFE.bots.push(b);}
function buildLife(){if(LIFE.built)return;LIFE.built=true;
 for(let i=0;i<NCARS;i++){const c={g:carMesh([2,4,6,0,1,3,5,7][i%8]),cur:0};c.g.visible=false;S.add(c.g);newTraffic(c);LIFE.cars.push(c);}
 for(let i=0;i<NPEDS;i++){const ch=Math.floor(rnd(0,CH_COUNT)),w=makeWalker(ch,CM,Math.random()<.4?Math.floor(rnd(1,HATS.length)):0,Math.random()<.3?Math.floor(rnd(1,BACKS.length)):0);w.root.visible=false;S.add(w.root);const p={w,ph:rnd(0,6),r:0};newPed(p);LIFE.peds.push(p);}
 {const N=LOW?6:14,m=new THREE.InstancedMesh(GEO.flat,new THREE.MeshBasicMaterial({color:'#f2f2f2'}),N*2);m.frustumCulled=false;S.add(m);
  LIFE.birds={m,b:Array.from({length:N},(_,i)=>{const pl=i%2===0;return{plaza:pl,r:pl?rnd(30,80):rnd(70,160),h:pl?rnd(26,46):rnd(95,150),a:rnd(0,6.28),sp:rnd(.18,.34)*(Math.random()<.5?1:-1)*(pl?1:.5),ph:rnd(0,6)};})};}
 {const N=LOW?6:12,m=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.5,1),new THREE.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.92,fog:false,depthWrite:false}),N*3);m.frustumCulled=false;m.renderOrder=-1;S.add(m);
  LIFE.clouds={m,c:Array.from({length:N},()=>({x:rnd(-900,900),z:rnd(-500,900),y:rnd(200,300),s:rnd(.8,1.6),sp:rnd(2,5)}))};}}
function lifeCars(dt){const f=focus(),E=(CITY.maxR+.5)*STEP,T=[];if(CAR.on&&CAR.car)T.push(CAR.car);else if(WK.on)T.push({x:WK.p.x,z:WK.p.z});
 for(const c of LIFE.cars){const lane=c.dir*(RD/12+RD/6*(c.ln|0)),th=c.axis===0?(c.dir>0?Math.PI/2:-Math.PI/2):(c.dir>0?0:Math.PI);
  const x=c.axis===0?c.pos:(c.line+.5)*STEP+lane,z=c.axis===0?(c.line+.5)*STEP+lane:c.pos,fx=Math.sin(th),fz=Math.cos(th);let blocked=false;
  for(const p of T){const dx=p.x-x,dz=p.z-z,fw=dx*fx+dz*fz,lat=Math.abs(dx*fz-dz*fx);if(fw>0&&fw<14&&lat<3.4)blocked=true;}// يوقف قدّام الناس
  c.cur+=((blocked?0:c.sp)-c.cur)*Math.min(1,dt*(blocked?5:1.5));c.pos+=c.dir*c.cur*dt;
  if(Math.abs(c.pos)>E){newTraffic(c);c.pos=-c.dir*E;}
  c.g.position.set(x,.07,z);c.g.rotation.y=th;c.g.visible=Math.hypot(x-f.x,z-f.z)<240;}}
function lifePeds(dt,t){const f=focus(),near=WK.on||cam.position.distanceTo(ctl.target)<160;
 for(const p of LIFE.peds){p.s+=p.dir*p.sp*dt;const[lx,lz,th0]=perim(p.s),x=p.cx+lx,z=p.cz+lz,th=th0+(p.dir<0?Math.PI:0);
  if(Math.hypot(x-f.x,z-f.z)>200)newPed(p);
  p.r=lerpAng(p.r,th,Math.min(1,dt*8));p.ph+=dt*8;p.w.pose(p.ph,1,t);p.w.root.position.set(x,.4+p.w.bob,z);p.w.root.rotation.y=p.r;p.w.root.visible=near&&Math.hypot(x-f.x,z-f.z)<170;}}
function botsFrame(dt,t){const active=(WK.on&&inPlaza(WK.p.x,WK.p.z,90))||(!WK.on&&Math.hypot(ctl.target.x-PLAZA.x,ctl.target.z-PLAZA.z)<140);
 const real=[...PEERS.values()].filter(p=>inPlaza(p.x,p.z)).length,want=active?Math.max(0,NBOTS-real):0;
 while(LIFE.bots.length<want)newBot(LIFE.bots.length);
 LIFE.bots.forEach((b,i)=>{const on=i<want;b.w.root.visible=b.lab.visible=on;if(!on){if(b.bub)dropBubble(b);return;}
  if(!inPlaza(b.x,b.z,4)){b.x=PLAZA.x+rnd(-40,40);b.z=PLAZA.z-PLAZA.h+30;pickBotTarget(b);}
  let moving=false;
  if(b.wait>0)b.wait-=dt;else{const dx=b.tx-b.x,dz=b.tz-b.z,d=Math.hypot(dx,dz);b.t+=dt;
   if(d<1.2||b.t>14){b.wait=rnd(2,7);pickBotTarget(b);}
   else{b.x+=dx/d*2.8*dt;b.z+=dz/d*2.8*dt;b.r=lerpAng(b.r,Math.atan2(dx,dz),Math.min(1,dt*6));moving=true;const q={x:b.x,z:b.z};collide(q,.3,.6);hitCars(q,.6,null);b.x=q.x;b.z=q.z;}}
  b.amt+=((moving?.8:0)-b.amt)*Math.min(1,dt*8);if(moving)b.ph+=dt*9;b.w.pose(b.ph,b.amt,t);b.w.root.position.set(b.x,.3+b.w.bob,b.z);b.w.root.rotation.y=b.r;
  if(WK.on&&t>b.sayT&&Math.hypot(WK.p.x-b.x,WK.p.z-b.z)<9){b.sayT=t+30;setBubble(b,['مرحبا 👋','هلا والله 😄','السلام عليكم'][Math.floor(Math.random()*3)]);b.wave=1.6;b.r=Math.atan2(WK.p.x-b.x,WK.p.z-b.z);}// يسلّم عليك لما تقرب
  if(b.wave>0){b.wave-=dt;waveArm(b.w,t);}
  const d=cam.position.distanceTo(b.w.root.position),ds=Math.max(1,d/40);b.lab.position.set(b.x,.3+2.9+.5*(ds-1),b.z);b.lab.scale.set(3*ds,.75*ds,1);bubbleAt(b,b.x,.3,b.z,dt);});}
function birdsFrame(dt,t){const B=LIFE.birds;if(!B)return;let i=0;
 for(const b of B.b){b.a+=b.sp*dt;const cx=b.plaza?PLAZA.x:0,cz=b.plaza?PLAZA.z:0,x=cx+Math.cos(b.a)*b.r,z=cz+Math.sin(b.a)*b.r,y=b.h+Math.sin(t*.7+b.ph)*3,sg=b.sp>0?1:-1,th=Math.atan2(-Math.sin(b.a)*sg,Math.cos(b.a)*sg),fl=Math.sin(t*9+b.ph)*.7;
  for(const side of[-1,1]){dummy.position.set(x+side*.9*Math.cos(th),y,z-side*.9*Math.sin(th));dummy.rotation.set(0,th,side*fl);dummy.scale.set(1.6,.08,.7);dummy.updateMatrix();B.m.setMatrixAt(i++,dummy.matrix);}}
 B.m.instanceMatrix.needsUpdate=true;}
function cloudsFrame(dt){const C=LIFE.clouds;if(!C)return;C.m.visible=WK.on;if(!WK.on)return;let i=0;
 for(const c of C.c){c.x+=c.sp*dt;if(c.x>1000)c.x=-1000;
  for(const[ox,oy,oz,sx,sy,sz]of[[0,0,0,90,26,50],[45,-4,12,60,20,40],[-45,-5,-10,64,20,38]]){dummy.position.set(c.x+ox*c.s,c.y+oy,c.z+oz*c.s);dummy.rotation.set(0,0,0);dummy.scale.set(sx*c.s,sy*c.s,sz*c.s);dummy.updateMatrix();C.m.setMatrixAt(i++,dummy.matrix);}}
 C.m.instanceMatrix.needsUpdate=true;}
function lifeFrame(dt,t){if(!LIFE.built)return;lifeCars(dt);lifePeds(dt,t);botsFrame(dt,t);birdsFrame(dt,t);cloudsFrame(dt);}
function pickBot(cx,cy){let best=null,bd=46*46;for(const b of[...LIFE.bots,...LIFE.peds]){if(!b.w.root.visible)continue;const r=b.w.root.position;
 for(const hy of[1.2,2.6]){TV.set(r.x,r.y+hy,r.z).project(cam);if(TV.z>1)continue;const d=((TV.x+1)/2*innerWidth-cx)**2+((1-TV.y)/2*innerHeight-cy)**2;if(d<bd){bd=d;best=b;}}}return best;}
const plazaCount=()=>(WK.on&&inPlaza(WK.p.x,WK.p.z)?1:0)+[...PEERS.values()].filter(p=>inPlaza(p.x,p.z)).length;

// ================= السباحة + الرقص والجلوس + الركوب مع غيرك + الحيّ (حلبة/مول/بحيرة) =================
const SW={on:false,t:30,lastW:0,stroke:0};
let RIDE=null;// راكب مع سائق: {id:رقم السائق، s:رقم المقعد}
// بالبحيرة: عندك 30 ثانية ثم تغرق وترجع للساحة؛ أول ما تطلع من الماء (أو للجزيرة) يتجدد الوقت
function swimTick(dt,deep,moving){if(deep&&!SW.on){SW.on=true;SW.t=30;SW.lastW=99;D.splashAt(WK.p.x,WK.p.z,1.3,true);toast('🏊 نزلت البحيرة — عندك 30 ثانية قبل ما تغرق!');}
 else if(!deep&&SW.on){SW.on=false;D.swimHud(null);D.splashAt(WK.p.x,WK.p.z,.6,true);toast('طلعت من الماء 👍');}
 if(!SW.on)return;SW.t-=dt;D.swimHud(Math.max(0,SW.t));SW.stroke-=dt;if(moving&&SW.stroke<=0){SW.stroke=.6;AU.stroke();}
 if(SW.t<10){const c=Math.ceil(SW.t);if(c!==SW.lastW){SW.lastW=c;AU.warn();}}
 if(SW.t<=0){SW.on=false;D.swimHud(null);AU.drown();toast('😵 غرقت! رجعناك للساحة');placeAtSpawn('plaza');}}
// وضعيات الجسم: 3 سباحة، 4 رقص، 5 جلوس (HIP=.95 فنخفض الجسم .82 عشان يقعد)
function actPose(w,mv,ph,t){w.root.rotation.x=0;w.root.rotation.z=0;
 if(mv===3){w.armL.rotation.x=-2.5+Math.sin(ph*.9);w.armR.rotation.x=-2.5-Math.sin(ph*.9);w.legL.rotation.x=Math.sin(ph*1.7)*.4;w.legR.rotation.x=-Math.sin(ph*1.7)*.4;w.bob=Math.sin(t*3)*.05;w.root.rotation.x=.45;}
 else if(mv===4){const s=Math.sin(ph),c=Math.cos(ph);w.armL.rotation.x=-2.8+s*.5;w.armR.rotation.x=-2.8-s*.5;w.armL.rotation.z=-.45;w.armR.rotation.z=.45;w.legL.rotation.x=s*.55;w.legR.rotation.x=-s*.55;w.bob=Math.abs(c)*.22;w.root.rotation.z=Math.sin(ph*.5)*.14;}
 else if(mv===6){w.root.rotation.x=-1.5;w.armL.rotation.x=w.armR.rotation.x=0;w.legL.rotation.x=w.legR.rotation.x=0;w.bob=.35;}
 else if(mv===5){w.legL.rotation.x=w.legR.rotation.x=-1.5;w.armL.rotation.x=w.armR.rotation.x=-.9;w.bob=-.82;}}
// مقاعد داخل السيارة [x,y,z,مقياس] (0 سائق، 1-3 ركاب): الشخصية تصغر شوي عشان تبان من الزجاج (السيارة الرياضية وراسه يطلع فوق السقف، والهايلكس الركاب ورا بالصندوق)
const mkSeats=(y,zf,zr,sc,yr=y,sx=.5)=>[[sx,y,zf,sc],[-sx,y,zf,sc],[sx,yr,zr,sc],[-sx,yr,zr,sc]];
const CABIN=[mkSeats(.5,.6,-1,.75),mkSeats(.45,1.2,-1.5,.75,.8),mkSeats(.15,.35,-.95,.75),mkSeats(-.05,.2,-1.8,.65,.5),mkSeats(.15,.35,-.95,.75),mkSeats(.5,.6,-1,.75),mkSeats(.15,.35,-.95,.75),mkSeats(-.05,.2,-1.8,.65,.5)];
function seatPlace(w,i,seat,x,y,z,yaw){const q=(CABIN[i]||CABIN[2])[seat&3],c=Math.cos(yaw),sn=Math.sin(yaw);actPose(w,5,0,0);w.bob=0;w.root.scale.setScalar(q[3]);w.root.position.set(x+q[0]*c+q[2]*sn,y+q[1],z-q[0]*sn+q[2]*c);w.root.rotation.y=yaw;}
// راكب لعبة بمدينة الألعاب: مكاني = المقعد (يتحرك مع اللعبة)، جالس، والشخصية مخفية عندي (رؤية الشخص الأول)
function fairRide(){const W=WK,s=FAIR.seatPose();if(!s)return;W.p.set(s.x,0,s.z);W.y=s.y-.13;W.jy=0;W.yaw=s.yaw;W.mv=5;W.emote=0;W.amt=0;}
function rideFrame(dt,t){const W=WK,p=PEERS.get(RIDE.id);if(!p||p.v<0){endRide(true);return;}
 W.p.set(p.x,0,p.z);W.y=p.y;W.yaw=p.r;W.mv=0;seatPlace(W.walker,p.v,RIDE.s,p.x,p.y,p.z,p.r);
 if(t-W.lastDrag>1.2)W.camYaw=lerpAng(W.camYaw,p.r+Math.PI,Math.min(1,dt*3.5));}
function onRide(m){if(m.end){if(RIDE)endRide(true);return;}
 if(!m.ok){toast({no:'ما تقدر تركب مع هذا الشخص',far:'قرّب من السيارة أول 🚗',full:'السيارة ممتلئة (3 ركاب كحد أقصى)',car:'انزل من سيارتك أول'}[m.e]||'تعذّر الركوب');return;}
 if(!WK.on)return;if(CAR.on)leaveCar();WK.emote=0;RIDE={id:m.d,s:m.s};WK.dist=14;WK.cur=14;WK.walker.root.visible=true;toast('🚗 ركبت مع السائق — اضغط 🚪 عشان تنزل');updCarBtn();}
function endRide(fromSrv){const p=RIDE&&PEERS.get(RIDE.id);RIDE=null;WK.walker.root.scale.setScalar(1);WK.dist=CAMD;WK.cur=CAMD;WK.walker.root.rotation.x=0;
 if(p){const sx=Math.cos(p.r),sz=-Math.sin(p.r);WK.p.set(p.x+sx*3,0,p.z+sz*3);collide(WK.p,p.y);WK.y=groundAt(WK.p.x,WK.p.z);}
 if(!fromSrv)netSend({t:'ride',to:null});updCarBtn();}
// ينزّل سيارتك قدّامك وتركب فيها (للتنقل)
// ===== سيارات الحوش المحفوظة (3 مواقف ورا بعض بحوش كل بيت، تنحفظ بالسيرفر ويشوفها الكل) =====
const YSLOT=[7,0,-7],YN=YSLOT.length;
const yardPose=(hh,s)=>{const[px,pz]=plotPos(hh.plot),F=faceOf(hh.plot);return{x:px+yardSide(hh.plot)*YQ,z:pz+YSLOT[s]*F,yaw:F<0?Math.PI:0};};
// السيارة داخل الحوش أو قدّام بوابته
const nearYard=(hh,x,z)=>{const[px,pz]=plotPos(hh.plot),F=faceOf(hh.plot),gx=px+yardSide(hh.plot)*YQ;return(Math.abs(x-gx)<5&&Math.abs(z-pz)<13)||Math.hypot(x-gx,z-(pz+F*(FH+4)))<9||(Math.abs(x-px)<12&&Math.abs(z-pz)<12);};
const YC=new Map();let PARKACT=null;
function syncYard(){const me=WK.on?WK.p:ctl.target,keep=new Set();for(const hh of HOUSES){if(!hh.pk||!hh.pk.length)continue;const[px,pz]=plotPos(hh.plot);if(Math.hypot(px-me.x,pz-me.z)>200)continue;for(const[m,s]of hh.pk){if(s<0||s>=YN||m<0||m>=CAR_N)continue;const k=hh.id+':'+s;keep.add(k);let c=YC.get(k);if(!c||c.m!==m){if(c)S.remove(c.g);const g=carMesh(m);S.add(g);c={g,m};YC.set(k,c);}const q=yardPose(hh,s);c.g.position.set(q.x,.3,q.z);c.g.rotation.set(0,q.yaw,0);}}for(const[k,c]of[...YC])if(!keep.has(k)){S.remove(c.g);YC.delete(k);}}
setInterval(syncYard,1500);
function updParkBtn(){const b=$('parkBtn');if(!b)return;let show=false,txt='';PARKACT=null;const hh=myHouse();
 if(hh&&WK.on&&!WK.intro&&!RIDE&&!FAIR.on&&!VOXW.fp&&!IN.on){const[px,pz]=plotPos(hh.plot);
  if(CAR.on&&CAR.car&&nearYard(hh,CAR.car.x,CAR.car.z)){show=true;txt='🅿️ ركن السيارة بالحوش';PARKACT={t:'park'};}
  else if(!CAR.on){for(const[m,s]of hh.pk||[]){const q=yardPose(hh,s);if(Math.hypot(q.x-WK.p.x,q.z-WK.p.z)<5.5){show=true;txt='🚗 اطلع بسيارتك';PARKACT={t:'take',m,s};break;}}}}
 if(show!==b._s||txt!==b._t){b._s=show;b._t=txt;b.style.display=show?'block':'none';b.textContent=txt;}}
if($('parkBtn'))$('parkBtn').onclick=()=>{const hh=myHouse(),A=PARKACT;if(!hh||!A)return;hh.pk=hh.pk||[];
 if(A.t==='park'){const c=CAR.car;if(!c)return;let best=-1,bd=1e9;for(let s=0;s<YN;s++){if(hh.pk.some(p=>p[1]===s&&p[0]!==c.i))continue;const q=yardPose(hh,s),d=Math.hypot(q.x-c.x,q.z-c.z);if(d<bd){bd=d;best=s;}}if(best<0){toast('الحوش ممتلئ (3 سيارات) — طلّع وحدة أول');return;}
  hh.pk=hh.pk.filter(p=>p[0]!==c.i&&p[1]!==best);hh.pk.push([c.i,best]);netSend({t:'pk',m:c.i,s:best});leaveCar();resetCars();syncYard();toast('🅿️ ركنت سيارتك بالحوش — تنحفظ وتبقى مكانها');}
 else{const c=PARKED[A.m];if(!c)return;hh.pk=hh.pk.filter(p=>p[1]!==A.s);netSend({t:'pu',s:A.s});const q=yardPose(hh,A.s);c.x=q.x;c.z=q.z;c.yaw=q.yaw;c.y=.3;c.vy=0;c.air=false;c.pitch=0;c.g.position.set(q.x,.3,q.z);c.g.rotation.set(0,q.yaw,0);syncYard();enterCar(c);AU.door();}};
window.__yard={yardPose,houseXZ,nearYard,plotPos,YC,syncYard,updParkBtn,get HOUSES(){return HOUSES;},get PARKED(){return PARKED;},get myId(){return MYID;},get act(){return PARKACT;}};
function dropCar(i){if(!WK.on||WK.intro||RIDE||SW.on)return;if(!myCar().o.includes(i))return;if(JB.noCar())return;if(CAR.on)leaveCar();WK.emote=0;const c=PARKED[i];if(!c)return;
 const fx=Math.sin(WK.yaw),fz=Math.cos(WK.yaw),q={x:WK.p.x+fx*5,z:WK.p.z+fz*5};collide(q,WK.y,1.3);hitCars(q,1.3,c);
 c.x=q.x;c.z=q.z;c.yaw=WK.yaw;c.y=groundAt(c.x,c.z);c.vy=0;c.air=false;c.pitch=0;c.g.position.set(c.x,c.y,c.z);c.g.rotation.set(0,c.yaw,0);enterCar(c);AU.door();}
function renderCarList(){const mc=myCar(),en=mc.en|0,coins=ECO?ECO.c:0,kmh=i=>Math.round(CAR_ST[i][1]*(1+.06*en)*3.6);
 let x=`<div style="text-align:center;margin:4px 0 8px"><b style="font-size:18px">${esc(CARS[mc.s].n)}</b> ${carStars(mc.s)}<br><small>🔧 محرك مستوى ${en+1}/5 • ${kmh(mc.s)} كم/س • رصيدك ${coins} 🪙</small></div>`;
 x+=`<button type="button" data-go="1" style="width:100%;background:#ff7414;color:#fff;font-weight:800;margin-bottom:6px">🚗 نزّل سيارتي قدّامي</button>`;
 x+=en<CAR_EN_COST.length?`<button type="button" data-up="1" style="width:100%;margin-bottom:8px">🔧 طوّر المحرك (+سرعة) — ${CAR_EN_COST[en]} 🪙</button>`:'<div class="info" style="text-align:center">🔧 محركك على آخر مستوى</div>';
 x+='<div class="lbl" style="margin-top:6px">🏪 معرض السيارات</div><div class="says">'+CARS.map((c,i)=>{const own=mc.o.includes(i),cur=mc.s===i;return `<button type="button" data-i="${i}" style="${cur?'outline:3px solid #ff7414':''}">${esc(c.n)}<br><small>${carStars(i)} • ${Math.round(CAR_ST[i][1]*3.6)} كم/س<br>${cur?'✅ سيارتك':own?'تملكها — اختر':CAR_PRICE[i]+' 🪙'}</small></button>`;}).join('')+'</div>';
 $('carList').innerHTML=x;}
$('wCar').onclick=()=>{if(!WK.on||WK.intro)return;if(RIDE){endRide();return;}if(CAR.on){leaveCar();return;}show('card',0);renderCarList();show('p15',1);};
$('carList').onclick=e=>{const mc=myCar();if(e.target.closest('[data-go]')){show('p15',0);dropCar(mc.s);return;}if(e.target.closest('[data-up]')){netSend({t:'cup'});AU.click();return;}
 const b=e.target.closest('[data-i]');if(!b)return;const i=+b.dataset.i;if(mc.o.includes(i)){if(i!==mc.s)netSend({t:'csel',i});return;}
 if((ECO?ECO.c:0)<CAR_PRICE[i]){toast(`ما يكفي: تحتاج ${CAR_PRICE[i]} 🪙`);return;}if(confirm(`تشتري ${CARS[i].n} بـ${CAR_PRICE[i]} 🪙؟`))netSend({t:'cbuy',i});};
$('cancel15').onclick=()=>show('p15',0);
const emote=k=>{if(!WK.on||WK.intro||CAR.on||RIDE||SW.on)return;WK.emote=WK.emote===k?0:k;if(WK.emote)AU.click();};
// أيقونة واحدة 🕺: تفتح اختيار (رقص / جلوس / وقوف)
$('wEmote').onclick=()=>{if(!WK.on||WK.intro||CAR.on||RIDE||SW.on)return;show('card',0);show('p17',1);};
$('emDance').onclick=()=>{show('p17',0);WK.emote=4;};$('emSit').onclick=()=>{show('p17',0);WK.emote=5;};$('emStop').onclick=()=>{show('p17',0);WK.emote=0;};$('cancel17').onclick=()=>show('p17',0);
// ناس ثابتين بـ InstancedMesh (لكل شخصية سحبتين بس) — للمول والمدرّج
function peopleLayer(key,list,parent){const by=new Map();for(const p of list){if(!by.has(p.ch))by.set(p.ch,[]);by.get(p.ch).push(p);}const out=[];
 for(const[ch,arr]of by){const g=charGeo(ch).npc;for(const mat of[CM.body,CM.line]){const m=new THREE.InstancedMesh(g,mat,arr.length);arr.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(0,p.ry||0,0);dummy.scale.set(1,1,1);dummy.updateMatrix();m.setMatrixAt(i,dummy.matrix);});parent.add(m);out.push(m);}}return out;}
function placeAt(x,z,yaw){SW.on=false;D.swimHud(null);WK.emote=0;if(FAIR.on)FAIR.leave(null,true);if(RIDE)endRide();if(CAR.on)leaveCar();WK.p.set(x,0,z);WK.y=groundAt(x,z);WK.yaw=yaw;WK.camYaw=yaw+Math.PI;WK.pitch=CAMP;WK.dist=CAMD;WK.cur=WK.dist;WK.jy=0;WK.vy=0;}
const D=createDistrict({STEP,S,GEO,setLayer,toon,textTex,AU,LOW,MID,WK,CAR,PARKED,CM,makeWalker,peopleLayer,collide,toast,focus,netSend,enterCar,
 plaza:()=>PLAZA,addSolid:addSolidBox,resolids:()=>rebuildSolids(),myId:()=>NET.id,stopSwim:()=>{SW.on=false;D.swimHud(null);}});

const FAIR=createFair({AU,toast,WK,S,textTex,toon,plaza:()=>PLAZA,PEERS,cam,placeAt:(x,z,yaw)=>placeAt(x,z,yaw),canBoard:()=>WK.on&&!WK.intro&&!CAR.on&&!RIDE&&!IN.on&&!SW.on&&!window.__gameOpen&&!JB.jailed()});window.__fair=FAIR;
JB=createJobs({S,toast,WK,CAR,PEERS,META,plaza:()=>PLAZA,placeAt:(x,z,y)=>placeAt(x,z,y),netSend:o=>netSend(o),show,textTex,toon,AU,esc,updCount:()=>updCount(),syncWalker:()=>syncWalker(),makeWalker,CM,groundAt:(x,z)=>groundAt(x,z),serverNow:()=>Date.now()+FAIR.off,myId:()=>NET.id,leaveCar:()=>leaveCar(),mkList:()=>MK,mkThumb:it=>mkThumb(it),
 leaveAll:()=>{if(VOXW.fp)VOXW.leave();if(IN.on)leaveHouse();GM.close(true);if(FAIR.on)FAIR.leave(null,true);if(RIDE)endRide();if(CAR.on)leaveCar();WK.emote=0;['p7','p9','p21','p30','p18','p15','p40'].forEach(x=>{try{show(x,0);}catch{}});},ensureWalk:()=>{if(!WK.on)enterWalk(false);}});window.__jobs=JB;
const VOXW=createVoxWorld({inside:()=>IN.on,textTex,askCompanion:w=>openCq(null,w),S,cam,WK,toast,AU,netSend,plaza:()=>PLAZA,PEERS,LOW,MID,R,myId:()=>NET.id,blocked:()=>CAR.on||!!RIDE||FAIR.on||IN.on||SW.on||!!window.__gameOpen,clock:()=>Date.now()+FAIR.off,respawn:()=>{const p=PLAZA;placeAt(p.x+WX0W-22,p.z,-Math.PI/2);}});window.__vox=VOXW;
const WLD=createWorlds({S,textTex,plaza:()=>PLAZA});window.__wld=WLD;
const GM=createGames({AU,toast,netSend,WK,CAR,S,textTex,toon,plaza:()=>PLAZA,clearKeys:()=>{for(const k in KEY)KEY[k]=false;JOY.on=false;JOY.id=null;JOY.x=JOY.y=0;$('knob').style.transform='';},sit:on=>{WK.emote=on?5:0;},zev:(g,sc)=>netSend({t:'ev',e:'z',g,s:sc}),canType:()=>CANTYPE});

// حركة الكاميرا الناعمة
let fly=null;function flyTo(x,z,dist){fly={t0:performance.now(),from:ctl.target.clone(),to:new THREE.Vector3(x,0,z),cf:cam.position.clone(),ct:new THREE.Vector3(x+dist*.55,dist*.75,z+dist*.75)};}
// احتفال
const conf=[];function celebrate(x,z){AU.fanfare();for(let i=0;i<120;i++){const m=new THREE.Mesh(GEO.flat,new THREE.MeshBasicMaterial({color:['#ff7414','#ffd34d','#3aa06a','#2d6fb8','#e94f3b'][i%5]}));m.position.set(x,6,z);m.scale.set(.5,.5,.12);S.add(m);conf.push({m,v:new THREE.Vector3((Math.random()-.5)*14,10+Math.random()*12,(Math.random()-.5)*14),life:3});}}

function hearts(x,y,z){for(let i=0;i<14;i++){const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:HEART,transparent:true,depthWrite:false}));sp.position.set(x+(Math.random()-.5)*4,y+2,z+(Math.random()-.5)*4);sp.scale.set(2.4,2.4,1);S.add(sp);conf.push({m:sp,v:new THREE.Vector3((Math.random()-.5)*3,6+Math.random()*5,(Math.random()-.5)*3),life:1.8,float:true});}}
const HEART=textTex('❤️',128,128,null,'#e94f3b',96);
addEventListener('resize',()=>{cam.aspect=innerWidth/innerHeight;cam.updateProjectionMatrix();R.setSize(innerWidth,innerHeight);});
const clock=new THREE.Clock();let lt=0;
function frame(){const dt=Math.min(clock.getDelta(),.05),t=clock.elapsedTime;
  if(fly&&!WK.on){const k=Math.min(1,(performance.now()-fly.t0)/1400),e=k*k*(3-2*k);ctl.target.lerpVectors(fly.from,fly.to,e);cam.position.lerpVectors(fly.cf,fly.ct,e);if(k>=1)fly=null;}
 for(let i=conf.length-1;i>=0;i--){const c=conf[i];c.v.y-=(c.float?2:18)*dt;c.m.position.addScaledVector(c.v,dt);c.m.rotation.x+=dt*6;c.m.rotation.y+=dt*4;c.life-=dt;if(c.life<=0||c.m.position.y<0){S.remove(c.m);conf.splice(i,1);}}
 if(S.userData.beacon)S.userData.beacon.visible=Math.sin(t*4)>-.2;if(S.userData.ownerLabel){const dd=cam.position.distanceTo(S.userData.ownerLabel.position);const k=Math.max(.6,dd/220);S.userData.ownerLabel.scale.set(32*k,8*k,1);}
 if(marker)marker.position.y=Math.sin(t*4)*.3;
 if(WK.on)walkFrame(dt,t);
 else{sun.target.position.copy(ctl.target);sun.position.set(ctl.target.x-150,260,ctl.target.z+110);
  // الضباب يلحق بعد الكاميرا: حافة الضواحي دايماً داخل الضباب فما تبان نهاية للمدينة
  const dd=cam.position.distanceTo(ctl.target);
  // من القرب: الضباب يخفي حافة الضواحي (مثل أول). كل ما بعدت الكاميرا (منظر المدينة كاملة) الضباب يتأخر ويمتد لحافة المدينة، والمستوى البعيد للكاميرا (far) يكبر بحيث ما تختفي المدينة وتبان سماء زرقاء
  const kf=Math.min(1,Math.max(0,(dd-260)/Math.max(300,CITY_EXT)));
  S.fog.near=(dd*.9+60)*(1-kf)+(dd+CITY_EXT*.9+200)*kf;S.fog.far=(dd*1.9+220)*(1-kf)+(dd+CITY_EXT*3+600)*kf;
  const fr=Math.max(2200,dd+CITY_EXT*3.2+700);if(Math.abs(cam.far-fr)>fr*.05){cam.far=fr;cam.updateProjectionMatrix();}
  // مستوى القرب يكبر مع البعد: دقة العمق أعلى بكثير من بعيد (هذا اللي كان يسبب وميض البيوت والشوارع)
  const nn=Math.min(20,Math.max(1,dd*.05));if(Math.abs(cam.near-nn)>.3){cam.near=nn;cam.updateProjectionMatrix();}
  ctl.update();}
 D.frame(dt,t);GM.frame();FAIR.frame(dt,t);JB.frame(dt,t);WLD.frame(dt,t);VOXW.frame(dt,t);secFrame(t);updDoorBtn(t);if(IN.on&&t-(IN.ut||0)>.4){IN.ut=t;updInUI();}{const f=WK.on?WK.p:ctl.target;if(Math.hypot(f.x-CHX,f.z-CHZ)>90){CHX=f.x;CHZ=f.z;CHSYNC=t;chunkSync(true);}else if(CHPEND>0||t-CHSYNC>.45){CHX=f.x;CHZ=f.z;CHSYNC=t;chunkSync(false);}}if(!CAR.on)AU.engine(false,0,0,false);npcFrame(dt,t);peersFrame(dt,t);lifeFrame(dt,t);netFrame(t);if(t-lt>.4){updLabels();updNPC();updCount();updParkBtn();lt=t;}R.render(S,cam);requestAnimationFrame(frame);}
window.__stage='fonts';document.fonts.load('900 40px Cairo').finally(async()=>{window.__stage='houses';await load();window.__stage='mine';await mine();window.__stage='net';netConnect();window.__stage='city';
 setTimeout(()=>{const q=new URLSearchParams(location.search).get('h');const target=q&&HOUSES.find(h=>h.id===q);
  if(target){ctl.autoRotate=false;const[x,z]=plotPos(target.plot);flyTo(x,z,60);openCard(target);}
  else{// الوضع الأساسي: المدينة من بعيد لحظة، بعدها ينزل بالساحة ويتمشى (الكل — صاحب بيت أو زائر)
   const h=myHouse();let nob=false;try{nob=localStorage.getItem('mnalsifr_nobuild')==='1';}catch{}if(!h&&!nob&&!new URLSearchParams(location.search).has('admin')){AUTOB=true;gStatus();$('add').click();}else enterWalk(true,'plaza');
   if(UPG&&h)tip(`مبروك! بيتك تطوّر إلى ${TYPE_NAMES[h.type]} 🎉 (زره من 🏠)`);
   if(NEWRW){const rw=NEWRW;NEWRW=null;setTimeout(()=>toast('🎁 جائزة اليوم: '+rewardName(rw)+' — البسها من 👕'),UPG?6200:3300);}}},600);if(new URLSearchParams(location.search).has('admin'))setTimeout(openAdmin,1200);
 if(ADMIN)setTimeout(()=>adm('state').then(r=>{if(r.ok){ADMIN_OK=true;netHi();syncWalker();}else adminForget();}).catch(()=>{}),2500);// جهاز المشرف المحفوظ: يدخل تلقائياً
 window.__stage='ok';$('load').style.opacity=0;setTimeout(()=>$('load').remove(),500);frame();window.__ok=true;window.__wk=WK;window.__net={NET,PEERS};window.__car={GM,CAR,PARKED,PLAZA:()=>PLAZA,LIFE,D,SW,AU,get RIDE(){return RIDE;},onNet,onRide,gotMsg,openHist,HIST,R,PEERS,buildCity,updLabels,updNPC,load,plotPos,flyTo,vip:()=>({VIP,VIPH,D:D.vip}),gfTest:(lx,lz,y)=>IN.on&&IN.gf?IN.gf(IN.x+lx,IN.z+lz,y):null,openVip:()=>openVip(),doorOf,faceOf,getHouse:id=>HOUSES.find(x=>x.id===id),inState:()=>({on:IN.on,x:IN.x,z:IN.z,hw:IN.hw,hd:IN.hd,own:IN.own,emote:WK.emote,bed:IN.bed}),nLayers:()=>Object.keys(layers).length,nSol:()=>SOL.length,free:()=>({l:FREEL,i:FREEI,pick,mode:MODE}),ctl,SEC,SECM,eco:()=>ECO,solidAt:(x,z,y=0)=>nearSolids(x,z,b=>x>=b[0]-.7&&x<=b[1]+.7&&z>=b[2]-.7&&z<=b[3]+.7&&b[4]<y+1.2&&b[5]>y+.1),setBlocked,openEco,setProg:t=>{PROGTXT=t;updCount();}};});
// تحديث كل 20 ثانية — فقط والصفحة ظاهرة (الجوال في الخلفية ما يستهلك)
setInterval(()=>{if(MODE==='view'&&!document.hidden)load();},45000);
// الصفحة بالخلفية: نقطع الاتصال المباشر (يرجع لحاله لما ترجع)
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(NET.ws)NET.ws.close();}else{if(MODE==='view')load();netConnect();}});

// نتيجة الرجوع من قوقل (?g=...)
setTimeout(()=>{let g;try{g=new URLSearchParams(location.search).get('g');}catch{}if(!g)return;try{history.replaceState(null,'',location.pathname);}catch{}
 const T={linked:'✅ تم توثيق حسابك بقوقل — بيتك وتقدمك محفوظين',same:'✅ حسابك موثّق من قبل',moved:'🎉 رجع لك بيتك وتقدمك من حسابك',conflict:'⚠️ هذا الجهاز عنده بيت ثاني — ما نقدر نربطه بحساب فيه بيت آخر',other:'⚠️ هذا الجهاز موثّق بحساب قوقل ثاني',err:'❌ ما تم التوثيق، جرّب مرة ثانية'};toast(T[g]||T.err);gStatus();},3500);
setTimeout(gStatus,9000);
setTimeout(()=>{try{if(localStorage.getItem('mnalsifr_fair_new'))return;localStorage.setItem('mnalsifr_fair_new','1');}catch{}tip('🎡 جديد! مدينة ألعاب بالساحة — زر 🏠 ثم «مدينة الألعاب»، واقترب من أي لعبة واضغط «اركب»');},16000);

// 🔄 وضع أفقي: شاشة كاملة + قفل التدوير بالعرض (أندرويد؛ الآيفون ما يدعم القفل من المتصفح)
{const b=document.getElementById('land16');const upd=()=>{if(b)b.textContent=document.fullscreenElement?'↩️ رجوع للوضع العادي':'🔄 وضع أفقي (شاشة كاملة)';};
 if(b)b.onclick=async()=>{try{if(document.fullscreenElement){try{screen.orientation.unlock();}catch{}await document.exitFullscreen();return;}
  await document.documentElement.requestFullscreen({navigationUI:'hide'});try{await screen.orientation.lock('landscape');}catch{toast('🔄 اقلب جوالك بالعرض (فك قفل التدوير لو مقفول)');}}catch{toast('🔄 جوالك ما يدعم الشاشة الكاملة — اقلبه بالعرض وفك قفل التدوير');}};
 document.addEventListener('fullscreenchange',upd);}

/* 📐 اللوحات على قد الشاشة: تصغير خفيف (ما يقل عن 72%) + تمرير داخلي + زر «⬇️ المزيد» كبير للأطفال لو فيه محتوى تحت (باللوحة أو بأي قائمة داخلها). ما نعيد الحساب إلا لو تغيّر شي (إعادة الحساب كل مرة كانت ترجّع التمرير لفوق) */
{const HINT=new WeakMap();
 const hintFor=sc=>{let b=HINT.get(sc);const need=sc.scrollHeight>sc.clientHeight+4&&sc.scrollTop+sc.clientHeight<sc.scrollHeight-2;
  if(need&&!b){b=document.createElement('button');b.type='button';b.className='moreHint';b.textContent='⬇️ المزيد تحت';b.onclick=e=>{e.preventDefault();e.stopPropagation();sc.scrollBy({top:sc.clientHeight*.7,behavior:'smooth'});};sc.appendChild(b);HINT.set(sc,b);}
  if(b&&(b.style.display==='none')===need)b.style.display=need?'block':'none';};
 const fitOne=el=>{const s=el.style,cs=getComputedStyle(el),padV=(parseFloat(cs.paddingTop)||0)+(parseFloat(cs.paddingBottom)||0),avail=(window.visualViewport?visualViewport.height:innerHeight)-(parseFloat(cs.bottom)||8)-10;
  const z=1;/* بدون تصغير: اللوحة بحجمها الطبيعي تاخذ طول الشاشة وتتمرر مثل التطبيقات */
  const mh=Math.floor(avail/z)-padV,key=z.toFixed(3)+':'+mh;
  if(el._fitKey!==key){el._fitKey=key;el._z=z;s.transformOrigin='center bottom';s.transform=z<1?`scale(${z})`:'';s.maxHeight=mh+'px';s.overflowY='auto';s.webkitOverflowScrolling='touch';}
  hintFor(el);for(const sc of el.querySelectorAll('.says,.lb,[style*="overflow"]'))if(sc.clientHeight>60&&/auto|scroll/.test(getComputedStyle(sc).overflowY))hintFor(sc);};
 const fitAll=()=>{for(const el of document.querySelectorAll('.panel')){if(el.style.display!=='block'&&getComputedStyle(el).display==='none'){if(el._fitKey){el._fitKey='';el._z=1;el.style.transform='';}continue;}fitOne(el);}};
 setInterval(fitAll,350);addEventListener('resize',()=>setTimeout(fitAll,60));if(window.visualViewport)visualViewport.addEventListener('resize',()=>setTimeout(fitAll,60));document.addEventListener('scroll',e=>{const t=e.target;if(t&&t.closest&&t.closest('.panel'))hintFor(t);},true);window.__fitPanels=fitAll;}
