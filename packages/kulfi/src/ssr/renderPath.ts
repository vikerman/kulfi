import './dom-shim.js';

import * as fs from 'fs';
import * as path from 'path';

import {
  CSSResultGroup,
  CSSResultFlatArray,
  CSSResultOrNative,
  getCompatibleStyle,
  CSSResult,
} from '@lit/reactive-element/css-tag.js';
import {render} from './render-lit-html.js';

function finalizeStyles(styles?: CSSResultGroup): CSSResultFlatArray {
  const elementStyles = [];
  if (Array.isArray(styles)) {
    // Dedupe the flattened array in reverse order to preserve the last items.
    // TODO(sorvell): casting to Array<unknown> works around TS error that
    // appears to come from trying to flatten a type CSSResultArray.
    const set = new Set((styles as Array<unknown>).flat(Infinity).reverse());
    // Then preserve original order by adding the set items in reverse order.
    for (const s of set) {
      elementStyles.unshift(getCompatibleStyle(s as CSSResultOrNative));
    }
  } else if (styles !== undefined) {
    elementStyles.push(getCompatibleStyle(styles));
  }
  return elementStyles;
}

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
        if (typeof module.shell === 'function') {
          shellResult = render(module.shell());
        }
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
          // render() is a required method for a page. head() and styles are optional.
          const result: {
            head: String | Iterable<String>;
            styles: String;
            shell: String | Iterable<String>;
            page: String | Iterable<String>;
            err?: any;
          } = {head: '', styles: '', shell: shellResult, page: ''};
          if (typeof module.page === 'function') {
            result.page = render(module.page());

            if (typeof module.head === 'function') {
              result.head = render(module.head());
            }

            if (typeof module.styles === 'object') {
              const styles = finalizeStyles(module.styles);
              if (styles.length > 0) {
                result.styles = '<style>';
                styles.forEach(s => {
                  result.styles += (s as CSSResult).cssText;
                });
                result.styles += '</style>';
              }
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
  return {
    head: '',
    styles: '',
    shell: '<!--PAGE-->',
    page: '<h2>Page Not Found</h2>',
    err,
  };
}

export {render};
