import * as fs from 'fs';
import * as path from 'path';
import {render} from '@lit-labs/ssr/lib/render-lit-html.js';

export async function renderPath(
  cwd: string,
  basePath: string,
  urlPath: string,
  useShell: boolean
) {
  (global as any)['SCRIPT_BASE_PATH'] = basePath;

  // Try to render the shell if it exists.
  const shellPath = path.join(cwd, basePath, '/pages/shell.js');
  let shellResult: String | Iterable<String> = '<!--PAGE-->';
  if (useShell) {
    try {
      if (fs.lstatSync(shellPath)?.isFile()) {
        const module = await import(shellPath);
        shellResult = render(module.render());
      }
    } catch (e) {
      // shell module not found.
    }
  }

  // Parse the path and find the matching page.
  const parts = urlPath.split('/');
  let targetPath = path.join(cwd, basePath, '/pages');
  let found = true;
  for (let i = 0; i < parts.length; i += 1) {
    const p = parts[i];
    if (p === '') {
      // eslint-disable-next-line no-continue
      continue;
    }

    // Ignore last part of the path if it is explcitly index.html.
    if (i === parts.length - 1 && (p === 'index.html' || p === 'index.json')) {
      break;
    }
    targetPath += `/${p}`;
    try {
      if (!fs.lstatSync(targetPath)?.isDirectory()) {
        found = false;
        break;
      }
    } catch (e) {
      found = false;
      break;
    }
  }

  let err: Error | undefined;
  if (found) {
    // Try to load the renderer from the index.js file.
    const indexPath = `${targetPath}/index.js`;
    try {
      if (fs.lstatSync(indexPath)?.isFile()) {
        const module = await import(indexPath);
        if (module) {
          // render() is a required method for a page. head() is optional.
          const result: {
            head: String | Iterable<String>;
            shell: String | Iterable<String>;
            page: String | Iterable<String>;
          } = {head: '', shell: shellResult, page: ''};
          if (typeof module.render === 'function') {
            result.page = render(module.render());
            if (typeof module.head === 'function') {
              result.head = render(module.head());
            }
            return result;
          }
          // else fall through to 404 case.
        }
        // else fall through to 404 case.
      }
    } catch (e) {
      // Page module not found or not valid.
      err = e;
    }
  }
  // 404.
  return {head: '', shell: '<!--PAGE-->', page: '<h2>Page Not Found</h2>', err};
}
