// Cinematic, fully procedural 3D procession. No external models, textures, footage or recordings.
export function createScene(canvas, labelsRoot, T) {
  const SPEED = .85;           // world units per second the road scrolls under the procession
  const PORTRAIT_Z = 4.4;      // the portrait bearer walks well ahead so the frame never hides the coffin
  const MAX_CROWD = 60;
  const HUD_BOTTOM = .125;    // title + status bar cover the top of the frame
  const SHIFT_X = .12;        // the procession sits left of centre, clear of the cards on the right
  // Screen areas (fractions of the frame) covered by the overlay UI: names are not drawn there.
  const blocked = (fx, fy) => fy < HUD_BOTTOM || (fx > .52 && fy < .32) || (fx > .76 && fy < .70);

  // ——— Renderer & scene ———
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.32;
  renderer.outputColorSpace = T.SRGBColorSpace;
  const scene = new T.Scene();
  const fogColor = new T.Color(0x1d2733);
  scene.background = fogColor;
  scene.fog = new T.FogExp2(fogColor, .026);
  const camera = new T.PerspectiveCamera(30, 9 / 16, .1, 260);

  let seed = 7193;
  const rand = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  const canvasTex = (w, h, draw, repeat) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    if (repeat) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(...repeat); }
    return t;
  };
  const glowTex = canvasTex(128, 128, (c, w) => {
    const g = c.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    g.addColorStop(0, 'rgba(255,240,200,1)'); g.addColorStop(.25, 'rgba(255,205,120,.55)'); g.addColorStop(1, 'rgba(255,190,90,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, w);
  });

  // ——— Sky: dusk gradient, stars, moon, distant skyline ———
  const hex = h => new T.Vector3(((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255);
  const sky = new T.Mesh(new T.SphereGeometry(200, 32, 16), new T.ShaderMaterial({
    side: T.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: hex(0x060b16) }, mid: { value: hex(0x16233a) }, horizon: { value: hex(0x4a3b3a) }, glow: { value: hex(0x9a6a45) } },
    vertexShader: 'varying vec3 vP;void main(){vP=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'uniform vec3 top,mid,horizon,glow;varying vec3 vP;void main(){float h=vP.y;vec3 c=mix(horizon,mid,smoothstep(-.03,.16,h));c=mix(c,top,smoothstep(.16,.62,h));float g=pow(max(0.,1.-abs(h-.01)*7.),3.)*smoothstep(.2,-.9,vP.z);c+=glow*g*.55;gl_FragColor=vec4(c,1.);}',
  }));
  scene.add(sky);
  {
    const n = 520, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const th = rand() * Math.PI * 2, y = .12 + rand() * .88, r = Math.sqrt(1 - y * y);
      pos.set([Math.cos(th) * r * 190, y * 190, Math.sin(th) * r * 190], i * 3);
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3));
    scene.add(new T.Points(g, new T.PointsMaterial({ color: 0xdfe6ff, size: .9, sizeAttenuation: true, transparent: true, opacity: .75, fog: false, depthWrite: false })));
  }
  const moonTex = canvasTex(256, 256, (c, w) => {
    const g = c.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    g.addColorStop(0, '#fffaf0'); g.addColorStop(.17, '#f6efe0'); g.addColorStop(.2, 'rgba(230,225,255,.35)'); g.addColorStop(.5, 'rgba(160,180,255,.08)'); g.addColorStop(1, 'rgba(120,140,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, w);
  });
  const moon = new T.Sprite(new T.SpriteMaterial({ map: moonTex, fog: false, depthWrite: false, transparent: true }));
  moon.position.set(-34, 54, -150); moon.scale.setScalar(46); scene.add(moon);
  // Distant city silhouette with domes and minarets on the horizon.
  {
    const sil = new T.MeshBasicMaterial({ color: 0x0b121d, fog: false });
    const city = new T.Group(); city.position.z = -150; scene.add(city);
    const block = (x, w, h) => { const m = new T.Mesh(new T.BoxGeometry(w, h, 4), sil); m.position.set(x, h / 2 - 1, 0); city.add(m); };
    for (let x = -120; x < 120; x += 4 + rand() * 6) block(x, 4 + rand() * 7, 3 + rand() * 9);
    const mosque = (x, s) => {
      block(x, 16 * s, 9 * s);
      const dome = new T.Mesh(new T.SphereGeometry(6.2 * s, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), sil); dome.position.set(x, 8 * s - 1, 0); city.add(dome);
      for (const dx of [-1, 1]) { const sd = new T.Mesh(new T.SphereGeometry(2.6 * s, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), sil); sd.position.set(x + dx * 6.5 * s, 8 * s - 1, 0); city.add(sd); }
      for (const dx of [-1, 1]) {
        const m = new T.Mesh(new T.CylinderGeometry(.55 * s, .7 * s, 30 * s, 10), sil); m.position.set(x + dx * 11 * s, 15 * s - 1, 0); city.add(m);
        const cap = new T.Mesh(new T.ConeGeometry(.75 * s, 4.5 * s, 10), sil); cap.position.set(x + dx * 11 * s, 32 * s - 1, 0); city.add(cap);
        const bal = new T.Mesh(new T.CylinderGeometry(1.05 * s, 1.05 * s, .6 * s, 10), sil); bal.position.set(x + dx * 11 * s, 22 * s - 1, 0); city.add(bal);
      }
    };
    mosque(18, 1); mosque(-46, .7);
  }

  // ——— Ground: scrolling cobblestone road and grass ———
  const roadTex = canvasTex(256, 512, (c, w, h) => {
    c.fillStyle = '#3c3f3c'; c.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 26) for (let x = (y / 26) % 2 ? -18 : 0; x < w; x += 38) {
      const l = 52 + Math.floor(Math.random() * 26);
      c.fillStyle = `rgb(${l},${l + 3},${l})`; c.beginPath(); c.roundRect(x + 2, y + 2, 34 + Math.random() * 4, 22, 7); c.fill();
      c.fillStyle = 'rgba(255,255,255,.05)'; c.fillRect(x + 6, y + 4, 22, 3);
    }
  }, [1.6, 16]);
  const grassTex = canvasTex(256, 256, (c, w) => {
    c.fillStyle = '#17241c'; c.fillRect(0, 0, w, w);
    for (let i = 0; i < 2600; i++) { const g = 30 + Math.random() * 30; c.fillStyle = `rgba(${g * .5},${g},${g * .6},.6)`; c.fillRect(Math.random() * w, Math.random() * w, 1.5, 3); }
  }, [14, 30]);
  const ground = new T.Mesh(new T.PlaneGeometry(160, 300), new T.MeshStandardMaterial({ map: grassTex, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, -.02, -100); ground.receiveShadow = true; scene.add(ground);
  const road = new T.Mesh(new T.PlaneGeometry(7.4, 150), new T.MeshStandardMaterial({ map: roadTex, roughness: .92, metalness: .05 }));
  road.rotation.x = -Math.PI / 2; road.position.set(0, 0, -55); road.receiveShadow = true; scene.add(road);
  const curbMat = new T.MeshStandardMaterial({ color: 0x6f6d62, roughness: .9 });
  for (const s of [-1, 1]) { const c = new T.Mesh(new T.BoxGeometry(.25, .12, 150), curbMat); c.position.set(s * 3.82, .05, -55); c.receiveShadow = true; scene.add(c); }

  // ——— Roadside: cypress trees, lanterns, old headstones (all scroll toward the camera) ———
  const roadside = [];
  const cypressMats = [0x10241a, 0x132a1f, 0x0f2018].map(color => new T.MeshStandardMaterial({ color, roughness: 1 }));
  const barkMat = new T.MeshStandardMaterial({ color: 0x2a221c, roughness: 1 });
  const cypressGeo = new T.SphereGeometry(1, 10, 12); cypressGeo.scale(.62, 3.4, .62);
  const trunkGeo = new T.CylinderGeometry(.09, .14, 1.2, 6);
  function cypress(x, z, s) {
    const g = new T.Group(); g.position.set(x, 0, z);
    const trunk = new T.Mesh(trunkGeo, barkMat); trunk.position.y = .6 * s; trunk.scale.setScalar(s); g.add(trunk);
    const crown = new T.Mesh(cypressGeo, cypressMats[Math.floor(rand() * 3)]); crown.position.y = 3.6 * s; crown.scale.setScalar(s); crown.castShadow = true; g.add(crown);
    scene.add(g); roadside.push(g);
  }
  const lampMetal = new T.MeshStandardMaterial({ color: 0x15191a, roughness: .5, metalness: .6 });
  const lampGlass = new T.MeshStandardMaterial({ color: 0xffe2a8, emissive: 0xffb24d, emissiveIntensity: 2.4 });
  const lampLights = [];
  function lantern(x, z, withLight) {
    const g = new T.Group(); g.position.set(x, 0, z);
    const post = new T.Mesh(new T.CylinderGeometry(.05, .08, 3.3, 8), lampMetal); post.position.y = 1.65; g.add(post);
    const glass = new T.Mesh(new T.BoxGeometry(.28, .4, .28), lampGlass); glass.position.y = 3.5; g.add(glass);
    const cap = new T.Mesh(new T.ConeGeometry(.3, .3, 4), lampMetal); cap.position.y = 3.86; cap.rotation.y = Math.PI / 4; g.add(cap);
    const halo = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color: 0xffc070, blending: T.AdditiveBlending, depthWrite: false, transparent: true, opacity: .85 }));
    halo.position.y = 3.5; halo.scale.setScalar(2.4); g.add(halo);
    if (withLight) { const l = new T.PointLight(0xffb060, 9, 11, 1.6); l.position.y = 3.4; g.add(l); lampLights.push(l); }
    scene.add(g); roadside.push(g);
  }
  const stoneMat = new T.MeshStandardMaterial({ color: 0x8c8a7e, roughness: .95 });
  const stoneGeo = new T.CapsuleGeometry(.2, .9, 4, 8);
  function headstone(x, z) {
    const s = new T.Mesh(stoneGeo, stoneMat); s.position.set(x, .45, z); s.rotation.set((rand() - .5) * .25, rand() * 3, (rand() - .5) * .3); s.scale.set(1, .7 + rand() * .7, .45);
    s.castShadow = true; scene.add(s); roadside.push(s);
  }
  for (let i = 0; i < 26; i++) {
    const z = -70 + i * 3.2;
    cypress(-5.2 - rand() * .8, z, .85 + rand() * .35);
    cypress(5.2 + rand() * .8, z + 1.6, .85 + rand() * .35);
    if (i % 3 === 0) lantern(i % 6 ? 4.25 : -4.25, z + .8, i % 6 === 0 ? lampLights.length < 3 : lampLights.length < 5);
    if (rand() > .45) headstone((rand() > .5 ? 1 : -1) * (6.8 + rand() * 3), z + rand() * 3);
  }

  // ——— Atmosphere: drifting mist and fireflies ———
  const mistTex = canvasTex(256, 256, (c, w) => {
    const g = c.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    g.addColorStop(0, 'rgba(190,205,220,.35)'); g.addColorStop(1, 'rgba(190,205,220,0)'); c.fillStyle = g; c.fillRect(0, 0, w, w);
  });
  const mists = [];
  for (let i = 0; i < 14; i++) {
    const m = new T.Mesh(new T.PlaneGeometry(14, 5), new T.MeshBasicMaterial({ map: mistTex, transparent: true, opacity: .32, depthWrite: false }));
    m.position.set((rand() - .5) * 18, .6 + rand() * .8, -40 + rand() * 50); m.userData.drift = rand() * Math.PI * 2;
    scene.add(m); mists.push(m);
  }
  const flyCount = 70, flyPos = new Float32Array(flyCount * 3), flyPhase = [];
  for (let i = 0; i < flyCount; i++) { flyPos.set([(rand() - .5) * 16, .5 + rand() * 4.5, -30 + rand() * 42], i * 3); flyPhase.push(rand() * 6.28); }
  const flyGeo = new T.BufferGeometry(); flyGeo.setAttribute('position', new T.BufferAttribute(flyPos, 3));
  scene.add(new T.Points(flyGeo, new T.PointsMaterial({ map: glowTex, color: 0xffd98a, size: .22, transparent: true, blending: T.AdditiveBlending, depthWrite: false })));

  // ——— Lights ———
  scene.add(new T.HemisphereLight(0x9cb3d8, 0x1b2119, 1.05));
  const moonLight = new T.DirectionalLight(0xb7c9ff, 1.55); moonLight.position.set(-9, 20, -8);
  moonLight.castShadow = true; moonLight.shadow.mapSize.set(2048, 2048);
  Object.assign(moonLight.shadow.camera, { left: -11, right: 11, top: 16, bottom: -14, near: 1, far: 60 }); moonLight.shadow.bias = -.0004;
  scene.add(moonLight);
  const key = new T.SpotLight(0xffc98c, 34, 34, .5, .7, 1.25); key.position.set(3.5, 12, 7); key.target.position.set(0, 1.4, .5);
  key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -.0004; scene.add(key, key.target);
  const portraitSpot = new T.SpotLight(0xffd88f, 55, 22, .3, .7, 1.2); portraitSpot.position.set(0, 11, PORTRAIT_Z + 2.5); portraitSpot.target.position.set(0, 2.4, PORTRAIT_Z);
  scene.add(portraitSpot, portraitSpot.target);
  const rimLight = new T.DirectionalLight(0x6fa3ff, .7); rimLight.position.set(6, 6, -12); scene.add(rimLight);

  // ——— Materials ———
  const M = {
    wood: new T.MeshStandardMaterial({ color: 0x3a2618, roughness: .55, metalness: .05 }),
    woodDark: new T.MeshStandardMaterial({ color: 0x24170f, roughness: .6 }),
    gold: new T.MeshStandardMaterial({ color: 0xcaa257, metalness: .85, roughness: .28, emissive: 0x2a1c05 }),
    pole: new T.MeshStandardMaterial({ color: 0x2c1d12, roughness: .7 }),
    white: new T.MeshStandardMaterial({ color: 0xece6d6, roughness: .9 }),
    red: new T.MeshStandardMaterial({ color: 0x8e1022, roughness: .8 }),
    leaf: new T.MeshStandardMaterial({ color: 0x2f5a3a, roughness: .95 }),
    black: new T.MeshStandardMaterial({ color: 0x0b0d0e, roughness: .6 }),
    frameBack: new T.MeshStandardMaterial({ color: 0x0b0f0e, roughness: .8 }),
  };

  // ——— Coffin: wooden tabut under a green drape embroidered in gold ———
  const drapeTex = canvasTex(512, 1024, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#0f4a32'); g.addColorStop(.5, '#17643f'); g.addColorStop(1, '#0c3b29');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 3000; i++) { c.fillStyle = `rgba(0,0,0,${Math.random() * .06})`; c.fillRect(Math.random() * w, Math.random() * h, 1, 6); }
    c.strokeStyle = '#d6b265'; c.lineWidth = 14; c.strokeRect(24, 24, w - 48, h - 48);
    c.strokeStyle = '#f0d590'; c.lineWidth = 3; c.strokeRect(50, 50, w - 100, h - 100);
    c.fillStyle = '#d9b86d';
    for (let y = 70; y < h - 70; y += 44) { for (const x of [36, w - 36]) { c.beginPath(); c.moveTo(x, y - 9); c.lineTo(x + 7, y); c.lineTo(x, y + 9); c.lineTo(x - 7, y); c.fill(); } }
    c.textAlign = 'center'; c.shadowColor = 'rgba(0,0,0,.45)'; c.shadowBlur = 6;
    c.fillStyle = '#f3d68f'; c.font = '600 74px Georgia, serif'; c.fillText('EŞREF', w / 2, h / 2 - 20); c.fillText('TEK', w / 2, h / 2 + 64);
    c.font = 'italic 30px Georgia, serif'; c.fillStyle = '#e6c983'; c.fillText('— son yolculuk —', w / 2, h / 2 + 130);
    c.font = '54px Georgia, serif'; c.fillText('❦', w / 2, h / 2 - 140); c.fillText('❦', w / 2, h / 2 + 230);
  });
  const coffin = new T.Group(); scene.add(coffin);
  const COFFIN_Y = 1.72;
  {
    const body = new T.Mesh(new T.BoxGeometry(1.18, .5, 2.8), new T.MeshStandardMaterial({ color: 0x125538, roughness: .92 })); body.position.y = COFFIN_Y + .25; coffin.add(body);
    const plinth = new T.Mesh(new T.BoxGeometry(1.22, .08, 2.85), M.woodDark); plinth.position.y = COFFIN_Y + .04; coffin.add(plinth);
    // Pitched lid (Ottoman-style tabut silhouette)
    const lidShape = new T.Shape(); lidShape.moveTo(-.6, 0); lidShape.lineTo(.6, 0); lidShape.lineTo(.42, .26); lidShape.lineTo(-.42, .26); lidShape.closePath();
    const lidGeo = new T.ExtrudeGeometry(lidShape, { depth: 2.8, bevelEnabled: false }); lidGeo.translate(0, 0, -1.4);
    const drapeMat = new T.MeshStandardMaterial({ map: drapeTex, roughness: .88, side: T.DoubleSide });
    const lid = new T.Mesh(lidGeo, new T.MeshStandardMaterial({ color: 0x135a3b, roughness: .9 })); lid.position.y = COFFIN_Y + .5; coffin.add(lid);
    const top = new T.Mesh(new T.PlaneGeometry(.84, 2.8), drapeMat); top.rotation.x = -Math.PI / 2; top.position.y = COFFIN_Y + .762; coffin.add(top);
    for (const s of [-1, 1]) {
      const fringe = new T.Mesh(new T.BoxGeometry(.03, .05, 2.84), M.gold); fringe.position.set(s * .6, COFFIN_Y + .1, 0); coffin.add(fringe);
      const pole = new T.Mesh(new T.BoxGeometry(.11, .11, 4.1), M.pole); pole.position.set(s * .86, COFFIN_Y - .06, 0); pole.castShadow = true; coffin.add(pole);
      const trim = new T.Mesh(new T.BoxGeometry(.03, .04, 2.8), M.gold); trim.position.set(s * .6, COFFIN_Y + .51, 0); coffin.add(trim);
      for (const z of [-1.95, 1.95]) { const knob = new T.Mesh(new T.SphereGeometry(.07, 10, 8), M.gold); knob.position.set(s * .86, COFFIN_Y - .06, z); coffin.add(knob); }
    }
    for (const z of [-1, 1]) { const end = new T.Mesh(new T.BoxGeometry(1.16, .04, .04), M.gold); end.position.set(0, COFFIN_Y + .51, z * 1.4); coffin.add(end); }
    // Rose wreath and loose roses
    const rose = new T.SphereGeometry(.07, 8, 6), leafG = new T.SphereGeometry(.06, 6, 4); leafG.scale(1.6, .4, .8);
    const wreath = new T.Group(); wreath.position.set(0, COFFIN_Y + .8, -.95); coffin.add(wreath);
    for (let i = 0; i < 14; i++) {
      const a = i / 14 * Math.PI * 2;
      const f = new T.Mesh(rose, i % 3 ? M.white : M.red); f.position.set(Math.sin(a) * .28, .03, Math.cos(a) * .2); wreath.add(f);
      const l = new T.Mesh(leafG, M.leaf); l.position.set(Math.sin(a) * .36, 0, Math.cos(a) * .26); l.rotation.y = a; wreath.add(l);
    }
    for (let i = 0; i < 7; i++) { const f = new T.Mesh(rose, i % 2 ? M.red : M.white); f.position.set((rand() - .5) * .5, COFFIN_Y + .79, .6 + rand() * .55); coffin.add(f); }
    coffin.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  }

  // ——— Portrait frame held aloft by the VIP ———
  const portraitRig = new T.Group(); portraitRig.position.z = PORTRAIT_Z; scene.add(portraitRig);
  const FRAME_Y = 2.55, FW = .9, FH = 1.16;
  {
    const pole = new T.Mesh(new T.CylinderGeometry(.035, .035, .9, 8), M.pole); pole.position.set(0, 1.62, .05); portraitRig.add(pole);
    const outer = new T.Mesh(new T.BoxGeometry(FW + .2, FH + .2, .1), M.gold); outer.position.set(0, FRAME_Y, 0); portraitRig.add(outer);
    const back = new T.Mesh(new T.BoxGeometry(FW, FH, .1), M.frameBack); back.position.set(0, FRAME_Y, .01); portraitRig.add(back);
    portraitRig.traverse(o => { if (o.isMesh) o.castShadow = true; });
  }
  const signOverlay = document.createElement('div'); signOverlay.className = 'portrait-world';
  const photoEl = document.createElement('img'); photoEl.alt = ''; photoEl.decoding = 'async'; photoEl.referrerPolicy = 'no-referrer';
  const monogram = document.createElement('b'); monogram.className = 'portrait-monogram'; monogram.textContent = 'ET';
  const signName = document.createElement('span'); signName.textContent = 'EŞREF TEK';
  const ribbonEl = document.createElement('i'); ribbonEl.className = 'ribbon';
  const sheen = document.createElement('i'); sheen.className = 'sheen';
  const corners = document.createElement('i'); corners.className = 'corners';
  signOverlay.append(monogram, photoEl, sheen, corners, ribbonEl, signName); labelsRoot.append(signOverlay);
  photoEl.addEventListener('load', () => signOverlay.classList.add('has-photo'));
  photoEl.addEventListener('error', () => signOverlay.classList.remove('has-photo'));
  let currentPortraitUrl = '';
  // Heavenly beam over the portrait bearer.
  const beam = new T.Mesh(new T.CylinderGeometry(.3, 1.3, 11, 32, 1, true), new T.MeshBasicMaterial({ color: 0xffd58a, transparent: true, opacity: .06, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false }));
  beam.position.set(0, 7.2, PORTRAIT_Z); scene.add(beam);

  // ——— People ———
  const G = {
    torso: new T.CylinderGeometry(.22, .17, .72, 10),
    chest: new T.BoxGeometry(.44, .36, .22),
    shirt: new T.BoxGeometry(.13, .3, .02),
    tie: new T.BoxGeometry(.045, .27, .016),
    head: new T.SphereGeometry(.165, 16, 12),
    hair: new T.SphereGeometry(.172, 14, 8, 0, Math.PI * 2, 0, Math.PI * .46),
    scarf: new T.SphereGeometry(.18, 12, 8, 0, Math.PI * 2, Math.PI * .25, Math.PI * .75),
    leg: new T.CylinderGeometry(.08, .07, .8, 8).translate(0, -.4, 0),
    shoe: new T.BoxGeometry(.18, .1, .3),
    arm: new T.CylinderGeometry(.074, .06, .58, 8).translate(0, -.29, 0),
    hand: new T.SphereGeometry(.068, 8, 6),
    shadow: new T.CircleGeometry(.36, 18),
    candle: new T.CylinderGeometry(.035, .035, .22, 8),
    flame: new T.SphereGeometry(.035, 8, 6).scale(1, 1.9, 1),
    sash: new T.BoxGeometry(.08, .82, .25),
  };
  const matCache = new Map();
  const mat = (color, extra = {}) => { const k = color + JSON.stringify(extra); if (!matCache.has(k)) matCache.set(k, new T.MeshStandardMaterial({ color, roughness: .85, ...extra })); return matCache.get(k); };
  const skin = [0xc89676, 0xd8ad88, 0xb17a58, 0xe2bc98, 0x9c6a4b];
  const suits = [0x15191c, 0x1b2024, 0x232628, 0x1a1d22, 0x101315, 0x262a30];
  const hairs = [0x161210, 0x2a1d17, 0x3a2a1f, 0x0f0d0c, 0x5b4636];
  const shadowMat = new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .32, depthWrite: false });
  const flameMat = new T.MeshBasicMaterial({ color: 0xffd27a });
  const hashOf = s => [...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  function makeHuman(id) {
    const h = hashOf(id), g = new T.Group();
    const scarfWoman = h % 5 === 1;
    const suitM = mat(suits[h % suits.length]), skinM = mat(skin[(h >>> 3) % skin.length]), hairM = mat(hairs[(h >>> 5) % hairs.length]);
    const body = new T.Group(); g.add(body);
    const add = (geo, m, x, y, z, parent = body) => { const o = new T.Mesh(geo, m); o.position.set(x, y, z); parent.add(o); return o; };
    add(G.torso, suitM, 0, 1.2, 0); add(G.chest, suitM, 0, 1.42, 0);
    add(G.shirt, M.white, 0, 1.43, .112); add(G.tie, M.black, 0, 1.41, .124);
    const head = add(G.head, skinM, 0, 1.84, 0); head.scale.set(.95, 1.12, .95);
    if (scarfWoman) add(G.scarf, mat(0x1a1a1f), 0, 1.86, -.005).scale.set(1.08, 1.18, 1.08);
    else add(G.hair, hairM, 0, 1.9, -.01);
    const legs = [];
    for (const s of [-1, 1]) {
      const p = new T.Group(); p.position.set(s * .11, .86, 0); g.add(p);
      add(G.leg, mat(0x101214), 0, 0, 0, p); add(G.shoe, mat(0x07090a, { roughness: .4 }), 0, -.8, .06, p); legs.push(p);
    }
    const arms = [];
    for (const s of [-1, 1]) {
      const p = new T.Group(); p.position.set(s * .28, 1.55, 0); body.add(p);
      add(G.arm, suitM, 0, 0, 0, p); add(G.hand, skinM, 0, -.6, 0, p); arms.push(p);
    }
    const sh = new T.Mesh(G.shadow, shadowMat); sh.rotation.x = -Math.PI / 2; sh.position.y = .015; g.add(sh);
    // Candle (shown once the viewer has liked the stream)
    const candle = new T.Group(); candle.position.set(0, -.66, .08); arms[1].add(candle);
    add(G.candle, mat(0xf3ead6, { emissive: 0x332611 }), 0, .02, 0, candle);
    const flame = add(G.flame, flameMat, 0, .17, 0, candle);
    const glow = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color: 0xffb04a, blending: T.AdditiveBlending, depthWrite: false, transparent: true, opacity: .9 }));
    glow.position.y = .17; glow.scale.setScalar(.55); candle.add(glow); candle.visible = false;
    const sash = add(G.sash, M.gold, 0, 1.3, 0); sash.rotation.z = .55; sash.visible = false;
    g.traverse(o => { if (o.isMesh && o !== sh) o.castShadow = true; });
    scene.add(g);
    return { group: g, body, legs, arms, head, candle, flame, glow, sash, phase: (h % 100) / 100 * Math.PI * 2 };
  }

  // ——— Effects: petals, sparkles, rings ———
  const PETALS = 260;
  const petalGeo = new T.PlaneGeometry(.11, .075);
  const petalMesh = new T.InstancedMesh(petalGeo, new T.MeshStandardMaterial({ side: T.DoubleSide, roughness: .7 }), PETALS);
  petalMesh.instanceMatrix.setUsage(T.DynamicDrawUsage); scene.add(petalMesh);
  const petals = Array.from({ length: PETALS }, (_, i) => ({ p: new T.Vector3(0, -10, 0), v: new T.Vector3(), r: new T.Euler(), s: new T.Vector3(rand() * 3, rand() * 3, rand() * 3), life: 0 }));
  const petalColors = [0xa3122a, 0xc4203c, 0xf2ece0, 0x7d0c1f, 0xe8d9c4];
  petals.forEach((_, i) => petalMesh.setColorAt(i, new T.Color(petalColors[i % petalColors.length])));
  let petalCursor = 0;
  function spawnPetal(x, y, z, burst) {
    const pt = petals[petalCursor = (petalCursor + 1) % PETALS];
    pt.p.set(x, y, z); pt.v.set((Math.random() - .5) * (burst ? 2.2 : .4), burst ? Math.random() * 1.6 : -.3, (Math.random() - .5) * (burst ? 2.2 : .4) - SPEED * .5);
    pt.life = 9;
  }
  const SPARKS = 700, sparkPos = new Float32Array(SPARKS * 3), sparkCol = new Float32Array(SPARKS * 3), sparks = [];
  for (let i = 0; i < SPARKS; i++) { sparks.push({ v: new T.Vector3(), life: 0, max: 1, c: new T.Color() }); sparkPos[i * 3 + 1] = -50; }
  const sparkGeo = new T.BufferGeometry();
  sparkGeo.setAttribute('position', new T.BufferAttribute(sparkPos, 3)); sparkGeo.setAttribute('color', new T.BufferAttribute(sparkCol, 3));
  scene.add(new T.Points(sparkGeo, new T.PointsMaterial({ size: .13, map: glowTex, vertexColors: true, transparent: true, blending: T.AdditiveBlending, depthWrite: false })));
  let sparkCursor = 0;
  function burst(x, y, z, count = 60, color = 0xffd07a, power = 1) {
    for (let i = 0; i < count; i++) {
      const k = sparkCursor = (sparkCursor + 1) % SPARKS, s = sparks[k];
      sparkPos.set([x + (Math.random() - .5) * .3, y + (Math.random() - .5) * .3, z + (Math.random() - .5) * .3], k * 3);
      const a = Math.random() * Math.PI * 2, u = Math.random();
      s.v.set(Math.cos(a) * u * 1.6 * power, (1 + Math.random() * 2.4) * power, Math.sin(a) * u * 1.6 * power);
      s.life = s.max = 1.2 + Math.random() * 1.2; s.c.set(color).offsetHSL(0, 0, (Math.random() - .5) * .2);
    }
  }
  const rings = [];
  const ringGeo = new T.RingGeometry(.42, .5, 40);
  function ring(x, z, color = 0xffd07a) {
    const m = new T.Mesh(ringGeo, new T.MeshBasicMaterial({ color, transparent: true, opacity: .9, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, .04, z); scene.add(m); rings.push({ m, t: 0 });
  }
  let beamBoost = 0;

  // ——— State sync ———
  const personCache = new Map();
  let activeState = { carriers: Array(6).fill(null), people: [], portraitBearer: null };
  const CARRIER_POS = i => ({ x: i < 3 ? -1.02 : 1.02, z: [1.3, 0, -1.3][i % 3] });
  function crowdSlot(i) {
    const row = Math.floor(i / 5), col = i % 5;
    return { x: (col - 2) * 1.02 + (row % 2 ? .3 : -.1), z: -3.35 - row * 1.12 - (col % 2) * .12 };
  }
  function syncPeople(s) {
    activeState = s;
    const onStage = new Map();
    s.carriers.forEach((p, i) => { if (p) onStage.set(p.id, i); });
    if (s.portraitBearer) onStage.set(s.portraitBearer.id, 6);
    if (s.portraitUrl && s.portraitUrl !== currentPortraitUrl) { currentPortraitUrl = s.portraitUrl; signOverlay.classList.remove('has-photo'); photoEl.src = currentPortraitUrl; }
    const assignments = [];
    for (let i = 0; i < 6; i++) {
      const p = s.carriers[i], pos = CARRIER_POS(i);
      assignments.push({ id: p?.id || `empty-${i}`, person: p, ...pos, role: 'carrier', slot: i, empty: !p });
    }
    assignments.push({ id: s.portraitBearer?.id || 'portrait-empty', person: s.portraitBearer, x: 0, z: PORTRAIT_Z, role: 'portrait', slot: 6, empty: !s.portraitBearer });
    const crowd = s.people.filter(p => !onStage.has(p.id)).slice(-MAX_CROWD).reverse();
    crowd.forEach((p, i) => assignments.push({ id: p.id, person: p, ...crowdSlot(i), role: 'crowd', slot: -1, row: Math.floor(i / 5), empty: false }));
    const active = new Set(assignments.map(a => a.id));
    for (const [id, rig] of personCache) if (!active.has(id)) { scene.remove(rig.group); rig.label.remove(); personCache.delete(id); }
    for (const a of assignments) {
      let rig = personCache.get(a.id);
      if (!rig) {
        rig = makeHuman(a.id);
        rig.group.position.set(a.x, 0, a.role === 'crowd' ? a.z - 4 : a.z - 2.5);
        rig.label = document.createElement('div'); rig.label.className = 'world-name';
        rig.handle = document.createElement('span'); rig.handle.className = 'handle';
        rig.bubble = document.createElement('span'); rig.bubble.className = 'bubble';
        rig.label.append(rig.bubble, rig.handle); labelsRoot.append(rig.label);
        personCache.set(a.id, rig);
      }
      rig.target = a;
      rig.group.visible = true;
      const p = a.person;
      rig.handle.textContent = a.empty ? (a.role === 'portrait' ? '👑 Hediye at, sen taşı' : '') : a.role === 'portrait' ? `👑 @${p.name}` : a.role === 'carrier' ? `@${p.name} ❤️${(p.likes || 0).toLocaleString('tr-TR')}` : `@${p.name}`;
      const fresh = p?.comment && Date.now() - p.commentAt < 7000;
      if (fresh && rig.bubble.textContent !== p.comment) { rig.bubble.textContent = p.comment; rig.bubbleUntil = p.commentAt + 7000; }
      rig.label.className = `world-name ${a.role}${a.empty ? ' empty' : ''}`;
      rig.candle.visible = !a.empty && Boolean(p?.followed);
      rig.sash.visible = a.role === 'portrait' && !a.empty;
      rig.group.scale.setScalar(a.role === 'portrait' ? 1.06 : 1);
      rig.ghost = a.empty;
    }
  }
  function slotWorld(slot) {
    if (slot === 6 || slot === -1) return new T.Vector3(0, FRAME_Y, PORTRAIT_Z);
    const { x, z } = CARRIER_POS(slot); return new T.Vector3(x, 2.1, z);
  }
  function fx(e) {
    if (!e) return;
    if (e.type === 'carrier') {
      const at = slotWorld(e.slot ?? 0);
      burst(at.x, at.y, at.z, 50, 0xff8a6a, .8); ring(at.x, at.z, 0xff9a7a);
      return;
    }
    if (e.type === 'gift') {
      const big = (e.points || 0) >= 100 || (e.amount || 1) >= 10;
      const at = slotWorld(e.slot ?? 0);
      burst(at.x, at.y, at.z, big ? 160 : 70, 0xffd07a, big ? 1.4 : 1);
      if (e.newCarrier) ring(at.x, at.z);
      for (let i = 0; i < (big ? 70 : 18); i++) spawnPetal((Math.random() - .5) * 3, 5 + Math.random() * 2, (Math.random() - .5) * 4, true);
    } else if (e.type === 'portrait') {
      beamBoost = 1;
      burst(0, FRAME_Y, PORTRAIT_Z, 260, 0xffe2a0, 1.6); ring(0, PORTRAIT_Z, 0xffe9b0);
      for (let i = 0; i < 90; i++) spawnPetal((Math.random() - .5) * 4, 6 + Math.random() * 2, PORTRAIT_Z + (Math.random() - .5) * 3, true);
    } else if (e.type === 'like' || e.type === 'milestone') {
      const rig = [...personCache.values()].find(r => r.target?.person?.name === e.name);
      if (rig) { const p = rig.group.position; burst(p.x, 1.4, p.z, 14, 0xffa94a, .5); }
      if (e.type === 'milestone') for (let i = 0; i < 120; i++) spawnPetal((Math.random() - .5) * 8, 7 + Math.random() * 3, (Math.random() - .5) * 14, false);
    } else if (e.type === 'join' || e.type === 'follow') {
      const rig = [...personCache.values()].find(r => r.target?.person?.name === e.name);
      if (rig) ring(rig.target.x, rig.target.z, e.type === 'follow' ? 0xff6b8a : 0x9fd3ff);
    }
  }

  // ——— Camera ———
  const views = [
    { pos: new T.Vector3(0, 10, 19), look: new T.Vector3(0, 1.5, 0) },     // Klasik
    { pos: new T.Vector3(7.6, 10, 17.4), look: new T.Vector3(.2, 1.5, 0) },    // Yandan
    { pos: new T.Vector3(-3, 8.6, 19.4), look: new T.Vector3(0, 1.8, .4) },   // Alçak açı
  ];
  let cameraMode = 3; // 3 = automatic cinematic drift
  const camPos = views[0].pos.clone(), camLook = views[0].look.clone();
  camera.position.copy(camPos); camera.lookAt(camLook);
  function cameraGoal(t) {
    if (cameraMode < 3) return views[cameraMode];
    const yaw = Math.sin(t * .045) * .24, rise = Math.sin(t * .031 + 1) * .5, dist = 18.9 + Math.sin(t * .027) * .5;
    return { pos: new T.Vector3(Math.sin(yaw) * dist, 10 + rise, Math.cos(yaw) * dist), look: new T.Vector3(Math.sin(yaw) * -.3, 1.5, 0) };
  }

  // ——— Labels (DOM) with simple collision avoidance ———
  const vec = new T.Vector3();
  function project(v, rect) { vec.copy(v).project(camera); return { x: (vec.x * .5 + .5) * rect.width, y: (-vec.y * .5 + .5) * rect.height, z: vec.z }; }
  function showLabels() {
    const rect = canvas.getBoundingClientRect(), now = Date.now(), placed = [];
    const rigs = [...personCache.values()].filter(r => r.target);
    const prio = r => r.target.role === 'portrait' ? 0 : r.target.role === 'carrier' ? 1 : (r.bubbleUntil > now ? 2 : 3 + (r.target.row || 0));
    rigs.sort((a, b) => prio(a) - prio(b));
    let crowdShown = 0;
    for (const rig of rigs) {
      const t = rig.target, lab = rig.label;
      const talking = rig.bubbleUntil > now;
      lab.classList.toggle('talking', talking);
      if (t.empty && t.role !== 'portrait') { lab.style.display = 'none'; continue; }
      if (t.role === 'crowd' && !talking && (crowdShown >= 30 || t.row > 9)) { lab.style.display = 'none'; continue; }
      if (t.role === 'portrait') portraitRig.localToWorld(vec.set(0, FRAME_Y + FH / 2 + .1, 0)); else { rig.group.getWorldPosition(vec); vec.y += 2.28; }
      const p = project(vec, rect);
      const u = rect.width / 540;
      if (talking) p.y = Math.max(p.y, rect.height * HUD_BOTTOM + 50 * u);
      const isBlocked = blocked(p.x / rect.width, p.y / rect.height);
      if (p.z > 1 || p.x < -40 || p.x > rect.width + 40 || p.y < 0 || p.y > rect.height) { lab.style.display = 'none'; continue; }
      const chars = (rig.handle.textContent || '').length;
      const w = (talking ? 170 : Math.min(120, chars * (t.role === 'crowd' ? 5.4 : 6.2) + 12)) * u, h = (talking ? 50 : t.role === 'crowd' ? 13 : 18) * u;
      const box = t.role === 'portrait' ? { l: p.x - 80, r: p.x + 80, t: p.y - 22, b: p.y } : { l: p.x - w / 2, r: p.x + w / 2, t: p.y - h, b: p.y };
      const hits = o => box.l < o.r && box.r > o.l && box.t < o.b && box.b > o.t;
      if (t.role === 'crowd' && (talking ? placed.some(o => o.talking && hits(o)) : (isBlocked || placed.some(hits)))) { lab.style.display = 'none'; continue; }
      box.talking = talking;
      placed.push(box); if (t.role === 'crowd') crowdShown++;
      lab.style.display = 'block';
      lab.style.transform = `translate(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px) translate(-50%,-100%)`;
    }
    const corners = [[-FW / 2, FRAME_Y + FH / 2], [FW / 2, FRAME_Y + FH / 2], [-FW / 2, FRAME_Y - FH / 2], [FW / 2, FRAME_Y - FH / 2]]
      .map(([x, y]) => project(portraitRig.localToWorld(new T.Vector3(x, y, .07)), rect));
    if (corners.some(c => c.z > 1)) signOverlay.style.display = 'none';
    else {
      const xs = corners.map(c => c.x), ys = corners.map(c => c.y);
      const l = Math.min(...xs), tp = Math.min(...ys);
      signOverlay.style.display = 'flex';
      signOverlay.style.transform = `translate(${l.toFixed(1)}px,${tp.toFixed(1)}px)`;
      signOverlay.style.width = `${(Math.max(...xs) - l).toFixed(1)}px`; signOverlay.style.height = `${(Math.max(...ys) - tp).toFixed(1)}px`;
    }
  }

  let composer = null, bloomPass = null;
  function resize() {
    const width = canvas.clientWidth || 540, height = canvas.clientHeight || 960;
    renderer.setSize(width, height, false);
    camera.aspect = width / height; camera.setViewOffset(width, height, width * SHIFT_X, 0, width, height);
    composer?.setSize(width, height);
  }
  // Optional bloom: lanterns, candles, gold trim and sparks glow softly.
  function enableBloom({ EffectComposer, RenderPass, UnrealBloomPass, OutputPass }) {
    const width = canvas.clientWidth || 540, height = canvas.clientHeight || 960;
    composer = new EffectComposer(renderer);
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.addPass(new RenderPass(scene, camera));
    bloomPass = new UnrealBloomPass(new T.Vector2(width, height), .42, .55, .9);
    composer.addPass(bloomPass);
    composer.addPass(new OutputPass());
    composer.setSize(width, height);
  }
  new ResizeObserver(resize).observe(canvas); resize();

  // ——— Animation loop ———
  let paused = false, last = performance.now(), elapsed = 0, frameNo = 0, petalTimer = 0;
  document.addEventListener('visibilitychange', () => { paused = document.hidden; last = performance.now(); });
  const dummy = new T.Object3D();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(.06, (now - last) / 1000); last = now;
    if (paused) return;
    elapsed += dt; frameNo++;
    const step = elapsed * 3.4; // slow funeral march cadence
    // Road and scenery scroll
    roadTex.offset.y -= dt * SPEED * roadTex.repeat.y / 150;
    grassTex.offset.y -= dt * SPEED * grassTex.repeat.y / 300;
    for (const o of roadside) { o.position.z -= dt * SPEED; if (o.position.z < -67.2) o.position.z += 83.2; }
    for (const m of mists) { m.position.z -= dt * SPEED * .6; m.position.x += Math.sin(elapsed * .1 + m.userData.drift) * dt * .2; m.lookAt(camera.position.x, m.position.y, camera.position.z); if (m.position.z < -38) m.position.z += 52; }
    for (let i = 0; i < flyCount; i++) {
      flyPos[i * 3 + 1] += Math.sin(elapsed * .8 + flyPhase[i]) * dt * .25;
      flyPos[i * 3 + 2] -= dt * SPEED * .7; if (flyPos[i * 3 + 2] < -30) flyPos[i * 3 + 2] = 14;
    }
    flyGeo.attributes.position.needsUpdate = true;
    lampLights.forEach((l, i) => { l.intensity = 8.5 + Math.sin(elapsed * 9 + i * 3) * .4 + Math.sin(elapsed * 23 + i) * .3; });
    // People
    for (const rig of personCache.values()) {
      const t = rig.target; if (!t) continue;
      const g = rig.group;
      g.position.x += (t.x - g.position.x) * Math.min(1, dt * 2.6);
      g.position.z += (t.z - g.position.z) * Math.min(1, dt * 2.2);
      const ph = step + (t.role === 'crowd' ? rig.phase : 0);
      const swing = Math.sin(ph);
      g.position.y = Math.abs(Math.cos(ph)) * .028;
      rig.legs[0].rotation.x = swing * .34; rig.legs[1].rotation.x = -swing * .34;
      rig.body.rotation.z = Math.sin(ph * .5) * .02;
      rig.body.rotation.x = t.role === 'crowd' ? .06 : 0; // heads slightly bowed
      for (let i = 0; i < 2; i++) {
        const side = i ? 1 : -1, arm = rig.arms[i];
        if (t.role === 'carrier' && ((t.x < 0 && side === 1) || (t.x > 0 && side === -1))) { arm.rotation.set(-.25, 0, side * -2.55); }
        else if (t.role === 'portrait') { arm.rotation.set(-1.15, 0, side * -.22); }
        else if (i === 1 && rig.candle.visible) { arm.rotation.set(-1.05, 0, -.18); }
        else { arm.rotation.set(-swing * side * .22, 0, side * .06); }
      }
      if (rig.candle.visible) { const f = 1 + Math.sin(elapsed * 14 + rig.phase * 5) * .12; rig.flame.scale.set(1, f, 1); rig.glow.material.opacity = .65 + Math.sin(elapsed * 11 + rig.phase) * .2; }
    }
    const lift = Math.cos(step * 2) * .018;
    coffin.position.y = lift; coffin.rotation.z = Math.sin(step) * .012; coffin.rotation.x = Math.sin(step * .5) * .006;
    portraitRig.position.y = lift * 1.3; portraitRig.rotation.z = Math.sin(step) * .02;
    const bearerRig = personCache.get(activeState.portraitBearer?.id || 'portrait-empty');
    if (bearerRig) portraitRig.position.x = bearerRig.group.position.x;
    // Beam
    beamBoost = Math.max(0, beamBoost - dt * .45);
    beam.material.opacity = beamBoost * .09; beam.visible = beamBoost > .01;
    portraitSpot.intensity = 45 + beamBoost * 45;
    // Petals: gentle ambient fall plus bursts
    petalTimer += dt; while (petalTimer > .35) { petalTimer -= .35; spawnPetal((Math.random() - .5) * 9, 8, -6 + Math.random() * 14, false); }
    for (let i = 0; i < PETALS; i++) {
      const pt = petals[i];
      if (pt.life > 0) {
        pt.life -= dt;
        pt.v.y = Math.max(-.55, pt.v.y - dt * 1.4); pt.v.x *= .985; pt.v.z *= .985;
        pt.p.addScaledVector(pt.v, dt); pt.p.x += Math.sin(elapsed * 2 + i) * dt * .25; pt.p.z -= dt * SPEED * .4;
        if (pt.p.y < .03) { pt.p.y = .03; pt.v.set(0, 0, 0); pt.p.z -= dt * SPEED; }
        pt.r.set(elapsed * pt.s.x, elapsed * pt.s.y, elapsed * pt.s.z);
        if (pt.p.y <= .031) pt.r.set(-Math.PI / 2, 0, i);
      }
      dummy.position.copy(pt.life > 0 ? pt.p : new T.Vector3(0, -20, 0)); dummy.rotation.copy(pt.r); dummy.updateMatrix();
      petalMesh.setMatrixAt(i, dummy.matrix);
    }
    petalMesh.instanceMatrix.needsUpdate = true;
    // Sparks
    for (let i = 0; i < SPARKS; i++) {
      const s = sparks[i]; if (s.life <= 0) continue;
      s.life -= dt; const k = Math.max(0, s.life / s.max);
      s.v.y -= dt * .9; s.v.multiplyScalar(.985);
      sparkPos[i * 3] += s.v.x * dt; sparkPos[i * 3 + 1] += s.v.y * dt; sparkPos[i * 3 + 2] += s.v.z * dt;
      sparkCol[i * 3] = s.c.r * k; sparkCol[i * 3 + 1] = s.c.g * k; sparkCol[i * 3 + 2] = s.c.b * k;
      if (s.life <= 0) { sparkCol[i * 3] = sparkCol[i * 3 + 1] = sparkCol[i * 3 + 2] = 0; }
    }
    sparkGeo.attributes.position.needsUpdate = true; sparkGeo.attributes.color.needsUpdate = true;
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i]; r.t += dt; const k = r.t / 1.6;
      r.m.scale.setScalar(1 + k * 3.2); r.m.material.opacity = .9 * (1 - k);
      if (k >= 1) { scene.remove(r.m); r.m.material.dispose(); rings.splice(i, 1); }
    }
    // Camera
    const goal = cameraGoal(elapsed);
    camPos.lerp(goal.pos, Math.min(1, dt * (cameraMode < 3 ? 1.6 : .9)));
    camLook.lerp(goal.look, Math.min(1, dt * 1.6));
    camera.position.copy(camPos); camera.lookAt(camLook);
    if (bloomPass) bloomPass.strength = .42 + beamBoost * .35;
    if (composer) composer.render(); else renderer.render(scene, camera);
    if (frameNo % 2 === 0) showLabels();
  }
  requestAnimationFrame(frame);
  return {
    update: syncPeople,
    camera: mode => { cameraMode = ((mode % 4) + 4) % 4; },
    fx,
    enableBloom,
  };
}
