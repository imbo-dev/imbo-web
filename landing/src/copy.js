// Copy buttons: <button data-copy="text">. The status line is read out by screen readers.
(() => {
  const status = document.getElementById('copy-status');
  for (const btn of document.querySelectorAll('[data-copy]')) {
    const label = btn.querySelector('.copy-text');
    let timer;
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(btn.dataset.copy);
      } catch {
        const code = btn.parentElement.querySelector('code');
        if (code) getSelection().selectAllChildren(code);
        if (status) status.textContent = 'Select the command and copy it.';
        return;
      }
      btn.dataset.copied = '';
      if (label) label.textContent = 'Copied';
      if (status) status.textContent = 'Install command copied.';
      clearTimeout(timer);
      timer = setTimeout(() => {
        delete btn.dataset.copied;
        if (label) label.textContent = 'Copy';
        if (status) status.textContent = '';
      }, 2000);
    });
  }
})();
