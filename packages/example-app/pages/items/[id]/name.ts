import {html} from 'lit';

export function page(params: {id: string}) {
  return html`<h3>Name of Item ${params.id}</h3>`;
}
