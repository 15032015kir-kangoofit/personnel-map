'use strict';

/* ---------- Утилиты (общие для всех модулей) ---------- */
const U = {
  // Экранирование HTML
  esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  },
  // Инициалы для аватара: «Иванов И.И.» -> «ИИ»
  initials(name) {
    const p = String(name || '').trim().split(/[\s.]+/).filter(Boolean);
    if (!p.length) return '?';
    return (p[0][0] + (p[1] ? p[1][0] : '')).toUpperCase();
  },
  // Сегодняшняя дата (локальная) в формате YYYY-MM-DD
  todayISO() {
    const d = new Date();
    const z = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate());
  },
  // Метка времени для журнала: ДД.ММ ЧЧ:ММ
  fmtTs(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    const z = (n) => String(n).padStart(2, '0');
    return z(d.getDate()) + '.' + z(d.getMonth() + 1) + ' ' + z(d.getHours()) + ':' + z(d.getMinutes());
  },
  // Toast-уведомление (вместо alert)
  toast(msg, kind) {
    const box = document.getElementById('toasts');
    if (!box) return;
    const t = document.createElement('div');
    t.className = 'toast ' + (kind || 'info');
    t.textContent = msg;
    box.appendChild(t);
    setTimeout(() => {
      t.classList.add('out');
      setTimeout(() => t.remove(), 300);
    }, 2600);
  }
};

