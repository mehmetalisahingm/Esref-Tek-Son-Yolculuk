import {tmpdir} from 'node:os';
import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';
import { playlistUrls, nextTrackIndex } from '../public/playlist.js';
import {spawn} from 'node:child_process';
import {setTimeout as sleep} from 'node:timers/promises';
const PORT=31000+Math.floor(Math.random()*500);
const base=`http://127.0.0.1:${PORT}`;
let child;
before(async()=>{
  child=spawn(process.execPath,['server.mjs'],{cwd:process.cwd(),env:{...process.env,PORT:String(PORT),SON_YOLCULUK_CONFIG:tmpdir()+'/sy-game-test.json'},stdio:'ignore'});
  for(let i=0;i<45;i++){
    if(child.exitCode!==null)throw new Error('Sunucu başlamadı');
    try {const r=await fetch(base+'/api/state');if(r.ok)return;}catch{}
    await sleep(100);
  }
  throw new Error('Sunucu yanıt vermedi');
});
after(()=>{child?.kill();});
async function getState(){const r=await fetch(base+'/api/state');assert.equal(r.status,200);return r.json();}
async function post(path,payload={}){const r=await fetch(base+'/api/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});assert.equal(r.status,200);return r.json();}
test('demo provides exactly six distinct pallbearers and a following crowd',async()=>{
  const state=await getState();
  assert.equal(state.carriers.length,6);
  assert.equal(new Set(state.carriers.map(p=>p.id)).size,6);
  assert.ok(state.people.length>6);
  assert.equal(state.demo,true);
});
test('a comment joins the crowd only once',async()=>{
  await post('chat',{name:'tester',id:'viewer-test'});
  const size=(await getState()).people.length;
  await post('chat',{name:'tester',id:'viewer-test'});
  assert.equal((await getState()).people.length,size);
});
test('six highest likers carry the coffin, including after a late surge',async()=>{
  await post('reset');
  for(let i=0;i<7;i++) await post('like',{name:`liker${i}`,id:`liker${i}`,count:i+1});
  let s=await getState();
  assert.deepEqual(s.carriers.map(p=>p.likes).sort((a,b)=>b-a),[7,6,5,4,3,2]);
  const before = new Map(s.carriers.map((p, i) => [p.id, i]));
  await post('like',{name:'liker0',id:'liker0',count:10});
  s=await getState();
  assert.ok(s.carriers.some(p=>p.id==='liker0'));
  for (const p of s.carriers) if (p.id !== 'liker0') assert.equal(s.carriers.indexOf(p), before.get(p.id));
  assert.equal(s.people.find(p=>p.id==='liker0').likes,11);
});
test('gifts alone do not put a viewer on the coffin',async()=>{
  await post('gift',{name:'gift-entrant',id:'new-gifter',amount:2});
  const s=await getState();
  assert.equal(s.portraitBearer.id,'new-gifter');
  assert.ok(s.carriers.every(p=>p?.id!=='new-gifter'));
});
test('reset clears the procession and demo restores six carriers',async()=>{
  await post('reset');
  let now=await getState();
  assert.equal(now.people.length,0);
  assert.equal(now.carriers.filter(Boolean).length,0);
  await post('demo');
  now=await getState();
  assert.equal(now.carriers.filter(Boolean).length,6);
});
test('web app HTML and graphics are served',async()=>{
  for(const path of ['/','/style.css','/app.js','/audio.js','/scene3d.js','/fallback.js','/?overlay=1','/vendor/three.module.js']) {
    const r=await fetch(base+path);assert.equal(r.status,200,`failed ${path}`);
  }
});

test('most gifts wins portrait and frees their coffin place for the next liker',async()=>{
  await post('reset');
  for(let i=0;i<7;i++) await post('like',{name:`p${i}`,id:`p${i}`,count:10-i});
  await post('gift',{name:'p0',id:'p0',amount:1,unitPoints:1});
  let s=await getState();
  assert.equal(s.portraitBearer.id,'p0');
  assert.deepEqual(new Set(s.carriers.map(p=>p.id)),new Set(['p1','p2','p3','p4','p5','p6']));
  await post('gift',{name:'p1',id:'p1',amount:2,unitPoints:0});
  s=await getState();
  assert.equal(s.portraitBearer.id,'p1');
  assert.deepEqual(new Set(s.carriers.map(p=>p.id)),new Set(['p0','p2','p3','p4','p5','p6']));
  assert.equal(new Set([...s.carriers.map(p=>p.id),s.portraitBearer.id]).size,7);
});
test('gift count determines the winner even if another gift has more points',async()=>{
  await post('reset');
  await post('gift',{name:'a',id:'a',amount:2,unitPoints:1});
  await post('gift',{name:'b',id:'b',amount:1,unitPoints:1000});
  assert.equal((await getState()).portraitBearer.id,'a');
  await post('demo');
});

test('comments are stored for in-scene speech bubbles and do not duplicate viewers',async()=>{
  await post('chat',{name:'yorumcu',id:'commenter',comment:'Başın sağ olsun <b>Eşref</b>'});
  let s=await getState();
  const p=s.people.find(x=>x.id==='commenter');
  assert.ok(p.comment.includes('Başın sağ olsun'));
  assert.ok(!p.comment.includes('<'));
  const n=s.people.length;
  await post('chat',{name:'yorumcu',id:'commenter',comment:'ikinci yorum'});
  s=await getState();
  assert.equal(s.people.length,n);
  assert.equal(s.people.find(x=>x.id==='commenter').comment,'ikinci yorum');
});

test('likes count per person and add the liker to the procession',async()=>{
  const before=(await getState()).likes;
  await post('like',{name:'mumcu',id:'liker',count:25});
  await post('like',{name:'mumcu',id:'liker',count:5});
  const s=await getState();
  assert.equal(s.likes,before+30);
  assert.equal(s.people.find(p=>p.id==='liker').likes,30);
  assert.equal(s.people.find(p=>p.id==='liker').followed,false);
});

test('following lights a candle without changing the like ranking',async()=>{
  await post('reset');
  await post('like',{name:'mumcu',id:'follower',count:5});
  await post('follow',{name:'mumcu',id:'follower'});
  const s=await getState();
  assert.equal(s.people.find(p=>p.id==='follower').followed,true);
  assert.equal(s.people.find(p=>p.id==='follower').likes,5);
  assert.equal(s.carriers[0].id,'follower');
});

test('leaderboard ranks gifters by gift count',async()=>{
  await post('reset');
  await post('gift',{name:'a',id:'lb-a',amount:1,unitPoints:5});
  await post('gift',{name:'b',id:'lb-b',amount:2,unitPoints:20});
  const s=await getState();
  assert.deepEqual(s.leaderboard.map(p=>p.id),['lb-b','lb-a']);
  assert.equal(s.leaderboard[0].giftPoints,40);
});

test('audio settings are validated and shared through state',async()=>{
  await post('audio',{music:false,volume:.4});
  let s=await getState();
  assert.equal(s.audio.music,false);assert.equal(s.audio.volume,.4);
  const bad=await fetch(base+'/api/audio',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({volume:3})});
  assert.equal(bad.status,400);
  await post('audio',{music:true,volume:.65});
});

test('an uploaded song is validated, served with byte ranges and can be removed',async()=>{
  const fakeMp3=Buffer.concat([Buffer.from('ID3'),Buffer.alloc(64,1)]);
  const up=await post('music',{dataUrl:'data:audio/mpeg;base64,'+fakeMp3.toString('base64'),name:'Benim Şarkım.mp3'});
  assert.match(up.musicUrl,/^\/music-custom\.mp3/);
  let s=await getState();
  assert.equal(s.musicName,'Benim Şarkım');
  const part=await fetch(base+s.musicUrl,{headers:{Range:'bytes=0-2'}});
  assert.equal(part.status,206);
  assert.equal(Buffer.from(await part.arrayBuffer()).toString(),'ID3');
  const bad=await fetch(base+'/api/music',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({dataUrl:'data:audio/mpeg;base64,'+Buffer.from('not really audio at all').toString('base64')})});
  assert.equal(bad.status,400);
  await post('music-default');
  s=await getState();
  assert.equal(s.musicUrl,'');
});

