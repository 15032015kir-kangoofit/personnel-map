'use strict';

/* PWA: регистрация service worker и кнопка «Установить» */
(function () {
  let deferredPrompt = null;
  const btn = document.getElementById('btn-install');

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  // Регистрация service worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => { /* офлайн-режим недоступен */ });
    });
  }

  // Браузер предлагает установку — показываем свою кнопку
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (btn && !isStandalone()) btn.hidden = false;
  });

  if (btn) {
    btn.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      try { await deferredPrompt.userChoice; } catch (e) { /* ignore */ }
      deferredPrompt = null;
      btn.hidden = true;
    });
  }

  // После установки кнопка больше не нужна
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    if (btn) btn.hidden = true;
  });
})();
