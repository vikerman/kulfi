export const DECLARATIVE_SHADOW_DOM_POLYFILL = `<script>
window.convertShadowRoot = function() {
  if (HTMLTemplateElement.prototype.hasOwnProperty('shadowRoot')) return;
  document.body.querySelectorAll('template[shadowroot]').forEach(t => {
    t.parentElement.attachShadow({
      mode: 'open',
    }).appendChild(t.content);
    t.remove();
  });
};
window.convertShadowRoot();
</script>
`;
