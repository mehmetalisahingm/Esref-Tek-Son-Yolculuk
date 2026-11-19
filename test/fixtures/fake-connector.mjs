// Stand-in for tiktok-live-connector used by test/direct.test.mjs: emits the event shapes of the real v2 library.
import { EventEmitter } from 'node:events';
export const WebcastEvent = { CHAT: 'chat', MEMBER: 'member', UNAUTHORIZED_MEMBER: 'unauthorizedMember', FOLLOW: 'follow', SHARE: 'share', LIKE: 'like', ROOM_USER: 'roomUser', GIFT: 'gift', STREAM_END: 'streamEnd' };
export const ControlEvent = { DISCONNECTED: 'disconnected' };
export class TikTokLiveConnection extends EventEmitter {
  constructor(user, options) { super(); this.user = user; this.options = options; }
  async connect() {
    setTimeout(() => {
      this.emit('chat', { user: { id: '7001', displayId: 'yorumcu', nickname: 'Yorumcu' }, comment: 'Başın sağ olsun Eşref' });
      this.emit('like', { user: { id: '7002', displayId: 'begenen', nickname: 'Beğenen' }, count: 15 });
      this.emit('like', { user: { id: '7003', displayId: 'az.begenen' }, count: 1 });
      this.emit('member', { userId: '7004', user: { nickname: 'Gelen Kişi' } });
      this.emit('unauthorizedMember', { nickName: 'Gizli Gelen' });
      this.emit('follow', { user: { id: '7005', displayId: 'takipci' } });
      this.emit('gift', { user: { id: '7006', displayId: 'cömert' }, giftId: '5655', repeatCount: 3, repeatEnd: true, gift: { name: 'Rose', diamondCount: 1, type: 1 }, common: { msgId: 'g1' } });
      this.emit('roomUser', { viewerCount: 321 });
    }, 150);
    return { roomId: '42' };
  }
  async disconnect() {}
}
