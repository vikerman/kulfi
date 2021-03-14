import {html} from 'lit';

import '../components/example-app.js';

export function head() {
  return html`
    <meta property="og:title" content="Kulfi example app" />
    <meta property="og:description" content="Home Page" />
  `;
}

export function render() {
  return html`
    <h1>Hello World!!</h1>
    <script
      async
      type="module"
      src="out-tsc/components/example-app.js"
    ></script>
    <example-app></example-app>
  `;
}
