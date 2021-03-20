import {html} from 'lit';

interface ItemData {
  name: string;
  parts: string[];
}

export function page(params: {id: string}, data: ItemData) {
  return html`
    <h2>Item ${params.id}</h2>
    <p>Name: ${data.name}</p>
    <p>Parts: ${data.parts.toString()}</p>
  `;
}
