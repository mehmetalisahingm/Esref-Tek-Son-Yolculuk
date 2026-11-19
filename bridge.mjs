// Brings TikTok LIVE events (comments, gifts, likes, follows, joins, viewer count) into the game.
// Two transports feed the same normalised events:
//   • direct    — tiktok-live-connector talks to TikTok itself (needs a third-party sign service)
//   • tikfinity — reads the local WebSocket that the TikFinity desktop app exposes (ws://127.0.0.1:21213/)

export const DEFAULT_TIKFINITY_URL = 'ws://127.0.0.1:21213/';
const WAIT_FOR_LIVE_MS = 15000;

// ——— Normalised event shape ———
// { type: 'chat'|'gift'|'like'|'follow'|'share'|'member'|'viewers'|'end',
//   user: { id, name }, comment, count, viewers,
//   gift: { id, name, diamonds, repeatCount, repeatEnd, streakable, msgId } }

const str = v => (v === undefined || v === null ? '' : String(v));
function userFrom(u = {}) {
  const name = str(u.displayId || u.uniqueId || u.nickname) || 'izleyici';
  return { id: str(u.id || u.userId || u.displayId || u.uniqueId), name };
}

// tiktok-live-connector v2 (proto v3) events → normalised events.
export function fromConnector(type, e = {}) {
  const user = userFrom(e.user);
  switch (type) {
    case 'chat': return { type, user, comment: str(e.comment) };
    case 'member': case 'follow': case 'share': return { type, user };
    case 'like': return { type, user, count: Number(e.count ?? e.likeCount ?? 1) || 1 };
    case 'viewers': return { type, viewers: Number(e.viewerCount ?? e.total ?? e.totalUser) };
    case 'gift': return {
      type, user,
      gift: {
        id: str(e.giftId || e.gift?.id || 'gift'),
        name: str(e.gift?.name || e.extendedGiftInfo?.name) || 'TikTok hediyesi',
        diamonds: e.gift?.diamondCount ?? e.extendedGiftInfo?.diamond_count ?? e.extendedGiftInfo?.diamondCount ?? e.diamondCount,
        repeatCount: Number(e.repeatCount || e.gift?.repeatCount || 1),
        repeatEnd: Boolean(e.repeatEnd),
        streakable: Number(e.gift?.type ?? e.giftType ?? 0) === 1,
        msgId: str(e.common?.msgId || e.msgId || e.transactionId),
      },
    };
    case 'end': return { type };
    default: return null;
  }
}

// TikFinity relays events as {"event": "...", "data": {...}} with the flat legacy field names.
export function fromTikfinity(raw) {
  let msg = raw;
  if (typeof raw === 'string') { try { msg = JSON.parse(raw); } catch { return null; } }
  if (!msg || typeof msg !== 'object') return null;
  const kind = str(msg.event || msg.type).toLowerCase();
  const d = msg.data && typeof msg.data === 'object' ? msg.data : msg;
  const user = { id: str(d.userId || d.uniqueId), name: str(d.uniqueId || d.nickname) || 'izleyici' };
  switch (kind) {
    case 'chat': case 'comment': return { type: 'chat', user, comment: str(d.comment ?? d.message) };
    case 'member': case 'join': return { type: 'member', user };
    case 'follow': return { type: 'follow', user };
    case 'share': return { type: 'share', user };
    case 'social': {
      const t = str(d.displayType || d.label).toLowerCase();
      if (t.includes('follow')) return { type: 'follow', user };
      if (t.includes('share')) return { type: 'share', user };
      return null;
    }
    case 'like': return { type: 'like', user, count: Number(d.likeCount ?? d.count ?? 1) || 1 };
    case 'roomuser': case 'viewers': return { type: 'viewers', viewers: Number(d.viewerCount ?? d.viewers) };
    case 'gift': return {
      type: 'gift', user,
      gift: {
        id: str(d.giftId || d.giftName || 'gift'),
        name: str(d.giftName || d.gift_name) || 'TikTok hediyesi',
        diamonds: d.diamondCount ?? d.diamonds,
        repeatCount: Number(d.repeatCount || 1),
        repeatEnd: d.repeatEnd === true || d.repeatEnd === 1,
        // TikFinity may omit giftType; treat a gift that reports repeatEnd as a combo gift.
        streakable: Number(d.giftType) === 1 || (d.giftType === undefined && d.repeatEnd !== undefined),
        msgId: str(d.msgId),
      },
    };
    case 'streamend': return { type: 'end' };
    default: return null;
  }
}

