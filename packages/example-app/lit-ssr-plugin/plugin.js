import {renderModule} from '@lit-labs/ssr/lib/render-module.js';
import {Readable} from 'stream';

const DECLARATIVE_SHADOW_DOM_POLYFILL = `<script>
document.body.querySelectorAll('template[shadowroot]').forEach(t => {
  t.parentElement.attachShadow({
    mode: t.getAttribute('shadowroot'),
  }).appendChild(t.content);
  t.remove();
});
</script>
`;

const PAGE_PLACEHOLDER = '<!--PAGE-->';
const PAGE_END_PLACEHOLDER = '<!--/PAGE-->';

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
    async transform(context) {
      if (context.response.is('html')) {
        // Render the path through lit-ssr.
        const ssrResult = await renderModule(
          './renderPath.js',
          import.meta.url,
          'renderPath',
          [process.cwd(), basePath, context.originalUrl]
        );
        // For dev mode just collect the result and return instead of actually streaming.
        const content =
          PAGE_PLACEHOLDER +
          (await toPromise(Readable.from(ssrResult))) +
          PAGE_END_PLACEHOLDER +
          DECLARATIVE_SHADOW_DOM_POLYFILL;
        return {body: context.body.replace(PAGE_PLACEHOLDER, content)};
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
