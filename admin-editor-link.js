/* Injected on /admin.html. Capture the chapter's original edit click before prompt() runs. */
(() => {
  'use strict';
  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest('.btn-edit-ch');
    if (!button) return;
    const row = button.closest('[data-id]');
    const id = row?.dataset?.id;
    if (!/^\d{1,18}$/.test(id || '')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    location.assign('/chapter-editor.html?id=' + encodeURIComponent(id));
  }, true);
})();
