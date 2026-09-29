// Recordatorios compartidos entre la app y el service worker.
// La app guarda aquí el calendario de avisos; el service worker lo lee en segundo plano.
// Cada aviso: { key, kind: 'task' | 'odo', at (ms), title, body }

const kv = (() => {
  const open = () => new Promise((resolve, reject) => {
    const req = indexedDB.open('gsxr-garage', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  const run = (mode, fn) => open().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction('kv', mode);
    const req = fn(tx.objectStore('kv'));
    tx.oncomplete = () => { db.close(); resolve(req.result); };
    tx.onerror = tx.onabort = () => { db.close(); reject(tx.error); };
  }));
  return {
    get: (key) => run('readonly', (s) => s.get(key)),
    set: (key, value) => run('readwrite', (s) => s.put(value, key)),
    del: (key) => run('readwrite', (s) => s.delete(key)),
  };
})();

// Devuelve los avisos que ya tocan y aún no se han mostrado, y los marca como mostrados
async function takeDueReminders(now = Date.now()) {
  const [schedule = [], sent = {}] = await Promise.all([kv.get('schedule'), kv.get('sent')]);
  const due = schedule.filter((r) => r.at <= now && !sent[r.key]);
  const keys = new Set(schedule.map((r) => r.key));
  for (const k of Object.keys(sent)) if (!keys.has(k)) delete sent[k];
  for (const r of due) sent[r.key] = now;
  await kv.set('sent', sent);
  return due;
}

// Agrupa los avisos en notificaciones (una para mantenimientos y otra para los km)
function reminderMessages(due) {
  const out = [];
  const tasks = due.filter((r) => r.kind === 'task');
  if (tasks.length === 1) out.push({ tag: 'gsxr-tasks', title: `🔧 ${tasks[0].title}`, body: tasks[0].body });
  else if (tasks.length) out.push({ tag: 'gsxr-tasks', title: `🔧 ${tasks.length} mantenimientos pendientes`, body: tasks.map((r) => r.title).join(', ') });
  const odo = due.find((r) => r.kind === 'odo');
  if (odo) out.push({ tag: 'gsxr-odo', title: odo.title, body: odo.body });
  return out;
}

const NOTIFICATION_DEFAULTS = { icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', data: { url: './' } };