// Turn library / network errors into a clear Turkish message and a retry policy.
export function explainError(err, username = '') {
  const name = err?.constructor?.name || err?.name || '';
  const text = String(err?.message || err || '');
  const at = username ? `@${username}` : 'Bu hesap';
  if (/paketi eksik|Cannot find (package|module)/i.test(text)) return { fatal: true, message: 'TikTok bağlayıcısı kurulu değil. Proje klasöründe "npm install" çalıştır.' };
  if (name === 'InvalidUniqueIdError') return { fatal: true, message: 'Kullanıcı adı geçersiz. TikTok profilindeki adı @ olmadan yaz.' };
  if (name === 'UserOfflineError' || /offline|isn'?t online|not (currently )?live|live has ended|LIVE_NOT_STARTED/i.test(text)) {
    return { wait: true, message: `${at} şu an canlı yayında değil. Yayını açınca otomatik bağlanacak.` };
  }
  if (name === 'PremiumFeatureError') return { delay: 60000, message: 'Bu yayın için ücretli imza özelliği gerekiyor. TikFinity köprüsünü dene.' };
  if (name === 'SignatureRateLimitError' || /rate.?limit|too many requests|\b429\b/i.test(text)) {
    return { delay: 60000, message: 'TikTok imza servisinin ücretsiz limiti doldu. TikFinity (WebSocket) yoluna geç.' };
  }
  if (name === 'SignAPIError' || /sign(ature)?\b.*(api|key|401|403|unauthori[sz]ed|forbidden)/i.test(text)) {
    return { delay: 30000, message: 'İmza servisi bağlantıyı reddetti. TikFinity (WebSocket) yoluna geç.' };
  }
  if (name === 'ConnectTimeoutError' || /timed? ?out|ETIMEDOUT/i.test(text)) return { message: 'TikTok yanıt vermedi (zaman aşımı). Tekrar deneniyor.' };
  if (/ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|fetch failed|network|getaddrinfo/i.test(text)) {
    return { message: 'İnternet bağlantısı yok ya da TikTok\'a ulaşılamıyor. Tekrar deneniyor.' };
  }
  return { message: `Bağlantı hatası: ${text.slice(0, 120) || name || 'bilinmiyor'}. Tekrar deneniyor.` };
}

