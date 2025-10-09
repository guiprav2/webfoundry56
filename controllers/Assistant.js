import actions from '../other/actions.js';
import autoassist from 'https://esm.sh/@camilaprav/kittygpt@0.0.37/autoassist.js';
import { arrayify, resolve } from '../other/util.js';

export default class Assistant {
  actions = {
    start: async () => {
      try {
        this.state.initializing = true;
        d.update();
        this.state.session = await autoassist({
          endpoint: 'https://kittygpt.netlify.app/.netlify/functions/voicechat',
          navdisable: true,
          idtrack: true,
          iframes: true,
          map: state.designer.current.map,
        });
        let fns = Object.fromEntries([...Object.entries(actions)].map(([k, v]) => [k, {
          description: v.description,
          parameters: v.parameters,
          handler: v.handler,
        }]));
        this.state.session.sysupdate({
          main: `You're Webfoundry Assistant, a voice assistant embedded into a web app and site creation tool.`,
          disabledFns: `Whenever a disabled function is requested, tell the user the reasons.`,
          configPanel: `Config or configuration panel refers to the settings panel in the icons sidebar.`,
          selections: `MISSION CRITICAL: All operations happen relative to the selected elements, so make sure to select the right ones before issuing any commands.`,
          imageGeneration: `When asked to generate images, make sure to probe the user to understand exactly the style as well as what they want before generating.`,
        }, fns);
      } finally {
        this.state.initializing = false;
      }
    },

    stop: () => { this.state.session.stop(); this.state.session = null },
  };
};
