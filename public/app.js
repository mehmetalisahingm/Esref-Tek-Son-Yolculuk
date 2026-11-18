import { createFallback } from './fallback.js';
import { createAudio } from './audio.js';

const $ = sel => document.querySelector(sel);
const qs = new URLSearchParams(location.search);
const overlay = qs.has('overlay');
const forceFallback = qs.has('fallback');
if (overlay) document.body.classList.add('overlay');
if (qs.has('compact')) document.body.classList.add('compact');

const initial = { connected: false, connecting: false, connectionMessage: '', username: '', demo: true, carriers: Array(6).fill(null), portraitBearer: null, portraitCost: 500, portraitUrl: '', giftPoints: 0, people: [], events: [], gifts: 0, totalChats: 0, likes: 0, viewerCount: null, leaderboard: [], audio: { music: true, sfx: true, volume: .65 }, revision: 0 };
let state = initial;
let stage = null;
let firstState = true;
const seenEvents = new Set();
const fmt = n => Number(n || 0).toLocaleString('tr-TR');
const short = n => n >= 1e6 ? (n / 1e6).toFixed(1).replace('.0', '') + 'M' : n >= 1e4 ? (n / 1e3).toFixed(1).replace('.0', '') + 'B' : fmt(n);
const at = name => '@' + String(name || '...').replace(/^@/, '');
function text(target, value) { const e = $(target); if (e && e.textContent !== String(value)) e.textContent = String(value); }

// HUD scales with the frame: 540 px wide = 1×, 1080 px wide = 2×.
const frame = $('#game-frame');
new ResizeObserver(([entry]) => frame.style.setProperty('--u', (entry.contentRect.width / 540).toFixed(4))).observe(frame);

// Hide the broken-image icon when the portrait cannot load; the gold monogram shows instead.
for (const img of document.querySelectorAll('#portrait-thumb,#takeover-photo')) {
  img.addEventListener('load', () => img.parentElement.classList.add('has-photo'));
  img.addEventListener('error', () => img.parentElement.classList.remove('has-photo'));
}

// ——— Audio ———
const audio = createAudio();
let previewOn = false;
function audioEnabled() { return overlay || previewOn; }
function configureAudio() { audio.configure({ enabled: audioEnabled(), music: state.audio.music, sfx: state.audio.sfx, volume: state.audio.volume }); refreshGate(); }
function refreshGate() { const gate = $('#sound-gate'); gate.hidden = !(audioEnabled() && !audio.running); }
audio.onstate(refreshGate);
const unlock = () => audio.unlock().then(refreshGate);
$('#sound-gate').addEventListener('click', unlock);
window.addEventListener('pointerdown', () => { if (audioEnabled()) unlock(); }, { passive: true });
if (overlay) { unlock(); setTimeout(unlock, 1200); } // OBS / LIVE Studio browser sources allow autoplay

// ——— Toast (control panel) ———
let toastTimer = null;
function showToast(message) {
  const el = $('#toast'); el.textContent = message;
  el.classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('visible'), 2800);
}