// ——— Bridge controller ———
export function createBridge({ onEvent, onStatus, loadConnector = () => import('tiktok-live-connector'), WebSocketImpl, staleMs = 60000 }) {
  const status = { mode: 'tikfinity', state: 'idle', message: 'Bağlı değil', counts: { chat: 0, gift: 0, like: 0, follow: 0, share: 0, member: 0 }, lastEventAt: 0, lastEventType: '', since: 0 };
  let opts = null, wanted = false, transport = null, retryTimer = null, attempt = 0, generation = 0;
  let connectedMessage = '', lastAnyAt = 0, stale = false;
  // An open TikFinity socket does not prove TikFinity is attached to the LIVE, so warn when nothing arrives.
  const watchdog = setInterval(() => {
    if (status.state !== 'connected' || stale) return;
    if (Date.now() - Math.max(lastAnyAt, status.since) < staleMs) return;
    stale = true;
    set({ message: opts?.mode === 'tikfinity'
      ? `TikFinity açık ama ${Math.round(staleMs / 1000)} sn'dir olay gelmiyor. TikFinity uygulamasında TikTok yayınına bağlı olduğunu kontrol et.`
      : `${Math.round(staleMs / 1000)} sn'dir yayından olay gelmiyor. Yayın açık mı?` });
  }, Math.min(5000, Math.max(50, staleMs / 4)));
  watchdog.unref?.();

  const set = (patch) => { Object.assign(status, patch); onStatus?.(status); };
  function deliver(ev, gen) {
    if (!ev || gen !== generation) return;
    if (ev.type === 'end') {
      wanted = false; close();
      set({ state: 'idle', message: 'Canlı yayın sona erdi. Yeniden yayına çıkınca tekrar bağlan.' });
      onEvent?.(ev); return;
    }
    lastAnyAt = Date.now();
    if (stale) { stale = false; status.message = connectedMessage; }
    if (ev.type in status.counts) status.counts[ev.type] += ev.type === 'like' ? (ev.count || 1) : 1;
    if (ev.type !== 'viewers') { status.lastEventAt = Date.now(); status.lastEventType = ev.type; }
    try { onEvent?.(ev); } catch (err) { console.warn('Olay işlenemedi:', err?.message || err); }
    onStatus?.(status);
  }
  function close() {
    const t = transport; transport = null;
    clearTimeout(retryTimer); retryTimer = null;
    if (t) { try { t.close(); } catch {} }
  }
  function scheduleRetry(info) {
    if (!wanted) return;
    clearTimeout(retryTimer);
    const delay = info.wait ? WAIT_FOR_LIVE_MS : (info.delay || Math.min(30000, 3000 * 2 ** Math.min(3, attempt)));
    attempt++;
    set({ state: info.wait ? 'waiting' : 'reconnecting', message: `${info.message} (${Math.round(delay / 1000)} sn)` });
    retryTimer = setTimeout(() => { retryTimer = null; if (wanted) open().catch(() => {}); }, delay);
  }

  async function openDirect(gen) {
    const mod = await loadConnector().catch(() => { throw new Error('TikTok paketi eksik'); });
    const { TikTokLiveConnection, WebcastEvent, ControlEvent } = mod;
    const conn = new TikTokLiveConnection(opts.username, {
      processInitialData: false, enableExtendedGiftInfo: false,
      ...(opts.signApiKey ? { signApiKey: opts.signApiKey } : {}),
    });
    const map = { [WebcastEvent.CHAT]: 'chat', [WebcastEvent.MEMBER]: 'member', [WebcastEvent.FOLLOW]: 'follow', [WebcastEvent.SHARE]: 'share', [WebcastEvent.LIKE]: 'like', [WebcastEvent.ROOM_USER]: 'viewers', [WebcastEvent.GIFT]: 'gift', [WebcastEvent.STREAM_END]: 'end' };
    for (const [evName, type] of Object.entries(map)) conn.on(evName, e => deliver(fromConnector(type, e), gen));
    conn.on(ControlEvent.DISCONNECTED, () => {
      if (gen !== generation || !wanted) return;
      transport = null; scheduleRetry({ message: 'TikTok bağlantısı koptu. Tekrar bağlanılıyor.' });
    });
    transport = { close: () => { conn.removeAllListeners?.(); conn.disconnect?.(); } };
    const room = await conn.connect();
    return `Doğrudan bağlandı · @${opts.username}${room?.roomId ? ` · oda ${room.roomId}` : ''}`;
  }

  async function openTikfinity(gen) {
    const WS = WebSocketImpl || globalThis.WebSocket || (await import('ws').then(m => m.default || m.WebSocket).catch(() => null));
    if (!WS) throw new Error('Bu Node sürümünde WebSocket yok. Node.js 22+ kur.');
    const url = opts.tikfinityUrl || DEFAULT_TIKFINITY_URL;
    return await new Promise((resolve, reject) => {
      let opened = false;
      const ws = new WS(url);
      transport = { close: () => { try { ws.close(); } catch {} } };
      const fail = () => {
        if (gen !== generation) return;
        const info = { message: 'TikFinity\'ye ulaşılamıyor. TikFinity açık ve yayına bağlı mı?' };
        if (!opened) reject(Object.assign(new Error(info.message), { bridgeInfo: info }));
        else if (wanted) { transport = null; scheduleRetry(info); }
      };
      ws.onopen = () => { opened = true; resolve('TikFinity\'ye bağlandı · olaylar TikFinity\'den geliyor'); };
      ws.onmessage = m => deliver(fromTikfinity(typeof m.data === 'string' ? m.data : String(m.data)), gen);
      ws.onerror = () => {};
      ws.onclose = fail;
    });
  }

  async function open() {
    const gen = ++generation;
    close();
    set({ state: 'connecting', message: opts.mode === 'tikfinity' ? 'TikFinity köprüsüne bağlanılıyor…' : `@${opts.username} yayınına bağlanılıyor…` });
    try {
      const message = await (opts.mode === 'tikfinity' ? openTikfinity(gen) : openDirect(gen));
      if (gen !== generation) return status;
      attempt = 0; connectedMessage = message; stale = false; lastAnyAt = 0;
      set({ state: 'connected', message, since: Date.now() });
    } catch (err) {
      if (gen !== generation) return status;
      close();
      const info = err?.bridgeInfo || explainError(err, opts.username);
      if (info.fatal) { wanted = false; set({ state: 'error', message: info.message }); }
      else scheduleRetry(info);
    }
    return status;
  }

  return {
    status,
    get wanted() { return wanted; },
    async start(next) {
      opts = { ...next }; wanted = true; attempt = 0;
      status.mode = opts.mode;
      status.counts = { chat: 0, gift: 0, like: 0, follow: 0, share: 0, member: 0 };
      status.lastEventAt = 0; status.lastEventType = '';
      return open();
    },
    stop(message = 'Bağlantı kapalı') { wanted = false; generation++; close(); set({ state: 'idle', message }); },
    dispose() { clearInterval(watchdog); this.stop(); },
  };
}
