// Rutas: grabación con el GPS del móvil, cálculos (distancia, tiempo en marcha, velocidades),
// importación/exportación GPX y mapa (Leaflet + teselas de OpenStreetMap).
// No depende de la interfaz: app.js la usa.
//
// Una ruta se guarda como tramos (se corta al pausar): [[[lat, lon, t], ...], ...]
// con t en segundos desde el inicio de la ruta.

const Geo = (() => {
  const R = 6371008.8;
  const rad = (d) => (d * Math.PI) / 180;
  const round = (n, dec) => Math.round(n * 10 ** dec) / 10 ** dec;

  // Distancia en metros entre dos puntos [lat, lon, ...]
  function distance(a, b) {
    const dLat = rad(b[0] - a[0]);
    const dLon = rad(b[1] - a[1]);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  const MOVING = 3 / 3.6; // por debajo de 3 km/h se considera parado
  const MAX_SPEED = 92; // m/s (≈ 330 km/h): por encima es un salto del GPS

  // Distancia (m), tiempo en marcha (s) y velocidad máxima (m/s) de una ruta.
  // La máxima se calcula sobre tramos de al menos 100 m para no dar picos falsos.
  function stats(segments) {
    let dist = 0;
    let moving = 0;
    let max = 0;
    for (const seg of segments) {
      const cum = [0];
      for (let i = 1; i < seg.length; i++) {
        const d = distance(seg[i - 1], seg[i]);
        const dt = seg[i][2] - seg[i - 1][2];
        cum.push(cum[i - 1] + d);
        if (dt > 0 && d / dt >= MOVING) moving += dt;
      }
      dist += cum[cum.length - 1] || 0;
      for (let i = 0, j = 0; i < seg.length; i++) {
        if (j < i) j = i;
        while (j < seg.length - 1 && cum[j] - cum[i] < 100) j++;
        const d = cum[j] - cum[i];
        const dt = seg[j][2] - seg[i][2];
        if (d >= 100 && dt > 0 && d / dt < MAX_SPEED) max = Math.max(max, d / dt);
      }
    }
    return { dist, moving, max };
  }

  const pointCount = (segments) => segments.reduce((n, s) => n + s.length, 0);

  return { distance, stats, pointCount, round, MAX_SPEED };
})();

// Graba una ruta con watchPosition. Filtra el ruido del GPS: descarta posiciones poco
// precisas, saltos imposibles y el "baile" de la posición cuando la moto está parada.
class RouteRecorder {
  constructor({ onUpdate, onError }) {
    this.onUpdate = onUpdate;
    this.onError = onError;
    this.watchId = null;
    this.wakeLock = null;
    this.onVisible = () => { if (document.visibilityState === 'visible' && this.watchId !== null) this.lockScreen(); };
  }

  // resume: estado guardado de una ruta a medias (snapshot())
  start(resume) {
    const now = Date.now();
    Object.assign(this, resume
      ? { ...resume, segments: resume.segments.concat([[]]), paused: false, pausedMs: resume.pausedMs + (resume.paused ? now - resume.pauseStart : 0) }
      : { startedAt: now, segments: [[]], paused: false, pausedMs: 0, pauseStart: 0, maxSpeed: 0 });
    this.current = null;
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => this.onPosition(pos),
      (err) => this.onError(err),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 },
    );
    this.lockScreen();
    document.addEventListener('visibilitychange', this.onVisible);
  }

  async lockScreen() {
    try { if ('wakeLock' in navigator && !this.wakeLock) { this.wakeLock = await navigator.wakeLock.request('screen'); this.wakeLock.addEventListener('release', () => { this.wakeLock = null; }); } } catch (e) { /* no disponible */ }
  }

  onPosition(pos) {
    const c = pos.coords;
    const speed = c.speed !== null && c.speed >= 0 ? c.speed : null;
    this.current = { speed, accuracy: c.accuracy, lat: c.latitude, lon: c.longitude };
    if (this.paused || c.accuracy > 35) return this.onUpdate(this);

    const p = [Geo.round(c.latitude, 6), Geo.round(c.longitude, 6), Geo.round((pos.timestamp - this.startedAt) / 1000, 1)];
    const seg = this.segments[this.segments.length - 1];
    const last = seg[seg.length - 1];
    if (last) {
      const d = Geo.distance(last, p);
      const dt = p[2] - last[2];
      if (dt <= 0 || d / dt > Geo.MAX_SPEED) return this.onUpdate(this);
      const stopped = speed !== null && speed < 1 && d < 25;
      if (stopped || d < Math.max(8, c.accuracy * 0.5)) return this.onUpdate(this);
      if (speed === null) this.current.speed = d / dt;
    }
    seg.push(p);
    if (this.current.speed !== null && this.current.speed < Geo.MAX_SPEED) this.maxSpeed = Math.max(this.maxSpeed, this.current.speed);
    this.onUpdate(this, true);
  }

  pause() {
    if (this.paused) return;
    this.paused = true;
    this.pauseStart = Date.now();
  }

  resume() {
    if (!this.paused) return;
    this.pausedMs += Date.now() - this.pauseStart;
    this.paused = false;
    this.segments.push([]);
  }

  elapsed() {
    const now = Date.now();
    return (now - this.startedAt - this.pausedMs - (this.paused ? now - this.pauseStart : 0)) / 1000;
  }

  snapshot() {
    const { startedAt, segments, paused, pausedMs, pauseStart, maxSpeed } = this;
    return { startedAt, segments: segments.filter((s) => s.length), paused, pausedMs, pauseStart, maxSpeed };
  }

  stop() {
    if (this.watchId !== null) navigator.geolocation.clearWatch(this.watchId);
    this.watchId = null;
    document.removeEventListener('visibilitychange', this.onVisible);
    if (this.wakeLock) this.wakeLock.release().catch(() => {});
    this.wakeLock = null;
    if (this.paused) this.resume();
    return this.snapshot();
  }
}

