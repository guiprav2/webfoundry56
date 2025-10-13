export let defaultHead = `<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
  <script>window.rootPrefix = location.pathname.split('/').slice(0, 4).join('/')</script>
  <script src="../webfoundry/head.js"></script>
</head>`;

export let defaultHtml = `<!doctype html>
<html>
  ${defaultHead}
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
