import {css, html} from 'lit';

export const styles = css`
  h1 {
    color: green;
  }
`;

export function page() {
  return html`<h1>About page</h1>`;
}
