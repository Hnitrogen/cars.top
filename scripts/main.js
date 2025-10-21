// Minimal interactions for performance-style prototype
(function() {
  const appbar = document.getElementById('appbar');
  const progress = document.getElementById('read-progress');
  const toc = document.querySelector('.toc');

  // App bar compact on scroll
  let lastY = 0;
  window.addEventListener('scroll', () => {
    const y = window.scrollY || document.documentElement.scrollTop;
    if (appbar) {
      appbar.classList.toggle('nav--compact', y > 48);
    }
    lastY = y;
    // Reading progress
    if (progress) {
      const doc = document.documentElement;
      const total = doc.scrollHeight - doc.clientHeight;
      const ratio = Math.max(0, Math.min(1, total ? y / total : 0));
      progress.style.scale = `${ratio} 1`;
    }
  }, { passive: true });

  // TOC active section highlight
  if (toc) {
    const links = Array.from(toc.querySelectorAll('a'));
    const targets = links.map(a => document.querySelector(a.getAttribute('href'))).filter(Boolean);
    const onScroll = () => {
      let active = 0;
      for (let i = 0; i < targets.length; i++) {
        const el = targets[i];
        const top = el.getBoundingClientRect().top;
        if (top <= (window.innerHeight * 0.25)) active = i; else break;
      }
      links.forEach((a, i) => a.classList.toggle('active', i === active));
    };
    document.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // Compare: "only differences" toggle
  const switchEl = document.getElementById('switch');
  const table = document.getElementById('compareTable');
  const wrap = document.getElementById('tableWrap');
  if (switchEl && table && wrap) {
    const markDiffs = () => {
      const rows = table.tBodies[0].rows;
      for (const tr of rows) {
        if (tr.classList.contains('group')) continue;
        const cells = Array.from(tr.cells).slice(1); // skip first (label)
        const values = cells.map(td => td.textContent.trim());
        const allSame = values.every(v => v === values[0]);
        tr.classList.toggle('same', allSame);
        tr.classList.toggle('diff', !allSame);
      }
    };
    markDiffs();
    switchEl.addEventListener('click', () => {
      const on = !switchEl.classList.contains('on');
      switchEl.classList.toggle('on', on);
      wrap.classList.toggle('diff-only', on);
    });
  }
})();

