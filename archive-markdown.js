/* Deliberately small, safe Markdown subset for a literary archive. No raw HTML. */
(() => {
  'use strict';
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  function inline(text) {
    // Escape raw HTML first; generated tags are only from tightly scoped markers.
    let value = escapeHtml(text);
    value = value.replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>');
    value = value.replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, '$1<em>$2</em>');
    return value;
  }
  function render(text) {
    const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
    const blocks = [];
    let paragraph = [], quote = [];
    const flushParagraph = () => {
      if (!paragraph.length) return;
      const raw = paragraph.join('\n').trim();
      if (raw) blocks.push(`<p${/^(有诗|山河远去|一卷春秋)/.test(raw) ? ' class="verse"' : ''}>${paragraph.map(inline).join('<br>')}</p>`);
      paragraph = [];
    };
    const flushQuote = () => {
      if (!quote.length) return;
      blocks.push(`<blockquote class="literary-quote">${quote.map(inline).join('<br>')}</blockquote>`);
      quote = [];
    };
    for (const original of lines) {
      const line = original.trim();
      if (!line) { flushParagraph();flushQuote();continue; }
      const heading = /^(#{2,3})\s+(.+)$/.exec(line);
      const quoted = /^>\s?(.*)$/.exec(line);
      if (heading) {
        flushParagraph();flushQuote();
        const level = heading[1].length;
        blocks.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      } else if (quoted) { flushParagraph(); quote.push(quoted[1]); }
      else { flushQuote();paragraph.push(original.trim()); }
    }
    flushParagraph();flushQuote();
    return blocks.join('');
  }
  window.ArchiveMarkdown = Object.freeze({ render, escapeHtml });
})();
