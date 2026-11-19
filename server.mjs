import http from 'node:http';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(DIR, 'public');
const THREE_BUILD = path.join(DIR, 'node_modules', 'three', 'build');
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';
const MAX_PEOPLE = 100;
const MAX_EVENTS = 40;
const LIKE_MILESTONE = 1000;
// Official Kanal D Eşref Tek character profile picture, used as a remote default.
const DEFAULT_PORTRAIT_URL = 'https://image.kanald.com.tr/i/kanald/100/200x286/6864d72ccf62483f9cfa5def.jpg';
const PORTRAIT_COST = 500;
const savedPortrait = ['jpg', 'png', 'webp'].find(ext => existsSync(path.join(PUBLIC, `portrait-custom.${ext}`)));
const MUSIC_EXTS = ['mp3', 'm4a', 'ogg', 'wav'];
const MAX_MUSIC_BYTES = 15 * 1024 * 1024;
const savedMusic = MUSIC_EXTS.find(ext => existsSync(path.join(PUBLIC, `music-custom.${ext}`)));
const musicNameFile = path.join(PUBLIC, 'music-custom.name.txt');
let savedMusicName = '';
try { savedMusicName = savedMusic ? (await fs.readFile(musicNameFile, 'utf8')).slice(0, 80) : ''; } catch {}
// Playlist slots are stored locally; never commit or fetch audio from YouTube.
const savedPlaylist = [
  { url: savedMusic ? `/music-custom.${savedMusic}` : '', name: savedMusic ? (savedMusicName || 'Yüklenen şarkı') : '' },
  ...await Promise.all([2, 3].map(async slot => {
    const stem = `music-custom-${slot}`;
    const ext = MUSIC_EXTS.find(x => existsSync(path.join(PUBLIC, `${stem}.${x}`)));
    if (!ext) return { url: '', name: '' };
    let name = '';
    try { name = (await fs.readFile(path.join(PUBLIC, `${stem}.name.txt`), 'utf8')).slice(0, 80); } catch {}
    return { url: `/${stem}.${ext}`, name: name || `Şarkı ${slot}` };
  })),
];
// Identify an uploaded audio file by its first bytes rather than trusting the browser's MIME type.
function sniffAudio(b) {
  if (b.length < 12) return null;
  if (b.subarray(0, 3).toString('latin1') === 'ID3' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) return 'mp3';
  if (b.subarray(0, 4).toString('latin1') === 'OggS') return 'ogg';
  if (b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WAVE') return 'wav';
  if (b.subarray(4, 8).toString('latin1') === 'ftyp') return 'm4a';
  return null;
}

const seedUsers = ['alikaya','denizx','efemert','sevda','emir.07','buse','kubilay','ayse.52','yagmur','mustafa','berke','irem','furkan','selin','mertcan','ece','kaang','dila','onur','elif','kerem','berat','zeynep','melis','umutt','azra','yunus','gizem','sinem','harun'];
const seedComments = ['Başın sağ olsun Eşref','Efsaneler ölmez 🖤','Rüya bitmesin...','Son yolculuğunda yanındayız','Mekânın cennet olsun','Unutulmayacaksın','🕯️🕯️🕯️','Kalbimizdesin abi'];

const state = {
  connected: false, connecting: false, connectionMessage: 'Demo modu', username: '', demo: true,
  carriers: Array(6).fill(null), portraitBearer: null, portraitCost: PORTRAIT_COST,
  portraitUrl: savedPortrait ? `/portrait-custom.${savedPortrait}` : DEFAULT_PORTRAIT_URL,
  people: [], events: [], gifts: 0, giftPoints: 0, totalChats: 0, likes: 0, follows: 0, shares: 0,
  viewerCount: null, audio: { music: true, sfx: true, volume: 0.8, musicVolume: 0.7, sfxVolume: 0.6 },
  musicUrl: savedPlaylist[0].url, musicName: savedPlaylist[0].name, musicPlaylist: savedPlaylist, revision: 0,
};
const clients = new Set();
let nextId = 0;
let activeConnection = null;
let isConnecting = false;
let wantConnected = false;
let reconnectTimer = null;
let reconnectAttempt = 0;
let giftStreak = new Map();
let giftSeen = new Map();
let emitTimer = null;

const normalize = raw => String(raw || '').replace(/^@/, '').trim().slice(0, 26).replace(/[<>\\\r\n\u0000-\u001f]/g, '');
const cleanText = (raw, max = 80) => String(raw || '').replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
function safeIdentity(name, id) {
  const cleanName = normalize(name) || `izleyici${++nextId}`;
  return { name: cleanName, id: String(id || cleanName.toLocaleLowerCase('tr-TR')).slice(0, 90) };
}
function makePerson(name, id, demo = false) {
  return { name, id, demo, giftCount: 0, giftPoints: 0, likes: 0, joined: Date.now(), lastGift: 0, comment: '', commentAt: 0 };
}
function event(type, name, detail = '', extra = {}) {
  state.events.unshift({ id: crypto.randomUUID(), type, name: String(name).slice(0, 26), detail: String(detail).slice(0, 80), time: Date.now(), ...extra });
  state.events.length = Math.min(state.events.length, MAX_EVENTS);
}
function leaderboard() {
  return state.people.filter(p => p.giftPoints > 0 || p.giftCount > 0)
    .sort((a, b) => b.giftPoints - a.giftPoints || b.giftCount - a.giftCount || a.lastGift - b.lastGift)
    .slice(0, 5).map(p => ({ id: p.id, name: p.name, giftPoints: p.giftPoints, giftCount: p.giftCount }));
}
function snapshot() {
  return {
    connected: state.connected, connecting: state.connecting, connectionMessage: state.connectionMessage,
    username: state.username, demo: state.demo, carriers: state.carriers,
    portraitBearer: state.portraitBearer, portraitCost: state.portraitCost, portraitUrl: state.portraitUrl, giftPoints: state.giftPoints,
    people: state.people, events: state.events, gifts: state.gifts, totalChats: state.totalChats,
    likes: state.likes, follows: state.follows, shares: state.shares, viewerCount: state.viewerCount,
    leaderboard: leaderboard(), audio: state.audio, musicUrl: state.musicUrl, musicName: state.musicName, musicPlaylist: state.musicPlaylist, revision: state.revision,
  };
}
// Coalesce bursts (likes on a busy stream can arrive dozens per second) into ≤ 12 pushes per second.
function flush() {
  emitTimer = null;
  state.revision++;
  const payload = `event: state\ndata: ${JSON.stringify(snapshot())}\n\n`;
  for (const client of clients) { try { client.write(payload); } catch { clients.delete(client); } }
}
function emit() { if (!emitTimer) emitTimer = setTimeout(flush, 80); }

function findOrAdd(name, id, demo = false) {
  const who = safeIdentity(name, id);
  let person = state.people.find(p => p.id === who.id);
  if (person) {
    if (who.name !== person.name) person.name = who.name;
    return { person, isNew: false };
  }
  person = makePerson(who.name, who.id, demo);
  state.people.push(person);
  if (state.people.length > MAX_PEOPLE) {
    // Drop the oldest passive viewer; never a carrier or the portrait bearer, gifters last.
    let outside = state.people.findIndex(p => p.giftCount === 0 && !isOnStage(p.id) && p !== person);
    if (outside < 0) outside = state.people.findIndex(p => !isOnStage(p.id) && p !== person);
    if (outside >= 0) state.people.splice(outside, 1);
  }
  return { person, isNew: true };
}
const isOnStage = id => state.carriers.some(c => c?.id === id) || state.portraitBearer?.id === id;
const personFor = findOrAdd;

export function chat(name, id, demo = false, comment = '') {
  const { person, isNew } = personFor(name, id, demo);
  state.totalChats++;
  const text = cleanText(comment);
  if (text) { person.comment = text; person.commentAt = Date.now(); }
  if (isNew) event('join', person.name, text ? `“${text}”` : 'Korteje katıldı', text ? { comment: text } : {});
  else if (text) event('chat', person.name, `“${text}”`, { comment: text });
  emit();
  return person;
}
export function join(name, id, kind = 'member') {
  const { person, isNew } = personFor(name, id, false);
  if (kind === 'follow') { state.follows++; event('follow', person.name, 'Takip etti · korteje katıldı'); }
  else if (kind === 'share') { state.shares++; event('share', person.name, 'Yayını paylaştı'); }
  else if (isNew) event('join', person.name, 'Korteje katıldı');
  emit();
  return person;
}
export function like(name, id, count = 1, demo = false) {
  const { person, isNew } = personFor(name, id, demo);
  const n = Math.min(1000, Math.max(1, Math.trunc(Number(count) || 1)));
  const before = state.likes;
  person.likes += n;
  state.likes += n;
  if (isNew || person.likes === n) event('like', person.name, 'Mum yaktı 🕯️', { count: n });
  if (Math.floor(before / LIKE_MILESTONE) !== Math.floor(state.likes / LIKE_MILESTONE)) {
    event('milestone', 'KORTEJ', `${(Math.floor(state.likes / LIKE_MILESTONE) * LIKE_MILESTONE).toLocaleString('tr-TR')} mum yandı`);
  }
  emit();
  return person;
}
// VIP is determined by total reported gift value for the current game session.
function choosePortraitBearer() {
  const eligible = state.people.filter(p => p.giftPoints >= state.portraitCost);
  eligible.sort((a, b) => b.giftPoints - a.giftPoints || b.lastGift - a.lastGift);
  const winner = eligible[0] || null;
  const previous = state.portraitBearer;
  if (previous?.id === winner?.id) return false;
  state.portraitBearer = winner;
  if (winner) {
    const slot = state.carriers.findIndex(p => p?.id === winner.id);
    if (slot >= 0) state.carriers[slot] = null;
    event('portrait', winner.name, `Fotoğrafı taşıyor · ${winner.giftPoints.toLocaleString('tr-TR')} puan`, { points: winner.giftPoints, previous: previous?.name || '' });
  } else if (previous) { event('rotate', previous.name, 'Fotoğraf taşıyıcılığı sona erdi'); }
  return true;
}
function fillCarrierVacancies() {
  // Keep six unique people in the casket team where enough gift-givers exist.
  const taken = new Set(state.carriers.filter(Boolean).map(p => p.id));
  if (state.portraitBearer) taken.add(state.portraitBearer.id);
  const candidates = state.people.filter(p => p.giftCount > 0 && !taken.has(p.id)).sort((a, b) => b.lastGift - a.lastGift);
  for (let i = 0; i < state.carriers.length; i++) {
    if (state.carriers[i] === null && candidates.length) {
      const p = candidates.shift(); state.carriers[i] = p; taken.add(p.id);
    }
  }
}
export function gift(name, id, giftName = 'Hediye', amount = 1, demo = false, unitPoints = 1) {
  const { person } = personFor(name, id, demo);
  const value = Math.min(10000, Math.max(1, Math.trunc(Number(amount) || 1)));
  // SDK gift.diamondCount is the event's per-gift *reported* value, not a wallet balance.
  const pointsPerGift = Math.max(0, Math.min(100000, Math.trunc(Number(unitPoints) || 0)));
  const points = Math.min(10000000, pointsPerGift * value);
  const label = cleanText(giftName, 32) || 'Hediye';
  person.giftCount += value;
  person.giftPoints += points;
  person.lastGift = Date.now();
  state.gifts += value;
  state.giftPoints += points;
  const photoChanged = choosePortraitBearer();
  const isPortrait = state.portraitBearer?.id === person.id;
  const meta = { giftName: label, amount: value, points };
  if (isPortrait) {
    if (!photoChanged) event('gift', person.name, `${label} · Fotoğraf taşıyıcısına destek (+${points})`, { ...meta, slot: -1 });
  } else {
    const already = state.carriers.findIndex(p => p?.id === person.id);
    if (already === -1) {
      const vacant = state.carriers.findIndex(p => p === null);
      const slot = vacant !== -1 ? vacant : state.carriers.reduce((oldest, p, i, all) => (p.lastGift < all[oldest].lastGift ? i : oldest), 0);
      const outgoing = state.carriers[slot];
      state.carriers[slot] = person;
      if (outgoing) event('rotate', outgoing.name, 'Omzunu devretti · korteje geçti');
      event('gift', person.name, `${label} · ${slot + 1}. tabut taşıyıcısı`, { ...meta, slot, newCarrier: true });
    } else { event('gift', person.name, `${label} · ${already + 1}. taşıyıcı yerini korudu`, { ...meta, slot: already }); }
  }
  if (photoChanged) fillCarrierVacancies();
  emit();
  return person;
}
function clearState(demo) {
  state.people = []; state.carriers = Array(6).fill(null); state.portraitBearer = null; state.events = [];
  state.gifts = 0; state.giftPoints = 0; state.totalChats = 0; state.likes = 0; state.follows = 0; state.shares = 0;
  state.demo = demo; giftStreak = new Map(); giftSeen = new Map();
  if (demo || !state.connected) state.viewerCount = null;
}
function demoSeed() {
  clearState(true);
  const carriers = ['mehmet.ali', 'utku.61', 'mertcan', 'feyza', 'enes.34', 'melis'];
  carriers.forEach((n, i) => {
    const { person: p } = findOrAdd(n, `demo-carrier-${i}`, true);
    p.giftCount = 1 + i; p.giftPoints = 5 + i * 30; p.lastGift = Date.now() - (6 - i) * 9000;
    state.carriers[i] = p;
  });
  seedUsers.slice(0, 26).forEach((n, i) => {
    const { person: p } = findOrAdd(n, `demo-crowd-${i}`, true);
    if (i < 6) { p.comment = seedComments[i % seedComments.length]; p.commentAt = Date.now() - i * 1500; }
    p.likes = (i * 7) % 40;
  });
  const { person: portrait } = findOrAdd('efsane.dostu', 'demo-portrait', true);
  portrait.giftCount = 3; portrait.giftPoints = state.portraitCost + 250; portrait.lastGift = Date.now(); state.portraitBearer = portrait;
  state.likes = 846;
  state.events = [{ id: crypto.randomUUID(), type: 'info', name: 'DEMO', detail: `Ön fotoğraf: ${state.portraitCost} hediye puanı`, time: Date.now() }];
  emit();
}
function readBody(req, maxBytes = 16384) {
  return new Promise((resolve, reject) => {
    let body = ''; let failed = false;
    req.on('data', chunk => { if (failed) return; body += chunk; if (body.length > maxBytes) { failed = true; reject(Object.assign(new Error('İstek çok büyük'), { status: 413 })); req.resume(); } });
    req.on('end', () => { if (failed) return; try { resolve(JSON.parse(body || '{}')); } catch { reject(Object.assign(new Error('Geçersiz JSON'), { status: 400 })); } });
    req.on('error', reject);
  });
}
function respond(res, code, obj) { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); }
function originAllowed(req) {
  if (!req.headers.origin) return true;
  try { const uri = new URL(req.headers.origin); return uri.host === req.headers.host; } catch { return false; }
}
// tiktok-live-connector v2 (proto v3): user.displayId is the @handle, user.nickname the profile name.
function getUser(e) {
  const u = e?.user || {};
  const name = u.displayId || u.uniqueId || u.nickname || 'izleyici';
  return { name, id: String(u.id || u.userId || u.displayId || u.uniqueId || '') };
}
function countGiftEvent(payload) {
  const who = getUser(payload);
  const gId = String(payload.giftId || payload.gift?.id || 'gift');
  const identity = who.id + ':' + gId;
  const msgId = String(payload.common?.msgId || payload.msgId || payload.transactionId || '');
  const repeat = Math.max(1, Number(payload.repeatCount || payload.gift?.repeatCount || 1));
  const streak = Number(payload.gift?.type ?? payload.giftType ?? 0) === 1;
  let delta = 1;
  if (streak) {
    const last = giftStreak.get(identity) || 0;
    delta = Math.max(0, repeat - last);
    if (payload.repeatEnd) giftStreak.delete(identity); else giftStreak.set(identity, repeat);
  } else {
    delta = repeat;
    if (msgId) {
      const key = identity + ':' + msgId;
      if (giftSeen.has(key)) return;
      giftSeen.set(key, Date.now());
      if (giftSeen.size > 1000) giftSeen = new Map([...giftSeen].slice(-500));
    }
  }
  if (delta > 0) {
    const rawPoints = payload.gift?.diamondCount ?? payload.extendedGiftInfo?.diamond_count ?? payload.extendedGiftInfo?.diamondCount ?? payload.diamondCount;
    // Never invent point value when TikTok does not send it.
    const unitPoints = rawPoints != null && Number.isFinite(Number(rawPoints)) ? Number(rawPoints) : 0;
    gift(who.name, who.id, String(payload.gift?.name || payload.extendedGiftInfo?.name || 'TikTok hediyesi').slice(0, 32), delta, false, unitPoints);
  }
}
function scheduleReconnect() {
  if (!wantConnected || reconnectTimer) return;
  const delay = Math.min(30000, 4000 * 2 ** Math.min(3, reconnectAttempt++));
  state.connectionMessage = `Bağlantı koptu · ${Math.round(delay / 1000)} sn içinde yeniden deneniyor`; emit();
  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    if (!wantConnected) return;
    try { await openConnection(state.username, { keepState: true }); }
    catch { scheduleReconnect(); }
  }, delay);
}
async function closeConnection() {
  const c = activeConnection; activeConnection = null;
  if (c) { try { c.removeAllListeners?.(); await c.disconnect(); } catch {} }
}
async function disconnect() {
  wantConnected = false; reconnectAttempt = 0;
  clearTimeout(reconnectTimer); reconnectTimer = null;
  await closeConnection();
  state.connected = false; state.connecting = false;
  state.connectionMessage = 'Bağlantı kapalı'; emit();
}
async function openConnection(clean, { keepState }) {
  if (isConnecting) throw new Error('Bağlantı zaten kuruluyor');
  isConnecting = true;
  try {
    await closeConnection();
    if (!keepState) clearState(false);
    state.connecting = true; state.username = clean;
    state.connectionMessage = 'TikTok yayınına bağlanılıyor'; emit();
    const module = await import('tiktok-live-connector').catch(() => null);
    if (!module) throw new Error('TikTok paketi eksik: klasörde "npm install" çalıştır');
    const { TikTokLiveConnection, WebcastEvent, ControlEvent } = module;
    const connection = new TikTokLiveConnection(clean, { processInitialData: false, enableExtendedGiftInfo: false });
    activeConnection = connection;
    const live = fn => (...args) => { if (activeConnection === connection) { try { fn(...args); } catch (err) { console.warn('Olay işlenemedi:', err?.message || err); } } };
    connection.on(WebcastEvent.CHAT, live(e => { const p = getUser(e); chat(p.name, p.id, false, e.comment); }));
    // Joining users can appear in the follower crowd even without commenting.
    // TikTok does not guarantee member notifications for every passive viewer.
    connection.on(WebcastEvent.MEMBER, live(e => { const p = getUser(e); if (p.id) join(p.name, p.id, 'member'); }));
    connection.on(WebcastEvent.FOLLOW, live(e => { const p = getUser(e); if (p.id) join(p.name, p.id, 'follow'); }));
    connection.on(WebcastEvent.SHARE, live(e => { const p = getUser(e); if (p.id) join(p.name, p.id, 'share'); }));
    connection.on(WebcastEvent.LIKE, live(e => { const p = getUser(e); if (p.id) like(p.name, p.id, e.count || e.likeCount || 1); }));
    connection.on(WebcastEvent.ROOM_USER, live(e => { const n = Number(e.viewerCount ?? e.total ?? e.totalUser); if (Number.isFinite(n) && n >= 0) { state.viewerCount = n; emit(); } }));
    connection.on(WebcastEvent.GIFT, live(countGiftEvent));
    connection.on(WebcastEvent.STREAM_END, live(() => {
      wantConnected = false; state.connected = false; state.connectionMessage = 'Yayın sona erdi'; event('info', 'YAYIN', 'Canlı yayın sona erdi'); emit();
    }));
    connection.on(ControlEvent.ERROR, live(({ info, exception } = {}) => {
      state.connectionMessage = String(info || exception?.message || 'TikTok bağlantı hatası').slice(0, 120); emit();
    }));
    connection.on(ControlEvent.DISCONNECTED, live(() => {
      state.connected = false; activeConnection = null;
      if (wantConnected) scheduleReconnect(); else { state.connectionMessage = 'Yayın bağlantısı kesildi'; emit(); }
    }));
    const room = await connection.connect();
    reconnectAttempt = 0;
    state.connected = true; state.connecting = false;
    state.connectionMessage = `Bağlandı · Oda ${room?.roomId || ''}`.trim(); emit();
  } catch (e) {
    state.connected = false; state.connecting = false;
    state.connectionMessage = String(e?.message || e).slice(0, 160); emit();
    throw e;
  } finally { isConnecting = false; }
}
async function connect(username) {
  const clean = normalize(username);
  if (!clean) throw Object.assign(new Error('TikTok kullanıcı adını yaz'), { status: 400 });
  wantConnected = false; clearTimeout(reconnectTimer); reconnectTimer = null; reconnectAttempt = 0;
  await openConnection(clean, { keepState: false });
  wantConnected = true;
}

