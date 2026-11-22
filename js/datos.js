/* Proceso de los datos del Registro central: labores, duraciones, jornadas, horas extra y estado de cada empleado. */
(function (root) {
  const G = root.GEA;

  // Labores de la app. El color identifica la labor en todo el panel.
  const LABORES = [
    { k: 'recoleccion', n: 'Recolección', c: '#7a3fc0', rx: /recol/ },
    { k: 'poda', n: 'Poda', c: '#1f7a31', rx: /poda/ },
    { k: 'riego', n: 'Riego', c: '#1f5fb5', rx: /riego/ },
    { k: 'suelos', n: 'Preparación de suelos', c: '#8a5a1e', rx: /suelo|prepar/ },
    { k: 'tractor', n: 'Tractor', c: '#4b5563', rx: /tractor/ },
    { k: 'reparacion', n: 'Reparación', c: '#b0155a', rx: /^repar/ },
    { k: 'almuerzo', n: 'Almuerzo', c: '#c9a227', rx: /almuerzo|comida/, pausa: true },
    { k: 'otros', n: 'Otros', c: '#9a5b00', rx: /^otro/ }
  ];
  const JORNADA = { k: 'jornada', n: 'Inicio Jornada', c: '#0f4d2a', jornada: true };
  G.LABORES = LABORES;
  G.labor = nombre => {
    const s = String(nombre || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
    if (/jornada/.test(s)) return JORNADA;
    return LABORES.find(l => l.rx.test(s)) || { k: 'otros', n: nombre || 'Otros', c: '#9a5b00' };
  };

  // raw = { actividades, incidencias, puntos } tal como los entrega el servicio
  G.construir = function (raw, cfg) {
    const vistos = {};
    const acts = raw.actividades.filter(a => (cfg.prueba || !a.prueba) && !vistos[a.id] && (vistos[a.id] = 1))
      .map(a => Object.assign({}, a, { t: new Date(a.iso).getTime(), L: G.labor(a.actividad), dia: G.dayKey(new Date(a.iso)) }))
      .filter(a => !isNaN(a.t)).sort((x, y) => x.t - y.t);
    const ids = {}; acts.forEach(a => { ids[a.id] = a; });
    const pts = new Map(), vp = {};
    raw.puntos.forEach(p => {
      if (!ids[p[0]] || p[2] == null || p[3] == null) return;
      const k = p[0] + '|' + p[1]; if (vp[k]) return; vp[k] = 1;
      if (!pts.has(p[0])) pts.set(p[0], []);
      pts.get(p[0]).push({ t: p[1] * 1000, lat: p[2], lon: p[3], p: p[4] });
    });
    pts.forEach(l => l.sort((a, b) => a.t - b.t));
    acts.forEach(a => {
      const l = pts.get(a.id), ultimo = l && l.length ? l[l.length - 1].t : a.t;
      // Con «Min activa» (si el servicio la devuelve) la duración es exacta; si no, se estima con el último punto GPS
      const trans = a.activa != null ? a.activa + (a.pausa || 0) : Math.max(0, (ultimo - a.t) / 60000);
      a.trans = trans; a.trab = Math.max(0, trans - (a.pausa || 0)); a.fin = a.t + trans * 60000;
      a.exacta = a.activa != null;
    });
    const vi = {};
    const inc = raw.incidencias.filter(i => (cfg.prueba || !i.prueba) && !vi[i.id] && (vi[i.id] = 1))
      .map(i => Object.assign({}, i, { t: new Date(i.iso).getTime(), dia: G.dayKey(new Date(i.iso)) })).filter(i => !isNaN(i.t)).sort((a, b) => b.t - a.t);
    const empleados = Array.from(new Set(acts.map(a => a.nombre).concat(inc.map(i => i.nombre)))).filter(Boolean).sort((a, b) => a.localeCompare(b, 'es'));
    return { acts, pts, inc, empleados, hayPrueba: acts.some(a => a.prueba) || inc.some(i => i.prueba) };
  };

  // Minutos de [a, b] que caen a partir de la hora de fin de jornada (por defecto 17:00) del día de a
  function extraMin(a, b, finHora) {
    const [h, m] = (finHora || '17:00').split(':').map(Number), d = new Date(a);
    const corte = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m).getTime();
    return Math.max(0, (b - Math.max(a, corte)) / 60000);
  }

  // Una jornada por empleado y día: horas trabajadas, extra, desglose por labor, km y ha
  G.jornadas = function (D, cfg, f) {
    f = f || {}; const mapa = new Map();
    D.acts.forEach(a => {
      if (f.emp && a.nombre !== f.emp) return;
      const k = a.nombre + '|' + a.dia;
      if (!mapa.has(k)) mapa.set(k, { emp: a.nombre, dia: a.dia, ini: a.t, fin: a.fin, jorn: null, sumLab: 0, labores: {}, km: 0, kmLab: 0, ha: 0, pausa: 0, incid: 0, acts: [] });
      const j = mapa.get(k);
      j.ini = Math.min(j.ini, a.t); j.fin = Math.max(j.fin, a.fin); j.acts.push(a);
      if (a.L.jornada) { j.jorn = a; j.km += a.km || 0; j.pausa += a.pausa || 0; }
      else {
        j.kmLab += a.km || 0; if (!a.L.pausa) { j.sumLab += a.trab; j.ha += a.ha || 0; }
        if (!f.lab || a.L.k === f.lab) j.labores[a.L.k] = (j.labores[a.L.k] || 0) + a.trab;
      }
    });
    D.inc.forEach(i => { const j = mapa.get(i.nombre + '|' + i.dia); if (j) j.incid++; });
    const cuenta = cfg.jornalH == null ? 5 : cfg.jornalH;
    return Array.from(mapa.values()).map(j => {
      j.trab = j.jorn ? j.jorn.trab : j.sumLab;
      if (!j.jorn) j.km = j.kmLab;
      j.extra = extraMin(j.ini, j.fin, cfg.finHora);
      j.jornal = j.trab >= cuenta * 60;
      return j;
    }).filter(j => !f.lab || j.labores[f.lab]).sort((a, b) => a.dia.localeCompare(b.dia) || a.emp.localeCompare(b.emp, 'es'));
  };

  // Estado de cada empleado según su última actividad y su último punto GPS
  G.estadoAhora = function (D, dia) {
    const r = [];
    D.empleados.forEach(emp => {
      const mias = D.acts.filter(a => a.nombre === emp && a.dia === dia); if (!mias.length) return;
      const abiertas = mias.filter(a => /curso|paus/i.test(a.estado)), ultimo = l => l[l.length - 1];
      const lab = ultimo(abiertas.filter(a => !a.L.jornada)) || ultimo(mias.filter(a => !a.L.jornada)) || ultimo(mias);
      let ult = null;
      mias.forEach(a => { const l = D.pts.get(a.id); if (l && l.length && (!ult || l[l.length - 1].t > ult.t)) ult = l[l.length - 1]; });
      const enCurso = abiertas.length > 0, pausa = abiertas.some(a => /paus/i.test(a.estado));
      const sinSenal = enCurso && ult && Date.now() - ult.t > 20 * 60000;
      r.push({ emp, act: lab, ult, enCurso, pausa, sinSenal, desde: mias[0].t });
    });
    return r;
  };
})(typeof window !== 'undefined' ? window : globalThis);
