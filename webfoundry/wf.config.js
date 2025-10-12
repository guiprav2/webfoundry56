let ui = JSON.parse((await (await fetch('wf.uiconfig.json')).text()));
export default ui;
