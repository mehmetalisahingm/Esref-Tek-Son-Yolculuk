import http from 'node:http';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(DIR, 'public');
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';
const MAX_PEOPLE = 100;
const MAX_EVENTS = 28;
// Official Kanal D Eşref Tek character profile picture, used as a remote default.
const DEFAULT_PORTRAIT_URL='https://image.kanald.com.tr/i/kanald/100/200x286/6864d72ccf62483f9cfa5def.jpg';
const PORTRAIT_COST=500;
const savedPortrait=['jpg','png','webp'].find(ext=>existsSync(path.join(PUBLIC,`portrait-custom.${ext}`)));

const seedUsers = ['alikaya','denizx','efemert','sevda','emir.07','buse','kubilay','ayse.52','yagmur','mustafa','berke','irem','furkan','selin','mertcan','ece','kaang','dila','onur','elif','kerem','berat','zeynep','melis','umutt','azra','yunus','gizem','sinem','harun'];
const state = { connected: false, connecting: false, connectionMessage: 'Demo modu', username: '', demo: true, carriers: Array(6).fill(null), portraitBearer:null, portraitCost:PORTRAIT_COST, portraitUrl:savedPortrait?`/portrait-custom.${savedPortrait}`:DEFAULT_PORTRAIT_URL, people: [], events: [], gifts: 0, giftPoints:0, totalChats: 0, revision: 0 };
const clients = new Set();
let nextId = 0;
let activeConnection = null;
let isConnecting = false;
let giftStreak = new Map();
let giftSeen = new Map();

