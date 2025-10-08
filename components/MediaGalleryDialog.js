import rfiles from '../repos/rfiles.js';
import { lookup as mimeLookup } from 'https://esm.sh/mrmime';
import { selectFile, isMedia } from '../other/util.js';

class MediaGalleryDialog {
  folders = [];
  selectedFolder = '';
  media = [];

  constructor(props) {
    (async () => {
      this.folders = await this.loadFolders();
      await this.selectFolder(this.folders[0]);
    })();
  }

  keytoggle(ev) {
    this.ctrlKey = ev.ctrlKey;
    d.update();
  }

  async loadFolders() {
    let files = await rfiles.list(state.projects.current);
    return [
      ...new Set(
        files
          .filter(x => x.startsWith('media/'))
          .map(x => x.split('/').slice(0, -1).join('/'))
          .filter(Boolean),
      ),
    ];
  }

  async getMedia(path) {
    let files = await rfiles.list(state.projects.current);
    return files
      .filter(x => x.split('/').slice(0, -1).join('/') === path && isMedia(x))
      .sort((a, b) => a.localeCompare(b));
  }

  async loadMedia() {
    this.media = await this.getMedia(this.selectedFolder);
    d.update();
  }

  async selectFolder(path) {
    this.selectedFolder = path;
    this.media = await this.getMedia(path);
    d.update();
  }

  // FIXME: Add question mark to unknown types in gallery, or filter them out
  typeFor(x) {
    return mimeLookup(x).split('/')[0];
  }

  srcFor(x) {
    return `/files/${state.projects.current}/${x}`;
  }

  audiovisualClick(ev) {
    console.log(ev);
    if (ev.ctrlKey) return;
    ev.preventDefault();
    ev.target.parentElement.dispatchEvent(
      new Event('click', { bubbles: true }),
    );
  }

  upload = async () => {
    let f = await selectFile('image/*, audio/*, video/*');
    await rfiles.save(
      state.projects.current,
      [this.selectedFolder, f.name].filter(Boolean).join('/'),
      f,
    );
    await this.loadMedia();
    await post('files.load');
  };

  ai = async () => {
    let [btn, name, file] = await showModal(d.el(AIImageDialog));
    if (btn !== 'ok') {
      return;
    }
    await rfiles.save(
      state.projects.current,
      [this.selectedFolder, name].filter(Boolean).join('/'),
      file,
    );
    await this.loadMedia();
    post('files.load');
  };

  submit = ev => {
    ev.preventDefault();
    this.root.returnDetail = '../' + this.selected;
    this.root.close(ev.submitter.value);
  };
}

export default MediaGalleryDialog;
