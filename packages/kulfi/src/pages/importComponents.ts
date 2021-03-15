import {html} from 'lit';

export function importComponents(path: string) {
  // TODO: Look for a build manifest for prod bundle names.
  const basePath = (global as any)['SCRIPT_BASE_PATH'] || '';
  return html`<script async type="module" src="${basePath}/${path}"></script>`;
}
