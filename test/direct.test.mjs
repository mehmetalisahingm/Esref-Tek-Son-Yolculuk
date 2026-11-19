// End to end through the real server on the default "direct" path, with a stand-in TikTok connector.
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = 33000 + Math.floor(Math.random() * 500);
const base = `http://127.0.0.1:${PORT}`;
const configFile = path.join(os.tmpdir(), `son-yolculuk-direct-${process.pid}.json`);
let child, output = '';
const getState = async () => (await fetch(base + '/api/state')).json();
const post = async (p, body = {}) => { const r = await fetch(`${base}/api/${p}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); return { status: r.status, body: await r.json() }; };
async function waitFor(fn, ms = 4000) { const end = Date.now() + ms; while (Date.now() < end) { const s = await getState(); if (fn(s)) return s; await sleep(60); } return getState(); }
function startServer() {
  child = spawn(process.execPath, ['server.mjs'], { cwd: process.cwd(), env: { ...process.env, PORT: String(PORT), SON_YOLCULUK_CONFIG: configFile, SON_YOLCULUK_CONNECTOR: 'test/fixtures/fake-connector.mjs' }, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', d => { output += d; }); child.stderr.on('data', d => { output += d; });
}
async function waitUp() { for (let i = 0; i < 50; i++) { try { if ((await fetch(base + '/api/state')).ok) return; } catch {} await sleep(100); } throw new Error('Sunucu başlamadı'); }
before(async () => { startServer(); await waitUp(); });
after(async () => { child?.kill(); await fs.unlink(configFile).catch(() => {}); });

test('direct connection: commenters join the procession, likers carry the coffin, joiners and followers appear', async () => {
  const r = await post('connect', { mode: 'direct', username: 'esref', signApiKey: 'test-key' });
  assert.equal(r.status, 200); assert.equal(r.body.state, 'connected');
  const s = await waitFor(x => x.viewerCount === 321 && x.portraitBearer);
  const byName = n => s.people.find(p => p.name === n);
  assert.equal(byName('yorumcu')?.comment, 'Başın sağ olsun Eşref', 'yorum yazan kortejde, yorumu balonda');
  assert.ok(s.carriers.some(c => c?.name === 'begenen'), 'beğenen tabutu taşıyor');
  assert.ok(s.carriers.some(c => c?.name === 'az.begenen'), 'tek beğeni de tabuta yeter (ilk 6 boşken)');
  assert.ok(byName('Gelen Kişi'), 'kimliği mesajda gelen katılımcı kortejde');
  assert.ok(byName('Gizli Gelen'), 'oturumsuz bağlantıdaki katılımcı kortejde');
  assert.equal(byName('takipci')?.followed, true, 'takip eden mum yakıyor');
  assert.equal(s.portraitBearer.name, 'cömert', 'hediye atan fotoğrafı taşıyor');
  assert.equal(s.likeBoard[0].name, 'begenen');
  assert.match(output, /\[olay\] 💬 @yorumcu: Başın sağ olsun Eşref/, 'olaylar sunucu penceresine yazılıyor');
});

test('after a restart the server reconnects to the saved stream by itself', async () => {
  child.kill(); await sleep(300); output = '';
  startServer(); await waitUp();
  const s = await waitFor(x => x.bridge.state === 'connected' && x.people.some(p => p.name === 'yorumcu'));
  assert.equal(s.bridge.state, 'connected');
  assert.ok(s.people.some(p => p.name === 'yorumcu'));
  assert.match(output, /Son bağlantı yeniden kuruluyor: @esref/);
});

test('a manual disconnect is remembered: no automatic reconnect after the next restart', async () => {
  await post('disconnect');
  child.kill(); await sleep(300);
  startServer(); await waitUp(); await sleep(600);
  assert.equal((await getState()).bridge.state, 'idle');
});
