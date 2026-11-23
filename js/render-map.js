'use strict';

/* Отрисовка вкладки «Карта»: дашборд, резерв, список / схема постов */
const RenderMap = (() => {
  const VIEW_KEY = 'personnel-map-view-v1';
  const GROUP_TITLES = {
    PT: 'Зона PT', T1: 'Зона T1', C1: 'Зона C1',
    T2: 'Зона T2', C2: 'Зона C2', F: 'Зона F'
  };
  // free — простой (красный), low — 1 человек (жёлтый), full — 2 и более (зелёный)
  const STATUS_TEXT = { free: 'Простой', low: 'Укомплектован', full: 'Укомплектован' };
  const STATUS_HINT = { free: '0 чел.', low: '1 чел.', full: '2 и более' };

  // Выбранный вид: из localStorage, иначе по ширине экрана
  function getView() {
    let v = null;
    try { v = localStorage.getItem(VIEW_KEY); } catch (e) { /* ignore */ }
    if (v === 'list' || v === 'scheme') return v;
    return window.matchMedia('(min-width: 768px)').matches ? 'scheme' : 'list';
  }
  function setView(v) {
    try { localStorage.setItem(VIEW_KEY, v); } catch (e) { /* ignore */ }
  }

  // Группы постов в порядке линии (порядок первого появления)
  function groups() {
    const order = [];
    const map = {};
    State.data.posts.forEach((p) => {
      if (!map[p.group]) { map[p.group] = []; order.push(p.group); }
      map[p.group].push(p);
    });
    return order.map((g) => ({ group: g, title: GROUP_TITLES[g] || ('Зона ' + g), posts: map[g] }));
  }

  // Счётчики сверху
  function renderDashboard() {
    const st = State.stats();
    const items = [
      ['В смене', st.present, 'full'],
      ['Отсутствуют', st.absent, 'free'],
      ['Простой', st.free, 'free'],
      ['В резерве', st.reserve, 'info'],
      ['На нескольких постах', st.multi, 'info']
    ];
    document.getElementById('dashboard').innerHTML = items.map(([label, n, kind]) =>
      '<div class="dash-card ' + kind + '"><div class="dash-n">' + n + '</div><div class="dash-l">' + label + '</div></div>'
    ).join('');
  }

  // Рабочие в резерве (можно назначить на пост)
  function renderReserve() {
    const list = State.reserveWorkers();
    const box = document.getElementById('reserve');
    if (!list.length) { box.innerHTML = ''; return; }
    box.innerHTML = '<div class="reserve"><div class="muted">В резерве — нажмите, чтобы назначить на пост:</div>'
      + '<div class="chips">'
      + list.map((w) => '<button type="button" class="chip" data-reserve="' + U.esc(w.id) + '">'
        + '<span class="av sm">' + U.esc(U.initials(w.name)) + '</span>' + U.esc(w.name) + '</button>').join('')
      + '</div></div>';
  }

  // Другие посты рабочего (кроме текущего) — для пометки совмещения
  function otherPosts(workerId, postId) {
    return State.postsOf(workerId).filter((id) => id !== postId);
  }

  // Режим «Список»: ФИО через запятую; совмещающие помечены «также: …»
  function namesHtml(post) {
    const ws = State.workersAt(post.id);
    if (!ws.length) return '—';
    return ws.map((w) => {
      const other = otherPosts(w.id, post.id);
      return '<span class="wk' + (other.length ? ' multi' : '') + '">' + U.esc(w.name)
        + (other.length ? ' <small class="also">также: ' + U.esc(other.join(', ')) + '</small>' : '')
        + '</span>';
    }).join(', ');
  }

  function noteInput(post) {
    return '<input type="text" class="post-note" maxlength="200" placeholder="Примечание к посту" '
      + 'aria-label="Примечание к посту ' + U.esc(post.id) + '" data-pnote="' + U.esc(post.id) + '" value="' + U.esc(post.note || '') + '">';
  }

  function listHtml() {
    return groups().map((g) =>
      '<section class="zone"><h3 class="zone-title">' + U.esc(g.title) + '</h3>'
      + g.posts.map((p) => {
        const st = State.postStatus(p);
        return '<div class="post-row st-' + st + '">'
          + '<button type="button" class="post-main" data-post="' + U.esc(p.id) + '">'
          + '<span class="pid">' + U.esc(p.id) + '</span>'
          + '<span class="names">' + namesHtml(p) + '</span>'
          + '<span class="badge st-' + st + '">' + STATUS_TEXT[st] + '</span>'
          + '</button>'
          + noteInput(p)
          + '</div>';
      }).join('')
      + '</section>'
    ).join('');
  }

  // Режим «Схема»: аватар + ПОЛНОЕ ФИО каждого рабочего
  function workerRow(w, postId) {
    const other = otherPosts(w.id, postId);
    const count = State.postsOf(w.id).length;
    return '<div class="wrow' + (other.length ? ' multi' : '') + '">'
      + '<span class="av" title="' + U.esc(w.name) + '">' + U.esc(U.initials(w.name))
      + (count > 1 ? '<i class="cnt" title="Постов: ' + count + '">' + count + '</i>' : '') + '</span>'
      + '<span class="wname">' + U.esc(w.name)
      + (other.length ? '<small class="also">также: ' + U.esc(other.join(', ')) + '</small>' : '')
      + '</span></div>';
  }

  function schemeHtml() {
    return groups().map((g) =>
      '<section class="zone"><h3 class="zone-title">' + U.esc(g.title) + '</h3>'
      + '<div class="tiles">'
      + g.posts.map((p) => {
        const st = State.postStatus(p);
        const ws = State.workersAt(p.id);
        return '<div class="tile st-' + st + '">'
          + '<button type="button" class="tile-main" data-post="' + U.esc(p.id) + '">'
          + '<span class="tile-h"><b>' + U.esc(p.id) + '</b><span class="dot st-' + st + '"></span></span>'
          + '<span class="wlist">'
          + (ws.length ? ws.map((w) => workerRow(w, p.id)).join('') : '<span class="empty">—</span>')
          + '</span>'
          + '<span class="tile-f">' + STATUS_TEXT[st] + '</span>'
          + '</button>'
          + noteInput(p)
          + '</div>';
      }).join('')
      + '</div></section>'
    ).join('');
  }

  function renderViewToggle() {
    const v = getView();
    document.querySelectorAll('#view-toggle [data-view]').forEach((b) => {
      const on = b.dataset.view === v;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function renderMap() {
    const root = document.getElementById('map-root');
    root.className = 'map-' + getView();
    root.innerHTML = getView() === 'scheme' ? schemeHtml() : listHtml();
  }

  function render() {
    renderDashboard();
    renderViewToggle();
    renderReserve();
    renderMap();
  }

  return { render, getView, setView, STATUS_TEXT, STATUS_HINT };
})();
