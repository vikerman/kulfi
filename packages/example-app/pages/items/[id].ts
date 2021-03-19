import {html} from 'lit';

export function page(params: {id: string}) {
  return html`<h2>Item ${params.id}</h2>`;
}
