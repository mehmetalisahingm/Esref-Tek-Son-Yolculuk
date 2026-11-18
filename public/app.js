import { createFallback } from './fallback.js';

const $ = sel => document.querySelector(sel);
const qs = new URLSearchParams(location.search);
const overlay = qs.has('overlay');
const forceFallback = qs.has('fallback');
if (overlay) document.body.classList.add('overlay');
const initial = { connected:false, connecting:false, connectionMessage:'', username:'', demo:true, carriers:Array(6).fill(null), portraitBearer:null,portraitCost:500,portraitUrl:'',giftPoints:0,people:[], events:[], gifts:0,totalChats:0,revision:0 };
let state = initial;
let stage = null;
let toastTimer = null;
let started = false;
let lastEventId = null;
let cameraMode = 0;

function text(target, value) { const e=$(target); if(e) e.textContent=String(value); }
function cleanName(n) {return '@'+String(n || '...').replace(/^@/,'');}
function formattedTime(n){return new Date(n).toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'})}
function showToast(message) {
  const el = $('#toast');el.textContent=message;
  el.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),3000);
}
function updateCarriers(s) {
  const root=$('#carriers-grid');
  const nodes=[...root.children];
  if(nodes.length!==6){root.replaceChildren();for(let i=0;i<6;i++){
    const tag=document.createElement('div');tag.className='carrier-tag';
    const n=document.createElement('span');n.className='carrier-number';n.textContent=String(i+1);
    const name=document.createElement('span');name.className='carrier-handle';
    tag.append(n,name);root.append(tag);
  }}
  [...root.children].forEach((el,i)=>{
    const p=s.carriers[i];el.classList.toggle('empty',!p);
    el.querySelector('.carrier-handle').textContent=p?cleanName(p.name):'BOŞ YER';
  });
}
function updateActivity(s){
  const root=$('#activity');root.replaceChildren();
  for(const e of (s.events||[]).slice(0,7)){
    const row=document.createElement('div');row.className='activity-entry';
    const av=document.createElement('span');av.className=`activity-avatar ${e.type}`;av.textContent= e.type==='portrait'?'👑':e.type==='gift'?'🎁':e.type==='join'?'↗':e.type==='rotate'?'↩':'✦';
    const mid=document.createElement('div');
    const strong=document.createElement('strong');strong.textContent=e.type==='info'?e.name:cleanName(e.name);
    const detail=document.createElement('p');detail.textContent=e.detail;
    const time=document.createElement('time');time.textContent=formattedTime(e.time);
    mid.append(strong,detail);row.append(av,mid,time);root.append(row);
  }
}
function updateStatus(s){
  const status=$('#broadcast-status');const pip=$('#connection-pip');
  if(s.connected){status.classList.add('live');status.innerHTML='<span class="status-dot"></span> CANLI YAYIN';pip.className='connection-pip connected';pip.textContent='BAĞLI';}
  else {status.classList.remove('live');status.innerHTML='<span class="status-dot"></span> '+(s.demo?'DEMO YAYINI':'YAYIN BEKLENİYOR');pip.className='connection-pip';pip.textContent=s.connecting?'BAĞLANIYOR':'DEMO';}
  text('#connection-hint',s.connectionMessage || 'TikTok bağlantısı kurulmadı.');
  $('#connection-hint').classList.toggle('error',/(hata|eksik|failed|kesildi|offline|error|unavailable)/i.test(s.connectionMessage));
  $('#connect-btn').disabled=Boolean(s.connecting);$('#connect-btn').textContent=s.connecting?'◉  Bağlantı kuruluyor...':s.connected?'◉  Yeniden bağlan':'◉  Yayına Bağlan';
}
function showState(next){
  const previous=state;state=next;
  text('#audience-top',next.people.length);
  text('#procession-count',next.people.length);
  text('#stats-audience',next.people.length);
  text('#stats-carriers',`${next.carriers.filter(Boolean).length} / 6`);
  text('#stats-gifts',next.gifts);
  text('#portrait-holder',next.portraitBearer?cleanName(next.portraitBearer.name):'ÖZEL YER BOŞ');
  text('#portrait-requirement',next.portraitBearer?`${next.portraitBearer.giftPoints.toLocaleString('tr-TR')} puan · eşik ${next.portraitCost.toLocaleString('tr-TR')}`:`${next.portraitCost.toLocaleString('tr-TR')} hediye puanı ile açılır`);
  text('#portrait-cta',`${next.portraitCost.toLocaleString('tr-TR')}+`);
  const portraitImage=$('#portrait-thumb');if(next.portraitUrl && portraitImage.getAttribute('src')!==next.portraitUrl)portraitImage.src=next.portraitUrl;
  if(document.activeElement!==$('#portrait-cost'))$('#portrait-cost').value=next.portraitCost;
  updateCarriers(next);updateActivity(next);updateStatus(next);
  stage?.update(next);
  if(previous.events?.length && next.events?.length && next.events[0].id!==lastEventId && next.events[0].id!==previous.events[0]?.id){
    const e=next.events[0];
    if(e.type==='portrait')showToast(`👑 ${cleanName(e.name)} Eşref Tek fotoğrafını taşıyor!`);
    if(e.type==='gift')showToast(`🎁 ${cleanName(e.name)} hediye gönderdi!`);
    if(e.type==='join')showToast(`💬 ${cleanName(e.name)} korteje katıldı!`);
  }
  lastEventId=next.events?.[0]?.id||null;
}
async function api(endpoint, data={}) {
  const response=await fetch(`/api/${endpoint}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  const json=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(json.error||`İşlem başarısız (${response.status})`);
  return json;
}
function wrap(fn){return async()=>{try{await fn()}catch(e){showToast('⚠ '+e.message);text('#connection-hint',e.message);}}}
const inputName=()=>$('#viewer-name').value.trim().replace(/^@/,'')||`izleyici${Math.floor(Math.random()*9000)+1000}`;
$('#chat-btn').addEventListener('click',wrap(async()=>{const name=inputName();await api('chat',{name});}));
$('#gift-btn').addEventListener('click',wrap(async()=>{const name=inputName();await api('gift',{name,giftName:'Gül',amount:1,unitPoints:1});}));
$('#portrait-test-btn').addEventListener('click',wrap(async()=>{const name=inputName();const rival=state.portraitBearer?.giftPoints||0;const person=state.people.find(p=>p.name===name);const required=Math.min(100000,Math.max(10,state.portraitCost,rival+1)-(person?.giftPoints||0));await api('gift',{name,giftName:'Büyük Hediye',amount:1,unitPoints:Math.max(1,required)}); }));
$('#save-cost-btn').addEventListener('click',wrap(async()=>{const portraitCost=Number($('#portrait-cost').value);await api('settings',{portraitCost});showToast(`👑 Fotoğraf eşiği: ${portraitCost} puan`);}));
$('#portrait-upload').addEventListener('change',wrap(async()=>{const file=$('#portrait-upload').files?.[0];if(!file)return;if(file.size>2300000)throw new Error('Fotoğraf 2 MB altında olmalı');const dataUrl=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});await api('portrait',{dataUrl});showToast('📷 Fotoğraf güncellendi');}));
$('#viewer-name').addEventListener('keydown',e=>{if(e.key==='Enter')$('#chat-btn').click()});
$('#tiktok-user').addEventListener('keydown',e=>{if(e.key==='Enter')$('#connect-btn').click()});
$('#connect-btn').addEventListener('click',wrap(async()=>{await api('connect',{username:$('#tiktok-user').value.trim()});}));
$('#demo-chat-btn').addEventListener('click',wrap(async()=>{for(let i=0;i<10;i++){await api('chat',{name:`izleyici_${Math.floor(Math.random()*90000+10000)}`});}}));
$('#demo-gift-btn').addEventListener('click',wrap(async()=>{const candidates=['arda_06','samet07','ece.official','elif16','kuzey','murat_61','sema.98','berke','fatoş','zeynep_52'];await api('gift',{name:candidates[Math.floor(Math.random()*candidates.length)],giftName:'Gül',amount:1});}));
$('#reset-btn').addEventListener('click',wrap(async()=>{await api('demo');showToast('✦ Demo sahnesi yeniden oluşturuldu');}));
$('#camera-btn').addEventListener('click',()=>{cameraMode=(cameraMode+1)%3;stage?.camera(cameraMode);});

const feed = new EventSource('/events');
feed.addEventListener('state',ev=>{try{showState(JSON.parse(ev.data));}catch(e){console.warn('Geçersiz sahne verisi',e);}});
feed.onerror=()=>text('#render-status','Sunucu bağlantısı yeniden deneniyor');

async function boot() {
  if(started)return;started=true;
  const canvas=$('#scene');
  const labels=$('#labels');
  try {
    if(forceFallback)throw new Error('Alternatif sahne kullanıcı tarafından seçildi');
    const THREE=await import('https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js');
    const {createScene}=await import('./scene3d.js');
    stage=createScene(canvas,labels,THREE);
    text('#render-status','3D sahne aktif · 60 FPS hedef');
  } catch(err) {
    console.warn('WebGL / CDN desteklenmedi, 2.5D yedek sahne açıldı:',err);
    stage=createFallback(canvas,labels);
    text('#render-status','Alternatif sinematik sahne aktif (çevrimdışı)');
  }
  stage.update(state);
  stage.camera(cameraMode);
}
boot();