// ——— Alerts: queued banners and the portrait takeover ———
const alertQueue = [];
let alertBusy = false;
function queueAlert(a) { if (alertQueue.length > 12) alertQueue.splice(0, alertQueue.length - 12); alertQueue.push(a); if (!alertBusy) nextAlert(); }
function nextAlert() {
  const a = alertQueue.shift();
  if (!a) { alertBusy = false; return; }
  alertBusy = true;
  if (a.kind === 'portrait') return takeover(a);
  const el = document.createElement('div');
  el.className = `alert ${a.kind}${a.big ? ' big' : ''}`;
  const icon = document.createElement('span'); icon.className = 'alert-icon'; icon.textContent = a.icon;
  const body = document.createElement('div');
  const title = document.createElement('strong'); title.textContent = a.title;
  const sub = document.createElement('small'); sub.textContent = a.sub;
  body.append(title, sub); el.append(icon, body);
  $('#alerts').append(el);
  const dwell = alertQueue.length > 3 ? 1500 : a.big ? 3600 : 2600;
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 450); nextAlert(); }, dwell);
}
function takeover(a) {
  const root = $('#takeover');
  text('#takeover-name', a.title); text('#takeover-detail', a.sub);
  const img = $('#takeover-photo'); if (state.portraitUrl && img.getAttribute('src') !== state.portraitUrl) img.src = state.portraitUrl;
  root.classList.remove('show'); void root.offsetWidth; root.classList.add('show');
  setTimeout(() => { root.classList.remove('show'); setTimeout(nextAlert, 500); }, 4600);
}
function floatUp(symbol) {
  const lane = $('#float-lane'); if (lane.childElementCount > 14) return;
  const el = document.createElement('span'); el.className = 'floater'; el.textContent = symbol;
  el.style.left = `${8 + Math.random() * 46}px`; el.style.animationDuration = `${2.6 + Math.random() * 1.4}s`; el.style.fontSize = `${18 + Math.random() * 12}px`;
  lane.append(el); el.addEventListener('animationend', () => el.remove());
}
function joinFeed(textLine) {
  const feed = $('#join-feed');
  const el = document.createElement('div'); el.className = 'join-line'; el.textContent = textLine;
  feed.prepend(el); while (feed.childElementCount > 3) feed.lastElementChild.remove();
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 500); }, 3800);
}
function handleEvent(e) {
  stage?.fx?.(e);
  switch (e.type) {
    case 'gift': {
      const big = (e.points || 0) >= 100 || (e.amount || 1) >= 10;
      const where = e.slot === -1 ? 'fotoğraf taşıyıcısına destek' : e.newCarrier ? `${(e.slot ?? 0) + 1}. omzu aldı` : 'omzunu korudu';
      queueAlert({ kind: 'gift', big, icon: '🎁', title: `${at(e.name)} ${e.giftName || 'hediye'}${e.amount > 1 ? ` ×${e.amount}` : ''}`, sub: `${where}${e.points ? ` · +${fmt(e.points)} puan` : ''}` });
      audio.play(e.newCarrier ? 'carrier' : 'gift', { big });
      break;
    }
    case 'portrait':
      queueAlert({ kind: 'portrait', title: at(e.name), sub: e.previous ? `${at(e.previous)} tahtı kaptırdı · ${fmt(e.points)} puan` : `${fmt(e.points)} puanla Eşref Tek'in fotoğrafını taşıyor` });
      audio.play('portrait');
      break;
    case 'follow':
      queueAlert({ kind: 'follow', icon: '💗', title: `${at(e.name)} takip etti`, sub: 'Korteje hoş geldin' });
      audio.play('follow');
      break;
    case 'milestone':
      queueAlert({ kind: 'milestone', big: true, icon: '🕯️', title: e.detail, sub: 'Beğenmeye devam, kortej aydınlansın' });
      audio.play('milestone');
      break;
    case 'like': floatUp(Math.random() > .5 ? '🕯️' : '🤍'); audio.play('like'); break;
    case 'join': joinFeed(`↗ ${at(e.name)} korteje katıldı`); audio.play('join'); break;
    case 'chat': audio.play('chat'); break;
    case 'share': joinFeed(`↻ ${at(e.name)} yayını paylaştı`); audio.play('follow'); break;
  }
}
function processEvents(s) {
  const fresh = (s.events || []).filter(e => !seenEvents.has(e.id));
  fresh.forEach(e => seenEvents.add(e.id));
  if (seenEvents.size > 400) { const keep = new Set((s.events || []).map(e => e.id)); seenEvents.clear(); keep.forEach(id => seenEvents.add(id)); }
  if (firstState) return;
  const ordered = fresh.reverse();
  const important = ordered.filter(e => e.type === 'portrait' || e.type === 'gift' || e.type === 'milestone' || e.type === 'follow');
  const minor = ordered.filter(e => !important.includes(e)).slice(-6);
  [...minor, ...important].sort((a, b) => a.time - b.time).forEach(handleEvent);
}

