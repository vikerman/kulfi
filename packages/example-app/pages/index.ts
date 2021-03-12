import {html} from 'lit';

import '../components/example-app.js';

export function render() {
  return html`
    <h1>Hello World</h1>
    <example-app></example-app>
    <script type="module" src="/out-tsc/components/example-app.js"></script>
  `;
}
