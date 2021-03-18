// import { hmrPlugin, presets } from '@open-wc/dev-server-hmr';
import {ssrPlugin} from 'kulfi/ssr-plugin/plugin.js';

export default /** @type {import('@web/dev-server').DevServerConfig} */ ({
  nodeResolve: true,
  open: '/',
  watch: true,
  appIndex: './index.html',

  /** Compile JS for older browsers. Requires @web/dev-server-esbuild plugin */
  // esbuildTarget: 'auto'

  /** Confgure bare import resolve plugin */
  // nodeResolve: {
  //   exportConditions: ['browser', 'development']
  // },

  plugins: [
    /** Use Hot Module Replacement by uncommenting. Requires @open-wc/dev-server-hmr plugin */
    // hmr && hmrPlugin({ exclude: ['**/*/node_modules/**/*'], presets: [presets.litElement] }),
    ssrPlugin('js'),
  ],

  // See documentation for all available options
});
