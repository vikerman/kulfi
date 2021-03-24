import {html} from 'lit';

import '../components/nav-cmp.js';

export function render(path: string) {
  return html`
    <nav-cmp path=${path}></nav-cmp>
    <script async type="module" src="/js/components/nav-cmp.js"></script>
  `;
}
