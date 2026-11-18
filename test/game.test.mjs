import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {setTimeout as sleep} from 'node:timers/promises';
const PORT=31000+Math.floor(Math.random()*500);
const base=`http://127.0.0.1:${PORT}`;
let child;
before(async()=>{
  child=spawn(process.execPath,['server.mjs'],{cwd:process.cwd(),env:{...process.env,PORT:String(PORT)},stdio:'ignore'});
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
test('a seventh gift replaces the oldest carrier, who stays in the crowd',async()=>{
  const first=(await getState()).carriers[0];
  await post('gift',{name:'gift-entrant',id:'new-gifter',giftName:'Gül',amount:2});
  const now=await getState();
  assert.equal(now.carriers.length,6);
  assert.ok(now.carriers.some(p=>p.id==='new-gifter'));
  assert.ok(now.people.some(p=>p.id===first.id));
  assert.equal(now.gifts,2);
});
test('a repeat gift by the same user does not add another character',async()=>{
  const n=(await getState()).people.length;
  await post('gift',{name:'gift-entrant',id:'new-gifter',giftName:'Gül',amount:1});
  const now=await getState();
  assert.equal(now.people.length,n);
  assert.equal(new Set(now.carriers.filter(Boolean).map(p=>p.id)).size,6);
  assert.equal(now.gifts,3);
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

test('special portrait is an exclusive seventh role with a higher point threshold',async()=>{
  await post('reset');
  await post('settings',{portraitCost:500});
  await post('gift',{name:'small-gifter',id:'small',amount:2,unitPoints:4});
  let s=await getState();
  assert.equal(s.portraitBearer,null);
  assert.equal(s.people.find(p=>p.id==='small').giftPoints,8);
  await post('gift',{name:'vip',id:'vip',amount:1,unitPoints:499});
  s=await getState();assert.equal(s.portraitBearer,null);
  await post('gift',{name:'vip',id:'vip',amount:1,unitPoints:1});
  s=await getState();
  assert.equal(s.portraitBearer.id,'vip');
  assert.equal(s.portraitBearer.giftPoints,500);
  assert.ok(s.carriers.every(p=>p?.id!=='vip'));
  assert.ok(s.people.some(p=>p.id==='vip'));
});

test('a higher spending viewer replaces portrait holder, without duplicate characters',async()=>{
  await post('gift',{name:'vip2',id:'vip2',amount:1,unitPoints:550});
  const s=await getState();
  assert.equal(s.portraitBearer.id,'vip2');
  assert.ok(s.carriers.every(p=>p?.id!=='vip2'));
  const all=[...s.carriers.filter(Boolean).map(p=>p.id),s.portraitBearer.id];
  assert.equal(new Set(all).size,all.length);
  assert.ok(s.people.some(p=>p.id==='vip'));
});

test('raising the threshold vacates portrait role, lowering it selects highest points',async()=>{
  await post('settings',{portraitCost:1000});
  assert.equal((await getState()).portraitBearer,null);
  await post('settings',{portraitCost:500});
  assert.equal((await getState()).portraitBearer.id,'vip2');
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

test('likes light candles, count per person and add the liker to the procession',async()=>{
  const before=(await getState()).likes;
  await post('like',{name:'mumcu',id:'liker',count:25});
  await post('like',{name:'mumcu',id:'liker',count:5});
  const s=await getState();
  assert.equal(s.likes,before+30);
  assert.equal(s.people.find(p=>p.id==='liker').likes,30);
});

test('leaderboard ranks gifters by points',async()=>{
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

test('static files cannot escape the public folder',async()=>{
  const r=await fetch(base+'/%2e%2e/server.mjs');
  assert.notEqual(r.status,200);
  const v=await fetch(base+'/vendor/..%2fpackage.json');
  assert.notEqual(v.status,200);
  await post('demo');
});
