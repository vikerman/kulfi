import * as path from 'path';
import {renderModule} from '@lit-labs/ssr/lib/render-module.js';
import {Readable} from 'stream';

const DECLARATIVE_SHADOW_DOM_POLYFILL = `<script>
window.convertShadowRoot = function() {
  if (HTMLTemplateElement.prototype.hasOwnProperty('shadowRoot')) return;
  document.body.querySelectorAll('template[shadowroot]').forEach(t => {
    t.parentElement.attachShadow({
      mode: 'open',
    }).appendChild(t.content);
    t.remove();
  });
};
window.convertShadowRoot();
</script>
`;

const PAGE_PLACEHOLDER = '<!--PAGE-->';
const PAGE_START_COMMENT = '<!--PAGE-->';
const PAGE_END_COMMENT = '<!--/PAGE-->';

const HEAD_PLACEHOLDER = '<!--HEAD-->';
const HEAD_START_COMMENT = '<!--HEAD-->';
const HEAD_END_COMMENT = '<!--/HEAD-->';

function toPromise(stream) {
  return new Promise(resolve => {
    let result = '';
    stream.on('end', () => {
      resolve(result);
    });
    stream.on('data', value => {
      result += value;
    });
  });
}

export function ssrPlugin(basePathParam) {
  const basePath = basePathParam || '';
  let cacheKey = 0;
  return {
    name: 'lit-ssr-plugin',
    serverStart(args) {
      // Add the pages directory to the watch list.
      args.fileWatcher.add(path.join(basePath, '/pages'));
    },
    async transform(context) {
      if (context.response.is('html')) {
        // Render the path through lit-ssr.
        // TODO: Don't reload the module every time?
        const ssrResult = await renderModule(
          './renderPath.js',
          import.meta.url,
          'renderPath',
          [process.cwd(), basePath, context.originalUrl]
        );
        // For dev mode just collect the result and return instead of actually streaming.
        const head =
          HEAD_START_COMMENT +
          (await toPromise(Readable.from(ssrResult.head))) +
          HEAD_END_COMMENT;
        const page =
          PAGE_START_COMMENT +
          (await toPromise(Readable.from(ssrResult.page))) +
          PAGE_END_COMMENT;
        const shell = await toPromise(Readable.from(ssrResult.shell));

        let body = context.body.replace(HEAD_PLACEHOLDER, head);
        if (shell !== '<!--PAGE-->') {
          body = body.replace(PAGE_PLACEHOLDER, shell);
        }
        body = body.replace(PAGE_PLACEHOLDER, page);
        return {
          body: body + DECLARATIVE_SHADOW_DOM_POLYFILL,
        };
      }
      return undefined;
    },
    transformCacheKey(context) {
      // Never cache SSR-ed index.html by having a rolling cache key.
      // This will eventually fill up the LRU cache in the WebDevServer and get discarded.
      // Maybe better to look into a way to not cache this in the first place.
      if (context.request.url === '/index.html') {
        cacheKey += 1;
        return cacheKey.toString();
      }
      return '';
    },
  };
}
