import { esc } from './util.js';

export let defaultHead = ({ title } = {}) =>`<head>
  <meta charset="utf-8">
  <title>${esc(title)}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
  <script>window.rootPrefix = /^\\/(files|preview)\\//.test(location.pathname) ? location.pathname.split('/').slice(0, 4).join('/') : '/'</script>
  <script src="../webfoundry/head.js"></script>
</head>`;

export let defaultHtml = opt =>`<!doctype html>
<html>
  ${defaultHead(opt)}
  <body style="display: none; min-height: 100vh">
    <div class="bu box tw m-8">
      <div class="tw p-16 text-center font-sm italic">Component intentionally left blank.</div>
    </div>
  </body>
</html>
`;

export function defaultCtrl(path) {
  let name = path.split('/').at(-1);
  let i = name.indexOf('.');
  if (i > 0) name = name.slice(0, i);
  return `export default class ${name} {
  state = {};
  actions = {};
};
`;
}
