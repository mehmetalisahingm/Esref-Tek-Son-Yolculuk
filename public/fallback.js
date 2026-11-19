// Offline 2.5D rendering fallback if the 3D engine CDN is unavailable.
// Gameplay remains live and functional; only the graphics implementation changes.
export function createFallback(canvas,labelsRoot){
  const ctx=canvas.getContext('2d');
  let state={carriers:Array(6).fill(null),people:[],portraitBearer:null},t=0,view=0;
  const portrait=new Image();let portraitLoaded=false,portraitUrl='';
  portrait.referrerPolicy='no-referrer';portrait.onload=()=>portraitLoaded=true;portrait.onerror=()=>portraitLoaded=false;
  let dpr=1,w=430,h=764;
  const rand=(n)=>{let v=Math.sin(n*19.619+16.33)*43758.5453;return v-Math.floor(v)};
  function resize(){const rect=canvas.getBoundingClientRect();w=rect.width||430;h=rect.height||764;dpr=Math.min(2,window.devicePixelRatio||1);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);}
  new ResizeObserver(resize).observe(canvas);resize();
  function point(x,y,z){
    const depth=Math.max(-40,Math.min(10,z));
    const scale=1/(1+Math.max(-depth,0)*.067);
    const cx=(.5+(view===2?.13:view===1?0:.065))*w;
    return {x:cx+x*scale*w*.112,y:h*.645+z*scale*h*.043-y*scale*h*.083,scale};
  }
  function poly(arr,fill,stroke=null,lw=1){ctx.beginPath();ctx.moveTo(arr[0].x,arr[0].y);for(const p of arr.slice(1))ctx.lineTo(p.x,p.y);ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lw;ctx.stroke()}}
  function line(a,b,color,width=1){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()}
  function ellipse(p,rx,ry,color){ctx.beginPath();ctx.ellipse(p.x,p.y,rx,ry,0,0,2*Math.PI);ctx.fillStyle=color;ctx.fill()}
  function drawRoad(){
    const back=ctx.createLinearGradient(0,h*.17,0,h*.80);back.addColorStop(0,'#314c42');back.addColorStop(.55,'#4e5a4e');back.addColorStop(1,'#526651');ctx.fillStyle=back;ctx.fillRect(0,0,w,h);
    const sky=ctx.createLinearGradient(0,0,0,h*.45);sky.addColorStop(0,'#1b302c');sky.addColorStop(1,'#556b59');ctx.fillStyle=sky;ctx.fillRect(0,0,w,h*.43);
    poly([point(-4,0,-40),point(4,0,-40),point(4,0,12),point(-4,0,12)],'#606b5e');
    for(let i=0;i<85;i++){
      const z=-35+(((i*3.03-t*.35)%46)+46)%46, x=(rand(i)*7-3.5);
      const p=point(x,0,z);const s=p.scale;
      ctx.fillStyle=['#859083','#737d74','#6c776e'][i%3];
      ctx.globalAlpha=.30;ctx.fillRect(p.x,p.y,Math.max(1,8*s),Math.max(.6,3*s));ctx.globalAlpha=1;
    }
    const edgeL0=point(-4,0,-40),edgeL1=point(-4,0,12),edgeR0=point(4,0,-40),edgeR1=point(4,0,12);
    line(edgeL0,edgeL1,'#b0aa85',2);line(edgeR0,edgeR1,'#b0aa85',2);
  }
  function lantern(x,z){
    const b=point(x,0,z),top=point(x,3.6,z),s=b.scale;
    line(b,top,'#24332b',Math.max(2,5*s));
    const p=point(x,3.6,z);ellipse(p,10*s,12*s,'#ffd89b');
    const glow=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,38*s);glow.addColorStop(0,'#ffd98a88');glow.addColorStop(1,'#ffd98a00');ctx.fillStyle=glow;ctx.beginPath();ctx.arc(p.x,p.y,38*s,0,7);ctx.fill();
  }
  function tree(x,z,index){
    const p=point(x,0,z),s=p.scale;
    ctx.fillStyle='#2d3028';ctx.fillRect(p.x-6*s,p.y-93*s,12*s,97*s);
    for(let j=0;j<3;j++){
      const cy=p.y-(105+j*37)*s,rx=(43-j*9)*s;
      poly([{x:p.x-rx,y:cy+35*s},{x:p.x,y:cy-76*s},{x:p.x+rx,y:cy+35*s}],['#1e4a38','#29583d','#326048'][index%3]);
    }
  }
  function scenery(){
    for(let i=0;i<18;i++){
      const z=-36+i*2.8+2.8-(t*.6%2.8);
      tree(i%2?-6.4:6.6,z,i);
      if(i%4===1)lantern(i%2?-4.6:4.5,z+.7);
    }
    for(let i=0;i<28;i++){
      const z=-29+(((i*1.47-t*.08)%41)+41)%41;
      const p=point((rand(i*31)-.5)*13,2.0+rand(i)*3,z);
      ctx.globalAlpha=.2+rand(i+3)*.3;ellipse(p,Math.max(.5,1.5*p.scale),Math.max(.5,2*p.scale),'#ffdb9f');ctx.globalAlpha=1;
    }
  }
  function human(x,z,id,name,carrier=false,empty=false,followed=false){
    const n=[...String(id)].reduce((a,c)=>a+c.charCodeAt(0),0);
    const bob=Math.sin(t*6+n)*.045;
    const p=point(x,bob,z),s=p.scale*(w/430)*.95;
    // Character height is about 2 metres in this scene, approximated by 95 px at near depth.
    const X=p.x,Y=p.y;
    ellipse({x:X,y:Y+1*s},15*s,5*s,'#15271a77');
    const step=Math.sin(t*6.2+n)*11*s;
    line({x:X-8*s,y:Y-36*s},{x:X-10*s-step*.25,y:Y-3*s},'#1c2929',8*s);
    line({x:X+8*s,y:Y-36*s},{x:X+10*s+step*.25,y:Y-3*s},'#293237',8*s);
    poly([{x:X-18*s,y:Y-83*s},{x:X+16*s,y:Y-83*s},{x:X+20*s,y:Y-36*s},{x:X-19*s,y:Y-36*s}],['#273437','#2a3034','#34413f'][n%3]);
    line({x:X-17*s,y:Y-72*s},{x:X-23*s,y:Y-36*s+step*.18},'#303b3c',8*s);
    line({x:X+17*s,y:Y-72*s},{x:X+22*s,y:Y-36*s-step*.18},'#303b3c',8*s);
    if(followed){ctx.fillStyle='#f3ead6';ctx.fillRect(X+19*s,Y-51*s,5*s,13*s);ellipse({x:X+21.5*s,y:Y-54*s},3*s,5*s,'#ffd16a');}
    ellipse({x:X,y:Y-99*s},15*s,19*s,['#c39370','#dbb490','#b6805f'][n%3]);
    poly([{x:X-14*s,y:Y-104*s},{x:X-14*s,y:Y-117*s},{x:X+13*s,y:Y-118*s},{x:X+15*s,y:Y-103*s},{x:X+5*s,y:Y-111*s},{x:X-7*s,y:Y-109*s}],'#1c211f');
    if(empty)ctx.globalAlpha=.6;
    if(name && (carrier||z>-4.2)){
      ctx.font=`700 ${Math.max(9,12*s)}px system-ui,sans-serif`;ctx.textAlign='center';ctx.lineWidth=3;ctx.strokeStyle='#142019';ctx.fillStyle=carrier?'#ffe0a0':'#e5eadc';
      const label='@'+String(name).slice(0,15);ctx.strokeText(label,X,Y-127*s);ctx.fillText(label,X,Y-127*s);
    }
    ctx.globalAlpha=1;
  }
  function coffin(){
    const wob=Math.sin(t*6)*.017;
    const coor=(x,z,y=1.62)=>point(x,y+wob,z);
    // Golden carrying poles.
    for(const x of [-1.1,1.1])line(coor(x,-2.1),coor(x,2.05),'#e4bb73',7);
    const corners=[coor(-.8,-1.75,1.80),coor(.8,-1.75,1.80),coor(.8,1.75,1.80),coor(-.8,1.75,1.80)];
    poly([coor(-.85,-1.75,1.55),coor(.85,-1.75,1.55),coor(.85,1.75,1.55),coor(-.85,1.75,1.55)],'#442e21');
    poly(corners,'#216347','#dfb66e',3);
    const inner=[coor(-.64,-1.53,1.81),coor(.64,-1.53,1.81),coor(.64,1.53,1.81),coor(-.64,1.53,1.81)];
    poly(inner,'#276f50','#e9c37a',2);
    const center=coor(0,0,1.85);ctx.fillStyle='#f4e1a7';ctx.textAlign='center';ctx.font=`bold ${Math.max(9,14*(w/430))}px Georgia,serif`;ctx.fillText('EŞREF TEK',center.x,center.y);
    const wreath=coor(0,-1.24,1.9);ellipse(wreath,17*(w/430),9*(w/430),'#cbd3ad');ellipse(wreath,10*(w/430),5*(w/430),'#577d4f');
  }
  function frontPortrait(){
    // The single holder walks *ahead* of the coffin and raises the framed photo.
    const p=state.portraitBearer;
    human(0,4.6,p?.id||'portrait-empty',null,false,!p,p?.followed);
    const mid=point(0,2.25,4.6),sc=mid.scale*(w/430)*.72;
    const bob=Math.sin(t*6)*2*sc;
    const bw=94*sc,bh=128*sc;
    const X=mid.x,Y=mid.y+bob;
    line(point(0,1.5,4.6),point(0,1.8,4.6),'#826038',8*sc);
    ctx.fillStyle='#654927';ctx.fillRect(X-bw/2-6*sc,Y-bh/2-6*sc,bw+12*sc,bh+12*sc);
    ctx.fillStyle='#f1c87a';ctx.fillRect(X-bw/2-3*sc,Y-bh/2-3*sc,bw+6*sc,bh+6*sc);
    ctx.fillStyle='#151d1a';ctx.fillRect(X-bw/2,Y-bh/2,bw,bh);
    if(portraitLoaded){const iw=portrait.naturalWidth,ih=portrait.naturalHeight,tw=bw-6*sc,th=bh-27*sc,r=Math.max(tw/iw,th/ih),sw=tw/r,sh=th/r;ctx.drawImage(portrait,(iw-sw)/2,(ih-sh)*.15,sw,sh,X-bw/2+3*sc,Y-bh/2+3*sc,tw,th);}
    else{ctx.textAlign='center';ctx.fillStyle='#f3e0b3';ctx.font=`${Math.max(9,12*sc)}px Georgia,serif`;ctx.fillText('EŞREF TEK',X,Y-5*sc)}
    ctx.fillStyle='#0e1f19';ctx.fillRect(X-bw/2,Y+bh/2-24*sc,bw,24*sc);
    ctx.fillStyle='#f7d99a';ctx.textAlign='center';ctx.font=`bold ${Math.max(9,13*sc)}px Georgia,serif`;
    ctx.fillText('EŞREF TEK',X,Y+bh/2-8*sc);
    ctx.font=`700 ${Math.max(8,11*sc)}px system-ui,sans-serif`;
    ctx.fillStyle='#ffdea1';
    ctx.font=`800 ${Math.max(10,15*sc)}px system-ui,sans-serif`;ctx.lineWidth=4;ctx.strokeStyle='#120d05';const crown=p?`👑 @${p.name}`:'👑 Bu yer seni bekliyor';ctx.strokeText(crown,X,Y-bh/2-14*sc);ctx.fillText(crown,X,Y-bh/2-14*sc);
  }
  function render(){
    requestAnimationFrame(render);t+=Math.min(.033,1/60);
    ctx.clearRect(0,0,w,h);drawRoad();scenery();
    const ids=new Set(state.carriers.filter(Boolean).map(p=>p.id));
    if(state.portraitBearer)ids.add(state.portraitBearer.id);
    const viewers=state.people.filter(p=>!ids.has(p.id)).slice(-95).reverse();
    for(let i=viewers.length-1;i>=0;i--){
      const row=Math.floor(i/5);const col=i%5;
      const p=viewers[i],x=(col-2)*1.1+(row%2)*.3,z=-3.5-row*1.16;
      human(x,z,p.id,p.name,false,false,p.followed);
    }
    // Rear 3 carriers, casket, front 3 carriers.
    for(let i of [2,5,1,4]){const p=state.carriers[i];human(i<3?-1.15:1.15, [1.25,0,-1.25][i%3],p?.id||i,p?.name, true,!p,p?.followed)}
    coffin();
    for(let i of [0,3]){const p=state.carriers[i];human(i<3?-1.15:1.15,1.25,p?.id||i,p?.name,true,!p,p?.followed)}
    frontPortrait();
  }
  requestAnimationFrame(render);
  return {update:s=>{state=s;if(s.portraitUrl && s.portraitUrl!==portraitUrl){portraitUrl=s.portraitUrl;portraitLoaded=false;portrait.src=portraitUrl;}},camera:i=>{view=i;}};
}