// GPX (formato estándar de las apps de rutas)
const GPX = {
  parse(text) {
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error('GPX no válido');
    const toPoint = (el) => {
      const time = el.getElementsByTagName('time')[0];
      return [Number(el.getAttribute('lat')), Number(el.getAttribute('lon')), time ? Date.parse(time.textContent) : NaN];
    };
    let raw = [...doc.getElementsByTagName('trkseg')].map((s) => [...s.getElementsByTagName('trkpt')].map(toPoint));
    if (!raw.some((s) => s.length)) raw = [[...doc.getElementsByTagName('trkpt'), ...doc.getElementsByTagName('rtept')].map(toPoint)];
    raw = raw.map((s) => s.filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]))).filter((s) => s.length > 1);
    if (!raw.length) throw new Error('El GPX no tiene puntos');
    const times = raw.flat().map((p) => p[2]).filter(Number.isFinite);
    const hasTime = times.length > 1;
    const t0 = hasTime ? Math.min(...times) : Date.now();
    // Se quitan puntos a menos de 5 m del anterior: el GPX suele traer uno por segundo
    const segments = raw.map((s) => s.reduce((out, p, i) => {
      const q = [Geo.round(p[0], 6), Geo.round(p[1], 6), hasTime && Number.isFinite(p[2]) ? Geo.round((p[2] - t0) / 1000, 1) : i];
      if (!out.length || Geo.distance(out[out.length - 1], q) >= 5 || i === s.length - 1) out.push(q);
      return out;
    }, []));
    const nameEl = doc.querySelector('trk > name') || doc.querySelector('metadata > name');
    return { name: nameEl ? nameEl.textContent.trim() : '', startedAt: t0, hasTime, segments };
  },

  build(route, segments) {
    const esc = (s) => String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
    const iso = (t) => new Date(route.startedAt + t * 1000).toISOString();
    const segs = segments.map((s) => `    <trkseg>\n${s.map((p) => `      <trkpt lat="${p[0]}" lon="${p[1]}"><time>${iso(p[2])}</time></trkpt>`).join('\n')}\n    </trkseg>`).join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Garage" xmlns="http://www.topografix.com/GPX/1/1">\n  <trk>\n    <name>${esc(route.name)}</name>\n${segs}\n  </trk>\n</gpx>\n`;
  },
};

// Mapa: Leaflet se carga sólo cuando hace falta
const RouteMap = {
  loading: null,
  load() {
    if (window.L) return Promise.resolve();
    if (this.loading) return this.loading;
    const base = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/';
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = base + 'leaflet.min.css';
    css.crossOrigin = 'anonymous'; // en modo CORS el service worker puede guardarla para usarla sin conexión
    document.head.append(css);
    this.loading = new Promise((resolve, reject) => {
      const js = document.createElement('script');
      js.src = base + 'leaflet.min.js';
      js.crossOrigin = 'anonymous';
      js.onload = resolve;
      js.onerror = () => { this.loading = null; reject(new Error('No se pudo cargar el mapa')); };
      document.head.append(js);
    });
    return this.loading;
  },

  create(el) {
    const map = L.map(el, { zoomControl: false, attributionControl: true }).setView([40.4, -3.7], 6);
    // Teselas de OpenStreetMap (se oscurecen por CSS para que encajen con la app)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      className: 'map-tiles',
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    map.routeLayer = L.layerGroup().addTo(map);
    return map;
  },

  // Dibuja la ruta; con fit ajusta el zoom para verla entera
  draw(map, segments, { color = '#4d8dff', fit = false, markers = true } = {}) {
    map.routeLayer.clearLayers();
    const lines = segments.filter((s) => s.length).map((s) => s.map((p) => [p[0], p[1]]));
    if (!lines.length) return;
    const line = L.polyline(lines, { color, weight: 5, opacity: 0.95 }).addTo(map.routeLayer);
    if (markers) {
      const first = lines[0][0];
      const lastSeg = lines[lines.length - 1];
      const last = lastSeg[lastSeg.length - 1];
      L.circleMarker(first, { radius: 7, color: '#fff', weight: 2, fillColor: '#22c55e', fillOpacity: 1 }).addTo(map.routeLayer);
      L.circleMarker(last, { radius: 7, color: '#fff', weight: 2, fillColor: '#ef4444', fillOpacity: 1 }).addTo(map.routeLayer);
    }
    if (fit) map.fitBounds(line.getBounds(), { padding: [24, 24], maxZoom: 16 });
  },
};
