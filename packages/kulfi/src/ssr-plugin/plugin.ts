import * as path from 'path';
import {Readable} from 'stream';

import {DECLARATIVE_SHADOW_DOM_POLYFILL} from '../ssr/decl-shadow-dom.js';
import {renderModule} from '../ssr/render-module.js';

const SHELL_PLACEHOLDER = '<!--SHELL-->';

const PAGE_PLACEHOLDER = '<!--PAGE-->';
const PAGE_START = '<div id="__page__"><div>';
const PAGE_END = '</div></div>';

const HEAD_PLACEHOLDER = '<!--HEAD-->';
const HEAD_START = '<!--HEAD-->';
const HEAD_END = '<!--/HEAD-->';

function toPromise(stream: Readable): Promise<string> {
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

// Highly simplified html escape.
function htmlEscape(s: string) {
  return s.replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function ssrPlugin(basePathParam: string) {
  const basePath = basePathParam || '';
  let cacheKey = 0;
  return {
    name: 'lit-ssr-plugin',
    serverStart(args: {fileWatcher: {add: Function}}) {
      // Add the pages directory to the watch list.
      args.fileWatcher.add(path.join(basePath, '/pages'));
    },
    async transform(context: {
      response: any;
      originalUrl: string;
      body: string;
    }) {
      if (context.response.is('html')) {
        // Render the path through lit-ssr.
        const ssrResult = await renderModule(
          '../ssr/renderPath.js',
          import.meta.url,
          'renderPath',
          [process.cwd(), basePath, context.originalUrl, true]
        );
        if (ssrResult.err) {
          // In dev mode return any underlying exception text.
          // Don't do that in prod mode.
          return {
            body: `<html><body><pre>${htmlEscape(
              ssrResult.err.stack
            )}</pre></body></html>`,
          };
        }

        // For dev mode just collect the result and return instead of actually streaming.
        const head =
          HEAD_START +
          (await toPromise(Readable.from(ssrResult.head))) +
          ssrResult.styles +
          HEAD_END;
        const page =
          PAGE_START +
          (await toPromise(Readable.from(ssrResult.page))) +
          PAGE_END;
        const shell = await toPromise(Readable.from(ssrResult.shell));

        let body = context.body.replace(HEAD_PLACEHOLDER, head);
        body = body.replace(SHELL_PLACEHOLDER, shell);
        body = body.replace(PAGE_PLACEHOLDER, page);
        return {
          body: body + DECLARATIVE_SHADOW_DOM_POLYFILL,
        };
      }
      return undefined;
    },
    transformCacheKey(context: {request: {url: string}}) {
      // Never cache SSR-ed index.html by having a rolling cache key.
      // This will eventually fill up the LRU cache in the WebDevServer and get discarded.
      // Maybe better to look into a way to not cache this in the first place.
      if (context.request.url === '/index.html') {
        cacheKey += 1;
        return cacheKey.toString();
      }
      return '';
    },
    async serve(context: {path: string; originalUrl: string}) {
      // Client side navigation requests are handled through a special .json handler to
      // return SSR-ed content as JSON responses which can be swapped in by the router.
      if (context.path.endsWith('/index.json')) {
        const ssrResult = await renderModule(
          '../ssr/renderPath.js',
          import.meta.url,
          'renderPath',
          [process.cwd(), basePath, context.originalUrl, false]
        );
        const result = {
          head: `<head>
            ${await toPromise(Readable.from(ssrResult.head))}
            ${ssrResult.styles}
          </head>`,
          page: `<body>${await toPromise(
            Readable.from(ssrResult.page)
          )}</body>`,
        };
        return {body: JSON.stringify(result), type: 'json'};
      }
      return undefined;
    },
  };
}
