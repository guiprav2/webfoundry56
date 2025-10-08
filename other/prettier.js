import * as prettierImpl from 'https://unpkg.com/prettier@3.5.3/standalone.mjs';
import * as prettierPluginBabel from 'https://unpkg.com/prettier@3.5.3/plugins/babel.mjs';
import * as prettierPluginEstree from 'https://unpkg.com/prettier@3.5.3/plugins/estree.mjs';
import * as prettierPluginHtml from 'https://unpkg.com/prettier@3.5.3/plugins/html.mjs';
import * as prettierPluginPostCss from 'https://unpkg.com/prettier@3.5.3/plugins/postcss.mjs';

export default async function prettier(code, opt) {
  opt.parser === 'css' && (opt.parser = 'postcss');
  /^js|javascript$/.test(opt.parser) && (opt.parser = 'babel');
  try {
    return await prettierImpl.format(code, {
      singleQuote: true,
      arrowParens: 'avoid',
      ...opt,
      plugins: [prettierPluginBabel, prettierPluginEstree, prettierPluginHtml, prettierPluginPostCss, ...(opt.plugins || [])],
    });
  } catch (err) {
    //console.error(err);
    return code;
  }
}
