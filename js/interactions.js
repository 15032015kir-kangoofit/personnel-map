'use strict';

/* Drawer поста, выбор поста, делегирование кликов карты/табеля/плавающего окна */
const Interactions = (() => {
  // ctx: {mode:'post', postId}
  //    | {mode:'pick', workerId, kind:'add'|'move', from?: postId, back?: postId}
  let ctx = null;

  const el = (id) => document.getElementById(id);

  function open(c) {
    ctx = c;
    render();
    el('drawer').classList.add('open');
    el('backdrop').classList.add('open');
    el('drawer').setAttribute('aria-hidden', 'false');
    el('drawer-close').focus();
  }

  function close() {
    ctx = null;
    el('drawer').classList.remove('open');
    el('backdrop').classList.remove('open');
    el('drawer').setAttribute('aria-hidden', 'true');
  }

  function otherPosts(workerId, postId) {
    return State.postsOf(workerId).filter((id) => id !== postId);
  }

  // Drawer: карточка поста
  function renderPost() {
    const post = State.getPost(ctx.postId);
    if (!post) { close(); return; }
    const st = State.postStatus(post);
    const ws = State.workersAt(post.id);
    el('drawer-title').textContent = 'Пост ' + post.id;
    el('drawer-sub').innerHTML = '<span class="badge st-' + st + '">' + RenderMap.STATUS_TEXT[st] + '</span> · на посту: ' + ws.length;

    let html = '<label class="field"><span class="muted">Примечание к посту</span>'
      + '<input type="text" class="post-note" maxlength="200" placeholder="Примечание к посту" data-dnote="' + U.esc(post.id) + '" value="' + U.esc(post.note || '') + '"></label>';

    if (!ws.length) {
      html += '<p class="muted">Пост свободен — никто не назначен.</p>';
    } else {
      html += '<ul class="dw-list">' + ws.map((w) => {
        const other = otherPosts(w.id, post.id);
        return '<li class="dw-item"><div class="dw-name"><span class="av">' + U.esc(U.initials(w.name)) + '</span>'
          + '<span>' + U.esc(w.name)
          + (other.length ? '<small class="also">также на постах: ' + U.esc(other.join(', ')) + '</small>' : '')
          + '</span></div>'
          + '<div class="dw-btns">'
          + '<button type="button" class="btn" data-act="move" data-worker="' + U.esc(w.id) + '">Сменить пост</button>'
          + '<button type="button" class="btn" data-act="more" data-worker="' + U.esc(w.id) + '">Ещё пост</button>'
          + '<button type="button" class="btn danger" data-act="unassign" data-worker="' + U.esc(w.id) + '">Снять с поста</button>'
          + '</div></li>';
      }).join('') + '</ul>';
    }

    // Добавить на этот пост любого вышедшего рабочего (в т.ч. уже стоящего на другом посту)
    const here = new Set(ws.map((w) => w.id));
    const cand = State.data.workers.filter((w) => State.data.roster[w.id] === 'present' && !here.has(w.id));
    html += '<h3 class="sub-title">Добавить на этот пост</h3>';
    if (cand.length) {
      html += '<div class="chips">' + cand.map((w) => {
        const cur = State.postsOf(w.id);
        return '<button type="button" class="chip" data-act="place-here" data-worker="' + U.esc(w.id) + '">+ ' + U.esc(w.name)
          + '<small class="also">' + (cur.length ? U.esc(cur.join(' + ')) : 'резерв') + '</small></button>';
      }).join('') + '</div>';
    } else {
      html += '<p class="muted">Нет вышедших рабочих, которых можно добавить. Отметьте «Вышел» в табеле.</p>';
    }
    el('drawer-body').innerHTML = html;
  }

  // Drawer: список всех постов для выбора
  function renderPick() {
    const w = State.getWorker(ctx.workerId);
    if (!w || State.data.roster[w.id] !== 'present') { close(); return; }
    const mine = State.postsOf(w.id);
    el('drawer-title').textContent = (ctx.kind === 'move' ? 'Перенести: ' : 'Добавить пост: ') + w.name;
    el('drawer-sub').textContent = 'Сейчас: ' + State.addressOf(w.id)
      + (ctx.kind === 'move' ? ' · пост ' + ctx.from + ' будет заменён' : ' · текущие посты сохранятся');

    let html = ctx.back
      ? '<button type="button" class="btn" data-act="back">← Назад к посту ' + U.esc(ctx.back) + '</button>'
      : '';
    html += '<ul class="pick-list">' + State.data.posts.map((p) => {
      const occ = State.workersAt(p.id);
      const isMine = mine.indexOf(p.id) !== -1;
      const st = State.postStatus(p);
      const info = isMine ? 'уже на этом посту'
        : occ.length ? 'на посту: ' + occ.map((x) => x.name).join(', ') : 'свободен';
      return '<li><button type="button" class="pick-item st-' + st + '" data-pick="' + U.esc(p.id) + '"' + (isMine ? ' disabled' : '') + '>'
        + '<b>' + U.esc(p.id) + '</b><span>' + U.esc(info) + '</span></button></li>';
    }).join('') + '</ul>';
    el('drawer-body').innerHTML = html;
  }

  function render() {
    if (!ctx) return;
    if (ctx.mode === 'pick') renderPick(); else renderPost();
  }

  // Вызывается при любом изменении состояния
  function refresh() { if (ctx) render(); }

  function nameOf(workerId) {
    const w = State.getWorker(workerId);
    return w ? w.name : '';
  }

  function onClick(e) {
    const t = e.target;

    // Пост на карте
    const postBtn = t.closest('#map-root [data-post]');
    if (postBtn) { open({ mode: 'post', postId: postBtn.dataset.post }); return; }

    // Рабочий из резерва -> выбор поста
    const resBtn = t.closest('[data-reserve]');
    if (resBtn) { open({ mode: 'pick', workerId: resBtn.dataset.reserve, kind: 'add' }); return; }

    // Действия внутри drawer
    const act = t.closest('#drawer [data-act]');
    if (act && ctx) {
      const wid = act.dataset.worker;
      switch (act.dataset.act) {
        case 'move':
          open({ mode: 'pick', workerId: wid, kind: 'move', from: ctx.postId, back: ctx.postId });
          break;
        case 'more':
          open({ mode: 'pick', workerId: wid, kind: 'add', back: ctx.postId });
          break;
        case 'unassign':
          if (State.unassign(wid, ctx.postId)) {
            const left = State.postsOf(wid);
            U.toast(nameOf(wid) + (left.length ? ' снят с поста ' + ctx.postId : ' — в резерве'), 'ok');
          }
          break;
        case 'place-here':
          if (State.assign(wid, ctx.postId)) U.toast(nameOf(wid) + ' + ' + ctx.postId, 'ok');
          break;
        case 'back':
          open({ mode: 'post', postId: ctx.back });
          break;
        default:
      }
      return;
    }

    // Выбор поста в списке
    const pick = t.closest('#drawer [data-pick]');
    if (pick && ctx && ctx.mode === 'pick') {
      const wid = ctx.workerId;
      const postId = pick.dataset.pick;
      const done = ctx.kind === 'move' ? State.move(wid, ctx.from, postId) : State.assign(wid, postId);
      if (done) U.toast(nameOf(wid) + ' → ' + postId, 'ok');
      close();
      return;
    }

    // Табель: «Вышел» / «Не вышел»
    const st = t.closest('[data-status]');
    if (st) { State.setStatus(st.dataset.worker, st.dataset.status); return; }

    // Плавающее окно: свернуть / развернуть
    if (t.closest('#float-toggle')) { toggleFloat(); }
  }

  // Примечания к постам (на карте и в drawer) — сохраняем и синхронизируем поля
  function onChange(e) {
    const m = e.target.closest('[data-pnote]');
    const d = e.target.closest('[data-dnote]');
    const id = m ? m.dataset.pnote : d ? d.dataset.dnote : null;
    if (!id) return;
    const input = m || d;
    State.setPostNote(id, input.value);
    const v = (State.getPost(id) || {}).note || '';
    document.querySelectorAll('[data-pnote="' + id + '"], [data-dnote="' + id + '"]').forEach((x) => {
      if (x !== input) x.value = v;
    });
  }

  function toggleFloat(force) {
    const body = el('float-body');
    const open = typeof force === 'boolean' ? force : body.hidden;
    body.hidden = !open;
    el('float-toggle').setAttribute('aria-expanded', open ? 'true' : 'false');
    el('float-arrow').textContent = open ? '▾' : '▸';
  }

  function bind() {
    document.addEventListener('click', onClick);
    document.addEventListener('change', onChange);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && ctx) { close(); return; }
      // Enter в поле примечания — сохранить (снять фокус)
      if (e.key === 'Enter' && e.target.matches && e.target.matches('.post-note, .note-input')) e.target.blur();
    });
    el('backdrop').addEventListener('click', close);
    el('drawer-close').addEventListener('click', close);
  }

  return { open, close, refresh, bind, toggleFloat };
})();
