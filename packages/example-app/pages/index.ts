import {html} from 'lit';

import '../components/example-app.js';

export function head() {
  return html`
    <meta name="og:title" content="Kulfi example app" />
    <meta name="og:description" content="Home Page" />
  `;
}

export function page() {
  return html`
    <h1>Hello World!!!!</h1>
    <script async type="module" src="/js/components/example-app.js"></script>
    <example-app title="Test"></example-app>
  `;
}