/* ---------- Состояние приложения ---------- */
const State = (() => {
  const KEY = 'personnel-map-state-v1';
  const MAX_HISTORY = 500;
  const RESERVE = 'Резерв';
  const DASH = '—';
  const JOIN = ' + ';       // разделитель постов в адресе рабочего
  let s = null;             // текущее состояние
  const listeners = [];

  // Пустое состояние смены на основе seed
  function blank(seed) {
    return {
      meta: { shiftDate: U.todayISO(), shiftType: 'day' },
      posts: seed.posts,
      workers: seed.workers,
      roster: {},          // {workerId: 'present'|'absent'}
      assignments: {},     // {workerId: {postIds: [..], lastPostIds: [..], since}}
      history: []          // [{ts, workerId, name, from, to, action}]
    };
  }

  // Проверка структуры (для localStorage)
  function valid(p) {
    return !!p && typeof p === 'object'
      && p.meta && typeof p.meta === 'object'
      && Array.isArray(p.posts) && p.posts.length > 0
      && Array.isArray(p.workers)
      && p.roster && typeof p.roster === 'object'
      && p.assignments && typeof p.assignments === 'object'
      && Array.isArray(p.history);
  }

  // Приведение старых сохранённых данных к текущей модели:
  // postId -> postIds[] (один рабочий может стоять на нескольких постах), примечания у постов/рабочих
  function migrate() {
    Object.keys(s.assignments).forEach((id) => {
      const a = s.assignments[id];
      if (!a || typeof a !== 'object') { delete s.assignments[id]; return; }
      if (!Array.isArray(a.postIds)) a.postIds = a.postId ? [a.postId] : [];
      if (!Array.isArray(a.lastPostIds)) a.lastPostIds = a.lastPostId ? [a.lastPostId] : [];
      delete a.postId;
      delete a.lastPostId;
    });
    s.posts.forEach((p) => { if (typeof p.note !== 'string') p.note = ''; });
    s.workers.forEach((w) => { if (typeof w.note !== 'string') w.note = ''; });
  }

  // Загрузка: localStorage, а при его отсутствии — data/seed.json
  async function init() {
    let raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { /* хранилище недоступно */ }
    if (raw) {
      try {
        const p = JSON.parse(raw);
        if (valid(p)) { s = p; migrate(); save(); return s; }
      } catch (e) { /* повреждённые данные — начнём заново */ }
    }
    const res = await fetch('data/seed.json');
    if (!res.ok) throw new Error('seed.json: HTTP ' + res.status);
    s = blank(await res.json());
    migrate();
    save();
    return s;
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch (e) {
      if (typeof document !== 'undefined') U.toast('Не удалось сохранить в localStorage', 'error');
    }
  }

  function emit() { listeners.forEach((fn) => fn(s)); }
  function onChange(fn) { listeners.push(fn); }
  function commit() { save(); emit(); }

  function getPost(id) { return s.posts.find((p) => p.id === id) || null; }
  function getWorker(id) { return s.workers.find((w) => w.id === id) || null; }

  // Посты рабочего (только если он отметился «Вышел»)
  function postsOf(workerId) {
    const a = s.assignments[workerId];
    return s.roster[workerId] === 'present' && a ? a.postIds.slice() : [];
  }

  // Рабочие, стоящие на посту
  function workersAt(postId) {
    return s.workers.filter((w) => postsOf(w.id).indexOf(postId) !== -1);
  }

  // Статус поста: free — никого (красный), low — 1 человек (жёлтый), full — 2 и более (зелёный)
  function postStatus(post) {
    const p = typeof post === 'string' ? getPost(post) : post;
    if (!p) return 'free';
    const n = workersAt(p.id).length;
    if (n === 0) return 'free';
    return n === 1 ? 'low' : 'full';
  }

  // Адрес рабочего: «PT-1 + T1-3» / «Резерв» / «—»
  function addressOf(workerId) {
    if (s.roster[workerId] !== 'present') return DASH;
    const ids = postsOf(workerId);
    return ids.length ? ids.join(JOIN) : RESERVE;
  }

  function statusLabel(r) {
    return r === 'present' ? 'Вышел' : r === 'absent' ? 'Не вышел' : 'Не отмечен';
  }

  // Запись в журнал
  function log(action, workerId, from, to, extra) {
    const w = workerId ? getWorker(workerId) : null;
    const entry = Object.assign({
      ts: new Date().toISOString(),
      workerId: workerId || null,
      name: w ? w.name : undefined,   // имя сохраняем: рабочего могут удалить из списка
      from: from == null ? null : from,
      to: to == null ? null : to,
      action
    }, extra || {});
    s.history.push(entry);
    if (s.history.length > MAX_HISTORY) s.history.splice(0, s.history.length - MAX_HISTORY);
  }

  // Табель: «Вышел» / «Не вышел»
  function setStatus(workerId, status) {
    const w = getWorker(workerId);
    if (!w || (status !== 'present' && status !== 'absent')) return;
    if (s.roster[workerId] === status) return;
    const now = new Date().toISOString();

    if (status === 'present') {
      const before = addressOf(workerId);
      s.roster[workerId] = 'present';
      const a = s.assignments[workerId];
      if (!a || !a.postIds.length) {
        // Автоназначение на «домашний» пост, если на нём пока никого нет
        const def = getPost(w.defaultPostId);
        const target = def && workersAt(def.id).length === 0 ? def.id : null;
        s.assignments[workerId] = {
          postIds: target ? [target] : [],
          lastPostIds: target ? [target] : ((a && a.lastPostIds) || []),
          since: now
        };
      }
      log('present', workerId, before, addressOf(workerId));
    } else {
      const before = addressOf(workerId);
      s.roster[workerId] = 'absent';
      delete s.assignments[workerId];
      log('absent', workerId, before, DASH);
    }
    commit();
  }

  function setPosts(workerId, ids) {
    s.assignments[workerId] = { postIds: ids, lastPostIds: ids.slice(), since: new Date().toISOString() };
  }

  // Добавить рабочего на пост (в дополнение к уже занятым — один человек может стоять на нескольких постах)
  function assign(workerId, postId) {
    if (!getWorker(workerId) || !getPost(postId)) return false;
    if (s.roster[workerId] !== 'present') return false;
    const cur = postsOf(workerId);
    if (cur.indexOf(postId) !== -1) return false;
    const before = addressOf(workerId);
    setPosts(workerId, cur.concat(postId));
    log('assign', workerId, before, addressOf(workerId));
    commit();
    return true;
  }

  // Перенести: убрать с поста fromId и поставить на toId (остальные посты рабочего сохраняются)
  function move(workerId, fromId, toId) {
    if (!getWorker(workerId) || !getPost(toId)) return false;
    if (s.roster[workerId] !== 'present') return false;
    const cur = postsOf(workerId);
    if (cur.indexOf(fromId) === -1 || cur.indexOf(toId) !== -1) return false;
    const before = addressOf(workerId);
    setPosts(workerId, cur.map((id) => (id === fromId ? toId : id)));
    log('move', workerId, before, addressOf(workerId));
    commit();
    return true;
  }

  // Снять с поста postId; без postId — со всех постов. Если постов не осталось — рабочий в резерве
  function unassign(workerId, postId) {
    if (s.roster[workerId] !== 'present') return false;
    const cur = postsOf(workerId);
    if (!cur.length) return false;
    if (postId && cur.indexOf(postId) === -1) return false;
    const before = addressOf(workerId);
    setPosts(workerId, postId ? cur.filter((id) => id !== postId) : []);
    log('unassign', workerId, before, addressOf(workerId));
    commit();
    return true;
  }

  function reserveWorkers() {
    return s.workers.filter((w) => addressOf(w.id) === RESERVE);
  }

  function stats() {
    const present = s.workers.filter((w) => s.roster[w.id] === 'present').length;
    const absent = s.workers.filter((w) => s.roster[w.id] === 'absent').length;
    const free = s.posts.filter((p) => postStatus(p) === 'free').length;
    const multi = s.workers.filter((w) => postsOf(w.id).length > 1).length;
    return { present, absent, free, reserve: reserveWorkers().length, multi, total: s.workers.length };
  }

  // Сброс смены: табель и расстановка; журнал и примечания сохраняются
  function resetRoster() {
    s.roster = {};
    s.assignments = {};
    log('reset', null, null, null);
    commit();
  }

  // Параметры смены
  function setMeta(patch) {
    Object.assign(s.meta, patch);
    commit();
  }

  // Сохранение смены = снимок в журнал
  function snapshot() {
    const st = stats();
    log('snapshot', null, null, 'в смене ' + st.present + '/' + st.total, {
      snapshot: {
        meta: Object.assign({}, s.meta),
        roster: Object.assign({}, s.roster),
        assignments: JSON.parse(JSON.stringify(s.assignments))
      }
    });
    commit();
  }

  // Следующий свободный id рабочего: W21, W22, ...
  function nextWorkerId() {
    const ids = new Set(s.workers.map((w) => w.id));
    let n = s.workers.length + 1;
    while (ids.has('W' + String(n).padStart(2, '0'))) n++;
    return 'W' + String(n).padStart(2, '0');
  }

  // Добавить рабочего; «домашний» пост — первый, который не закреплён ни за кем
  function addWorker(name) {
    const clean = String(name || '').trim().slice(0, 60);
    if (!clean) return null;
    const used = new Set(s.workers.map((w) => w.defaultPostId));
    const free = s.posts.find((p) => !used.has(p.id));
    const w = { id: nextWorkerId(), name: clean, defaultPostId: free ? free.id : null, note: '' };
    s.workers.push(w);
    log('add', w.id, null, null);
    commit();
    return w;
  }

  // Удалить рабочих из списка (вместе с табелем и расстановкой)
  function removeWorkers(ids) {
    const set = new Set(ids);
    const gone = s.workers.filter((w) => set.has(w.id));
    if (!gone.length) return 0;
    gone.forEach((w) => log('remove', w.id, addressOf(w.id), null));
    s.workers = s.workers.filter((w) => !set.has(w.id));
    gone.forEach((w) => { delete s.roster[w.id]; delete s.assignments[w.id]; });
    commit();
    return gone.length;
  }

  // Примечание к рабочему / к посту: сохраняем без перерисовки (чтобы не терять фокус в поле)
  function setNote(workerId, text) {
    const w = getWorker(workerId);
    if (!w) return;
    const v = String(text == null ? '' : text).slice(0, 200);
    if ((w.note || '') === v) return;
    w.note = v;
    save();
  }
  function setPostNote(postId, text) {
    const p = getPost(postId);
    if (!p) return;
    const v = String(text == null ? '' : text).slice(0, 200);
    if ((p.note || '') === v) return;
    p.note = v;
    save();
  }

  return {
    get data() { return s; },
    RESERVE, DASH,
    init, save, emit, onChange,
    getPost, getWorker, postsOf, workersAt, postStatus, addressOf, statusLabel,
    setStatus, assign, move, unassign, log, stats, resetRoster,
    reserveWorkers, setMeta, snapshot, addWorker, removeWorkers, setNote, setPostNote
  };
})();
