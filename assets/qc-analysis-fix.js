/* Al-Israa QC Manager 4.0.3 — isolated analysis-series patch */
(function () {
  'use strict';
  const DB = 'alisraa-qc-manager-v4';
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let database;

  // The main app owns schema creation. This reader opens the same version only
  // after the app script has started; it never performs a competing upgrade.
  function openDB() {
    if (database) return Promise.resolve(database);
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB, 1);
      request.onsuccess = () => {
        database = request.result;
        database.onversionchange = () => database.close();
        resolve(database);
      };
      request.onerror = () => reject(request.error || new Error('IndexedDB open failed'));
      request.onblocked = () => reject(new Error('IndexedDB open blocked; close other app tabs and reload'));
    });
  }

  function read(store) {
    return openDB().then(db => new Promise((resolve, reject) => {
      if (!db.objectStoreNames.contains(store)) return reject(new Error('Missing IndexedDB store: ' + store));
      const request = db.transaction(store, 'readonly').objectStore(store).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error || new Error('IndexedDB read failed: ' + store));
    }));
  }

  function cv(values) {
    if (values.length < 2) return null;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    if (!Number.isFinite(mean) || mean === 0) return null;
    const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
    return Math.sqrt(variance) / Math.abs(mean) * 100;
  }

  function draw(points) {
    const canvas = $('#lj');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height, pad = 55, mid = h / 2, scale = (h - 2 * pad) / 6;
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = '#dce5ef'; ctx.lineWidth = 1;
    for (let z = -3; z <= 3; z++) {
      const y = mid - z * scale;
      ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(w - 20, y); ctx.stroke();
      ctx.fillStyle = '#60758e'; ctx.font = '16px sans-serif';
      ctx.fillText((z > 0 ? '+' : '') + z + 'SD', 8, y + 5);
    }
    if (!points.length) {
      ctx.fillStyle = '#687b94'; ctx.font = '18px sans-serif';
      ctx.fillText('لا توجد نقاط لهذه السلسلة المحددة', pad, mid);
      return;
    }
    const step = (w - 2 * pad) / Math.max(points.length - 1, 1);
    ctx.strokeStyle = '#245a96'; ctx.lineWidth = 2; ctx.beginPath();
    points.forEach((p, i) => {
      const x = pad + i * step, y = mid - Math.max(-3.5, Math.min(3.5, p.z)) * scale;
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    });
    ctx.stroke();
    points.forEach((p, i) => {
      const x = pad + i * step, y = mid - Math.max(-3.5, Math.min(3.5, p.z)) * scale;
      ctx.fillStyle = Math.abs(p.z) >= 3 ? '#b42318' : Math.abs(p.z) >= 2 ? '#b7791f' : '#245a96';
      ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
    });
  }

  async function renderStrict() {
    const ids = ['ana-device', 'ana-analyte', 'ana-lot', 'ana-level', 'ana-kind'];
    if (ids.some(id => !$('#' + id))) return;
    const deviceId = $('#ana-device').value;
    const analyte = $('#ana-analyte').value;
    const lot = $('#ana-lot').value;
    const level = $('#ana-level').value;
    const kind = $('#ana-kind').value;
    if (!deviceId || !analyte || !lot || !level || !kind) {
      $('#series-stats').innerHTML = '<p class="notice">لمنع خلط سلاسل QC، اختر جهازاً واحداً وتحليلاً واحداً وLOT واحداً ومستوى واحداً ونوع هدف واحداً.</p>';
      $('#history-list').innerHTML = '<p class="empty">أكمل محددات السلسلة لعرض السجل.</p>';
      draw([]);
      return;
    }

    const [runs, targets] = await Promise.all([read('runs'), read('targets')]);
    const targetById = new Map(targets.map(target => [target.id, target]));
    const rows = [];
    for (const run of runs) {
      if (run.deviceId !== deviceId || run.analyte !== analyte || run.lot !== lot) continue;
      for (const measurement of (run.measurements || [])) {
        const target = targetById.get(measurement.targetId);
        if (!target) continue;
        // Match the persisted target identity, not just display labels.
        if (target.deviceId !== deviceId || target.analyte !== analyte || target.lot !== lot ||
            target.level !== level || target.kind !== kind || measurement.level !== level) continue;
        const value = Number(measurement.value), z = Number(measurement.z);
        if (!Number.isFinite(value) || !Number.isFinite(z)) continue;
        rows.push({ ...measurement, value, z, runAt: run.runAt, status: run.evaluation?.status || '—' });
      }
    }
    rows.sort((a, b) => String(a.runAt).localeCompare(String(b.runAt)));
    const values = rows.map(row => row.value);
    const mean = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
    const meanZ = rows.length ? rows.reduce((sum, row) => sum + row.z, 0) / rows.length : null;
    const seriesCV = cv(values);
    $('#series-stats').innerHTML = `<p>عدد النقاط: <b>${rows.length}</b> · متوسط Z: <b>${meanZ === null ? '—' : meanZ.toFixed(3)}</b> · متوسط القراءة: <b>${mean === null ? '—' : mean.toFixed(4)}</b> · CV السلسلة: <b>${seriesCV === null ? 'غير متاح (يلزم نقطتان على الأقل ومتوسط غير صفري)' : seriesCV.toFixed(2) + '%'}</b></p><p class="muted">CV السلسلة محسوب من القراءات المسجلة باستخدام الانحراف المعياري للعينة؛ لا يفسر وحده قبول الأداء أو رفضه. لا يُعد بديلاً عن CV الهدف أو حدود الشركة المصنعة.</p>`;
    draw(rows);
    $('#history-list').innerHTML = rows.slice().reverse().map(row => `<div class="tablewrap"><table><tbody><tr><th>التاريخ</th><td>${esc(new Date(row.runAt).toLocaleString('ar-IQ'))}</td><th>القراءة</th><td>${row.value}</td><th>Z</th><td>${row.z.toFixed(2)}</td><th>التقييم</th><td>${esc(row.status)}</td></tr></tbody></table></div>`).join('') || '<p class="empty">لا توجد نقاط لهذه السلسلة المحددة.</p>';
  }

  function install() {
    const device = $('#ana-device'), analyte = $('#ana-analyte'), lot = $('#ana-lot'), level = $('#ana-level');
    if (!device || !analyte || !lot || !level) return false;
    if (!$('#ana-kind')) {
      const label = document.createElement('label');
      label.textContent = 'نوع الهدف';
      const kind = document.createElement('select');
      kind.id = 'ana-kind';
      kind.innerHTML = '<option value="">اختر نوع الهدف</option><option value="manufacturer">الشركة المصنعة</option><option value="lab">المختبر</option>';
      label.appendChild(kind);
      level.parentElement.insertAdjacentElement('afterend', label);
    }
    const kind = $('#ana-kind');
    [device, analyte, lot, level, kind].forEach(element => {
      if (element.dataset.strictAnalysisBound === '1') return;
      element.dataset.strictAnalysisBound = '1';
      element.addEventListener('change', () => { renderStrict().catch(error => console.error('QC strict analysis:', error)); });
    });
    const runResult = $('#run-result');
    if (runResult && !runResult.dataset.cvLabelObserver) {
      runResult.dataset.cvLabelObserver = '1';
      new MutationObserver(() => {
        runResult.querySelectorAll('p').forEach(p => {
          if (p.textContent.includes('CV=')) p.textContent = p.textContent.replace(/CV=/g, 'CV الهدف (نظري)=');
        });
      }).observe(runResult, { childList: true, subtree: true });
    }
    renderStrict().catch(error => console.error('QC strict analysis:', error));
    return true;
  }

  const observer = new MutationObserver(() => { if (install()) observer.disconnect(); });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      if (!install()) observer.observe(document.body, { childList: true, subtree: true });
    }, { once: true });
  } else if (!install()) {
    observer.observe(document.body, { childList: true, subtree: true });
  }
})();