test('ordered playlist cycles 1 -> 2 -> 3 -> 1 and skips empty slots', () => {
  const tracks = [
    { url: '/music-custom.mp3', name: 'Bir' },
    { url: '', name: '' },
    { url: '/music-custom-3.ogg?v=10', name: 'Üç' },
  ];
  assert.deepEqual(playlistUrls(tracks), ['/music-custom.mp3', '/music-custom-3.ogg?v=10']);
  assert.equal(nextTrackIndex(0, 2), 1);
  assert.equal(nextTrackIndex(1, 2), 0);
  assert.equal(nextTrackIndex(2, 3), 0);
  assert.equal(nextTrackIndex(0, 0), -1);
  assert.deepEqual(playlistUrls([{ url: 'https://youtube.com/shorts/example' }]), []);
});

test('three upload slots persist as ordered state, serve audio and clear independently', async () => {
  const audioData = Buffer.concat([Buffer.from('ID3'), Buffer.alloc(64, 1)]).toString('base64');
  for (let slot = 1; slot <= 3; slot++) {
    const response = await post('music', {
      slot, dataUrl: 'data:audio/mpeg;base64,' + audioData, name: `Kullanıcı sesi ${slot}.mp3`
    });
    assert.equal(response.slot, slot);
    assert.ok(response.musicUrl.includes(slot === 1 ? 'music-custom.mp3' : `music-custom-${slot}.mp3`));
  }
  let state = await getState();
  assert.deepEqual(state.musicPlaylist.map(song => song.name), [
    'Kullanıcı sesi 1', 'Kullanıcı sesi 2', 'Kullanıcı sesi 3'
  ]);
  for (const item of state.musicPlaylist) {
    const res = await fetch(base + item.url, { headers: { Range: 'bytes=0-2' } });
    assert.equal(res.status, 206);
    assert.equal(Buffer.from(await res.arrayBuffer()).toString(), 'ID3');
  }
  await post('music-default', { slot: 2 });
  state = await getState();
  assert.equal(state.musicPlaylist[0].name, 'Kullanıcı sesi 1');
  assert.equal(state.musicPlaylist[1].url, '');
  assert.equal(state.musicPlaylist[2].name, 'Kullanıcı sesi 3');
  const invalid = await fetch(base + '/api/music', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slot: 4, dataUrl: 'data:audio/mpeg;base64,' + audioData })
  });
  assert.equal(invalid.status, 400);
  await post('music-default');
  state = await getState();
  assert.equal(state.musicPlaylist.filter(song => song.url).length, 0);
  assert.equal(state.musicUrl, '');
});

test('music and effect volumes are separate and validated',async()=>{
  await post('audio',{musicVolume:.3,sfxVolume:.9});
  const s=await getState();
  assert.equal(s.audio.musicVolume,.3);assert.equal(s.audio.sfxVolume,.9);
  const bad=await fetch(base+'/api/audio',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sfxVolume:-1})});
  assert.equal(bad.status,400);
  await post('audio',{musicVolume:.7,sfxVolume:.6});
});

test('static files cannot escape the public folder',async()=>{
  const r=await fetch(base+'/%2e%2e/server.mjs');
  assert.notEqual(r.status,200);
  const v=await fetch(base+'/vendor/..%2fpackage.json');
  assert.notEqual(v.status,200);
  await post('demo');
});
