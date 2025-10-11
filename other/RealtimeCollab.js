import EventEmitter from 'https://esm.sh/eventemitter2';
import { createClient } from 'https://esm.sh/@supabase/supabase-js';

export default class RealtimeCollab {
  constructor(room) {
    this.supabase = createClient('https://xvxszwvhwzsxjhxskkek.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2eHN6d3Zod3pzeGpoeHNra2VrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgyODY2MjcsImV4cCI6MjA3Mzg2MjYyN30.tQi5XePGi6NHLAfuKEuMSw7YQCiDVY2KAd8XXmk8Lcs');
    this.events = new EventEmitter({ wildcard: true, delimiter: ':' });
    this.presence = [];
    this.sync = false;
    this.joinRoom(room);
  }

  async joinRoom(room) {
    let colors = ['red-600', 'red-800', 'orange-600', 'orange-800', 'amber-600', 'amber-800', 'yellow-600', 'yellow-800', 'lime-600', 'lime-800', 'green-600', 'green-800', 'emerald-600', 'emerald-800', 'teal-600', 'teal-800', 'cyan-600', 'cyan-800', 'sky-600', 'sky-800', 'blue-600', 'blue-800', 'indigo-600', 'indigo-800', 'violet-600', 'violet-800', 'purple-600', 'purple-800', 'fuchsia-600', 'fuchsia-800', 'pink-600', 'pink-800', 'rose-600', 'rose-800'];
    this.uid = location.pathname.startsWith('/collab.html') ? crypto.randomUUID() : 'master';
    this.color = colors[Math.floor(Math.random() * colors.length)];
    this.channel = this.supabase.channel(room, { config: { presence: { key: this.uid } } });
    this.channel.on('broadcast', { event: 'message' }, ({ payload }) => this.events.emit(payload.message.type, payload.message));
    this.channel.on('presence', { event: 'sync' }, () => {
      let currentPresence = this.channel.presenceState();
      this.presence = Object.keys(currentPresence).map(key => ({ user: key, ...currentPresence[key][0] }));
      this.events.emit('presence:update', this.presence);
    });
    this.channel.on('presence', { event: 'join' }, ({ newPresences }) => {
      let joined = newPresences.map(presence => ({ user: presence.user_key, ...presence }));
      this.presence.push(...joined);
      this.sync = true;
      this.events.emit('presence:join', joined);
    });
    this.channel.on('presence', { event: 'leave' }, ({ leftPresences }) => {
      let left = leftPresences.map(presence => presence.user_key);
      this.presence = this.presence.filter(p => !left.includes(p.user));
      this.events.emit('presence:leave', leftPresences);
    });
    await this.channel.subscribe();
    await this.channel.track({ color: this.color });
  }

  async send(message) {
    if (!this.channel) return;
    await this.channel.send({ type: 'broadcast', event: 'message', payload: { message: { ...message, peer: this.uid } } });
  }

  async teardown() {
    try {
      this.presence = [];
      if (!this.channel) return;
      await this.channel.untrack();
      await this.channel.unsubscribe();
    } finally {
      this.events.emit('teardown');
      this.events.removeAllListeners();
    }
  }
};
