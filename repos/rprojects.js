import rfiles from './rfiles.js';

class ProjectsRepository {
  list() {
    let ret = [];
    for (let [k, v] of Object.entries(localStorage)) {
      if (!k.startsWith('webfoundry:projects:link:')) continue;
      ret.push(`${k.slice('webfoundry:projects:link:'.length)}:${v}`);
    }
    return ret.sort((a, b) => a.split(':')[0].localeCompare(b.split(':')[0]));
  }

  create(name, uuid = crypto.randomUUID()) {
    if (state.projects.list.find(x => x.split(':')[0] === name)) throw new Error(`Project alreaady exists: ${name}`);
    localStorage.setItem(`webfoundry:projects:link:${name}`, uuid);
    localStorage.setItem(`webfoundry:projects:storage:${uuid}`, state.companion.client?.status !== 'connected' ? 'local' : 'cfs');
    return `${name}:${uuid}`;
  }

  storage(project, value) {
    let uuid = project.split(':')[1];
    if (value === undefined) return localStorage.getItem(`webfoundry:projects:storage:${uuid}`);
    localStorage.setItem(`webfoundry:projects:storage:${uuid}`, value);
  }

  async config(project, opt) {
    if (!opt) { let blob = await rfiles.load(project, 'wf.uiconfig.json'); return blob ? JSON.parse(await blob.text()) : {} }
    await rfiles.save(project, 'wf.uiconfig.json', new Blob([JSON.stringify(opt, null, 2)], { type: 'application/json' }));
  }

  async mv(project, newName) {
    let [name, uuid] = project.split(':');
    if (this.storage(project) === 'cfs') await post('companion.rpc', 'files:mv', { path: name, newPath: newName });
    localStorage.setItem(`webfoundry:projects:link:${newName}`, uuid);
    localStorage.removeItem(`webfoundry:projects:link:${name}`);
  }

  async rm(project) {
    let [name, uuid] = project.split(':');
    let storage = this.storage(project);
    switch (storage) {
      case 'local': {
        if (state.projects.list.filter(x => x.split(':')[1] === uuid).length <= 1) await Promise.all((await rfiles.list(project)).map(async x => await rfiles.rm(project, x)));
        break;
      }
      case 'cfs': await post('companion.rpc', 'files:rm', { path: name }); break;
      default: throw new Error(`Unknown project storage: ${storage}`);
    }
    localStorage.removeItem(`webfoundry:projects:link:${name}`);
    localStorage.removeItem(`webfoundry:projects:storage:${uuid}`);
  }
}

let rprojects = window.rprojects = new ProjectsRepository();
export default rprojects;
