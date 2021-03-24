import {html} from 'lit';

export function render(params: {id: string; num: string}) {
  return html`<h3>Part #${params.num} for Item ${params.id}</h3>`;
}
