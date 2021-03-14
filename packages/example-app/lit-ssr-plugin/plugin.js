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
const PAGE_START = '<div id="__page__"><div>';
const PAGE_END = '</div></div>';

const HEAD_PLACEHOLDER = '<!--HEAD-->';
const HEAD_START = '<!--HEAD-->';
const HEAD_END = '<!--/HEAD-->';

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
          [process.cwd(), basePath, context.originalUrl, true]
        );
        // For dev mode just collect the result and return instead of actually streaming.
        const head =
          HEAD_START +
          (await toPromise(Readable.from(ssrResult.head))) +
          HEAD_END;
        const page =
          PAGE_START +
          (await toPromise(Readable.from(ssrResult.page))) +
          PAGE_END;
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
    async serve(context) {
      // Client side navigation requests are handled through a special .json handler to
      // return SSR-ed content as JSON responses which can be swapped in by the router.
      if (context.path.endsWith('/index.json')) {
        const ssrResult = await renderModule(
          './renderPath.js',
          import.meta.url,
          'renderPath',
          [process.cwd(), basePath, context.originalUrl, true]
        );
        const result = {
          head: await toPromise(Readable.from(ssrResult.head)),
          page: await toPromise(Readable.from(ssrResult.page)),
        };
        return {body: JSON.stringify(result), type: 'json'};
      }
      return undefined;
    },
  };
}
