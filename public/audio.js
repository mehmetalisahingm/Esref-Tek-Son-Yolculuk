// Procedural soundtrack and sound effects. No recordings are used.
// Music: theme from Chopin's Piano Sonata No. 2, 3rd mvt. "Marche funèbre" (1839, public domain),
// synthesised live with the Web Audio API, so the stream carries no third-party recording.

const midi = n => 440 * 2 ** ((n - 69) / 12);
const BPM = 50;
const BEAT = 60 / BPM;
// [midi, beats]; null = rest. Eight-bar loop in B♭ minor.
const BAR_A = [[58, 1], [58, .75], [58, .25], [58, 2]];
const BAR_B = [[61, 1], [60, .75], [60, .25], [58, .75], [58, .25], [57, .75], [58, .25]];
const BAR_C = [[61, 1], [61, .75], [61, .25], [61, 2]];
const BAR_D = [[65, 1], [63, .75], [63, .25], [61, .75], [61, .25], [60, .75], [61, .25]];
const MELODY = [BAR_A, BAR_B, BAR_A, BAR_B, BAR_C, BAR_D, BAR_A, BAR_B];
// Left-hand ostinato alternates B♭ minor and G♭ major colours on every beat.
const CHORDS = [[46, 49, 53], [42, 46, 49]];

