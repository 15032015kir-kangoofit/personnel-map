'use strict';

/* Точка входа: инициализация состояния, вкладки, кнопки, перерисовка */
(function () {
  const $ = (id) => document.getElementById(id);
  let activeTab = 'map';

  // Полная перерисовка всех представлений
  function renderAll() {
    RenderMap.render();
    RenderRoster.render();
    RenderRoster.renderFloat();
    RenderRoster.renderSettings();
    Interactions.refresh();
  }

  // Переключение вкладок
  function showTab(name) {
    activeTab = name;
    document.querySelectorAll('.tab-btn').forEach((b) => {
      const on = b.dataset.tab === name;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    document.querySelectorAll('.tab').forEach((s) => {
      const on = s.id === 'tab-' + name;
      s.classList.toggle('active', on);
      s.hidden = !on;
    });
    // Плавающее окно — только поверх карты
    $('float').hidden = name !== 'map';
    Interactions.close();
  }

  function bindTabs() {
    document.querySelectorAll('.tab-btn').forEach((b) => {
      b.addEventListener('click', () => showTab(b.dataset.tab));
    });
  }

  // Переключатель «Вид: Список / Схема»
  function bindViewToggle() {
    $('view-toggle').addEventListener('click', (e) => {
      const b = e.target.closest('[data-view]');
      if (!b) return;
      RenderMap.setView(b.dataset.view);
      RenderMap.render();
    });
  }

  // Кнопки экспорта, сохранения, сброса, импорта; поля настроек
  function bindActions() {
    $('btn-pdf').addEventListener('click', () => Exporter.pdf());
    $('btn-xlsx').addEventListener('click', () => Exporter.xlsx());
    $('btn-save').addEventListener('click', () => {
      State.snapshot();
      U.toast('Смена сохранена', 'ok');
    });

    // Заглушки: функции в разработке
    $('btn-import-xlsx').addEventListener('click', () => U.toast('Импорт Excel — функция в разработке'));
    $('btn-archive').addEventListener('click', () => U.toast('Архив смен — функция в разработке'));

    // Добавление / удаление рабочих (под таблицей табеля)
    $('btn-add').addEventListener('click', () => RenderRoster.setMode('add'));
    $('btn-del').addEventListener('click', () => RenderRoster.setMode('delete'));

    const tab = $('tab-roster');
    function addWorker() {
      const inp = $('new-name');
      const w = State.addWorker(inp ? inp.value : '');
      if (!w) { U.toast('Введите ФИО рабочего', 'error'); if (inp) inp.focus(); return; }
      RenderRoster.exitMode();
      RenderRoster.render();
      U.toast('Добавлен: ' + w.name, 'ok');
    }
    tab.addEventListener('click', (e) => {
      const b = e.target.closest('[data-rp]');
      if (!b) return;
      const act = b.dataset.rp;
      if (act === 'cancel') { RenderRoster.setMode(null); return; }
      if (act === 'add-ok') { addWorker(); return; }
      if (act === 'del-ok') {
        const n = State.removeWorkers(RenderRoster.selectedIds());
        RenderRoster.exitMode();
        RenderRoster.render();
        U.toast(n ? 'Удалено рабочих: ' + n : 'Никто не выбран', n ? 'ok' : 'warn');
      }
    });
    tab.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.id === 'new-name') { e.preventDefault(); addWorker(); }
    });
    tab.addEventListener('change', (e) => {
      const sel = e.target.closest('[data-sel]');
      if (sel) { RenderRoster.toggleSelect(sel.dataset.sel, sel.checked); return; }
      const note = e.target.closest('[data-note]');
      if (note) State.setNote(note.dataset.note, note.value);
    });

    // Сброс смены: двойное нажатие вместо confirm()/alert()
    const resetBtn = $('btn-reset');
    let armed = null;
    resetBtn.addEventListener('click', () => {
      if (!armed) {
        resetBtn.textContent = 'Нажмите ещё раз для сброса';
        armed = setTimeout(() => { armed = null; resetBtn.textContent = 'Сбросить смену'; }, 3000);
        return;
      }
      clearTimeout(armed);
      armed = null;
      resetBtn.textContent = 'Сбросить смену';
      State.resetRoster();
      U.toast('Смена сброшена', 'ok');
    });

    $('set-date').addEventListener('change', (e) => {
      if (e.target.value) State.setMeta({ shiftDate: e.target.value });
    });
    $('set-type').addEventListener('change', (e) => State.setMeta({ shiftType: e.target.value }));
  }

  async function start() {
    try {
      await State.init();
    } catch (e) {
      U.toast('Не удалось загрузить данные (data/seed.json). Запустите через веб-сервер.', 'error');
      return;
    }
    bindTabs();
    Theme.bind();
    bindViewToggle();
    bindActions();
    Interactions.bind();
    State.onChange(renderAll);
    showTab(activeTab);
    renderAll();
  }

  start();
})();
