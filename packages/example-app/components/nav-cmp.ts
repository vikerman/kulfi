import 'kulfi/hydrate-support.js';

import {LitElement, html} from 'lit';
import {property, customElement} from 'lit/decorators.js';
import {inject} from 'kulfi/inject.js';
import {Router} from 'kulfi/router.js';

@customElement('nav-cmp')
export class NavCmp extends LitElement {
  @property()
  path = '';

  connectedCallback() {
    super.connectedCallback();
    inject<Router>('ROUTER').then(r => {
      r.getController(this, 'path');
    });
  }

  render() {
    return html`<nav>
        <ul>
          <li><a href="/">Home</a></li>
          <li><a href="/about">About</a></li>
          <li><a href="/items/1">Main item</a></li>
          <li><a href="/items/1/name">Main item Name</a></li>
          <li><a href="/items/1/part">Main item Parts</a></li>
          <li><a href="/items/1/part/10">Main item Specific Part</a></li>
        </ul>
      </nav>
      <p>Path: ${this.path}</p>`;
  }
}