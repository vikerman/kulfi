import {html} from 'lit';

export function shell() {
  return html`<nav>
    <ul>
      <li><a href="/">Home</a></li>
      <li><a href="/about">About</a></li>
      <li><a href="/items/1">Main item</a></li>
      <li><a href="/items/1/name">Main item Name</a></li>
      <li><a href="/items/1/part">Main item Parts</a></li>
      <li><a href="/items/1/part/10">Main item Specific Part</a></li>
    </ul>
  </nav>`;
}
