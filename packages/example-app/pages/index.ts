import {html} from 'lit';

import '../components/example-app.js';
import {importComponents} from 'kulfi/pages/importComponents.js';

export function head() {
  return html`
    <meta property="og:title" content="Kulfi example app" />
    <meta property="og:description" content="Home Page" />
  `;
}

export function render() {
  return html`
    <h1>Hello World!!</h1>
    ${importComponents('components/example-app.js')}
    <example-app></example-app>
  `;
}
