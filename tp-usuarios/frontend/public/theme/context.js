(function () {
  const listeners = new Set();
  const read = () => {
    try { return localStorage.getItem('theme') === 'dark' ? 'dark' : 'light'; }
    catch { return 'light'; }
  };
  let current = read();
  const apply = () => {
    document.documentElement.dataset.theme = current;
    document.documentElement.style.colorScheme = current;
    listeners.forEach(listener => listener());
  };
  window.R6Theme = {
    getSnapshot: () => current === 'dark',
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
    toggle: () => {
      current = current === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('theme', current); } catch {}
      apply();
    },
  };
  window.addEventListener('storage', event => {
    if (event.key === 'theme' || event.key === null) { current = read(); apply(); }
  });
  apply();
})();
