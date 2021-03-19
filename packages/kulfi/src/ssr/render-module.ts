/**
 * @license
 * Copyright (c) 2019 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */

import {importModule} from './import-module.js';

/**
 * Imports a module into a web-like rendering VM content and calls the function
 * exported as `functionName`.
 *
 * @param specifier
 * @param referrer
 * @param functionName
 * @param args
 */
export const renderModule = async (
  specifier: string,
  referrer: string,
  functionName: string,
  args: unknown[]
) => {
  const module = await importModule(specifier, referrer, global);
  const f = module.namespace[functionName] as Function;
  // TODO: should we require the result be an AsyncIterable?
  return f(...args);
};
