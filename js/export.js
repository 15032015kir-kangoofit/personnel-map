'use strict';

/* Экспорт: PDF (jsPDF + autotable), Excel (SheetJS) */
const Exporter = (() => {
  // Шрифт с кириллицей для PDF (стандартные шрифты jsPDF её не содержат)
  const FONT_URL = 'https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans.ttf';
  let fontB64 = null;

  const TR = { 'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'e','ж':'zh','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'h','ц':'c','ч':'ch','ш':'sh','щ':'sch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya' };
  // Запасной вариант: транслит, если шрифт не удалось загрузить
  function translit(str) {
    return String(str).replace(/[А-Яа-яЁё]/g, (c) => {
      const t = TR[c.toLowerCase()] || '';
      return c === c.toLowerCase() ? t : (t.charAt(0).toUpperCase() + t.slice(1));
    });
  }

  function bufToB64(buf) {
    const bytes = new Uint8Array(buf);
    let bin = '';
    const CH = 0x8000;
    for (let i = 0; i < bytes.length; i += CH) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    }
    return btoa(bin);
  }

  async function loadFont() {
    if (fontB64) return fontB64;
    const res = await fetch(FONT_URL);
    if (!res.ok) throw new Error('font HTTP ' + res.status);
    fontB64 = bufToB64(await res.arrayBuffer());
    return fontB64;
  }

  function shiftName() { return State.data.meta.shiftType === 'night' ? 'Ночь' : 'День'; }

  // Строки таблицы: ФИО, Статус, Адрес — из актуального состояния
  function rows() {
    const d = State.data;
    return d.workers.map((w) => [w.name, State.statusLabel(d.roster[w.id]), State.addressOf(w.id), w.note || '']);
  }

  async function pdf() {
    const lib = window.jspdf;
    if (!lib || !lib.jsPDF) { U.toast('Библиотека PDF не загружена (нужен интернет)', 'error'); return; }
    const date = State.data.meta.shiftDate;
    try {
      const doc = new lib.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      if (typeof doc.autoTable !== 'function') { U.toast('Плагин таблиц PDF не загружен', 'error'); return; }
      let font = 'helvetica';
      let t = translit;
      try {
        const b64 = await loadFont();
        doc.addFileToVFS('DejaVuSans.ttf', b64);
        doc.addFont('DejaVuSans.ttf', 'DejaVuSans', 'normal');
        font = 'DejaVuSans';
        t = (x) => x;
      } catch (e) {
        U.toast('Шрифт не загружен — текст в PDF будет транслитом', 'warn');
      }
      doc.setFont(font, 'normal');
      doc.setFontSize(15);
      doc.text(t('Табель смены'), 14, 16);
      doc.setFontSize(10);
      doc.text(t('Дата: ' + date + ' · Смена: ' + shiftName()), 14, 23);
      doc.autoTable({
        startY: 28,
        head: [[t('ФИО'), t('Статус'), t('Адрес'), t('Примечание')]],
        body: rows().map((r) => r.map(t)),
        styles: { font: font, fontStyle: 'normal', fontSize: 10, cellPadding: 2.2 },
        headStyles: { fillColor: [31, 111, 235], fontStyle: 'normal' }
      });
      doc.save('Табель_' + date + '_' + shiftName() + '.pdf');
      U.toast('PDF сформирован', 'ok');
    } catch (e) {
      U.toast('Ошибка экспорта PDF', 'error');
    }
  }

  function xlsx() {
    if (!window.XLSX) { U.toast('Библиотека Excel не загружена (нужен интернет)', 'error'); return; }
    try {
      const date = State.data.meta.shiftDate;
      const ws = window.XLSX.utils.aoa_to_sheet([['ФИО', 'Статус', 'Адрес', 'Примечание']].concat(rows()));
      ws['!cols'] = [{ wch: 24 }, { wch: 14 }, { wch: 12 }, { wch: 40 }];
      const wb = window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(wb, ws, 'Табель');
      window.XLSX.writeFile(wb, 'Табель_' + date + '.xlsx');
      U.toast('Excel сформирован', 'ok');
    } catch (e) {
      U.toast('Ошибка экспорта Excel', 'error');
    }
  }

  return { pdf, xlsx };
})();
