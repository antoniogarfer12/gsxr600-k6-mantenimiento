/* GSX-R Garage — lógica de la aplicación */
(() => {
  'use strict';

  const STORAGE_KEY = 'gsxr600k6-garage-v1';
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  // ---------- Estado ----------
  let state = load();
  let planFilter = 'all';

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        return { odometer: Number(data.odometer) || 0, entries: Array.isArray(data.entries) ? data.entries : [] };
      }
    } catch (e) { /* datos corruptos o almacenamiento bloqueado */ }
    return { odometer: 0, entries: [] };
  }
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch (e) { toast('No se pudo guardar en este navegador'); }
  }

  // ---------- Utilidades ----------
  const fmtKm = (n) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const parseDate = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
  const fmtDate = (iso) => { const d = parseDate(iso); return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
  const todayISO = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
  const addMonths = (iso, months) => { const d = parseDate(iso); d.setMonth(d.getMonth() + months); return d; };
  const daysBetween = (a, b) => Math.round((b - a) / 86400000);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const catColor = (t) => CATEGORIES[t.category].color;

  function fmtDays(days) {
    const abs = Math.abs(days);
    if (abs < 45) return `${abs} día${abs === 1 ? '' : 's'}`;
    const m = Math.round(abs / 30.4);
    return `${m} mes${m === 1 ? '' : 'es'}`;
  }
  function intervalText(t) {
    const parts = [];
    if (t.km) parts.push(`${fmtKm(t.km)} km`);
    if (t.months) parts.push(t.months % 12 === 0 ? `${t.months / 12} año${t.months === 12 ? '' : 's'}` : `${t.months} meses`);
    return 'Cada ' + parts.join(' o ');
  }

  function currentKm() {
    const maxEntry = state.entries.reduce((m, e) => Math.max(m, Number(e.km) || 0), 0);
    return Math.max(state.odometer || 0, maxEntry);
  }

  // Última vez que se hizo una tarea (incluye tareas que la "resetean")
  function lastDone(taskId) {
    const resetters = TASKS.filter((t) => t.resets && t.resets.includes(taskId)).map((t) => t.id);
    let best = null;
    for (const e of state.entries) {
      if (e.tasks.includes(taskId) || e.tasks.some((id) => resetters.includes(id))) {
        if (!best || e.km > best.km || (e.km === best.km && e.date > best.date)) best = e;
      }
    }
    return best;
  }

  // Calcula el estado de una tarea
  function statusOf(t) {
    const km = currentKm();
    const last = lastDone(t.id);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const s = { task: t, last, known: !!last, nextKm: null, remainingKm: null, nextDate: null, remainingDays: null, progress: 0, score: 1 };
    const ratios = [];

    if (t.km) {
      if (last) {
        s.nextKm = Number(last.km) + t.km;
      } else {
        const first = t.first || t.km;
        s.nextKm = km < first ? first : Math.ceil(km / t.km) * t.km;
      }
      s.remainingKm = s.nextKm - km;
      ratios.push(s.remainingKm / t.km);
    }
    if (t.months) {
      if (last) {
        s.nextDate = addMonths(last.date, t.months);
        s.remainingDays = daysBetween(today, s.nextDate);
        ratios.push(s.remainingDays / (t.months * 30.4));
      }
    }

    if (ratios.length) {
      s.score = Math.min(...ratios);
      s.progress = Math.max(0, Math.min(1, 1 - s.score));
    } else {
      s.score = 0.25; // sólo por tiempo y sin registro: pedir que se registre
    }

    const kmSoon = s.remainingKm !== null && s.remainingKm <= Math.max(500, t.km * 0.1);
    const daySoon = s.remainingDays !== null && s.remainingDays <= 30;
    if ((s.remainingKm !== null && s.remainingKm < 0) || (s.remainingDays !== null && s.remainingDays < 0)) s.level = 'overdue';
    else if (kmSoon || daySoon) s.level = 'soon';
    else if (!ratios.length) s.level = 'unknown';
    else s.level = 'ok';
    return s;
  }

  const allStatuses = () => TASKS.map(statusOf).sort((a, b) => a.score - b.score);

  function dueText(s) {
    const parts = [];
    if (s.remainingKm !== null) {
      parts.push(s.remainingKm < 0 ? `Pasado ${fmtKm(-s.remainingKm)} km` : `En ${fmtKm(s.remainingKm)} km`);
    }
    if (s.remainingDays !== null) {
      parts.push(s.remainingDays < 0 ? `vencido hace ${fmtDays(s.remainingDays)}` : `en ${fmtDays(s.remainingDays)}`);
    }
    return parts.join(' · ');
  }

  // ---------- Render: Inicio ----------
  function renderHome() {
    const list = allStatuses();
    const top = list[0];

    // Tarjeta principal
    const hero = $('#heroCard');
    if (!state.entries.length && !state.odometer) {
      hero.innerHTML = `
        <div class="empty-hero">
          <div class="empty-icon">🏍️</div>
          <h3>¡Bienvenido al garaje!</h3>
          <p class="muted">Empieza indicando los kilómetros actuales de tu GSX-R y registrando los últimos mantenimientos que recuerdes. Con eso calcularé todo lo que toca.</p>
          <div class="row" style="justify-content:center;margin-top:14px">
            <button class="btn btn-primary" data-action="odometer">Poner kilómetros</button>
            <button class="btn" data-action="new-entry">Registrar mantenimiento</button>
          </div>
        </div>`;
    } else {
      const t = top.task;
      const kicker = top.level === 'overdue' ? '⚠ Mantenimiento vencido' : top.level === 'soon' ? 'Toca pronto' : 'Próximo mantenimiento';
      let big;
      if (top.remainingKm !== null && (top.remainingDays === null || top.remainingKm / t.km <= top.remainingDays / (t.months * 30.4))) {
        big = top.remainingKm < 0
          ? `<div class="hero-km">+${fmtKm(-top.remainingKm)} <small>km pasado</small></div>`
          : `<div class="hero-km">${fmtKm(top.remainingKm)} <small>km restantes</small></div>`;
      } else if (top.remainingDays !== null) {
        big = `<div class="hero-km">${fmtDays(top.remainingDays)} <small>${top.remainingDays < 0 ? 'de retraso' : 'restantes'}</small></div>`;
      } else {
        big = `<div class="hero-km" style="font-size:2rem">Sin registro</div>`;
      }
      const meta = [];
      if (top.nextKm !== null) meta.push(`A los ${fmtKm(top.nextKm)} km`);
      if (top.nextDate) meta.push(`${top.remainingDays < 0 ? 'vencía el' : 'antes del'} ${fmtDate(top.nextDate.toISOString().slice(0, 10))}`);
      if (!top.known) meta.push('estimado según plan del fabricante');

      // Otras tareas que coinciden (aprovechar el mismo día)
      const also = list.slice(1).filter((s) =>
        ['overdue', 'soon'].includes(s.level) || (top.nextKm !== null && s.nextKm !== null && Math.abs(s.nextKm - top.nextKm) <= 500));

      hero.innerHTML = `
        <div class="hero ${top.level === 'overdue' ? 'overdue' : top.level === 'soon' ? 'soon' : ''}">
          <div class="hero-kicker">${kicker}</div>
          <div class="hero-title">${esc(t.name)}</div>
          ${big}
          <div class="hero-meta">${meta.join(' · ')}</div>
          ${also.length ? `<div class="hero-also">Aprovecha y haz también: <b>${also.slice(0, 4).map((s) => esc(s.task.name)).join(', ')}</b>${also.length > 4 ? '…' : ''}</div>` : ''}
          <div class="hero-actions">
            <button class="btn" data-guide="${t.id}">📘 Cómo hacerlo</button>
            <button class="btn btn-ghost" data-action="new-entry" data-preset="${t.id}">✓ Ya lo he hecho</button>
          </div>
        </div>`;
    }

    // Contadores
    const count = (lvl) => list.filter((s) => s.level === lvl).length;
    $('#stats').innerHTML = `
      <div class="stat overdue"><b>${count('overdue')}</b><span>Vencidos</span></div>
      <div class="stat soon"><b>${count('soon')}</b><span>Próximos</span></div>
      <div class="stat ok"><b>${count('ok')}</b><span>Al día</span></div>`;

    $('#upcoming').innerHTML = list.slice(0, 8).map(taskRow).join('');
  }

  function taskRow(s) {
    const t = s.task;
    let right;
    if (s.remainingKm !== null) {
      right = `<div class="task-left">${s.remainingKm < 0 ? '−' : ''}${fmtKm(Math.abs(s.remainingKm))} <small>km</small></div>
               <div class="task-when">${s.remainingKm < 0 ? 'pasado' : `a los ${fmtKm(s.nextKm)}`}</div>`;
    } else if (s.remainingDays !== null) {
      right = `<div class="task-left">${fmtDays(s.remainingDays)}</div><div class="task-when">${s.remainingDays < 0 ? 'de retraso' : 'restantes'}</div>`;
    } else {
      right = `<div class="task-left" style="font-size:1rem">—</div><div class="task-when">sin registro</div>`;
    }
    const tag = s.level === 'overdue' ? '<span class="tag overdue">Vencido</span>'
      : s.level === 'soon' ? '<span class="tag soon">Pronto</span>'
      : !s.known ? '<span class="tag">Estimado</span>' : '';
    const lastTxt = s.last ? `Último: ${fmtKm(s.last.km)} km · ${fmtDate(s.last.date)}` : 'Sin registrar todavía';
    return `
      <button class="task ${s.level}" data-guide="${t.id}">
        <span class="task-bar"></span>
        <span class="task-main">
          <span class="task-name"><span class="cat-dot" style="background:${catColor(t)}"></span>${esc(t.name)} ${tag}</span>
          <span class="task-sub" style="display:block">${intervalText(t)} · ${lastTxt}</span>
          ${s.remainingKm !== null || s.remainingDays !== null ? `<span class="progress" style="display:block"><i style="width:${Math.round(s.progress * 100)}%"></i></span>` : ''}
        </span>
        <span class="task-right">${right}</span>
      </button>`;
  }

  // ---------- Render: Historial ----------
  function renderHistory() {
    const entries = [...state.entries].sort((a, b) => b.km - a.km || b.date.localeCompare(a.date));
    if (!entries.length) {
      $('#historyList').innerHTML = `
        <div class="empty"><div class="empty-icon">🛠️</div>
          <p>Aún no hay mantenimientos registrados.</p>
          <p class="muted">Registra lo que hayas hecho indicando los kilómetros y te diré qué es lo siguiente.</p>
          <button class="btn btn-primary" data-action="new-entry">+ Registrar el primero</button>
        </div>`;
      return;
    }
    const total = entries.reduce((s, e) => s + (Number(e.cost) || 0), 0);
    $('#historyList').innerHTML =
      (total ? `<p class="muted">${entries.length} registros · Gasto total: <b style="color:var(--text)">${total.toFixed(2).replace('.', ',')} €</b></p>` : '') +
      entries.map((e) => `
        <article class="entry">
          <div class="entry-head">
            <div>
              <div class="entry-km">${fmtKm(e.km)} <small>km</small></div>
              <div class="entry-date">${fmtDate(e.date)}${e.cost ? ` · <span class="entry-cost">${Number(e.cost).toFixed(2).replace('.', ',')} €</span>` : ''}</div>
            </div>
            <div class="entry-actions">
              <button class="icon-btn" data-edit="${e.id}" title="Editar">✎</button>
              <button class="icon-btn" data-delete="${e.id}" title="Eliminar">🗑</button>
            </div>
          </div>
          <div class="entry-tasks">
            ${e.tasks.filter((id) => TASK_MAP[id]).map((id) => `<span class="entry-task" data-guide="${id}"><span class="cat-dot" style="background:${catColor(TASK_MAP[id])}"></span>${esc(TASK_MAP[id].name)}</span>`).join('')}
          </div>
          ${e.notes ? `<div class="entry-notes">${esc(e.notes)}</div>` : ''}
        </article>`).join('');
  }

  // ---------- Render: Plan ----------
  function renderPlan() {
    const filters = [['all', 'Todas', null], ...Object.entries(CATEGORIES).map(([k, c]) => [k, c.label, c.color])];
    $('#planFilters').innerHTML = filters.map(([k, label, color]) =>
      `<button class="chip ${planFilter === k ? 'active' : ''}" data-filter="${k}">${color ? `<span class="cat-dot" style="background:${color}"></span>` : ''}${label}</button>`).join('');
    const list = TASKS.filter((t) => planFilter === 'all' || t.category === planFilter).map(statusOf);
    $('#planList').innerHTML = list.map(taskRow).join('');
  }

  // ---------- Render: Ficha ----------
  function renderSpecs() {
    $('#specsList').innerHTML = BIKE.specs.map((s) => `<div><dt>${esc(s.label)}</dt><dd>${esc(s.value)}</dd></div>`).join('');
    renderTorques('');
  }
  function renderTorques(q) {
    const seen = new Map();
    for (const t of TASKS) for (const tq of t.torques) {
      const key = tq.part.toLowerCase();
      if (!seen.has(key)) seen.set(key, { ...tq, task: t });
    }
    const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const rows = [...seen.values()]
      .filter((r) => !q || norm(r.part).includes(norm(q)) || norm(r.task.name).includes(norm(q)))
      .sort((a, b) => a.part.localeCompare(b.part, 'es'));
    $('#torqueTable').innerHTML = `<tr><th>Pieza</th><th style="text-align:right">Par</th></tr>` +
      (rows.length ? rows.map((r) => `<tr><td>${esc(r.part)}${r.note ? `<span class="torque-note">${esc(r.note)}</span>` : ''}</td><td><span class="nm">${String(r.nm).replace('.', ',')}</span> <small class="muted">N·m</small></td></tr>`).join('')
        : `<tr><td colspan="2" class="muted">Sin resultados</td></tr>`);
  }

  function renderAll() {
    $('#odoValue').textContent = fmtKm(currentKm());
    renderHome();
    renderHistory();
    renderPlan();
  }

  // ---------- Modal ----------
  function openModal(html) {
    $('#modalBody').innerHTML = html;
    $('#modal').classList.add('open');
    $('#modal').setAttribute('aria-hidden', 'false');
    $('.modal-sheet').scrollTop = 0;
    document.body.style.overflow = 'hidden';
  }
  function closeModal() {
    $('#modal').classList.remove('open');
    $('#modal').setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  // Guía de una tarea
  function openGuide(id) {
    const t = TASK_MAP[id];
    if (!t) return;
    const s = statusOf(t);
    const dots = Array.from({ length: 5 }, (_, i) => `<i class="${i < t.difficulty ? 'on' : ''}"></i>`).join('');
    const lastTxt = s.last ? `${fmtKm(s.last.km)} km` : '—';
    const lastSub = s.last ? fmtDate(s.last.date) : 'sin registro';
    let nextTxt = '—', nextSub = '';
    if (s.nextKm !== null) { nextTxt = `${fmtKm(s.nextKm)} km`; nextSub = dueText(s); }
    else if (s.nextDate) { nextTxt = fmtDate(s.nextDate.toISOString().slice(0, 10)); nextSub = dueText(s); }
    else if (t.months) { nextSub = 'Registra la última vez que lo hiciste'; }

    openModal(`
      <div class="hero-kicker" style="color:${catColor(t)}">${CATEGORIES[t.category].label}</div>
      <h2>${esc(t.name)}</h2>
      <div class="guide-badges">
        <span class="badge">🔁 ${intervalText(t)}${t.first ? ` (1ª a los ${fmtKm(t.first)} km)` : ''}</span>
        <span class="badge">⏱ ${esc(t.duration)}</span>
        <span class="badge difficulty">Dificultad ${dots}</span>
      </div>
      <div class="status-box ${s.level}">
        <div><span>Última vez</span><b>${lastTxt}</b><div class="hint">${lastSub}</div></div>
        <div><span>Próxima</span><b>${nextTxt}</b><div class="hint">${esc(nextSub)}${!s.known && s.nextKm !== null ? ' (estimado)' : ''}</div></div>
      </div>

      ${t.torques.length ? `
      <div class="guide-section">
        <h3>🎯 Pares de apriete</h3>
        <div class="torque-card"><table class="torque-table">
          ${t.torques.map((r) => `<tr><td>${esc(r.part)}${r.note ? `<span class="torque-note">${esc(r.note)}</span>` : ''}</td><td><span class="nm">${String(r.nm).replace('.', ',')}</span> <small class="muted">N·m</small></td></tr>`).join('')}
        </table></div>
      </div>` : ''}

      <div class="guide-section">
        <h3>🔧 Herramientas</h3>
        <ul class="tool-list">${t.tools.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      </div>

      ${t.parts.length ? `
      <div class="guide-section">
        <h3>📦 Recambios y consumibles</h3>
        <ul class="tool-list parts">${t.parts.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      </div>` : ''}

      <div class="guide-section">
        <h3>📋 Paso a paso <span class="hint" style="text-transform:none;letter-spacing:0;font-family:var(--sans)">(toca un paso para marcarlo)</span></h3>
        <ol class="steps">${t.steps.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>
      </div>

      ${t.tips ? `<div class="guide-section"><div class="tip">💡 ${esc(t.tips)}</div></div>` : ''}

      <div class="guide-footer">
        <button class="btn btn-primary btn-block" data-action="new-entry" data-preset="${t.id}">✓ Marcar como hecho</button>
      </div>
    `);
  }

  // Formulario de registro (nuevo o edición)
  function openEntryForm(entry, preset = []) {
    const editing = !!entry;
    const e = entry || { date: todayISO(), km: currentKm() || '', tasks: preset, notes: '', cost: '' };
    const statuses = Object.fromEntries(TASKS.map((t) => [t.id, statusOf(t)]));
    const groups = Object.entries(CATEGORIES).map(([key, c]) => {
      const tasks = TASKS.filter((t) => t.category === key);
      return `
        <div class="picker-group">
          <h4><span class="cat-dot" style="background:${c.color}"></span>${c.label}</h4>
          <div class="picker-items">
            ${tasks.map((t) => {
              const due = ['overdue', 'soon'].includes(statuses[t.id].level);
              return `<label class="pick"><input type="checkbox" name="tasks" value="${t.id}" ${e.tasks.includes(t.id) ? 'checked' : ''} /><span class="${due ? 'due' : ''}">${esc(t.name)}</span></label>`;
            }).join('')}
          </div>
        </div>`;
    }).join('');

    openModal(`
      <h2>${editing ? 'Editar registro' : 'Registrar mantenimiento'}</h2>
      <p class="muted">Indica los kilómetros a los que lo hiciste y marca todo lo realizado. Las tareas con borde naranja son las que tocan ahora.</p>
      <form class="form" id="entryForm" novalidate>
        <div class="two">
          <div class="field"><label for="fKm">Kilómetros</label><input id="fKm" type="number" inputmode="numeric" min="0" step="1" value="${esc(e.km)}" required placeholder="ej. 24500" /></div>
          <div class="field"><label for="fDate">Fecha</label><input id="fDate" type="date" value="${esc(e.date)}" max="${todayISO()}" required /></div>
        </div>
        <div class="field">
          <label>Trabajos realizados</label>
          <div class="task-picker">${groups}</div>
        </div>
        <div class="two">
          <div class="field"><label for="fCost">Coste (€)</label><input id="fCost" type="number" inputmode="decimal" min="0" step="0.01" value="${esc(e.cost)}" placeholder="opcional" /></div>
          <div class="field"><label>&nbsp;</label><div class="hint">Recambios, aceite, taller…</div></div>
        </div>
        <div class="field"><label for="fNotes">Notas</label><textarea id="fNotes" placeholder="Marca del aceite, pastillas usadas, observaciones…">${esc(e.notes)}</textarea></div>
        <div class="error" id="formError"></div>
        <button type="submit" class="btn btn-primary btn-block">${editing ? 'Guardar cambios' : 'Guardar mantenimiento'}</button>
      </form>
    `);

    $('#entryForm').addEventListener('submit', (ev) => {
      ev.preventDefault();
      const km = parseInt($('#fKm').value, 10);
      const date = $('#fDate').value;
      const tasks = $$('input[name="tasks"]:checked').map((i) => i.value);
      const err = $('#formError');
      if (!Number.isFinite(km) || km < 0) return (err.textContent = 'Introduce los kilómetros del mantenimiento.');
      if (!date) return (err.textContent = 'Introduce la fecha.');
      if (!tasks.length) return (err.textContent = 'Marca al menos un trabajo realizado.');

      const data = { id: editing ? e.id : uid(), km, date, tasks, cost: $('#fCost').value ? Number($('#fCost').value) : '', notes: $('#fNotes').value.trim() };
      if (editing) state.entries = state.entries.map((x) => (x.id === e.id ? data : x));
      else state.entries.push(data);
      if (km > state.odometer) state.odometer = km;
      save();
      closeModal();
      renderAll();

      const next = allStatuses()[0];
      const nextMsg = next.remainingKm !== null && next.remainingKm >= 0
        ? `Próximo: ${next.task.name} en ${fmtKm(next.remainingKm)} km`
        : `Próximo: ${next.task.name}`;
      toast(`✓ Guardado. ${nextMsg}`);
    });
  }

  function openOdometer() {
    const maxEntry = state.entries.reduce((m, e) => Math.max(m, Number(e.km) || 0), 0);
    openModal(`
      <h2>Kilómetros actuales</h2>
      <p class="muted">Actualiza el cuentakilómetros cada vez que cojas la moto para que los avisos sean precisos.</p>
      <form class="form" id="odoForm" novalidate>
        <div class="field"><label for="fOdo">Cuentakilómetros</label>
          <input id="fOdo" type="number" inputmode="numeric" min="0" step="1" value="${currentKm() || ''}" placeholder="ej. 32150" style="font-size:1.6rem;font-family:var(--display);font-weight:700" autofocus />
        </div>
        <div class="error" id="odoError"></div>
        <button class="btn btn-primary btn-block" type="submit">Guardar</button>
      </form>`);
    const input = $('#fOdo');
    setTimeout(() => input.select(), 50);
    $('#odoForm').addEventListener('submit', (ev) => {
      ev.preventDefault();
      const v = parseInt(input.value, 10);
      if (!Number.isFinite(v) || v < 0) return ($('#odoError').textContent = 'Introduce un número válido.');
      if (v < maxEntry) return ($('#odoError').textContent = `Tienes un mantenimiento registrado a ${fmtKm(maxEntry)} km; el cuentakilómetros no puede ser menor.`);
      state.odometer = v;
      save();
      closeModal();
      renderAll();
      toast('Kilómetros actualizados');
    });
  }

  let toastTimer;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
  }

  function showView(name) {
    $$('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${name}`));
    $$('.tab').forEach((t) => t.classList.toggle('active', t.dataset.view === name));
    window.scrollTo({ top: 0 });
    try { sessionStorage.setItem('gsxr-view', name); } catch (e) { /* ignorar */ }
  }

  // ---------- Eventos ----------
  document.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-guide],[data-action],[data-edit],[data-delete],[data-filter],[data-view],[data-close],.steps li');
    if (!el) return;

    if (el.matches('.steps li')) return el.classList.toggle('done');
    if (el.hasAttribute('data-close')) return closeModal();
    if (el.dataset.view) return showView(el.dataset.view);
    if (el.dataset.filter) { planFilter = el.dataset.filter; return renderPlan(); }
    if (el.dataset.guide) return openGuide(el.dataset.guide);
    if (el.dataset.edit) return openEntryForm(state.entries.find((e) => e.id === el.dataset.edit));
    if (el.dataset.delete) {
      const e = state.entries.find((x) => x.id === el.dataset.delete);
      if (e && confirm(`¿Eliminar el registro de los ${fmtKm(e.km)} km?`)) {
        state.entries = state.entries.filter((x) => x.id !== e.id);
        save(); renderAll(); toast('Registro eliminado');
      }
      return;
    }
    if (el.dataset.action === 'new-entry') return openEntryForm(null, el.dataset.preset ? el.dataset.preset.split(',') : []);
    if (el.dataset.action === 'odometer') return openOdometer();
  });

  $('#odoBtn').addEventListener('click', openOdometer);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
  $('#torqueSearch').addEventListener('input', (e) => renderTorques(e.target.value.trim()));

  // Copia de seguridad
  $('#exportBtn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ app: 'gsxr600k6-garage', version: 1, exported: new Date().toISOString(), ...state }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `gsxr600k6-mantenimiento-${todayISO()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  $('#importInput').addEventListener('change', async (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.entries)) throw new Error('formato');
      const entries = data.entries
        .filter((e) => e && Number.isFinite(Number(e.km)) && /^\d{4}-\d{2}-\d{2}$/.test(e.date) && Array.isArray(e.tasks))
        .map((e) => ({ id: e.id || uid(), km: Number(e.km), date: e.date, tasks: e.tasks.filter((id) => TASK_MAP[id]), cost: e.cost ?? '', notes: String(e.notes || '') }));
      if (!confirm(`Se importarán ${entries.length} registros y se reemplazarán los datos actuales. ¿Continuar?`)) return;
      state = { odometer: Number(data.odometer) || 0, entries };
      save(); renderAll(); toast('Datos importados');
    } catch (e) {
      toast('El archivo no es una copia válida');
    } finally {
      ev.target.value = '';
    }
  });
  $('#resetBtn').addEventListener('click', () => {
    if (confirm('¿Borrar TODO el historial y los kilómetros? Esta acción no se puede deshacer.')) {
      state = { odometer: 0, entries: [] };
      save(); renderAll(); toast('Datos borrados');
    }
  });

  // ---------- Inicio ----------
  renderSpecs();
  renderAll();
  try { const v = sessionStorage.getItem('gsxr-view'); if (v) showView(v); } catch (e) { /* ignorar */ }

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
