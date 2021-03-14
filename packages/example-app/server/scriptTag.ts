import {html} from 'lit';

export function scriptTag(path: string) {
  const basePath = (global as any)['SCRIPT_BASE_PATH'] || '';
  return html`<script async type="module" src="${basePath}/${path}"></script>`;
}
