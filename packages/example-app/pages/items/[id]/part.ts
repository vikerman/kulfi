import {html} from 'lit';

export function page(params: {id: string}) {
  return html`<h3>All parts of ${params.id}</h3>`;
}
