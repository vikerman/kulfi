import * as fs from 'fs';
import * as path from 'path';
import {render} from '@lit-labs/ssr/lib/render-lit-html.js';

export async function renderPath(cwd, basePath, urlPath) {
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
    if (i === parts.length - 1 && p === 'index.html') {
      break;
    }
    targetPath += `/${p}`;
    try {
      if (!fs.lstatSync(targetPath, {throwIfNoEntry: false})?.isDirectory()) {
        found = false;
        break;
      }
    } catch (e) {
      // Needed till throwIfNotEntry is supported in lstatSync.
      if (e.code === 'ENOENT') {
        found = false;
        break;
      }
    }
  }
  if (found) {
    // Try to load the renderer from the index.js file.
    const indexPath = `${targetPath}/index.js`;
    try {
      if (fs.lstatSync(indexPath, {throwIfNoEntry: false})?.isFile()) {
        const module = await import(indexPath);
        if (module && typeof module.render === 'function') {
          return render(module.render());
        }
      }
    } catch (e) {
      // Needed till throwIfNotEntry is supported in lstatSync.
    }
  }
  return '<h2>Page Not Found</h2>';
}
