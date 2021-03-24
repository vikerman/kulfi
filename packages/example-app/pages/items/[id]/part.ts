import {html} from 'lit';

export function render(params: {id: string}) {
  return html`<h3>All parts of ${params.id}</h3>`;
}