const normalize = raw => String(raw || '').replace(/^@/, '').trim().slice(0, 26).replace(/[<>\\\r\n]/g,'');
function safeIdentity(name, id) {
  const cleanName = normalize(name) || `izleyici${++nextId}`;
  return { name: cleanName, id: String(id || cleanName.toLocaleLowerCase('tr-TR')).slice(0, 90) };
}
function makePerson(name, id, demo = false) {
  const who = safeIdentity(name, id);
  return { ...who, demo, giftCount: 0, giftPoints:0, joined: Date.now(), lastGift: 0 };
}
function event(type, name, detail = '') {
  state.events.unshift({ id: crypto.randomUUID(), type, name: String(name).slice(0, 26), detail: String(detail).slice(0, 60), time: Date.now() });
  state.events.length = Math.min(state.events.length, MAX_EVENTS);
}
function snapshot() {
  return {
    connected: state.connected, connecting: state.connecting, connectionMessage: state.connectionMessage,
    username: state.username, demo: state.demo, carriers: state.carriers,
    portraitBearer:state.portraitBearer, portraitCost:state.portraitCost,portraitUrl:state.portraitUrl, giftPoints:state.giftPoints,
    people: state.people, events: state.events, gifts: state.gifts, totalChats: state.totalChats,
    revision: state.revision,
  };
}
function emit() {
  state.revision++;
  const payload = `event: state\ndata: ${JSON.stringify(snapshot())}\n\n`;
  for (const client of clients) { try { client.write(payload); } catch { clients.delete(client); } }
}
function findOrAdd(name, id, demo = false) {
  const who = safeIdentity(name, id);
  let person = state.people.find(p => p.id === who.id);
  if (!person) {
    person = makePerson(who.name, who.id, demo);
    state.people.push(person);
    if (state.people.length > MAX_PEOPLE) {
      const outside = state.people.findIndex(p => !state.carriers.some(c => c?.id === p.id) && state.portraitBearer?.id !== p.id);
      if (outside >= 0) state.people.splice(outside,1);
    }
  } else if (who.name !== person.name) {
    person.name = who.name;
  }
  return person;
}
export function chat(name, id, demo = false) {
  const existing = state.people.some(p => p.id === String(id || normalize(name).toLocaleLowerCase('tr-TR')));
  const person = findOrAdd(name,id,demo);
  state.totalChats++;
  if (!existing) event('join',person.name,'Korteje katıldı');
  emit();
  return person;
}
// VIP is determined by total reported gift value for the current game session.
function choosePortraitBearer(){
  const eligible=state.people.filter(p=>p.giftPoints >= state.portraitCost);
  eligible.sort((a,b)=>b.giftPoints-a.giftPoints || b.lastGift-a.lastGift);
  const winner=eligible[0] || null;
  const previous=state.portraitBearer;
  if(previous?.id===winner?.id)return false;
  state.portraitBearer=winner;
  if(winner){
    const slot=state.carriers.findIndex(p=>p?.id===winner.id);
    if(slot>=0)state.carriers[slot]=null;
    event('portrait',winner.name,`Fotoğrafı taşıyor · ${winner.giftPoints} puan`);
  } else if(previous){event('rotate',previous.name,'Fotoğraf taşıyıcılığı sona erdi');}
  return true;
}
function fillCarrierVacancies(){
  // Keep six unique people in the casket team where enough gift-givers exist.
  const taken=new Set(state.carriers.filter(Boolean).map(p=>p.id));
  if(state.portraitBearer)taken.add(state.portraitBearer.id);
  const candidates=state.people.filter(p=>p.giftCount>0&&!taken.has(p.id)).sort((a,b)=>b.lastGift-a.lastGift);
  for(let i=0;i<state.carriers.length;i++){
    if(state.carriers[i]===null && candidates.length){
      const p=candidates.shift();state.carriers[i]=p;taken.add(p.id);
    }
  }
}
export function gift(name, id, giftName = 'Hediye', amount = 1, demo = false, unitPoints=1) {
  const person = findOrAdd(name,id,demo);
  const value = Math.min(10000,Math.max(1,Math.trunc(Number(amount)||1)));
  // SDK gift.diamondCount is the event's per-gift *reported* value, not a wallet balance.
  const pointsPerGift=Math.max(0,Math.min(100000,Math.trunc(Number(unitPoints)||0)));
  const points=Math.min(10000000,pointsPerGift*value);
  person.giftCount += value;
  person.giftPoints += points;
  person.lastGift = Date.now();
  state.gifts += value;
  state.giftPoints += points;
  const photoChanged=choosePortraitBearer();
  const isPortrait=state.portraitBearer?.id===person.id;
  if(isPortrait){
    if(!photoChanged)event('gift',person.name,`${giftName} · Fotoğraf taşıyıcısına destek (+${points})`);
  } else {
    const already = state.carriers.findIndex(p => p?.id === person.id);
    if (already === -1) {
      const vacant = state.carriers.findIndex(p => p === null);
      const slot = vacant !== -1 ? vacant : state.carriers.reduce((oldest, p, i, all) => (p.lastGift < all[oldest].lastGift ? i : oldest),0);
      const outgoing = state.carriers[slot];
      state.carriers[slot] = person;
      if (outgoing) event('rotate',outgoing.name,'Korteje geçti');
      event('gift',person.name,`${giftName} · ${slot+1}. tabut taşıyıcısı`);
    } else {event('gift',person.name,`${giftName} · Taşıyıcıya destek`);}
  }
  if(photoChanged)fillCarrierVacancies();
  emit();
  return person;
}
function clearState(demo) {
  state.people=[]; state.carriers=Array(6).fill(null);state.portraitBearer=null;state.events=[];state.gifts=0;state.giftPoints=0;state.totalChats=0;state.demo=demo;
}
function demoSeed() {
  clearState(true);
  const carriers = ['mehmet.ali','utku.61','mertcan','feyza','enes.34','melis'];
  carriers.forEach((n,i)=>{
    const p = findOrAdd(n,`demo-carrier-${i}`,true);
    p.giftCount=1+i; p.giftPoints=1+i;p.lastGift = Date.now()- (6-i)*9000;
    state.carriers[i]=p;
  });
  seedUsers.slice(0,26).forEach((n,i)=>findOrAdd(n,`demo-crowd-${i}`,true));
  const portrait= findOrAdd('efsane.dostu','demo-portrait',true);portrait.giftCount=1;portrait.giftPoints=state.portraitCost+250;portrait.lastGift=Date.now();state.portraitBearer=portrait;
  state.events=[{id:crypto.randomUUID(), type:'info', name:'DEMO',detail:`Ön fotoğraf: ${state.portraitCost} hediye puanı`,time:Date.now()}];
  emit();
}
function readBody(req,maxBytes=16384) {
  return new Promise((resolve,reject)=>{
    let body='';
    req.on('data', chunk=> {body+=chunk; if(body.length>maxBytes){reject(new Error('İstek çok büyük'));req.destroy();}});
    req.on('end',()=>{try{resolve(JSON.parse(body||'{}'))}catch{reject(new Error('Geçersiz JSON'))}});
    req.on('error',reject);
  });
}
function respond(res,code,obj) {res.writeHead(code, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(obj));}
function originAllowed(req) {
  if(!req.headers.origin) return true;
  try { const uri=new URL(req.headers.origin);return uri.host===req.headers.host; }catch{return false;}
}
function getUser(event) {
  return { name: event.user?.displayId || event.user?.nickname || event.user?.uniqueId || 'izleyici', id: String(event.user?.id || event.user?.displayId || event.user?.uniqueId || '') };
}
function countGiftEvent(payload) {
  const who=getUser(payload);
  const gId=String(payload.giftId || payload.gift?.id || 'gift');
  const identity=who.id+':'+gId;
  const msgId=String(payload.common?.msgId || payload.msgId || payload.transactionId || '');
  const repeat=Math.max(1,Number(payload.repeatCount || payload.gift?.repeatCount || 1));
  const streak = Number(payload.gift?.type || payload.giftType || 0)===1;
  let delta=1;
  if(streak) {
    const last=giftStreak.get(identity)||0;
    delta=Math.max(0,repeat-last);
    if(payload.repeatEnd) giftStreak.delete(identity); else giftStreak.set(identity,repeat);
  } else if (msgId) {
    const key=identity+':'+msgId;
    if(giftSeen.has(key)) return;
    giftSeen.set(key,Date.now());
    if(giftSeen.size>1000) giftSeen=new Map([...giftSeen].slice(-500));
  }
  if(delta>0) {
    const rawPoints=payload.gift?.diamondCount ?? payload.extendedGiftInfo?.diamondCount ?? payload.diamondCount;
    // Never invent point value when TikTok does not send it.
    const unitPoints=Number.isFinite(Number(rawPoints)) && rawPoints != null ? Number(rawPoints) : 0;
    gift(who.name,who.id,String(payload.gift?.name || payload.extendedGiftInfo?.name || 'TikTok hediyesi').slice(0,32),delta,false,unitPoints);
  }
}
async function disconnect() {
  const c=activeConnection;activeConnection=null;
  if(c) {try {await c.disconnect();}catch{}}
  state.connected=false; state.connecting=false;
  state.connectionMessage='Bağlantı kapalı';emit();
}
async function connect(username) {
  const clean=normalize(username);
  if(!clean) throw new Error('TikTok kullanıcı adını yaz');
  if(isConnecting) throw new Error('Bağlantı zaten kuruluyor');
  isConnecting=true;
  try {
    await disconnect();
    clearState(false);state.connecting=true;state.username=clean;
    state.connectionMessage='TikTok yayınına bağlanılıyor';emit();
    const module=await import('tiktok-live-connector').catch(()=>null);
    if(!module) throw new Error('TikTok paketi eksik: npm install tiktok-live-connector');
    const {TikTokLiveConnection,WebcastEvent,ControlEvent}=module;
    const connection=new TikTokLiveConnection(clean);
    activeConnection=connection;
    connection.on(WebcastEvent.CHAT, e=>{const p=getUser(e);chat(p.name,p.id,false);});
    // Joining users can appear in the follower crowd even without commenting.
    // TikTok does not guarantee member notifications for every passive viewer.
    connection.on(WebcastEvent.MEMBER, e=>{const p=getUser(e);if(p.id)chat(p.name,p.id,false);});
    connection.on(WebcastEvent.FOLLOW, e=>{const p=getUser(e);if(p.id)chat(p.name,p.id,false);});
    connection.on(WebcastEvent.GIFT, countGiftEvent);
    connection.on(ControlEvent.ERROR, ({info,exception})=>{
      state.connectionMessage=String(info||exception?.message||'TikTok bağlantı hatası').slice(0,120);emit();
    });
    connection.on(ControlEvent.DISCONNECTED, ()=>{
      if(activeConnection===connection){state.connected=false;state.connectionMessage='Yayın bağlantısı kesildi';emit();}
    });
    const room=await connection.connect();
    state.connected=true;state.connecting=false;
    state.connectionMessage=`Bağlandı · Oda ${room.roomId || ''}`;emit();
  } catch(e) {
    state.connected=false;state.connecting=false;
    state.connectionMessage=String(e.message||e).slice(0,160);emit();
    throw e;
  } finally { isConnecting=false; }
}
const mime = {'.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml'};
const server=http.createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,`http://${req.headers.host || 'localhost'}`);
    if(req.method==='GET' && url.pathname==='/events') {
      res.writeHead(200, {'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});
      res.write(`event: state\ndata: ${JSON.stringify(snapshot())}\n\n`);
      clients.add(res);
      req.on('close',()=>clients.delete(res));
      return;
    }
    if(req.method==='GET' && url.pathname==='/api/state')return respond(res,200,snapshot());
    if(req.method==='POST' && url.pathname.startsWith('/api/')) {
      if(!originAllowed(req)) return respond(res,403,{error:'Cross-origin istek reddedildi'});
      const body=await readBody(req,url.pathname==='/api/portrait'?3500000:16384);
      switch(url.pathname){
        case '/api/chat': {const p=chat(body.name,body.id,false);return respond(res,200,{ok:true,person:p});}
        case '/api/gift': {const p=gift(body.name,body.id,body.giftName||'Gül',body.amount||1,false,body.unitPoints ?? 1);return respond(res,200,{ok:true,person:p});}
        case '/api/settings': {const cost=Number(body.portraitCost);if(!Number.isInteger(cost)||cost<10||cost>100000) return respond(res,400,{error:'Eşik 10–100.000 arasında olmalı'});state.portraitCost=cost;choosePortraitBearer();fillCarrierVacancies();event('info','AYAR',`Fotoğraf taşıma eşiği ${cost} puan`);emit();return respond(res,200,{ok:true,portraitCost:cost});}
        case '/api/portrait': {
          const source=String(body.dataUrl||'');
          const match=/^data:image\/(jpeg|png|webp);base64,([a-zA-Z0-9+/=]+)$/.exec(source);
          if(!match)return respond(res,400,{error:'JPEG, PNG veya WebP yükleyebilirsin'});
          const data=Buffer.from(match[2],'base64');
          if(!data.length||data.length>2300000)return respond(res,400,{error:'Fotoğraf en fazla 2 MB olabilir'});
          const format=match[1]==='jpeg'?'jpg':match[1];
          const valid=format==='jpg'?data[0]===0xff&&data[1]===0xd8&&data[2]===0xff:format==='png'?data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):data.subarray(0,4).toString()==='RIFF'&&data.subarray(8,12).toString()==='WEBP';
          if(!valid)return respond(res,400,{error:'Fotoğraf dosyası doğrulanamadı'});
          await fs.writeFile(path.join(PUBLIC,`portrait-custom.${format}`),data);
          await Promise.all(['jpg','png','webp'].filter(ext=>ext!==format).map(ext=>fs.unlink(path.join(PUBLIC,`portrait-custom.${ext}`)).catch(()=>{})));
          state.portraitUrl=`/portrait-custom.${format}?v=${Date.now()}`;event('info','AYAR','Fotoğraf güncellendi');emit();return respond(res,200,{ok:true,portraitUrl:state.portraitUrl});
        }
        case '/api/demo': {demoSeed();return respond(res,200,{ok:true});}
        case '/api/reset': {clearState(false);emit();return respond(res,200,{ok:true});}
        case '/api/connect': {await connect(body.username);return respond(res,200,{ok:true});}
        case '/api/disconnect': {await disconnect();return respond(res,200,{ok:true});}
        default: return respond(res,404,{error:'API bulunamadı'});
      }
    }
    if(req.method!=='GET'&&req.method!=='HEAD')return respond(res,405,{error:'Yöntem desteklenmiyor'});
    const sub=url.pathname==='/'?'/index.html':url.pathname;
    const target=path.resolve(PUBLIC,'.'+decodeURIComponent(sub));
    if(!target.startsWith(PUBLIC+path.sep))return respond(res,403,{error:'İzin verilmedi'});
    const file=await fs.readFile(target).catch(()=>null);
    if(!file)return respond(res,404,{error:'Dosya bulunamadı'});
    res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream','Cache-Control':'no-cache'});
    res.end(req.method==='HEAD'?undefined:file);
  } catch(error){ if(!res.headersSent)respond(res,500,{error:String(error.message||error)});else res.end(); }
});
setInterval(()=>{for(const c of clients){try{c.write(': ping\n\n');}catch{clients.delete(c)}}},20000).unref();
demoSeed();
server.listen(PORT,HOST,()=>{
  console.log(`\n🎬 Eşref Tek | Son Yolculuk: http://${HOST}:${PORT}`);
  console.log(`📺 OBS Browser Source: http://${HOST}:${PORT}/?overlay=1`);
  console.log('🎁 Gerçek TikTok için: npm install tiktok-live-connector');
});
