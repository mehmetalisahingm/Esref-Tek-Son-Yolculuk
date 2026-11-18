// A fully procedural 3D scene. No external models, textures, audio, or TV footage.
export function createScene(canvas, labelsRoot, T) {
  const scene=new T.Scene();
  scene.background=new T.Color(0x172823);
  scene.fog=new T.FogExp2(0x20342d,.027);
  const renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.65));
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=T.PCFSoftShadowMap;
  renderer.toneMapping=T.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.28;
  renderer.outputColorSpace=T.SRGBColorSpace;
  const camera=new T.PerspectiveCamera(41,9/16,.1,140);
  const cameraGoals=[new T.Vector3(8.9,9.1,16.3),new T.Vector3(0,11.7,18.8),new T.Vector3(-8.9,9.2,15.8)];
  let cameraMode=0;
  camera.position.copy(cameraGoals[0]);
  const focus=new T.Vector3(0,1,-3.0);
  camera.lookAt(focus);
  const hemisphere=new T.HemisphereLight(0xe1d6b8,0x193d34,2.1);scene.add(hemisphere);
  const sun=new T.DirectionalLight(0xffd6a1,3.05);sun.position.set(-8,18,7);sun.castShadow=true;
  sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-24;sun.shadow.camera.right=24;sun.shadow.camera.top=25;sun.shadow.camera.bottom=-25;sun.shadow.camera.near=.5;sun.shadow.camera.far=65;sun.shadow.bias=-.00035;
  scene.add(sun);
  const rim=new T.DirectionalLight(0x7cc9aa,1.0);rim.position.set(6,9,-10);scene.add(rim);
  const materials={
    ground:new T.MeshStandardMaterial({color:0x1e372d,roughness:1}),
    path:new T.MeshStandardMaterial({color:0x5a6454,roughness:1}),
    curb:new T.MeshStandardMaterial({color:0x808272,roughness:1}),
    stone:new T.MeshStandardMaterial({color:0x757d72,roughness:.95}),
    gold:new T.MeshStandardMaterial({color:0xa98a4c,metalness:.58,roughness:.3}),
    wood:new T.MeshStandardMaterial({color:0x413026,roughness:.8}),
    green:new T.MeshStandardMaterial({color:0x164c35,roughness:.93}),
    velvet:new T.MeshStandardMaterial({color:0x1d513e,roughness:.98,side:T.DoubleSide}),
    black:new T.MeshStandardMaterial({color:0x202a2b,roughness:.89}),
  };
  const box=(w,h,d,mat)=>new T.Mesh(new T.BoxGeometry(w,h,d),mat);
  const cylinder=(r1,r2,h,mat,segments=9)=>new T.Mesh(new T.CylinderGeometry(r1,r2,h,segments),mat);
  const sphere=(r,mat,segments=12)=>new T.Mesh(new T.SphereGeometry(r,segments,10),mat);
  function add(parent, mesh, x=0,y=0,z=0, shadows=true){mesh.position.set(x,y,z);if(shadows){mesh.castShadow=true;mesh.receiveShadow=true;}parent.add(mesh);return mesh}
  const ground=add(scene,box(95,.19,180,materials.ground),0,-.19,-28,false);
  const road=add(scene,box(6.9,.11,110,materials.path),0,-.09,-26,false);road.receiveShadow=true;
  for(const s of [-1,1])add(scene,box(.22,.13,110,materials.curb),s*3.49,-.03,-26,false);
  const roadside=[];
  let seed=718;
  function rand(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}
  // Path seams and scattered cobbles, endlessly moving under the procession.
  const cobbles=[];
  const shades=[0x6c7569,0x626d62,0x798176,0x53665c,0x72776a];
  for(let i=0;i<260;i++){
    const mat=new T.MeshStandardMaterial({color:shades[Math.floor(rand()*shades.length)],roughness:.99});
    const w=.28+rand()*.68,d=.20+rand()*.39;
    const stone=add(scene,box(w,.015,d,mat), (rand()-.5)*6.1,-.024,-51+rand()*68,false);
    stone.rotation.y=(rand()-.5)*.26;
    cobbles.push(stone);
  }
  // Soft roadside lanterns, trees and stone bollards.
  const bark=new T.MeshStandardMaterial({color:0x342f29,roughness:1});
  const leafColors=[0x254d3e,0x305542,0x39634d,0x294536];
  const leafMats=leafColors.map(c=>new T.MeshStandardMaterial({color:c,roughness:1}));
  const lanternMaterial=new T.MeshStandardMaterial({color:0xf5d8a0,emissive:0xffc878,emissiveIntensity:1.5});
  function makeTree(x,z,size=1){
    const group=new T.Group();group.position.set(x,0,z);
    add(group,cylinder(.16*size,.24*size,1.4*size,bark),0,.7*size,0);
    const foliage=add(group,new T.Mesh(new T.ConeGeometry(.77*size,3*size,8),leafMats[Math.floor(rand()*leafMats.length)]),0,2.45*size,0);
    foliage.castShadow=true;
    add(group,new T.Mesh(new T.ConeGeometry(.55*size,2.25*size,8),leafMats[Math.floor(rand()*leafMats.length)]),0,3.12*size,0);
    scene.add(group);roadside.push(group);
  }
  function makeLamp(x,z){
    const group=new T.Group();group.position.set(x,0,z);
    add(group,cylinder(.05,.07,3.4,materials.black),0,1.7,0);
    add(group,box(.43,.12,.43,materials.wood),0,3.35,0);
    add(group,box(.3,.38,.3,lanternMaterial),0,3.58,0);
    const cap=add(group,new T.Mesh(new T.ConeGeometry(.38,.32,4),materials.black),0,3.88,0);cap.rotation.y=Math.PI/4;
    const light=new T.PointLight(0xffbb70,6,8,2);light.position.set(0,3.55,0);group.add(light);
    scene.add(group);roadside.push(group);
  }
  for(let i=0;i<35;i++){
    const z=-63+i*2.28;
    const side=i%2?1:-1;
    makeTree(side*(5+rand()*3.9),z,(.8+rand()*.75));
    if(i%4===1)makeLamp(-side*4.15,z-1);
  }
  // Background village silhouette.
  const buildings=new T.Group();
  const wallMats=[0x384a3f,0x435449,0x4b5146].map(color=>new T.MeshStandardMaterial({color,roughness:1}));
  for(let i=0;i<14;i++){
    const side=i%2?1:-1;const z=-65+i*5.7;const width=2.4+rand()*2.5;
    const house=new T.Group();house.position.set(side*(11+rand()*3),0,z);
    const height=2.6+rand()*2;
    add(house,box(width,height,3.3,wallMats[i%3]),0,height/2,0);
    const roof=add(house,new T.Mesh(new T.ConeGeometry(width*.88,1.5,4),materials.wood),0,height+.5,0);roof.rotation.y=Math.PI/4;
    buildings.add(house);
  }
  scene.add(buildings);
  // Dust and firefly-like golden specks give the scene a living atmosphere.
  const particles=[];
  const dustMat=new T.MeshBasicMaterial({color:0xe9cc8c,transparent:true,opacity:.56,depthWrite:false});
  for(let i=0;i<45;i++){
    const dot=add(scene,sphere(.015+rand()*.025,dustMat,5),(rand()-.5)*11,.5+rand()*5,-33+rand()*44,false);
    particles.push({mesh:dot,phase:rand()*Math.PI*2,baseY:dot.position.y});
  }

  function makeCoffinTopTexture(){
    const canv=document.createElement('canvas');canv.width=512;canv.height=1024;
    const c=canv.getContext('2d');
    const gr=c.createLinearGradient(0,0,512,1024);gr.addColorStop(0,'#1c543e');gr.addColorStop(.48,'#26734c');gr.addColorStop(1,'#143d30');
    c.fillStyle=gr;c.fillRect(0,0,512,1024);
    c.lineWidth=17;c.strokeStyle='#be9b50';c.strokeRect(22,22,468,980);
    c.lineWidth=3;c.strokeStyle='#e5c87d';c.strokeRect(49,48,414,928);
    c.fillStyle='#cbb275';
    for(let i=0;i<18;i++){const y=62+i*52;c.fillRect(54,y,12,11);c.fillRect(446,y,12,11)}
    c.textAlign='center';
    c.fillStyle='#f4d995';c.font='bold 56px Georgia, serif';c.fillText('EŞREF',256,453);c.fillText('TEK',256,521);
    c.font='italic 29px Georgia, serif';c.fillText('SON YOLCULUK',256,590);
    c.fillStyle='#bda26d';c.font='48px serif';c.fillText('✦',256,335);c.fillText('✦',256,705);
    const t=new T.CanvasTexture(canv);t.colorSpace=T.SRGBColorSpace;t.anisotropy=renderer.capabilities.getMaxAnisotropy();return t;
  }
  const coffin=new T.Group();scene.add(coffin);
  // Polish wooden beam structure; two poles are visibly carried on each shoulder.
  add(coffin,box(1.4,.32,3.65,materials.wood),0,1.53,0);
  add(coffin,box(1.48,.07,3.74,materials.gold),0,1.71,0);
  const drape=add(coffin,box(1.43,.29,3.6,materials.green),0,1.75,0);
  const topper=add(coffin,new T.Mesh(new T.PlaneGeometry(1.38,3.53),new T.MeshStandardMaterial({map:makeCoffinTopTexture(),side:T.DoubleSide,roughness:1})),0,1.911,0);
  topper.rotation.x=-Math.PI/2;
  for(const side of [-1,1]){
    add(coffin,box(.10,.10,4.12,materials.wood),side*.96,1.48,0);
    add(coffin,box(.025,.027,4.11,materials.gold),side*.96,1.55,0);
    for(const z of [-1.65,0,1.65]) add(coffin,box(.38,.075,.16,materials.wood),side*.81,1.46,z);
    add(coffin,box(.058,.18,3.55,materials.gold),side*.733,1.69,0);
  }
  const wreath=new T.Group();wreath.position.set(0,1.95,-1.28);coffin.add(wreath);
  const flowerWhite=new T.MeshStandardMaterial({color:0xe5dac0,roughness:1});
  const leaf=new T.MeshStandardMaterial({color:0x417255,roughness:1});
  for(let i=0;i<8;i++){const a=i/8*Math.PI*2;add(wreath,sphere(.084,flowerWhite,7),Math.sin(a)*.3,0,Math.cos(a)*.17);add(wreath,sphere(.06,leaf,6),Math.sin(a)*.38,-.04,Math.cos(a)*.22)}

  // Independent front VIP: a single walker carries Eşref Tek's framed portrait.
  const photoSign=new T.Group();photoSign.position.z=3.35;scene.add(photoSign);
  add(photoSign,box(.065,1.04,.065,materials.wood),0,1.92,-.02);
  add(photoSign,box(1.43,1.81,.13,materials.wood),0,2.98,0);
  add(photoSign,box(1.35,1.72,.14,materials.gold),0,2.98,.013);
  add(photoSign,box(1.16,1.50,.15,materials.black),0,2.98,.025);
  const signOverlay=document.createElement('div');signOverlay.className='portrait-world';
  const photoEl=document.createElement('img');photoEl.alt='Eşref Tek karakter fotoğrafı';photoEl.decoding='async';
  const signName=document.createElement('span');signName.textContent='EŞREF TEK';
  signOverlay.append(photoEl,signName);labelsRoot.append(signOverlay);
  let currentPortraitUrl='';

  const skinColors=[0xb98464,0xc69575,0xd8ad83,0xa97654,0xe0b995];
  const jackets=[0x1c262b,0x222d2d,0x303337,0x24292b,0x333b3c,0x292d34];
  const trousers=[0x161d20,0x212729,0x202b2d];
  const hair=[0x1c1716,0x2b201d,0x35261d];
  const shoeMat=new T.MeshStandardMaterial({color:0x11191b,roughness:.95});
  const personCache=new Map();
  function makeHuman(index=0){
    const group=new T.Group();
    const tone=new T.MeshStandardMaterial({color:skinColors[index%skinColors.length],roughness:.96});
    const suit=new T.MeshStandardMaterial({color:jackets[index%jackets.length],roughness:.94});
    const pants=new T.MeshStandardMaterial({color:trousers[index%trousers.length],roughness:1});
    const hairMat=new T.MeshStandardMaterial({color:hair[index%hair.length],roughness:1});
    const torso=new T.Group();group.add(torso);
    add(torso,cylinder(.23,.18,.75,suit,8),0,1.22,0);
    add(torso,box(.4,.38,.18,suit),0,1.44,0);
    add(torso,box(.052,.32,.02,new T.MeshStandardMaterial({color:0x59625b})),0,1.34,.19);
    const face=add(torso,sphere(.185,tone,14),0,1.87,.008);face.scale.set(.94,1.17,.89);
    add(torso,new T.Mesh(new T.SphereGeometry(.188,12,8,0,Math.PI*2,0,Math.PI*.42),hairMat),0,1.985,.007);
    add(torso,box(.075,.04,.03,hairMat),0,1.975,.163);
    const legs=[];
    for(const side of [-1,1]){
      const pivot=new T.Group();pivot.position.set(side*.125,.92,0);group.add(pivot);
      add(pivot,cylinder(.085,.077,.76,pants,7),0,-.38,0);
      add(pivot,box(.20,.115,.31,shoeMat),0,-.77,.09);
      legs.push(pivot);
    }
    const arms=[];
    for(const side of [-1,1]){
      const shoulder=new T.Group();shoulder.position.set(side*.27,1.55,0);torso.add(shoulder);
      const arm=add(shoulder,cylinder(.084,.065,.57,suit,7),side*.03,-.31,0);
      const hand=add(shoulder,sphere(.081,tone,8),side*.03,-.64,0);
      arms.push(shoulder);
    }
    const shade=new T.Mesh(new T.CircleGeometry(.34,16),new T.MeshBasicMaterial({color:0x08130f,transparent:true,opacity:.28,depthWrite:false}));shade.rotation.x=-Math.PI/2;shade.position.y=.025;group.add(shade);
    scene.add(group);
    return {group,torso,legs,arms,shade,index};
  }
  function placePositions(count){
    const slots=[];
    for(let i=0;i<count;i++){
      const row=Math.floor(i/5);
      const col=i%5;
      const offset=row%2?.36:0;
      const x=(col-2)*1.05+offset;
      const z=-3.5-row*1.13-(col%2)*.14;
      slots.push({x,z});
    }
    return slots;
  }
  const humanColorFor = name => [...name].reduce((acc,ch)=>acc+ch.charCodeAt(0),0);
  let activeState={carriers:Array(6).fill(null),people:[],portraitBearer:null};
  function syncPeople(newState){
    activeState=newState;
    const carriers=new Map();
    newState.carriers.forEach((p,i)=>{if(p)carriers.set(p.id,i)});
    if(newState.portraitBearer)carriers.set(newState.portraitBearer.id,6);
    if(newState.portraitUrl && newState.portraitUrl!==currentPortraitUrl){
      currentPortraitUrl=newState.portraitUrl;photoEl.src=currentPortraitUrl;
    }
    const active=new Set(newState.people.map(p=>p.id));
    // Render 6 placeholder pallbearers even when slots have not yet been gifted.
    for(let i=0;i<6;i++)if(!newState.carriers[i])active.add(`empty-${i}`);
    if(!newState.portraitBearer)active.add('portrait-empty');
    for(const [id,rig] of personCache)if(!active.has(id)){
      scene.remove(rig.group);rig.group.traverse(obj=>{if(obj.geometry)obj.geometry.dispose();});
      rig.label?.remove();personCache.delete(id);
    }
    const crowd=newState.people.filter(p=>!carriers.has(p.id)).slice(0,80);
    const slots=placePositions(crowd.length);
    const assignments=[];
    for(let i=0;i<6;i++){
      const p=newState.carriers[i];
      assignments.push({id:p?.id||`empty-${i}`,name:p?.name||'Bekleniyor',x:i<3?-.98:.98,z:[1.18,0,-1.18][i%3],carrier:true,slot:i,empty:!p});
    }
    assignments.push({id:newState.portraitBearer?.id||'portrait-empty',name:newState.portraitBearer?.name||'VIP BEKLENİYOR',x:0,z:3.35,carrier:false,portrait:true,empty:!newState.portraitBearer,slot:6});
    crowd.forEach((p,i)=>assignments.push({id:p.id,name:p.name,x:slots[i].x,z:slots[i].z,carrier:false,empty:false,slot:-1}));
    assignments.forEach((target,i)=>{
      let rig=personCache.get(target.id);
      if(!rig){
        rig=makeHuman(humanColorFor(target.id));
        rig.group.position.set(target.x,0,target.z-3);rig.group.rotation.y=.02;
        rig.label=document.createElement('div');rig.label.className='world-name';labelsRoot.append(rig.label);
        personCache.set(target.id,rig);
      }
      rig.target=target;
      rig.label.textContent=target.empty?'':`@${target.name}`;
      rig.label.className=`world-name ${target.carrier?'carrier':target.portrait?'portrait-holder':''}`;
      rig.group.visible=true;
    });
  }
  const vec=new T.Vector3();
  let last=performance.now(),elapsed=0,labelElapsed=0;
  function showLabels(){
    const rect=canvas.getBoundingClientRect();
    const maxCrowdLabels=activeState.people.length<40?13:8;
    let shownCrowd=0;
    for(const rig of personCache.values()){
      const lab=rig.label;
      if(!rig.target||rig.target.empty){lab.style.display='none';continue}
      if(!rig.target.carrier && shownCrowd++>=maxCrowdLabels){lab.style.display='none';continue}
      rig.group.getWorldPosition(vec);vec.y+=rig.target.portrait?4.05:rig.target.carrier?2.27:2.12;
      vec.project(camera);
      if(vec.z>1||vec.z< -1||Math.abs(vec.x)>1.05||Math.abs(vec.y)>1.05){lab.style.display='none';continue}
      lab.style.display='block';
      lab.style.left=`${(vec.x*.5+.5)*rect.width}px`;
      lab.style.top=`${(-vec.y*.5+.5)*rect.height}px`;
      lab.style.opacity=String(Math.max(.48,Math.min(1,1+(rig.target.z/30))));
    }
    // Real portrait is a normal HTML image: cross-origin official images remain displayable
    // without requiring CORS access to a WebGL texture. A locally uploaded image works too.
    const corners=[[-.55,3.63],[.55,3.63],[-.55,2.31],[.55,2.31]].map(([x,y])=>{
      const v=photoSign.localToWorld(new T.Vector3(x,y,.14)).project(camera);
      return {x:(v.x*.5+.5)*rect.width,y:(-v.y*.5+.5)*rect.height,z:v.z};
    });
    if(corners.some(p=>p.z>1||p.z< -1))signOverlay.style.display='none';
    else{
      const left=Math.min(...corners.map(p=>p.x)),right=Math.max(...corners.map(p=>p.x));
      const top=Math.min(...corners.map(p=>p.y)),bottom=Math.max(...corners.map(p=>p.y));
      signOverlay.style.display='flex';signOverlay.style.left=`${left}px`;
      signOverlay.style.top=`${top}px`;signOverlay.style.width=`${right-left}px`;signOverlay.style.height=`${bottom-top}px`;
    }
  }
  function resize(){
    const width=canvas.clientWidth || 430, height=canvas.clientHeight || 764;
    renderer.setSize(width,height,false);
    camera.aspect=width/height;camera.updateProjectionMatrix();
  }
  const observer=new ResizeObserver(resize);observer.observe(canvas);resize();
  let paused=false;
  document.addEventListener('visibilitychange',()=>{paused=document.hidden;last=performance.now()});
  function frame(now){
    requestAnimationFrame(frame);
    const dt=Math.min(.07,(now-last)/1000);last=now;
    if(paused)return;
    elapsed+=dt;
    const run=elapsed*1.25;
    for(const rig of personCache.values()){
      const p=rig.target;if(!p)continue;
      rig.group.position.x += (p.x-rig.group.position.x)*Math.min(1,dt*4);
      rig.group.position.z += (p.z-rig.group.position.z)*Math.min(1,dt*3);
      rig.group.position.y=.025+Math.abs(Math.sin(run*6.1+rig.index*1.2))*.033;
      rig.legs[0].rotation.x=Math.sin(run*6.1+rig.index*1.3)*.42;
      rig.legs[1].rotation.x=-Math.sin(run*6.1+rig.index*1.3)*.42;
      rig.torso.rotation.z=Math.sin(run*3.1+rig.index)*.025;
      for(let i=0;i<2;i++){
        const side=i===0?-1:1;
        const holding=p.carrier && ((p.x<0&&side===1)||(p.x>0&&side===-1));
        rig.arms[i].rotation.z=p.portrait?(side===1?-.60:.60):holding?(side===1?-.96:.96):Math.sin(run*6.1+rig.index+i*Math.PI)*.11;
        rig.arms[i].rotation.x=p.portrait?-2.3:holding?-1.03:Math.sin(run*6.1+rig.index+i*Math.PI)*.33;
      }
      rig.group.scale.setScalar(p.empty ? .98 : 1);
    }
    coffin.position.y=Math.sin(run*6.1)*.022;
    coffin.rotation.z=Math.sin(run*3.1)*.006;
    photoSign.position.y=Math.sin(run*6.1)*.016;photoSign.rotation.z=Math.sin(run*3.1)*.015;
    for(const stone of cobbles){stone.position.z+=dt*.95;if(stone.position.z>16)stone.position.z-=67;}
    for(const group of roadside){group.position.z+=dt*.95;if(group.position.z>17)group.position.z-=80;}
    for(let i=0;i<particles.length;i++){
      const p=particles[i];p.mesh.position.y=p.baseY+Math.sin(elapsed*.65+p.phase)*.15;
      p.mesh.position.z+=dt*.3;if(p.mesh.position.z>14)p.mesh.position.z=-31;
    }
    camera.position.lerp(cameraGoals[cameraMode],Math.min(1,dt*1.8));
    camera.lookAt(focus);
    renderer.render(scene,camera);
    labelElapsed+=dt;if(labelElapsed>.075){showLabels();labelElapsed=0;}
  }
  requestAnimationFrame(frame);
  return {
    update:syncPeople,
    camera:mode=>{cameraMode=mode%cameraGoals.length;},
  };
}
