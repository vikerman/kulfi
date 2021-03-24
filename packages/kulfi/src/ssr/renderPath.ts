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

function isIndex(p: string) {
  return p === 'index.html' || p === 'index.json';
}

function isReserved(p: string) {
  return p === '_shell' || p === '_404';
}

export async function renderPath(
  cwd: string,
  basePath: string,
  urlPath: string,
  useShell: boolean
) {
  // Try to render the shell if it exists.
  const shellPath = path.join(cwd, basePath, '/pages/_shell.js');
  let shellResult: String | Iterable<String> = '<!--PAGE-->';
  if (useShell) {
    try {
      if (fs.lstatSync(shellPath)?.isFile()) {
        const module = await import(shellPath);
        if (typeof module.render === 'function') {
          let locationPath = urlPath;
          if (locationPath.endsWith('/index.html')) {
            locationPath = locationPath.substr(0, locationPath.length - 11);
          }
          if (locationPath.endsWith('/')) {
            locationPath = locationPath.substr(0, locationPath.length - 1);
          }
          if (locationPath === '') {
            locationPath = '/';
          }
          shellResult = render(module.render(locationPath));
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
  const params: Record<string, string> = {};
  for (let i = 0; i < parts.length; i += 1) {
    const p = parts[i];
    if (p === '') {
      // eslint-disable-next-line no-continue
      continue;
    }

    if (isReserved(p)) {
      found = false;
      break;
    }

    if (i === parts.length - 1 && isIndex(p)) {
      break;
    }

    const isLastSegment =
      i === parts.length - 1 ||
      (i === parts.length - 2 && isIndex(parts[parts.length - 1]));

    targetPath += `/${p}`;

    if (!isLastSegment) {
      try {
        if (!fs.lstatSync(targetPath)?.isDirectory()) {
          found = false;
        }
      } catch (e) {
        found = false;
      }
      if (!found) {
        // Try to check for a parameterized directory.
        const last = targetPath.lastIndexOf('/');
        const lastPath = `${targetPath.substring(0, last)}/`;
        const files = fs.readdirSync(lastPath);
        for (const f of files) {
          if (
            f.startsWith('[') &&
            f.endsWith(']') &&
            f.length > 2 &&
            fs.lstatSync(lastPath + f).isDirectory()
          ) {
            targetPath = lastPath + f;
            params[f.substr(1, f.length - 2)] = p;
            found = true;
            break;
          }
        }
      }
      if (!found) {
        break;
      }
    } else {
      targetPath += '.js';
      try {
        if (!fs.lstatSync(targetPath)?.isFile()) {
          found = false;
        }
      } catch (e) {
        found = false;
      }
      // Try to check for a parameterized file.
      if (!found) {
        // Try to check for a parameterized directory.
        const last = targetPath.lastIndexOf('/');
        const lastPath = `${targetPath.substring(0, last)}/`;
        const files = fs.readdirSync(lastPath);
        for (const f of files) {
          if (
            f.startsWith('[') &&
            f.endsWith('].js') &&
            f.length > 5 &&
            fs.lstatSync(lastPath + f).isFile()
          ) {
            targetPath = lastPath + f;
            params[f.substr(1, f.length - 5)] = p;
            found = true;
            break;
          }
        }
      }
      if (!found) {
        break;
      }
    }

    if (isLastSegment) {
      // This can happen for second last segment but next segment is just index.html or imdex.json
      break;
    }
  }

  let err: Error | undefined;
  if (found) {
    // This should happen only when route is '/'.
    if (!targetPath.endsWith('.js')) {
      targetPath += '/index.js';
    }

    // Try to load the renderer from the index.js file.
    try {
      if (fs.lstatSync(targetPath)?.isFile()) {
        const module = await import(targetPath);
        if (module) {
          // render() is a required method for a page. head() and styles are optional.
          const result: {
            head: String | Iterable<String>;
            styles: String;
            shell: String | Iterable<String>;
            page: String | Iterable<String>;
            err?: any;
          } = {head: '', styles: '', shell: shellResult, page: ''};
          if (typeof module.render === 'function') {
            // Fetch the data if data definition exists.
            let data: any;
            const dataFile = `${targetPath.substr(
              0,
              targetPath.length - 3
            )}.data.js`;
            try {
              if (fs.lstatSync(dataFile)?.isFile()) {
                const dataModule = await import(dataFile);
                if (typeof dataModule.data === 'function') {
                  try {
                    data = await dataModule.data(params);
                  } catch (e) {
                    err = e;
                  }
                }
              }
            } catch (e) {
              // Ignore errors
            }

            if (!err) {
              result.page = render(module.render(params, data));

              if (typeof module.head === 'function') {
                result.head = render(module.head(params, data));
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
    shell: shellResult,
    page: '<h2>Page Not Found</h2>',
    err,
  };
}

export {render};
