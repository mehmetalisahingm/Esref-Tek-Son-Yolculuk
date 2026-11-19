import http from 'node:http';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createBridge, DEFAULT_TIKFINITY_URL } from './bridge.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(DIR, 'public');
const THREE_BUILD = path.join(DIR, 'node_modules', 'three', 'build');
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';
const MAX_EVENTS = 40;
const LIKE_MILESTONE = 1000;
// Official Kanal D Eşref Tek character profile picture, used as a remote default.
const DEFAULT_PORTRAIT_URL = 'https://image.kanald.com.tr/i/kanald/100/200x286/6864d72ccf62483f9cfa5def.jpg';
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
  username: '', demo: true,
  carriers: Array(6).fill(null), portraitBearer: null,
  portraitUrl: savedPortrait ? `/portrait-custom.${savedPortrait}` : DEFAULT_PORTRAIT_URL,
  people: [], events: [], gifts: 0, giftPoints: 0, totalChats: 0, likes: 0, follows: 0, shares: 0,
  viewerCount: null, audio: { music: true, sfx: true, volume: 0.8, musicVolume: 0.7, sfxVolume: 0.6 },
  musicUrl: savedPlaylist[0].url, musicName: savedPlaylist[0].name, musicPlaylist: savedPlaylist, revision: 0,
};
const clients = new Set();
let nextId = 0;
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
  return { name, id, demo, giftCount: 0, giftPoints: 0, likes: 0, followed: false, joined: Date.now(), lastGift: 0, comment: '', commentAt: 0 };
}
function event(type, name, detail = '', extra = {}) {
  state.events.unshift({ id: crypto.randomUUID(), type, name: String(name).slice(0, 26), detail: String(detail).slice(0, 80), time: Date.now(), ...extra });
  state.events.length = Math.min(state.events.length, MAX_EVENTS);
}
function leaderboard() {
  return state.people.filter(p => p.giftPoints > 0 || p.giftCount > 0)
    .sort((a, b) => b.giftCount - a.giftCount || a.joined - b.joined)
    .slice(0, 5).map(p => ({ id: p.id, name: p.name, giftPoints: p.giftPoints, giftCount: p.giftCount }));
}
function snapshot() {
  return {
    connected: isLive(), connecting: ['connecting', 'reconnecting', 'waiting'].includes(bridge.status.state), connectionMessage: bridge.status.state === 'idle' && state.demo ? 'Demo modu' : bridge.status.message,
    bridge: bridgeSnapshot(),
    username: state.username, demo: state.demo, carriers: state.carriers,
    portraitBearer: state.portraitBearer, portraitUrl: state.portraitUrl, giftPoints: state.giftPoints,
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
  if (kind === 'follow') { person.followed = true; state.follows++; event('follow', person.name, 'Takip etti · mum yaktı 🕯️'); }
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
  rankCarriers();
  if (isNew || person.likes === n) event('like', person.name, 'Yayını beğendi', { count: n });
  if (Math.floor(before / LIKE_MILESTONE) !== Math.floor(state.likes / LIKE_MILESTONE)) {
    event('milestone', 'KORTEJ', `${(Math.floor(state.likes / LIKE_MILESTONE) * LIKE_MILESTONE).toLocaleString('tr-TR')} beğeni geldi`);
  }
  emit();
  return person;
}
// The portrait goes to the viewer with the most gifts. Ties retain arrival order.
function choosePortraitBearer() {
  const winner = state.people.filter(p => p.giftCount > 0)
    .sort((a, b) => b.giftCount - a.giftCount || a.joined - b.joined)[0] || null;
  const previous = state.portraitBearer;
  if (previous?.id === winner?.id) return false;
  state.portraitBearer = winner;
  if (winner) event('portrait', winner.name, `Fotoğrafı taşıyor · ${winner.giftCount} hediye`, { count: winner.giftCount, points: winner.giftPoints, previous: previous?.name || '' });
  return true;
}
function rankCarriers() {
  // Retain existing shoulder positions while the viewer remains in the top six.
  const old = state.carriers.filter(Boolean);
  const order = new Map(old.map((p, i) => [p.id, i]));
  const ranked = state.people.filter(p => p.likes > 0 && p.id !== state.portraitBearer?.id)
    .sort((a, b) => b.likes - a.likes || (order.get(a.id) ?? 1000000) - (order.get(b.id) ?? 1000000) || a.joined - b.joined).slice(0, 6);
  const keep = new Set(ranked.map(p => p.id));
  const next = state.carriers.map(p => p && keep.has(p.id) ? p : null);
  for (const p of old) if (!keep.has(p.id) && p.id !== state.portraitBearer?.id) event('rotate', p.name, 'Omzunu devretti · korteje geçti');
  for (const p of ranked) {
    if (next.some(c => c?.id === p.id)) continue;
    const slot = next.indexOf(null);
    next[slot] = p;
    event('carrier', p.name, `${slot + 1}. omuz · ${p.likes.toLocaleString('tr-TR')} beğeni`, { slot, likes: p.likes });
  }
  state.carriers = next;
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
  rankCarriers();
  if (!photoChanged || state.portraitBearer?.id !== person.id) {
    event('gift', person.name, `${label} · ${value} hediye`, { giftName: label, amount: value, points, slot: -1 });
  }
  emit();
  return person;
}
function clearState(demo) {
  state.people = []; state.carriers = Array(6).fill(null); state.portraitBearer = null; state.events = [];
  state.gifts = 0; state.giftPoints = 0; state.totalChats = 0; state.likes = 0; state.follows = 0; state.shares = 0;
  state.demo = demo; giftStreak = new Map(); giftSeen = new Map();
  if (demo || !isLive()) state.viewerCount = null;
}
function demoSeed() {
  clearState(true);
  const carriers = ['mehmet.ali', 'utku.61', 'mertcan', 'feyza', 'enes.34', 'melis'];
  carriers.forEach((n, i) => {
    const { person: p } = findOrAdd(n, `demo-carrier-${i}`, true);
    p.giftCount = 1 + i; p.giftPoints = 5 + i * 30; p.lastGift = Date.now() - (6 - i) * 9000;
    p.likes = 100 - i * 10;
  });
  seedUsers.slice(0, 26).forEach((n, i) => {
    const { person: p } = findOrAdd(n, `demo-crowd-${i}`, true);
    if (i < 6) { p.comment = seedComments[i % seedComments.length]; p.commentAt = Date.now() - i * 1500; }
    p.likes = (i * 7) % 40;
  });
  const { person: portrait } = findOrAdd('efsane.dostu', 'demo-portrait', true);
  portrait.giftCount = 10; portrait.giftPoints = 750; portrait.lastGift = Date.now(); state.portraitBearer = portrait;
  rankCarriers();
  state.likes = 846;
  state.events = [{ id: crypto.randomUUID(), type: 'info', name: 'DEMO', detail: 'En çok hediye gönderen fotoğrafı taşır', time: Date.now() }];
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
// ——— Live bridge settings (kept in a local, git-ignored file; the sign key never leaves this computer) ———
const CONFIG_FILE = process.env.SON_YOLCULUK_CONFIG || path.join(DIR, 'config.local.json');
let bridgeConfig = { mode: 'direct', username: '', signApiKey: '', tikfinityUrl: DEFAULT_TIKFINITY_URL };
try { bridgeConfig = { ...bridgeConfig, ...JSON.parse(await fs.readFile(CONFIG_FILE, 'utf8')) }; } catch {}
async function saveBridgeConfig() {
  try { await fs.writeFile(CONFIG_FILE, JSON.stringify(bridgeConfig, null, 2)); } catch (err) { console.warn('Ayar dosyası yazılamadı:', err?.message || err); }
}
function bridgeSnapshot() {
  const b = bridge.status;
  return {
    mode: b.mode, state: b.state, message: b.message, counts: b.counts, unknown: b.unknown, lastEventAt: b.lastEventAt, lastEventType: b.lastEventType, since: b.since,
    username: bridgeConfig.username, tikfinityUrl: bridgeConfig.tikfinityUrl, hasSignKey: Boolean(bridgeConfig.signApiKey), savedMode: bridgeConfig.mode,
  };
}

// ——— One event pipeline for both transports ———
function countGift(ev) {
  const { user, gift: g } = ev;
  const identity = `${user.id}:${g.id}`;
  let delta;
  if (g.streakable) {
    // A repeated final message must not start a new combo after the first one was cleared.
    if (g.repeatEnd && g.msgId) {
      const key = `${identity}:${g.msgId}`;
      if (giftSeen.has(key)) return;
      giftSeen.set(key, Date.now());
      if (giftSeen.size > 1000) giftSeen = new Map([...giftSeen].slice(-500));
    }
    // Combo gifts report a running total; count only the increase since the last update.
    const last = giftStreak.get(identity) || 0;
    delta = Math.max(0, g.repeatCount - last);
    if (g.repeatEnd) giftStreak.delete(identity); else giftStreak.set(identity, g.repeatCount);
  } else {
    delta = Math.max(1, g.repeatCount || 1);
    if (g.msgId) {
      const key = `${identity}:${g.msgId}`;
      if (giftSeen.has(key)) return;
      giftSeen.set(key, Date.now());
      if (giftSeen.size > 1000) giftSeen = new Map([...giftSeen].slice(-500));
    }
  }
  if (delta <= 0) return;
  // Never invent a point value when TikTok does not send one.
  const unitPoints = g.diamonds != null && Number.isFinite(Number(g.diamonds)) ? Number(g.diamonds) : 0;
  gift(user.name, user.id, g.name.slice(0, 32), delta, false, unitPoints);
}
// A viewer is usable when TikTok gave an id or at least a real name (anonymous joins carry only a name).
const known = u => Boolean(u && (u.id || (u.name && u.name !== 'izleyici')));
function ingest(ev) {
  const u = ev.user;
  switch (ev.type) {
    case 'chat': chat(u.name, u.id, false, ev.comment); break;
    // Join notifications are not guaranteed for every passive viewer; TikTok decides what it sends.
    case 'member': if (known(u)) join(u.name, u.id, 'member'); break;
    case 'follow': if (known(u)) join(u.name, u.id, 'follow'); break;
    case 'share': if (known(u)) join(u.name, u.id, 'share'); break;
    case 'like': if (known(u)) like(u.name, u.id, ev.count); break;
    case 'viewers': if (Number.isFinite(ev.viewers) && ev.viewers >= 0) { state.viewerCount = ev.viewers; emit(); } break;
    case 'gift': countGift(ev); break;
    case 'end': event('info', 'YAYIN', 'Canlı yayın sona erdi'); emit(); break;
  }
}
const bridge = createBridge({ onEvent: ingest, onStatus: () => emit() });
const isLive = () => bridge.status.state === 'connected';
async function connect(body) {
  const mode = body.mode === 'tikfinity' ? 'tikfinity' : 'direct';
  const username = normalize(body.username ?? bridgeConfig.username);
  if (mode === 'direct' && !username) throw Object.assign(new Error('TikTok kullanıcı adını yaz'), { status: 400 });
  if (typeof body.signApiKey === 'string' && body.signApiKey.trim()) bridgeConfig.signApiKey = body.signApiKey.trim().slice(0, 200);
  if (body.clearSignKey) bridgeConfig.signApiKey = '';
  let tikfinityUrl = String(body.tikfinityUrl || bridgeConfig.tikfinityUrl || DEFAULT_TIKFINITY_URL).trim();
  if (!/^wss?:\/\/[^\s]+$/i.test(tikfinityUrl)) throw Object.assign(new Error('TikFinity adresi ws:// ile başlamalı'), { status: 400 });
  Object.assign(bridgeConfig, { mode, username, tikfinityUrl });
  await saveBridgeConfig();
  // A fresh connection replaces the demo procession with real viewers.
  clearState(false); state.username = username; emit();
  const st = await bridge.start({ mode, username, signApiKey: bridgeConfig.signApiKey, tikfinityUrl });
  if (st.state === 'error') throw Object.assign(new Error(st.message), { status: 400 });
  return { ok: true, state: st.state, message: st.message };
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
          const match = /^data:[\w/.+-]*;base64,([a-zA-Z0-9+/=]+)$/.exec(String(body.dataUrl || ''));
          if (!match) return respond(res, 400, { error: 'Şarkı dosyası okunamadı' });
          const data = Buffer.from(match[1], 'base64');
          if (!data.length || data.length > MAX_MUSIC_BYTES) return respond(res, 400, { error: 'Şarkı en fazla 15 MB olabilir' });
          const format = sniffAudio(data);
          if (!format) return respond(res, 400, { error: 'MP3, M4A, OGG veya WAV yükleyebilirsin' });
          const stem = slot === 1 ? 'music-custom' : `music-custom-${slot}`;
          await fs.writeFile(path.join(PUBLIC, `${stem}.${format}`), data);
          await Promise.all(MUSIC_EXTS.filter(ext => ext !== format).map(ext => fs.unlink(path.join(PUBLIC, `${stem}.${ext}`)).catch(() => {})));
          const name = cleanText(String(body.name || '').replace(/\.[a-z0-9]{2,4}$/i, ''), 60) || `Şarkı ${slot}`;
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
          if (bridge.wanted) return respond(res, 409, { error: 'Canlı yayın bağlıyken demo yüklenmez. Önce bağlantıyı kes.' });
          demoSeed(); return respond(res, 200, { ok: true });
        }
        case '/api/reset': { clearState(false); emit(); return respond(res, 200, { ok: true }); }
        case '/api/connect': return respond(res, 200, await connect(body));
        case '/api/disconnect': { bridge.stop(); emit(); return respond(res, 200, { ok: true }); }
        case '/api/bridge-settings': {
          if (typeof body.signApiKey === 'string' && body.signApiKey.trim()) bridgeConfig.signApiKey = body.signApiKey.trim().slice(0, 200);
          if (body.clearSignKey) bridgeConfig.signApiKey = '';
          if (body.mode === 'direct' || body.mode === 'tikfinity') bridgeConfig.mode = body.mode;
          await saveBridgeConfig(); emit();
          return respond(res, 200, { ok: true, bridge: bridgeSnapshot() });
        }
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
// Start with an empty procession: only real viewers appear. Set SON_YOLCULUK_DEMO=1 to start with sample viewers.
if (process.env.SON_YOLCULUK_DEMO === '1') demoSeed(); else { clearState(false); emit(); }
server.listen(PORT, HOST, () => {
  console.log(`\n🎬 Eşref Tek | Son Yolculuk: http://${HOST === '127.0.0.1' ? 'localhost' : HOST}:${PORT}`);
  console.log(`📺 OBS / TikTok LIVE Studio kaynağı: http://localhost:${PORT}/?overlay=1`);
  if (!existsSync(THREE_BUILD)) console.log('⚠  3D motoru yerelde yok. Klasörde "npm install" çalıştır (yoksa CDN denenir).');
});