const mime = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg', '.wav': 'audio/wav' };
async function sendFile(req, res, target, cache = 'no-cache') {
  const file = await fs.readFile(target).catch(() => null);
  if (!file) return respond(res, 404, { error: 'Dosya bulunamadı' });
  const type = mime[path.extname(target)] || 'application/octet-stream';
  // Byte ranges let the browser's audio player loop and seek a song smoothly.
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (range && (range[1] || range[2])) {
    let start = range[1] ? Number(range[1]) : file.length - Number(range[2]);
    let end = range[1] && range[2] ? Number(range[2]) : file.length - 1;
    start = Math.max(0, start); end = Math.min(file.length - 1, end);
    if (start > end) { res.writeHead(416, { 'Content-Range': `bytes */${file.length}` }); return res.end(); }
    res.writeHead(206, { 'Content-Type': type, 'Cache-Control': cache, 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${start}-${end}/${file.length}`, 'Content-Length': end - start + 1 });
    return res.end(req.method === 'HEAD' ? undefined : file.subarray(start, end + 1));
  }
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': cache, 'Accept-Ranges': 'bytes', 'Content-Length': file.length });
  res.end(req.method === 'HEAD' ? undefined : file);
}
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (req.method === 'GET' && url.pathname === '/events') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
      res.write('retry: 2000\n\n');
      res.write(`event: state\ndata: ${JSON.stringify(snapshot())}\n\n`);
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/state') return respond(res, 200, snapshot());
    if (req.method === 'POST' && url.pathname.startsWith('/api/')) {
      if (!originAllowed(req)) return respond(res, 403, { error: 'Cross-origin istek reddedildi' });
      const body = await readBody(req, url.pathname === '/api/portrait' ? 3500000 : url.pathname === '/api/music' ? Math.ceil(MAX_MUSIC_BYTES * 1.4) + 4096 : 16384);
      switch (url.pathname) {
        case '/api/chat': { const p = chat(body.name, body.id, false, body.comment); return respond(res, 200, { ok: true, person: p }); }
        case '/api/gift': { const p = gift(body.name, body.id, body.giftName || 'Gül', body.amount || 1, false, body.unitPoints ?? 1); return respond(res, 200, { ok: true, person: p }); }
        case '/api/like': { const p = like(body.name, body.id, body.count || 1, false); return respond(res, 200, { ok: true, person: p }); }
        case '/api/follow': { const p = join(body.name, body.id, 'follow'); return respond(res, 200, { ok: true, person: p }); }
        case '/api/settings': {
          const cost = Number(body.portraitCost);
          if (!Number.isInteger(cost) || cost < 10 || cost > 100000) return respond(res, 400, { error: 'Eşik 10–100.000 arasında olmalı' });
          state.portraitCost = cost; choosePortraitBearer(); fillCarrierVacancies();
          event('info', 'AYAR', `Fotoğraf taşıma eşiği ${cost.toLocaleString('tr-TR')} puan`); emit();
          return respond(res, 200, { ok: true, portraitCost: cost });
        }
        case '/api/audio': {
          const a = state.audio;
          if (typeof body.music === 'boolean') a.music = body.music;
          if (typeof body.sfx === 'boolean') a.sfx = body.sfx;
          for (const key of ['volume', 'musicVolume', 'sfxVolume']) {
            if (body[key] === undefined) continue;
            const v = Number(body[key]);
            if (!Number.isFinite(v) || v < 0 || v > 1) return respond(res, 400, { error: 'Ses 0–1 arasında olmalı' });
            a[key] = Math.round(v * 100) / 100;
          }
          emit(); return respond(res, 200, { ok: true, audio: a });
        }
        case '/api/music': {
          const slot = body.slot === undefined ? 1 : Number(body.slot);
          if (!Number.isInteger(slot) || slot < 1 || slot > 3) return respond(res, 400, { error: 'Şarkı sırası 1–3 olmalı' });
          const match = /^data:[\\w/.+-]*;base64,([a-zA-Z0-9+/=]+)$/.exec(String(body.dataUrl || ''));
          if (!match) return respond(res, 400, { error: 'Şarkı dosyası okunamadı' });
          const data = Buffer.from(match[1], 'base64');
          if (!data.length || data.length > MAX_MUSIC_BYTES) return respond(res, 400, { error: 'Şarkı en fazla 15 MB olabilir' });
          const format = sniffAudio(data);
          if (!format) return respond(res, 400, { error: 'MP3, M4A, OGG veya WAV yükleyebilirsin' });
          const stem = slot === 1 ? 'music-custom' : `music-custom-${slot}`;
          await fs.writeFile(path.join(PUBLIC, `${stem}.${format}`), data);
          await Promise.all(MUSIC_EXTS.filter(ext => ext !== format).map(ext => fs.unlink(path.join(PUBLIC, `${stem}.${ext}`)).catch(() => {})));
          const name = cleanText(String(body.name || '').replace(/\\.[a-z0-9]{2,4}$/i, ''), 60) || `Şarkı ${slot}`;
          await fs.writeFile(path.join(PUBLIC, `${stem}.name.txt`), name);
          const url = `/${stem}.${format}?v=${Date.now()}`;
          state.musicPlaylist[slot - 1] = { url, name };
          if (slot === 1) { state.musicUrl = url; state.musicName = name; }
          state.audio.music = true;
          event('info', 'MÜZİK', `${slot}. sıraya eklendi: ${name}`); emit();
          return respond(res, 200, { ok: true, slot, musicUrl: url, musicName: name, musicPlaylist: state.musicPlaylist });
        }
        case '/api/music-default': {
          const slot = body.slot === undefined ? null : Number(body.slot);
          if (slot !== null && (!Number.isInteger(slot) || slot < 1 || slot > 3)) return respond(res, 400, { error: 'Şarkı sırası 1–3 olmalı' });
          const slots = slot === null ? [1, 2, 3] : [slot];
          await Promise.all(slots.flatMap(n => {
            const stem = n === 1 ? 'music-custom' : `music-custom-${n}`;
            return [...MUSIC_EXTS.map(ext => `${stem}.${ext}`), `${stem}.name.txt`]
              .map(file => fs.unlink(path.join(PUBLIC, file)).catch(() => {}));
          }));
          for (const n of slots) state.musicPlaylist[n - 1] = { url: '', name: '' };
          if (slot === null || slot === 1) { state.musicUrl = ''; state.musicName = ''; }
          event('info', 'MÜZİK', slot === null ? 'Varsayılan müziğe dönüldü' : `${slot}. sıradaki şarkı kaldırıldı`); emit();
          return respond(res, 200, { ok: true, musicPlaylist: state.musicPlaylist });
        }
        case '/api/portrait': {
          const source = String(body.dataUrl || '');
          const match = /^data:image\/(jpeg|png|webp);base64,([a-zA-Z0-9+/=]+)$/.exec(source);
          if (!match) return respond(res, 400, { error: 'JPEG, PNG veya WebP yükleyebilirsin' });
          const data = Buffer.from(match[2], 'base64');
          if (!data.length || data.length > 2300000) return respond(res, 400, { error: 'Fotoğraf en fazla 2 MB olabilir' });
          const format = match[1] === 'jpeg' ? 'jpg' : match[1];
          const valid = format === 'jpg' ? data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff : format === 'png' ? data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) : data.subarray(0, 4).toString() === 'RIFF' && data.subarray(8, 12).toString() === 'WEBP';
          if (!valid) return respond(res, 400, { error: 'Fotoğraf dosyası doğrulanamadı' });
          await fs.writeFile(path.join(PUBLIC, `portrait-custom.${format}`), data);
          await Promise.all(['jpg', 'png', 'webp'].filter(ext => ext !== format).map(ext => fs.unlink(path.join(PUBLIC, `portrait-custom.${ext}`)).catch(() => {})));
          state.portraitUrl = `/portrait-custom.${format}?v=${Date.now()}`; event('info', 'AYAR', 'Fotoğraf güncellendi'); emit();
          return respond(res, 200, { ok: true, portraitUrl: state.portraitUrl });
        }
        case '/api/portrait-default': {
          await Promise.all(['jpg', 'png', 'webp'].map(ext => fs.unlink(path.join(PUBLIC, `portrait-custom.${ext}`)).catch(() => {})));
          state.portraitUrl = DEFAULT_PORTRAIT_URL; event('info', 'AYAR', 'Varsayılan fotoğrafa dönüldü'); emit();
          return respond(res, 200, { ok: true, portraitUrl: state.portraitUrl });
        }
        case '/api/demo': {
          if (state.connected || wantConnected) return respond(res, 409, { error: 'Canlı yayın bağlıyken demo yüklenmez. Önce bağlantıyı kes.' });
          demoSeed(); return respond(res, 200, { ok: true });
        }
        case '/api/reset': { clearState(false); emit(); return respond(res, 200, { ok: true }); }
        case '/api/connect': { await connect(body.username); return respond(res, 200, { ok: true }); }
        case '/api/disconnect': { await disconnect(); return respond(res, 200, { ok: true }); }
        default: return respond(res, 404, { error: 'API bulunamadı' });
      }
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return respond(res, 405, { error: 'Yöntem desteklenmiyor' });
    // Three.js is served locally from node_modules so the stream does not depend on a CDN.
    if (url.pathname.startsWith('/vendor/addons/')) {
      const name = url.pathname.slice('/vendor/addons/'.length);
      if (!/^(postprocessing|shaders)\/[A-Za-z0-9]+\.js$/.test(name)) return respond(res, 403, { error: 'İzin verilmedi' });
      return sendFile(req, res, path.join(DIR, 'node_modules', 'three', 'examples', 'jsm', name), 'public, max-age=86400');
    }
    if (url.pathname.startsWith('/vendor/')) {
      const name = url.pathname.slice('/vendor/'.length);
      if (!/^[a-z0-9.]+\.js$/i.test(name)) return respond(res, 403, { error: 'İzin verilmedi' });
      return sendFile(req, res, path.join(THREE_BUILD, name), 'public, max-age=86400');
    }
    const sub = url.pathname === '/' ? '/index.html' : url.pathname;
    let decoded; try { decoded = decodeURIComponent(sub); } catch { return respond(res, 400, { error: 'Geçersiz adres' }); }
    const target = path.resolve(PUBLIC, '.' + decoded);
    if (!target.startsWith(PUBLIC + path.sep)) return respond(res, 403, { error: 'İzin verilmedi' });
    return sendFile(req, res, target);
  } catch (error) {
    const status = error?.status || 500;
    if (!res.headersSent) respond(res, status, { error: String(error?.message || error) }); else res.end();
  }
});
setInterval(() => { for (const c of clients) { try { c.write(': ping\n\n'); } catch { clients.delete(c); } } }, 20000).unref();
demoSeed();
server.listen(PORT, HOST, () => {
  console.log(`\n🎬 Eşref Tek | Son Yolculuk: http://${HOST === '127.0.0.1' ? 'localhost' : HOST}:${PORT}`);
  console.log(`📺 OBS / TikTok LIVE Studio kaynağı: http://localhost:${PORT}/?overlay=1`);
  if (!existsSync(THREE_BUILD)) console.log('⚠  3D motoru yerelde yok. Klasörde "npm install" çalıştır (yoksa CDN denenir).');
});
