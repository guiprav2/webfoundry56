export let defaultHead = (opt = {}) => `<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
  <script type="module" src="../webfoundry/head.js"></script>
  ${opt.betterscroll ?? true ? `<style class="wf-scrollbar-style">
    ::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }
    ::-webkit-scrollbar-track {
      background: transparent;
      box-shadow: inset 0 0 4px rgba(0, 0, 0, 0.05);
      border-radius: 4px;
    }
    ::-webkit-scrollbar-thumb {
      background-color: grey;
      border-radius: 4px;
      border: 2px solid transparent;
      background-clip: content-box;
    }
    ::-webkit-scrollbar-thumb:hover {
      background-color: #b0b0b0;
    }
    ::-webkit-scrollbar-thumb:horizontal {
      background-clip: padding-box;
    }
    ::-webkit-scrollbar-thumb:vertical {
      background-clip: padding-box;
    }
  </style>` : ''}
</head>`;

export let defaultHtml = (opt = {}) => `<!doctype html>
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
