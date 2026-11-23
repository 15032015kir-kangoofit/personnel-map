'use strict';

/* Цвет темы: светлая / темная / зимняя (со снежинками). Выбор хранится в localStorage.
   Скрипт подключён в <head>, чтобы тема применялась до первой отрисовки (без мигания). */
const Theme = (() => {
  const KEY = 'personnel-map-theme-v1';
  const THEMES = ['light', 'dark', 'winter'];
  const META = { light: '#ffffff', dark: '#1f6feb', winter: '#12304f' };
  const FLAKES = ['❄', '❅', '❆'];
  const COUNT = 36;

  function get() {
    try {
      const v = localStorage.getItem(KEY);
      if (THEMES.indexOf(v) !== -1) return v;
    } catch (e) { /* ignore */ }
    return 'dark';
  }

  // Контейнер со снежинками (создаётся один раз)
  function snowBox() {
    let box = document.getElementById('snow');
    if (!box && document.body) {
      box = document.createElement('div');
      box.id = 'snow';
      box.className = 'snow';
      box.setAttribute('aria-hidden', 'true');
      document.body.appendChild(box);
    }
    return box;
  }

  function buildSnow() {
    const box = snowBox();
    if (!box || box.childElementCount) return;
    for (let i = 0; i < COUNT; i++) {
      const f = document.createElement('span');
      f.className = 'flake';
      f.textContent = FLAKES[i % FLAKES.length];
      f.style.left = (Math.random() * 100).toFixed(1) + '%';
      f.style.fontSize = (10 + Math.random() * 14).toFixed(0) + 'px';
      f.style.opacity = (0.35 + Math.random() * 0.55).toFixed(2);
      f.style.animationDuration = (9 + Math.random() * 11).toFixed(1) + 's';
      f.style.animationDelay = (-Math.random() * 18).toFixed(1) + 's';
      f.style.setProperty('--dx', ((Math.random() * 120) - 60).toFixed(0) + 'px');
      box.appendChild(f);
    }
  }

  function markButtons(t) {
    document.querySelectorAll('[data-theme-set]').forEach((b) => {
      const on = b.dataset.themeSet === t;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function apply(t) {
    document.documentElement.setAttribute('data-theme', t);
    const m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', META[t]);
    if (t === 'winter') buildSnow();
    markButtons(t);
  }

  function set(t) {
    if (THEMES.indexOf(t) === -1) return;
    try { localStorage.setItem(KEY, t); } catch (e) { /* ignore */ }
    apply(t);
  }

  // Привязка кнопок «Цвет темы» в настройках
  function bind() {
    const box = document.getElementById('theme-toggle');
    if (!box) return;
    box.addEventListener('click', (e) => {
      const b = e.target.closest('[data-theme-set]');
      if (b) set(b.dataset.themeSet);
    });
    markButtons(get());
  }

  // Применяем сразу (атрибут на <html>), остальное — когда документ готов
  document.documentElement.setAttribute('data-theme', get());
  document.addEventListener('DOMContentLoaded', () => apply(get()));

  return { get, set, apply, bind };
})();