export function createAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return { unlock() {}, configure() {}, play() {}, get running() { return false; }, onstate() {} };
  const ctx = new AC({ latencyHint: 'playback' });
  const master = ctx.createGain(); master.gain.value = 0;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3; comp.attack.value = .01; comp.release.value = .3;
  master.connect(comp).connect(ctx.destination);
  const musicBus = ctx.createGain(); musicBus.gain.value = 0;
  const sfxBus = ctx.createGain(); sfxBus.gain.value = 1;
  const dry = ctx.createGain(); dry.gain.value = .72;
  const wet = ctx.createGain(); wet.gain.value = .5;
  const reverb = ctx.createConvolver(); reverb.buffer = impulse(3.8, 2.6);
  for (const bus of [musicBus, sfxBus]) { bus.connect(dry); bus.connect(reverb); }
  // An uploaded song plays on its own clean bus (no added reverb), still under the master volume.
  const trackBus = ctx.createGain(); trackBus.gain.value = 0; trackBus.connect(master);
  const track = new Audio(); track.loop = true; track.preload = 'auto';
  let trackSource = null, trackUrl = '';
  function setTrack(url) {
    if (url === trackUrl) return;
    trackUrl = url;
    if (!url) { track.pause(); track.removeAttribute('src'); track.load(); return; }
    if (!trackSource) { trackSource = ctx.createMediaElementSource(track); trackSource.connect(trackBus); }
    track.src = url; track.load();
  }
  dry.connect(master); reverb.connect(wet).connect(master);
  const noise = (() => { const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; })();

  let settings = { enabled: false, music: true, sfx: true, volume: .8, musicVolume: .7, sfxVolume: .6, musicUrl: '' };
  let musicOn = false, nextTime = 0, step = 0, timer = null, listeners = [];
  const lastPlayed = new Map();

  function impulse(seconds, decay) {
    const rate = ctx.sampleRate, len = Math.floor(rate * seconds), buf = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** decay; }
    return buf;
  }
  function env(g, t, peak, attack, hold, release) {
    g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(.0002, peak), t + attack);
    g.gain.setValueAtTime(Math.max(.0002, peak), t + attack + hold);
    g.gain.exponentialRampToValueAtTime(.0001, t + attack + hold + release);
    return t + attack + hold + release + .05;
  }
  function voice({ freq, t, type = 'sine', peak = .1, attack = .01, hold = .05, release = .3, out = musicBus, detune = 0, filter = 0, glideTo = 0 }) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t); o.detune.value = detune;
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + attack + hold + release * .6);
    const g = ctx.createGain(); let node = o;
    if (filter) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filter; f.Q.value = .4; o.connect(f); node = f; }
    node.connect(g).connect(out);
    const end = env(g, t, peak, attack, hold, release);
    o.start(t); o.stop(end);
  }
  function noiseHit(t, { peak = .2, freq = 400, q = .7, type = 'lowpass', attack = .005, release = .5, out = sfxBus } = {}) {
    const s = ctx.createBufferSource(); s.buffer = noise;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); s.connect(f).connect(g).connect(out);
    const end = env(g, t, peak, attack, 0, release); s.start(t, Math.random()); s.stop(end);
  }
  // ——— Music ———
  function strings(note, t, dur) {
    const hold = Math.max(.05, dur - .18);
    for (const d of [-7, 6]) voice({ freq: midi(note), t, type: 'sawtooth', peak: .045, attack: .09, hold, release: .55, detune: d, filter: 1500 });
    voice({ freq: midi(note + 12), t, type: 'triangle', peak: .022, attack: .12, hold, release: .6 });
    voice({ freq: midi(note - 12), t, type: 'sine', peak: .04, attack: .1, hold, release: .5 });
  }
  function chord(notes, t, accent) {
    for (const n of notes) {
      voice({ freq: midi(n), t, type: 'triangle', peak: accent ? .05 : .036, attack: .012, hold: .04, release: BEAT * .95 });
      voice({ freq: midi(n), t, type: 'sine', peak: .02, attack: .2, hold: BEAT * .4, release: .5, filter: 900 });
    }
    voice({ freq: midi(34), t, type: 'sine', peak: accent ? .15 : .1, attack: .02, hold: BEAT * .5, release: .6 });
  }
  function drum(t, peak = .32) {
    voice({ freq: 62, glideTo: 38, t, type: 'sine', peak, attack: .004, hold: .02, release: .95, out: musicBus });
    noiseHit(t, { peak: peak * .35, freq: 220, release: .45, out: musicBus });
  }
  function scheduleBar(barIndex, t0) {
    const bar = MELODY[barIndex % MELODY.length];
    let t = t0;
    for (const [note, beats] of bar) { if (note) strings(note, t, beats * BEAT); t += beats * BEAT; }
    for (let b = 0; b < 4; b++) chord(CHORDS[b % 2], t0 + b * BEAT, b === 0);
    drum(t0, barIndex % 4 === 0 ? .4 : .28); drum(t0 + 2 * BEAT, .2);
  }
  function scheduler() {
    while (nextTime < ctx.currentTime + 1.2) { scheduleBar(step++, nextTime); nextTime += 4 * BEAT; }
  }
  function applyGains(ramp = 1.2) {
    const t = ctx.currentTime;
    const vol = settings.enabled ? settings.volume : 0;
    master.gain.cancelScheduledValues(t); master.gain.setTargetAtTime(vol, t, ramp / 4);
    setTrack(settings.musicUrl || '');
    const useTrack = Boolean(trackUrl);
    const level = settings.music ? settings.musicVolume : 0;
    musicBus.gain.cancelScheduledValues(t); musicBus.gain.setTargetAtTime(useTrack ? 0 : level * 1.3, t, ramp / 3);
    trackBus.gain.cancelScheduledValues(t); trackBus.gain.setTargetAtTime(useTrack ? level : 0, t, ramp / 3);
    sfxBus.gain.setTargetAtTime(settings.sfx ? settings.sfxVolume * 1.5 : 0, t, .05);
    const shouldPlay = settings.enabled && settings.music && ctx.state === 'running';
    const synth = shouldPlay && !useTrack;
    if (synth && !musicOn) { musicOn = true; nextTime = ctx.currentTime + .25; step = 0; scheduler(); timer = setInterval(scheduler, 250); }
    if (!synth && musicOn) { musicOn = false; clearInterval(timer); timer = null; }
    if (shouldPlay && useTrack) { if (track.paused) track.play().catch(() => {}); }
    else if (!track.paused) track.pause();
  }
  function duck(seconds = 3) {
    const t = ctx.currentTime;
    const level = settings.music ? settings.musicVolume : 0;
    const bus = trackUrl ? trackBus : musicBus, full = trackUrl ? level : level * 1.3;
    bus.gain.cancelScheduledValues(t);
    bus.gain.setTargetAtTime(full * .35, t, .08);
    bus.gain.setTargetAtTime(full, t + seconds, .8);
  }
  // ——— Effects ———
  const sfx = {
    join(t) { voice({ freq: midi(82), t, peak: .05, attack: .005, hold: 0, release: .9, out: sfxBus }); voice({ freq: midi(89), t: t + .07, peak: .03, attack: .005, release: .8, out: sfxBus }); },
    chat(t) { voice({ freq: midi(86), t, type: 'triangle', peak: .025, attack: .004, release: .35, out: sfxBus }); },
    like(t) { voice({ freq: midi(94), t, peak: .022, attack: .003, release: .5, out: sfxBus }); noiseHit(t, { peak: .025, freq: 6000, type: 'highpass', release: .25 }); },
    follow(t) { [77, 81, 84].forEach((n, i) => voice({ freq: midi(n), t: t + i * .09, peak: .05, release: .9, out: sfxBus })); },
    gift(t, big) {
      const notes = big ? [70, 74, 77, 82, 86, 89] : [70, 77, 82, 86];
      notes.forEach((n, i) => voice({ freq: midi(n), t: t + i * .075, type: 'triangle', peak: big ? .09 : .065, attack: .004, hold: .02, release: 1.6, out: sfxBus }));
      noiseHit(t, { peak: .05, freq: 7000, type: 'highpass', release: 1.2 });
    },
    carrier(t) { sfx.gift(t, false); voice({ freq: 70, glideTo: 44, t, peak: .35, attack: .004, release: 1, out: sfxBus }); },
    portrait(t) {
      duck(4.5);
      const brass = [46, 53, 58, 62, 65];
      brass.forEach((n, i) => voice({ freq: midi(n), t: t + .05 * i, type: 'sawtooth', peak: .07, attack: .7, hold: 1.4, release: 1.8, out: sfxBus, filter: 1100, detune: (i % 2 ? 5 : -5) }));
      noiseHit(t, { peak: .18, freq: 5200, type: 'highpass', attack: .9, release: 2.2 });
      [82, 86, 89, 94].forEach((n, i) => voice({ freq: midi(n), t: t + 1 + i * .12, peak: .06, release: 2.4, out: sfxBus }));
      voice({ freq: 55, glideTo: 36, t: t + .9, peak: .5, attack: .005, release: 1.6, out: sfxBus });
    },
    milestone(t) {
      duck(3);
      [58, 62, 65, 70, 74].forEach((n, i) => voice({ freq: midi(n), t: t + i * .02, type: 'sine', peak: .05, attack: .5, hold: 1, release: 1.6, out: sfxBus }));
    },
  };
  const minGap = { join: .35, chat: .2, like: .9, follow: .5, gift: .12, carrier: .2, portrait: 1, milestone: 2 };
  function play(type, opts = {}) {
    if (!settings.enabled || !settings.sfx || ctx.state !== 'running' || !sfx[type]) return;
    const now = ctx.currentTime;
    if (now - (lastPlayed.get(type) || -9) < (minGap[type] || .1)) return;
    lastPlayed.set(type, now);
    sfx[type](now + .02, opts.big);
  }
  async function unlock() {
    try { if (ctx.state !== 'running') await ctx.resume(); } catch {}
    applyGains(); listeners.forEach(fn => fn(ctx.state));
    return ctx.state === 'running';
  }
  ctx.onstatechange = () => { applyGains(); listeners.forEach(fn => fn(ctx.state)); };
  return {
    unlock,
    configure(next) { settings = { ...settings, ...next }; applyGains(); },
    play,
    get running() { return ctx.state === 'running'; },
    onstate(fn) { listeners.push(fn); },
  };
}
