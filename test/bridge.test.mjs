import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import { fromTikfinity, fromConnector, explainError, safeAvatar } from '../bridge.mjs';

// ——— Unit: event normalisation and error messages ———
test('TikFinity messages are normalised into game events', () => {
  assert.deepEqual(fromTikfinity('{"event":"chat","data":{"uniqueId":"ali","userId":"7","comment":"Başın sağ olsun"}}'),
    { type: 'chat', user: { id: '7', name: 'ali' }, comment: 'Başın sağ olsun' });
  const g = fromTikfinity({ event: 'gift', data: { uniqueId: 'veli', userId: '9', giftId: 5655, giftName: 'Rose', diamondCount: 1, repeatCount: 3, repeatEnd: false, giftType: 1, msgId: 'm1' } });
  assert.equal(g.type, 'gift'); assert.equal(g.gift.streakable, true); assert.equal(g.gift.repeatCount, 3); assert.equal(g.gift.diamonds, 1);
  assert.equal(fromTikfinity({ event: 'social', data: { uniqueId: 'a', displayType: 'pm_mt_msg_viewer_follow' } }).type, 'follow');
  assert.equal(fromTikfinity({ event: 'roomUser', data: { viewerCount: 321 } }).viewers, 321);
  assert.equal(fromTikfinity({ event: 'config', data: {} }), null);
  assert.equal(fromTikfinity('not json'), null);
});

test('connector (v2) events are normalised the same way', () => {
  const g = fromConnector('gift', { user: { id: '1', displayId: 'x' }, giftId: '5', repeatCount: 2, repeatEnd: true, gift: { name: 'Lion', diamondCount: 29999, type: 2 }, common: { msgId: 'z' } });
  assert.deepEqual(g.user, { id: '1', name: 'x' });
  assert.equal(g.gift.name, 'Lion'); assert.equal(g.gift.streakable, false); assert.equal(g.gift.msgId, 'z');
  assert.equal(fromConnector('like', { user: { id: '2', displayId: 'y' }, count: 15 }).count, 15);
});

test('joins are kept even when TikTok sends the id on the message or only a nickname', () => {
  assert.deepEqual(fromConnector('member', { userId: '55', user: { nickname: 'Ali' } }).user, { id: '55', name: 'Ali' });
  assert.deepEqual(fromConnector('anonMember', { nickName: 'Sessiz Kız' }), { type: 'member', user: { id: '', name: 'Sessiz Kız' } });
  assert.equal(fromConnector('anonMember', { nickName: '***' }), null);
  assert.equal(fromTikfinity({ event: 'enter', data: { uniqueId: 'a' } }).type, 'member');
  assert.deepEqual(fromTikfinity({ event: 'yeniTur', data: {} }), { type: 'unknown', kind: 'yenitur' });
});

test('profile pictures are taken from both transports, only as https URLs', () => {
  assert.equal(fromConnector('chat', { user: { id: '1', displayId: 'a', avatarThumb: { urlList: ['https://p16.tiktokcdn.com/a.jpg'] } } }).user.avatar, 'https://p16.tiktokcdn.com/a.jpg');
  assert.equal(fromTikfinity({ event: 'like', data: { uniqueId: 'b', userId: '2', likeCount: 1, profilePictureUrl: 'https://p77.tiktokcdn.com/b.webp' } }).user.avatar, 'https://p77.tiktokcdn.com/b.webp');
  assert.equal(safeAvatar('javascript:alert(1)'), '');
  assert.equal(safeAvatar('http://insecure.example/a.jpg'), '');
});

test('connection errors become clear Turkish messages with the right retry policy', () => {
  class UserOfflineError extends Error {}
  class SignatureRateLimitError extends Error {}
  assert.equal(explainError(new UserOfflineError('x'), 'esref').wait, true);
  assert.match(explainError(new UserOfflineError('x'), 'esref').message, /@esref şu an canlı yayında değil/);
  assert.match(explainError(new SignatureRateLimitError('x')).message, /token/);
  assert.equal(explainError(new Error('TikTok paketi eksik')).fatal, true);
  assert.match(explainError(new Error('getaddrinfo ENOTFOUND www.tiktok.com')).message, /İnternet/);
});

// ——— End to end: a fake TikFinity WebSocket feeds the real server ———
const PORT = 32000 + Math.floor(Math.random() * 500);
const base = `http://127.0.0.1:${PORT}`;
const configFile = path.join(os.tmpdir(), `son-yolculuk-test-${process.pid}.json`);
let child, fake, sockets = [];

