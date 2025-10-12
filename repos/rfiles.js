import JSZip from 'https://esm.sh/jszip';
import lf from 'https://esm.sh/localforage';
import rprojects from './rprojects.js';
import { lookup as mimeLookup } from 'https://cdn.skypack.dev/mrmime';

class FilesRepository {
  async list(project) {
    let [name, uuid] = project.split(':');
    let storage = rprojects.storage(project);
    let list;
    switch (storage) {
      case 'local': {
        let ks = await lf.keys();
        let prefix = `webfoundry:projects:files:${uuid}:`;
        list = ks.filter(x => x.startsWith(prefix)).map(x => x.slice(prefix.length));
        break;
      }
      case 'cfs': list = (await post('companion.rpc', 'files:list', { path: name })).map(x => x.slice(name.length + 1)); break;
      default: throw new Error(`Unknown project storage: ${storage}`);
    }
    return list;
  }

  async save(project, path, blob) {
    console.log('save:', project, path);
    let [name, uuid] = project.split(':');
    let storage = rprojects.storage(project);
    switch (storage) {
      case 'local': {
        let k = `webfoundry:projects:files:${uuid}:${path}`;
        let exists = await lf.getItem(k);
        await lf.setItem(k, blob);
        await post('broadcast.publish', `files:${exists ? 'change' : 'add'}`, { project, path: `${name}/${path}` });
        break;
      }
      case 'cfs': return await post('companion.rpc', 'files:save', { path: `${name}/${path}`, data: await b64(blob) });
      default: throw new Error(`Unknown project storage: ${storage}`);
    }
  }

  async load(project, path) {
    let [name, uuid] = project.split(':');
    let storage = rprojects.storage(project);
    switch (storage) {
      case 'local': return await lf.getItem(`webfoundry:projects:files:${uuid}:${path}`);
      case 'cfs': return unb64(await post('companion.rpc', 'files:load', { path: `${name}/${path}` }), mimeLookup(path));
      default: throw new Error(`Unknown project storage: ${storage}`);
    }
  }

  async mv(project, path, newPath) {
    let [name, uuid] = project.split(':');
    let storage = rprojects.storage(project);
    switch (storage) {
      case 'local': {
        if (!path.endsWith('/')) {
          let blob = await lf.getItem(`webfoundry:projects:files:${uuid}:${path}`);
          await lf.setItem(`webfoundry:projects:files:${uuid}:${newPath}`, blob);
          await lf.removeItem(`webfoundry:projects:files:${uuid}:${path}`);
          await post('broadcast.publish', 'files:rm', { project, path: `${name}/${path}` });
          await post('broadcast.publish', 'files:add', { project, path: `${name}/${newPath}` });
        } else {
          for (let x of (await lf.keys()).filter(x => x.startsWith(`webfoundry:projects:files:${uuid}:${path}`))) {
            let y = x.replace(new RegExp(`^webfoundry:projects:files:${uuid}:${path}`), `webfoundry:projects:files:${uuid}:${newPath}`);
            let blob = await lf.getItem(x);
            await lf.setItem(y, blob);
            await lf.removeItem(x);
            await post('broadcast.publish', 'files:rm', { project, path: `${name}/${path}` });
            await post('broadcast.publish', 'files:add', { project, path: `${name}/${newPath}` });
          }
        }
        break;
      }
      case 'cfs': return await post('companion.rpc', 'files:mv', { path: `${name}/${path}`, newPath: `${name}/${newPath}` });
      default: throw new Error(`Unknown project storage: ${storage}`);
    }
  }

  async rm(project, path) {
    let [name, uuid] = project.split(':');
    let storage = rprojects.storage(project);
    switch (storage) {
      case 'local': {
        if (!path.endsWith('/')) lf.removeItem(`webfoundry:projects:files:${uuid}:${path}`);
        else for (let x of (await lf.keys()).filter(x => x.startsWith(`webfoundry:projects:files:${uuid}:${path}`))) await lf.removeItem(x);
        await post('broadcast.publish', 'files:rm', { project, path: `${name}/${path}` });
        break;
      }
      case 'cfs': return await post('companion.rpc', 'files:rm', { path: `${name}/${path}` });
      default: throw new Error(`Unknown project storage: ${storage}`);
    }
  }

  async importZip(project, blob) {
    let zip = await JSZip.loadAsync(blob);
    for (let [path, entry] of Object.entries(zip.files)) {
      if (path.endsWith('/')) continue;
      let fileBlob = await entry.async('blob');
      await this.save(project, path, new Blob([await fileBlob.arrayBuffer()], { type: mimeLookup(path) || 'application/octet-stream', }));
    }
  }

  async exportZip(project, extraFiles = {}) {
    let zip = new JSZip();
    for (let path of await this.list(project)) zip.file(path, await this.load(project, path));
    for (let [k, v] of Object.entries(extraFiles)) zip.file(k, v);
    return await zip.generateAsync({ type: 'blob' });
  }

  async push(project) {
    let [name, uuid] = project.split(':');
    for (let x of (await post('companion.rpc', 'files:list', { path: name })).map(x => x.slice(name.length + 1))) {
      await lf.setItem(`webfoundry:projects:files:${uuid}:${x}`, unb64(await post('companion.rpc', 'files:load', { path: `${name}/${x}` }), mimeLookup(x)));
      await post('broadcast.publish', 'files:add', { path: `${name}/${x}` });
    }
    await post('companion.rpc', 'files:rm', { path: `${name}/` });
    return true;
  }

  async pull(project) {
    let [name, uuid] = project.split(':');
    if (await post('companion.rpc', 'files:stat', { path: `${name}/` })) {
      let [btn] = await showModal('ConfirmationDialog', { title: `${name}/ exists in workspace. Merge and overwrite?` });
      if (btn !== 'yes') return false;
    }
    let ks = await lf.keys();
    let prefix = `webfoundry:projects:files:${uuid}:`;
    let fks = ks.filter(x => x.startsWith(prefix)).map(x => x.slice(prefix.length));
    for (let x of fks) await post('companion.rpc', 'files:save', { path: `${name}/${x}`, data: await b64(await lf.getItem(`webfoundry:projects:files:${uuid}:${x}`)) });
    for (let x of fks) {
      await lf.removeItem(`webfoundry:projects:files:${uuid}:${x}`);
      await post('broadcast.publish', 'files:rm', { path: `${name}/${x}` });
    }
    return true;
  }
}

function b64(blob) {
  return new Promise((resolve, reject) => {
    let reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function unb64(base64, type = '') {
  if (base64 == null) return null;
  let chars = atob(base64);
  let nums = new Array(chars.length);
  for (let i = 0; i < chars.length; i++) nums[i] = chars.charCodeAt(i);
  return new Blob([new Uint8Array(nums)], { type });
}

export default new FilesRepository();