// ——— Rendering of HUD + control panel ———
function updateCarriers(s) {
  const root = $('#carriers-grid');
  if (root.children.length !== 6) {
    root.replaceChildren();
    for (let i = 0; i < 6; i++) {
      const tag = document.createElement('div'); tag.className = 'carrier-tag';
      tag.innerHTML = `<span class="carrier-number">${i + 1}</span><span class="carrier-handle"></span><span class="carrier-gifts"></span>`;
      root.append(tag);
    }
  }
  [...root.children].forEach((el, i) => {
    const p = s.carriers[i];
    el.classList.toggle('empty', !p);
    const handle = el.querySelector('.carrier-handle'), gifts = el.querySelector('.carrier-gifts');
    const name = p ? at(p.name) : 'Boş omuz';
    if (handle.textContent !== name) { handle.textContent = name; if (p && !firstState) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); } }
    gifts.textContent = p ? `🎁${short(p.giftCount)}` : '🎁';
  });
}
function updateLeaderboard(s) {
  const root = $('#leaderboard'); root.replaceChildren();
  const medals = ['🥇', '🥈', '🥉'];
  const list = (s.leaderboard || []).slice(0, 3);
  if (!list.length) { const e = document.createElement('span'); e.className = 'leader empty'; e.textContent = 'İlk hediye seni zirveye taşır'; root.append(e); return; }
  list.forEach((p, i) => {
    const e = document.createElement('span'); e.className = 'leader';
    const m = document.createElement('i'); m.textContent = medals[i];
    const n = document.createElement('b'); n.textContent = at(p.name);
    const v = document.createElement('em'); v.textContent = short(p.giftPoints);
    e.append(m, n, v); root.append(e);
  });
}
function updateThrone(s) {
  const holder = s.portraitBearer, lb = s.leaderboard || [], cost = s.portraitCost;
  text('#portrait-holder', holder ? at(holder.name) : 'Taht boş');
  text('#holder-points', holder ? short(holder.giftPoints) : '—');
  $('#throne-card').classList.toggle('vacant', !holder);
  let pct = 0, line;
  if (holder) {
    const target = holder.giftPoints + 1, ch = lb.find(p => p.id !== holder.id);
    if (ch) { pct = ch.giftPoints / target; line = `${at(ch.name)} tahta ${fmt(target - ch.giftPoints)} puan uzakta`; }
    else line = `Tahtı almak için ${fmt(target)} puan topla`;
  } else {
    const top = lb[0];
    if (top) { pct = top.giftPoints / cost; line = `${at(top.name)} · ${fmt(top.giftPoints)} / ${fmt(cost)} puan`; }
    else line = `İlk ${fmt(cost)} puanı toplayan fotoğrafı taşır`;
  }
  text('#challenge-text', line);
  $('#challenge-bar').style.width = `${Math.max(3, Math.min(100, pct * 100)).toFixed(1)}%`;
  for (const img of [$('#portrait-thumb'), $('#takeover-photo')]) if (s.portraitUrl && img.getAttribute('src') !== s.portraitUrl) img.src = s.portraitUrl;
}
function updateActivity(s) {
  const root = $('#activity'); root.replaceChildren();
  const icons = { portrait: '👑', gift: '🎁', join: '↗', rotate: '↩', chat: '💬', like: '🕯️', follow: '💗', share: '↻', milestone: '✨', info: '✦' };
  for (const e of (s.events || []).slice(0, 9)) {
    const row = document.createElement('div'); row.className = 'activity-entry';
    const av = document.createElement('span'); av.className = `activity-avatar ${e.type}`; av.textContent = icons[e.type] || '✦';
    const mid = document.createElement('div');
    const strong = document.createElement('strong'); strong.textContent = ['info', 'milestone'].includes(e.type) ? e.name : at(e.name);
    const detail = document.createElement('p'); detail.textContent = e.detail;
    const time = document.createElement('time'); time.textContent = new Date(e.time).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    mid.append(strong, detail); row.append(av, mid, time); root.append(row);
  }
}
function updateStatus(s) {
  const badge = $('#broadcast-status'), pip = $('#connection-pip');
  badge.classList.toggle('live', s.connected);
  text('#broadcast-text', s.connected ? 'CANLI' : s.demo ? 'DEMO' : s.connecting ? 'BAĞLANIYOR' : 'HAZIR');
  text('#top-status', s.connected ? 'CANLI YAYINDA' : 'YAYINA HAZIR');
  pip.className = `connection-pip${s.connected ? ' connected' : ''}`;
  pip.textContent = s.connected ? 'BAĞLI' : s.connecting ? 'BAĞLANIYOR' : s.demo ? 'DEMO' : 'KAPALI';
  text('#connection-hint', s.connectionMessage || 'TikTok bağlantısı kurulmadı.');
  $('#connection-hint').classList.toggle('error', /(hata|eksik|failed|kesildi|koptu|offline|error|unavailable|sona erdi)/i.test(s.connectionMessage || ''));
  $('#connect-btn').disabled = Boolean(s.connecting);
  $('#connect-btn').textContent = s.connecting ? '◉ Bağlanıyor…' : s.connected ? '◉ Yeniden bağlan' : '◉ Yayına Bağlan';
  $('#disconnect-btn').disabled = !(s.connected || s.connecting || /deneniyor/.test(s.connectionMessage || ''));
  $('#demo-btn').disabled = s.connected;
  if (s.username && document.activeElement !== $('#tiktok-user') && !$('#tiktok-user').value) $('#tiktok-user').value = s.username;
}
function updateAudioPanel(s) {
  if (document.activeElement !== $('#volume')) $('#volume').value = Math.round(s.audio.volume * 100);
  text('#volume-value', `${Math.round(s.audio.volume * 100)}%`);
  $('#music-toggle').checked = s.audio.music; $('#sfx-toggle').checked = s.audio.sfx;
}
function showState(next) {
  state = next;
  const crowd = next.people.length;
  text('#viewer-count', short(next.viewerCount ?? crowd));
  text('#like-count', short(next.likes || 0));
  text('#stats-audience', fmt(crowd));
  text('#stats-carriers', `${next.carriers.filter(Boolean).length} / 6`);
  text('#stats-gifts', fmt(next.gifts));
  text('#stats-points', `${fmt(next.giftPoints)} puan`);
  text('#stats-likes', fmt(next.likes || 0));
  if (document.activeElement !== $('#portrait-cost')) $('#portrait-cost').value = next.portraitCost;
  updateCarriers(next); updateLeaderboard(next); updateThrone(next); updateStatus(next); updateAudioPanel(next);
  if (!overlay) updateActivity(next);
  stage?.update(next);
  processEvents(next);
  configureAudio();
  firstState = false;
}