function wsFrame(text) {
  const payload = Buffer.from(text);
  const head = payload.length < 126 ? Buffer.from([0x81, payload.length]) : Buffer.from([0x81, 126, payload.length >> 8, payload.length & 255]);
  return Buffer.concat([head, payload]);
}
function startFakeTikfinity() {
  return new Promise(resolve => {
    const server = http.createServer();
    server.on('upgrade', (req, socket) => {
      const accept = crypto.createHash('sha1').update(req.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
      socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
      socket.on('error', () => {});
      sockets.push(socket);
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}
const send = obj => sockets.forEach(s => s.write(wsFrame(JSON.stringify(obj))));
async function getState() { const r = await fetch(base + '/api/state'); return r.json(); }
async function post(p, payload = {}) {
  const r = await fetch(`${base}/api/${p}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  return { status: r.status, body: await r.json() };
}
async function waitFor(fn, ms = 3000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { const s = await getState(); if (fn(s)) return s; await sleep(60); }
  return getState();
}

before(async () => {
  fake = await startFakeTikfinity();
  child = spawn(process.execPath, ['server.mjs'], { cwd: process.cwd(), env: { ...process.env, PORT: String(PORT), SON_YOLCULUK_CONFIG: configFile }, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) { try { if ((await fetch(base + '/api/state')).ok) return; } catch {} await sleep(100); }
  throw new Error('Sunucu başlamadı');
});
after(async () => { child?.kill(); sockets.forEach(s => s.destroy()); fake?.close(); await fs.unlink(configFile).catch(() => {}); });

test('TikFinity bridge brings comments, joins, follows, likes, gifts and viewers into the game', async () => {
  const url = `ws://127.0.0.1:${fake.address().port}/`;
  const res = await post('connect', { mode: 'tikfinity', tikfinityUrl: url });
  assert.equal(res.status, 200); assert.equal(res.body.state, 'connected');
  let s = await getState();
  assert.equal(s.connected, true); assert.equal(s.demo, false); assert.equal(s.people.length, 0);
  assert.equal((await post('demo')).status, 409);

  send({ event: 'config', data: { version: 1 } });
  send({ event: 'chat', data: { uniqueId: 'yorumcu', userId: 'u1', comment: 'Mekânın cennet olsun' } });
  send({ event: 'member', data: { uniqueId: 'sessiz', userId: 'u2' } });
  send({ event: 'social', data: { uniqueId: 'takipci', userId: 'u3', displayType: 'pm_main_follow_message_viewer_2' } });
  send({ event: 'like', data: { uniqueId: 'begenen', userId: 'u4', likeCount: 15 } });
  // A combo rose: running totals 1 → 3 → 5 must count as five roses, not nine.
  for (const [n, end] of [[1, false], [3, false], [5, true]]) send({ event: 'gift', data: { uniqueId: 'gulcu', userId: 'u5', giftId: 5655, giftName: 'Rose', diamondCount: 1, repeatCount: n, repeatEnd: end, giftType: 1, msgId: `r${n}` } });
  // A duplicate final combo event must not count the whole series a second time.
  send({ event: 'gift', data: { uniqueId: 'gulcu', userId: 'u5', giftId: 5655, giftName: 'Rose', diamondCount: 1, repeatCount: 5, repeatEnd: true, giftType: 1, msgId: 'r5' } });
  // A big non-combo gift sent twice with the same msgId must only count once.
  const lion = { event: 'gift', data: { uniqueId: 'aslan', userId: 'u6', giftId: 6369, giftName: 'Lion', diamondCount: 29999, repeatCount: 1, repeatEnd: true, giftType: 2, msgId: 'big1' } };
  send(lion); send(lion);
  send({ event: 'roomUser', data: { viewerCount: 1234 } });

  s = await waitFor(x => x.viewerCount === 1234 && x.portraitBearer);
  const byId = id => s.people.find(p => p.id === id);
  assert.equal(byId('u1').comment, 'Mekânın cennet olsun');
  assert.ok(byId('u2'), 'katılan izleyici kortejde');
  assert.equal(byId('u2').followed, false, 'katılım için takip gerekmez');
  assert.equal(byId('u3').followed, true, 'takip eden mum yakar');
  assert.equal(byId('u4').followed, false, 'beğeni tek başına mum yakmaz');
  assert.equal(s.follows, 1);
  assert.equal(s.likes, 15);
  assert.equal(byId('u5').giftCount, 5);
  assert.equal(s.portraitBearer.id, 'u5');
  assert.ok(s.carriers.some(c => c?.id === 'u4'), 'beğeni atan tabutu omuzladı');
  assert.equal(s.portraitBearer.id, 'u5');
  assert.equal(byId('u6').giftPoints, 29999);
  assert.equal(s.gifts, 6);
  assert.equal(s.viewerCount, 1234);
  assert.deepEqual(s.bridge.counts, { chat: 1, gift: 6, like: 15, follow: 1, share: 0, member: 1 });
  assert.ok(s.bridge.lastEventAt > 0);
});

test('a join with only a nickname still adds the viewer, and unknown event types are reported', async () => {
  send({ event: 'member', data: { nickname: 'Sessiz Kız' } });
  send({ event: 'yeniOlay', data: { x: 1 } });
  const s = await waitFor(x => x.people.some(p => p.name === 'Sessiz Kız') && x.bridge.unknown?.yeniolay);
  assert.ok(s.people.some(p => p.name === 'Sessiz Kız'), 'sadece takma adı gelen izleyici kortejde');
  assert.equal(s.bridge.unknown.yeniolay, 1);
});

test('the bridge notices when TikFinity goes away and retries, and stops on request', async () => {
  sockets.forEach(s => s.destroy()); sockets = [];
  let s = await waitFor(x => x.bridge.state === 'reconnecting');
  assert.equal(s.bridge.state, 'reconnecting');
  assert.match(s.connectionMessage, /TikFinity/);
  await post('disconnect');
  s = await getState();
  assert.equal(s.bridge.state, 'idle'); assert.equal(s.connected, false);
  assert.equal((await post('demo')).status, 200);
});

test('the sign key is stored locally and never sent to the browser', async () => {
  await post('bridge-settings', { signApiKey: 'gizli-anahtar-123' });
  const raw = await (await fetch(base + '/api/state')).text();
  assert.ok(!raw.includes('gizli-anahtar-123'));
  assert.equal(JSON.parse(raw).bridge.hasSignKey, true);
  assert.equal(JSON.parse(await fs.readFile(configFile, 'utf8')).signApiKey, 'gizli-anahtar-123');
  await post('bridge-settings', { clearSignKey: true });
  assert.equal((await getState()).bridge.hasSignKey, false);
});

test('a direct connection needs a username', async () => {
  const r = await post('connect', { mode: 'direct', username: '' });
  assert.equal(r.status, 400);
});

// ——— Direct transport with a stand-in for tiktok-live-connector ———
import { EventEmitter } from 'node:events';
import { createBridge } from '../bridge.mjs';
function fakeConnector({ offlineTimes = 0 } = {}) {
  const made = [];
  class UserOfflineError extends Error {}
  class TikTokLiveConnection extends EventEmitter {
    constructor(user, options) { super(); this.user = user; this.options = options; made.push(this); }
    async connect() { if (made.length <= offlineTimes) throw new UserOfflineError('User is offline'); return { roomId: '42' }; }
    async disconnect() {}
  }
  const WebcastEvent = { CHAT: 'chat', MEMBER: 'member', UNAUTHORIZED_MEMBER: 'unauthorizedMember', FOLLOW: 'follow', SHARE: 'share', LIKE: 'like', ROOM_USER: 'roomUser', GIFT: 'gift', STREAM_END: 'streamEnd' };
  const ControlEvent = { DISCONNECTED: 'disconnected' };
  return { made, load: async () => ({ TikTokLiveConnection, WebcastEvent, ControlEvent }) };
}

test('direct bridge connects with the sign key, forwards events and reconnects after a drop', async () => {
  const fc = fakeConnector(); const events = [];
  const b = createBridge({ onEvent: e => events.push(e), loadConnector: fc.load });
  const st = await b.start({ mode: 'direct', username: 'esref', signApiKey: 'k-1' });
  assert.equal(st.state, 'connected');
  assert.equal(fc.made[0].options.signApiKey, 'k-1');
  fc.made[0].emit('chat', { user: { id: '1', displayId: 'ali' }, comment: 'selam' });
  fc.made[0].emit('gift', { user: { id: '2', displayId: 'veli' }, giftId: '5', repeatCount: 1, repeatEnd: true, gift: { name: 'Rose', diamondCount: 1, type: 1 } });
  fc.made[0].emit('unauthorizedMember', { nickName: 'Gizli İzleyici' });
  assert.deepEqual(events.map(e => e.type), ['chat', 'gift', 'member']);
  assert.equal(events[2].user.name, 'Gizli İzleyici');
  fc.made[0].emit('disconnected');
  assert.equal(b.status.state, 'reconnecting');
  b.stop();
  assert.equal(b.status.state, 'idle');
});

test('direct bridge waits for the stream to go live instead of failing', async () => {
  const fc = fakeConnector({ offlineTimes: 1 });
  const b = createBridge({ onEvent: () => {}, loadConnector: fc.load });
  const st = await b.start({ mode: 'direct', username: 'esref' });
  assert.equal(st.state, 'waiting');
  assert.match(st.message, /canlı yayında değil/);
  b.stop();
});

test('stream end stops the bridge with a clear message', async () => {
  const fc = fakeConnector(); const events = [];
  const b = createBridge({ onEvent: e => events.push(e), loadConnector: fc.load });
  await b.start({ mode: 'direct', username: 'esref' });
  fc.made[0].emit('streamEnd', {});
  assert.equal(b.status.state, 'idle'); assert.equal(b.wanted, false);
  assert.match(b.status.message, /sona erdi/);
});

test('an open TikFinity socket with no events triggers a visible warning, cleared by the next event', async () => {
  let sock;
  class FakeWS { constructor() { sock = this; setTimeout(() => this.onopen?.(), 5); } close() {} }
  const b = createBridge({ onEvent: () => {}, WebSocketImpl: FakeWS, staleMs: 150 });
  assert.equal((await b.start({ mode: 'tikfinity' })).state, 'connected');
  await sleep(400);
  assert.match(b.status.message, /olay gelmiyor/);
  sock.onmessage({ data: JSON.stringify({ event: 'chat', data: { uniqueId: 'a', userId: '1', comment: 'x' } }) });
  assert.doesNotMatch(b.status.message, /olay gelmiyor/);
  b.dispose();
});
