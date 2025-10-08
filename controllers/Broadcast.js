export default class Broadcast {
  actions = {
    init: () => {
      this.state.channel = new BroadcastChannel('webfoundry');
      this.state.channel.addEventListener('message', ev => state.event.bus.emit(`broadcast:${ev.data.event}`, ev.data));
    },

    publish: (event, data) => this.state.channel.postMessage({ event: null, ...data, event }),
  };
};