// ——— Rotating call-to-action ———
let ctaIndex = 0;
function rotateCta() {
  const lines = [
    '💬 Yorum yaz → korteje katıl, sözün sahnede görünsün',
    '🕯️ Beğen → elinde mum yansın',
    '🎁 Hediye gönder → tabutu omuzla',
    `👑 ${fmt(state.portraitCost)}+ puan → Eşref Tek'in fotoğrafını sen taşı`,
    '💗 Takip et → kortejde yerini al',
  ];
  const el = $('#cta-text');
  el.classList.add('swap');
  setTimeout(() => { el.textContent = lines[ctaIndex++ % lines.length]; el.classList.remove('swap'); }, 350);
}
setInterval(rotateCta, 4500);

// ——— Control panel actions ———
async function api(endpoint, data = {}) {
  const response = await fetch(`/api/${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json.error || `İşlem başarısız (${response.status})`);
  return json;
}
const wrap = fn => async () => { try { await fn(); } catch (e) { showToast('⚠ ' + e.message); } };
const on = (sel, fn) => $(sel).addEventListener('click', wrap(fn));
const inputName = () => $('#viewer-name').value.trim().replace(/^@/, '') || `izleyici${Math.floor(Math.random() * 9000) + 1000}`;
const sampleComments = ['Başın sağ olsun Eşref 🖤', 'Efsaneler ölmez', 'Rüya bitmesin...', 'Mekânın cennet olsun', 'Unutulmayacaksın abi', '🕯️🕯️🕯️'];
on('#chat-btn', () => api('chat', { name: inputName(), comment: $('#viewer-comment').value.trim() || sampleComments[Math.floor(Math.random() * sampleComments.length)] }));
on('#like-btn', () => api('like', { name: inputName(), count: 15 }));
on('#follow-btn', () => api('follow', { name: inputName() }));
on('#gift-btn', () => api('gift', { name: inputName(), giftName: 'Gül', amount: 1, unitPoints: 1 }));
on('#portrait-test-btn', async () => {
  const name = inputName(); const rival = state.portraitBearer?.giftPoints || 0;
  const person = state.people.find(p => p.name === name);
  const required = Math.min(100000, Math.max(10, state.portraitCost, rival + 1) - (person?.giftPoints || 0));
  await api('gift', { name, giftName: 'Aslan', amount: 1, unitPoints: Math.max(1, required) });
});
on('#save-cost-btn', async () => { const portraitCost = Number($('#portrait-cost').value); await api('settings', { portraitCost }); showToast(`👑 Fotoğraf eşiği: ${fmt(portraitCost)} puan`); });
$('#portrait-upload').addEventListener('change', wrap(async () => {
  const file = $('#portrait-upload').files?.[0]; if (!file) return;
  if (file.size > 2300000) throw new Error('Fotoğraf 2 MB altında olmalı');
  const dataUrl = await new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(file); });
  await api('portrait', { dataUrl }); showToast('📷 Fotoğraf güncellendi');
}));
on('#portrait-default-btn', async () => { await api('portrait-default'); showToast('📷 Varsayılan fotoğraf'); });
$('#viewer-comment').addEventListener('keydown', e => { if (e.key === 'Enter') $('#chat-btn').click(); });
$('#viewer-name').addEventListener('keydown', e => { if (e.key === 'Enter') $('#chat-btn').click(); });
$('#tiktok-user').addEventListener('keydown', e => { if (e.key === 'Enter') $('#connect-btn').click(); });
on('#connect-btn', () => api('connect', { username: $('#tiktok-user').value.trim() }));
on('#disconnect-btn', () => api('disconnect'));
on('#demo-chat-btn', async () => { for (let i = 0; i < 10; i++) await api('chat', { name: `izleyici_${Math.floor(Math.random() * 90000 + 10000)}`, comment: i % 3 === 0 ? sampleComments[i % sampleComments.length] : '' }); });
on('#demo-gift-btn', async () => {
  const names = ['arda_06', 'samet07', 'ece.official', 'elif16', 'kuzey', 'murat_61', 'sema.98', 'berke', 'fatoş', 'zeynep_52'];
  const gifts = [['Gül', 1], ['TikTok', 1], ['Parmak Kalp', 5], ['Kalp', 10], ['Konfeti', 100], ['Şapka ve Bıyık', 99]];
  const [giftName, unitPoints] = gifts[Math.floor(Math.random() * gifts.length)];
  await api('gift', { name: names[Math.floor(Math.random() * names.length)], giftName, amount: 1 + Math.floor(Math.random() * 3), unitPoints });
});
on('#demo-btn', async () => { await api('demo'); showToast('✦ Demo sahnesi yüklendi'); });
on('#reset-btn', async () => { if (!confirm('Kortej, taşıyıcılar ve sayaçlar sıfırlansın mı?')) return; await api('reset'); showToast('Sahne temizlendi'); });
for (const [sel, key] of [['#music-toggle', 'music'], ['#sfx-toggle', 'sfx']]) $(sel).addEventListener('change', wrap(() => api('audio', { [key]: $(sel).checked })));
let volTimer = null;
$('#volume').addEventListener('input', () => { text('#volume-value', `${$('#volume').value}%`); clearTimeout(volTimer); volTimer = setTimeout(wrap(() => api('audio', { volume: Number($('#volume').value) / 100 })), 120); });
$('#preview-toggle').addEventListener('change', () => { previewOn = $('#preview-toggle').checked; if (previewOn) unlock(); configureAudio(); });
$('#copy-overlay').addEventListener('click', async () => { try { await navigator.clipboard.writeText(`${location.origin}/?overlay=1`); showToast('📋 Overlay adresi kopyalandı'); } catch { showToast(`${location.origin}/?overlay=1`); } });
text('#overlay-url', `${location.origin}/?overlay=1`);
let cameraMode = Number(qs.get('cam') ?? 3) % 4;
function setCamera(mode) {
  cameraMode = mode; stage?.camera(mode);
  document.querySelectorAll('#camera-buttons button').forEach(b => b.classList.toggle('active', Number(b.dataset.cam) === mode));
}
document.querySelectorAll('#camera-buttons button').forEach(b => b.addEventListener('click', () => setCamera(Number(b.dataset.cam))));

// ——— Live feed ———
const feed = new EventSource('/events');
feed.addEventListener('state', ev => { try { showState(JSON.parse(ev.data)); } catch (e) { console.warn('Geçersiz sahne verisi', e); } });
feed.onopen = () => document.body.classList.remove('offline');
feed.onerror = () => { document.body.classList.add('offline'); text('#render-status', 'Sunucu bağlantısı yeniden deneniyor…'); };

async function boot() {
  const canvas = $('#scene'), labels = $('#labels');
  try {
    if (forceFallback) throw new Error('Alternatif sahne kullanıcı tarafından seçildi');
    const THREE = await import('/vendor/three.module.js').catch(() => import('https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js'));
    const { createScene } = await import('./scene3d.js');
    stage = createScene(canvas, labels, THREE);
    text('#render-status', '3D sinematik sahne aktif');
  } catch (err) {
    console.warn('WebGL / 3D motoru açılamadı, 2.5D yedek sahne açıldı:', err);
    labels.replaceChildren();
    stage = createFallback(canvas, labels);
    text('#render-status', 'Yedek 2.5D sahne aktif (3D motoru yüklenemedi)');
  }
  stage.update(state);
  setCamera(cameraMode);
}
boot();
