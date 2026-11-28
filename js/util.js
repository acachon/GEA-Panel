/* Utilidades comunes del panel GEA */
(function (root) {
  const G = (root.GEA = root.GEA || {});
  const pad = n => String(n).padStart(2, '0');
  G.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  G.dayKey = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  G.parseDay = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  G.addDays = (k, n) => { const d = G.parseDay(k); d.setDate(d.getDate() + n); return G.dayKey(d); };
  G.hhmm = t => { const d = new Date(t); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  G.fmtMin = m => { m = Math.round(m || 0); const h = Math.floor(m / 60); return h ? h + ' h ' + pad(m % 60) + ' m' : (m % 60) + ' m'; };
  G.fmtNum = (n, dec = 1) => (n == null || isNaN(n)) ? '—' : Number(n).toLocaleString('es-ES', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  const DS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const MS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  G.diaCorto = k => { const d = G.parseDay(k); return DS[d.getDay()].slice(0, 3) + ' ' + d.getDate(); };
  G.diaLargo = k => { const d = G.parseDay(k); return DS[d.getDay()] + ' ' + d.getDate() + ' de ' + MS[d.getMonth()]; };
  // Solo se enlazan adjuntos alojados en Google (los enlaces vienen de una hoja que puede editarse a mano)
  G.urlSegura = u => /^https:\/\/(drive|docs)\.google\.com\//.test(u || '') ? u : '';
  // ID de un archivo de Drive a partir de su enlace (…/file/d/ID/… o …?id=ID)
  G.driveId = u => { const m = String(u || '').match(/\/d\/([\w-]{20,})/) || String(u || '').match(/[?&]id=([\w-]{20,})/); return m ? m[1] : ''; };
  const PAL = ['#b0155a', '#7a3fc0', '#1f7a31', '#1f5fb5', '#4b5563', '#c2410c', '#0e7490', '#a16207'];
  G.colorEmp = (lista, nombre) => PAL[Math.max(0, lista.indexOf(nombre)) % PAL.length];
  G.inicial = n => (String(n || '?').trim()[0] || '?').toUpperCase();
})(typeof window !== 'undefined' ? window : globalThis);
