'use strict';

/* Табель смены, плавающее окно, настройки и журнал */
const RenderRoster = (() => {
  const ACTION_TEXT = {
    present: 'Вышел', absent: 'Не вышел', assign: 'Назначен',
    unassign: 'Снят с поста', move: 'Перенесён', snapshot: 'Снимок смены', reset: 'Сброс смены',
    add: 'Добавлен', remove: 'Удалён'
  };

  // Состояние интерфейса табеля (не хранится): режим «Добавить» / «Удалить»
  let mode = null;            // null | 'add' | 'delete'
  const selected = new Set(); // id рабочих, отмеченных на удаление

  // Таблица табеля (на мобильном CSS превращает строки в карточки)
  function render() {
    const d = State.data;
    // Удалённых рабочих убираем из выбора
    Array.from(selected).forEach((id) => { if (!State.getWorker(id)) selected.delete(id); });
    const del = mode === 'delete';
    const rows = d.workers.map((w) => {
      const r = d.roster[w.id];
      const posts = State.postsOf(w.id);
      const addr = State.addressOf(w.id);
      // Адрес: чипы постов; при совмещении — пометка «×N»
      const addrHtml = posts.length
        ? posts.map((p) => '<span class="addr post">' + U.esc(p) + '</span>').join('')
          + (posts.length > 1 ? '<span class="multi-badge" title="Рабочий стоит на нескольких постах">×' + posts.length + '</span>' : '')
        : '<span class="addr ' + (addr === State.RESERVE ? 'reserve' : 'none') + '">' + U.esc(addr) + '</span>';
      const name = del
        ? '<label class="sel"><input type="checkbox" data-sel="' + U.esc(w.id) + '"' + (selected.has(w.id) ? ' checked' : '') + '><span>' + U.esc(w.name) + '</span></label>'
        : U.esc(w.name);
      return '<tr class="' + (r === 'absent' ? 'is-absent' : '') + '">'
        + '<td class="w-name">' + name + '</td>'
        + '<td class="w-addr"><div class="addr-list">' + addrHtml + '</div></td>'
        + '<td class="w-act"><div class="act-group">'
        + '<button type="button" class="btn-st present' + (r === 'present' ? ' on' : '') + '" data-status="present" data-worker="' + U.esc(w.id) + '">Вышел</button>'
        + '<button type="button" class="btn-st absent' + (r === 'absent' ? ' on' : '') + '" data-status="absent" data-worker="' + U.esc(w.id) + '">Не вышел</button>'
        + '</div></td>'
        + '<td class="w-note"><input type="text" class="note-input" maxlength="200" placeholder="Примечание" aria-label="Примечание: ' + U.esc(w.name) + '" data-note="' + U.esc(w.id) + '" value="' + U.esc(w.note || '') + '"></td>'
        + '</tr>';
    }).join('');
    document.getElementById('roster-root').innerHTML =
      '<table class="roster"><thead><tr><th>ФИО</th><th>Адрес</th><th>Действия</th><th>Примечание</th></tr></thead><tbody>' + rows + '</tbody></table>';
    renderPanel();
  }

  // Панель под таблицей: форма добавления или подтверждение удаления
  function renderPanel() {
    const box = document.getElementById('roster-panel');
    document.getElementById('btn-add').classList.toggle('active', mode === 'add');
    document.getElementById('btn-del').classList.toggle('active', mode === 'delete');
    if (mode === 'add') {
      box.innerHTML = '<div class="card panel">'
        + '<label for="new-name" class="muted">ФИО нового рабочего</label>'
        + '<div class="panel-row">'
        + '<input type="text" id="new-name" maxlength="60" placeholder="Например: Орлов А.А." autocomplete="off">'
        + '<button type="button" class="btn primary" data-rp="add-ok">Добавить</button>'
        + '<button type="button" class="btn" data-rp="cancel">Отмена</button>'
        + '</div></div>';
    } else if (mode === 'delete') {
      box.innerHTML = '<div class="card panel">'
        + '<div class="muted">Отметьте рабочих в таблице, затем нажмите «Удалить выбранных».</div>'
        + '<div class="panel-row">'
        + '<button type="button" class="btn danger" data-rp="del-ok"' + (selected.size ? '' : ' disabled') + '>Удалить выбранных (' + selected.size + ')</button>'
        + '<button type="button" class="btn" data-rp="cancel">Отмена</button>'
        + '</div></div>';
    } else {
      box.innerHTML = '';
    }
  }

  // Переключение режима (повторное нажатие на ту же кнопку — выход из режима)
  function setMode(next) {
    mode = mode === next ? null : next;
    selected.clear();
    render();
    if (mode === 'add') {
      const inp = document.getElementById('new-name');
      if (inp) inp.focus();
    }
  }

  function toggleSelect(id, on) {
    if (on) selected.add(id); else selected.delete(id);
    renderPanel();
  }

  function selectedIds() { return Array.from(selected); }

  // Выйти из режима и перерисовать (после добавления/удаления перерисовка идёт из State)
  function exitMode() {
    mode = null;
    selected.clear();
  }

  // Плавающее окно: «ФИО — пост»
  function renderFloat() {
    const d = State.data;
    const st = State.stats();
    document.getElementById('float-title').textContent = 'Табель · Присутствуют: ' + st.present + '/' + st.total;
    document.getElementById('float-body').innerHTML = d.workers.map((w) => {
      const a = State.addressOf(w.id);
      const cls = d.roster[w.id] === 'present' ? '' : ' dim';
      return '<div class="float-row' + cls + '"><span>' + U.esc(w.name) + '</span><b>' + U.esc(a) + '</b></div>';
    }).join('');
  }

  function workerName(h) {
    const w = h.workerId ? State.getWorker(h.workerId) : null;
    return h.name || (w ? w.name : 'Смена');
  }

  // Настройки: значения полей и журнал (последние 50)
  function renderSettings() {
    const d = State.data;
    const date = document.getElementById('set-date');
    const type = document.getElementById('set-type');
    if (document.activeElement !== date) date.value = d.meta.shiftDate || '';
    if (document.activeElement !== type) type.value = d.meta.shiftType || 'day';

    const items = d.history.slice(-50).reverse();
    document.getElementById('history-root').innerHTML = items.length
      ? '<ul class="history">' + items.map((h) =>
        '<li><time>' + U.esc(U.fmtTs(h.ts)) + '</time> <b>' + U.esc(workerName(h)) + '</b> '
        + (h.from != null || h.to != null
          ? '<span class="muted">' + U.esc(h.from == null ? '—' : h.from) + ' → ' + U.esc(h.to == null ? '—' : h.to) + '</span> '
          : '')
        + '<span class="act-tag">' + U.esc(ACTION_TEXT[h.action] || h.action) + '</span></li>'
      ).join('') + '</ul>'
      : '<p class="muted">Записей пока нет.</p>';
  }

  return { render, renderPanel, renderFloat, renderSettings, setMode, toggleSelect, selectedIds, exitMode };
})();
