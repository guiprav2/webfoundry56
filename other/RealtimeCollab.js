import EventEmitter from 'https://esm.sh/eventemitter2';
import { joinRoom } from 'https://esm.sh/trystero?target=es2022&bundle';

const COLORS = [
  'red-600', 'red-800', 'orange-600', 'orange-800', 'amber-600', 'amber-800',
  'yellow-600', 'yellow-800', 'lime-600', 'lime-800', 'green-600', 'green-800',
  'emerald-600', 'emerald-800', 'teal-600', 'teal-800', 'cyan-600', 'cyan-800',
  'sky-600', 'sky-800', 'blue-600', 'blue-800', 'indigo-600', 'indigo-800',
  'violet-600', 'violet-800', 'purple-600', 'purple-800', 'fuchsia-600',
  'fuchsia-800', 'pink-600', 'pink-800', 'rose-600', 'rose-800',
];

const TRYSTERO_CONFIG = { appId: 'webfoundry-collab' };

export default class RealtimeCollab {
  constructor(room) {
    this.roomName = room;
    this.events = new EventEmitter({ wildcard: true, delimiter: ':' });
    this.presence = [];
    this.sync = false;
    this.uid = location.pathname.startsWith('/collab.html') ? crypto.randomUUID() : 'master';
    this.color = COLORS[Math.floor(Math.random() * COLORS.length)];
    this.messageSender = null;
    this.presenceSender = null;

    this.ready = this.joinRoom();
  }

  async joinRoom() {
    try {
      this.room = joinRoom(TRYSTERO_CONFIG, this.roomName);

      let [sendMessage, onMessage] = this.room.makeAction('message');
      let [sendPresence, onPresence] = this.room.makeAction('presence');

      this.messageSender = sendMessage;
      this.presenceSender = sendPresence;

      this.room.onPeerJoin(peerId => this.handlePeerJoin(peerId));
      this.room.onPeerLeave(peerId => this.handlePeerLeave(peerId));
      onMessage((message, peerId) => this.handleIncomingMessage(message, peerId));
      onPresence((payload, peerId) => this.handlePresence(payload, peerId));

      this.addOrUpdatePresence({ user: this.uid, color: this.color, peerId: this.room.selfId ?? null, self: true });
      this.broadcastPresence();
    } catch (err) {
      console.error('RealtimeCollab join failed', err);
      throw err;
    }
  }

  addOrUpdatePresence(entry, { emitJoin = false } = {}) {
    let existing = this.presence.find(p => p.user === entry.user);
    if (existing) {
      Object.assign(existing, entry);
      this.events.emit('presence:update', [...this.presence]);
      return existing;
    }
    this.presence.push(entry);
    emitJoin && this.events.emit('presence:join', [entry]);
    this.events.emit('presence:update', [...this.presence]);
    return entry;
  }

  handlePeerJoin(peerId) {
    this.broadcastPresence(peerId);
  }

  handlePeerLeave(peerId) {
    let leftPresences = this.presence.filter(p => !p.self && p.peerId === peerId);
    if (!leftPresences.length) return;
    this.presence = this.presence.filter(p => p.self || p.peerId !== peerId);
    this.events.emit('presence:leave', leftPresences.map(({ user, color }) => ({ user, color })));
    this.events.emit('presence:update', [...this.presence]);
  }

  handlePresence(payload, peerId) {
    if (!payload || typeof payload.user !== 'string') return;
    if (payload.user === this.uid) return;

    let entry = this.presence.find(p => p.user === payload.user);
    if (!entry) {
      entry = this.addOrUpdatePresence({ user: payload.user, color: payload.color || null, peerId }, { emitJoin: true });
      this.sync = true;
    } else {
      Object.assign(entry, { color: payload.color || entry.color, peerId });
      this.events.emit('presence:update', [...this.presence]);
    }
  }

  handleIncomingMessage(message, peerId) {
    if (!message || typeof message.type !== 'string') return;
    let peer = message.peer || this.lookupUserByPeer(peerId) || peerId;
    this.events.emit(message.type, { ...message, peer, peerId });
  }

  lookupUserByPeer(peerId) {
    return this.presence.find(p => p.peerId === peerId)?.user || null;
  }

  broadcastPresence(targetPeer) {
    if (!this.presenceSender) return;
    this.presenceSender({ user: this.uid, color: this.color }, targetPeer);
  }

  async send(message, targetPeer) {
    if (!message || typeof message !== 'object') return;
    try {
      await this.ready;
    } catch (err) {
      console.error('RealtimeCollab send failed (not ready)', err);
      return;
    }
    if (!this.messageSender) return;
    return await this.messageSender({ ...message, peer: this.uid }, targetPeer);
  }

  async teardown() {
    try {
      this.presence = [];
      try {
        await this.ready;
      } catch (err) {
        console.error('RealtimeCollab teardown skipped (not ready)', err);
      }
      this.room?.leave?.();
    } finally {
      this.events.emit('teardown');
      this.events.removeAllListeners();
    }
  }
};
