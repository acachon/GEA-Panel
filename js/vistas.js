/* Pantallas del panel. Cada vista devuelve HTML (todo lo que viene de la hoja se escapa con G.esc) y, si lleva mapa, una función post. */
(function (root) {
  const G = root.GEA, esc = G.esc, S = () => G.state;
  const BASE = [37.8526, -3.7303];

  /* ---------- Mapa (Leaflet) ---------- */
  let mapaActual = null;
  G.destruirMapa = () => { if (mapaActual) { mapaActual.remove(); mapaActual = null; } };
  function pintarMapa(el, D, f, capas) {
    G.destruirMapa();
    const m = L.map(el); mapaActual = m;
    const aerea = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Imágenes © Esri, Maxar, Earthstar Geographics' }).addTo(m);
    const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' });
    L.control.layers({ 'Aérea': aerea, 'Mapa': osm }, null, { position: 'topright' }).addTo(m);
    const b = [], quien = a => (!f.emp || a.nombre === f.emp);
    D.acts.filter(a => quien(a) && (!f.lab || a.L.k === f.lab) && !(f.lab && a.L.jornada)).forEach(a => {
      const l = (D.pts.get(a.id) || []).map(p => [p.lat, p.lon]); if (!l.length) return;
      if (a.L.jornada ? !capas.jornada : !capas.recorridos) return;
      L.polyline(l, { color: a.L.jornada ? '#ffffff' : a.L.c, weight: a.L.jornada ? 2 : 5, opacity: a.L.jornada ? .7 : .95, dashArray: a.L.jornada ? '2 7' : null })
        .bindTooltip(esc(a.nombre) + ' · ' + esc(a.actividad) + ' · ' + G.hhmm(a.t)).addTo(m);
      b.push(...l);
    });
    if (capas.posicion) {
      D.empleados.filter(e => !f.emp || e === f.emp).forEach(e => {
        let u = null; D.acts.forEach(a => { if (a.nombre !== e || a.dia !== f.dia) return; const l = D.pts.get(a.id); if (l && l.length && (!u || l[l.length - 1].t > u.t)) u = l[l.length - 1]; });
        if (!u) return;
        const c = G.colorEmp(D.empleados, e);
        L.marker([u.lat, u.lon], { icon: L.divIcon({ className: 'mk', html: '<div class="p" style="background:' + c + '">' + esc(G.inicial(e)) + '</div>', iconSize: [30, 30], iconAnchor: [15, 15] }) })
          .bindTooltip(esc(e) + ' · ' + G.hhmm(u.t), { direction: 'top', offset: [0, -14] }).addTo(m);
        b.push([u.lat, u.lon]);
      });
    }
    if (capas.incidencias) {
      D.inc.filter(i => i.lat != null && i.lon != null && (!f.emp || i.nombre === f.emp)).forEach(i => {
        L.marker([i.lat, i.lon], { icon: L.divIcon({ className: 'mk', html: '<div class="i"></div>', iconSize: [26, 24], iconAnchor: [13, 22] }) })
          .bindPopup('<b>' + esc(i.tipo) + '</b><br>' + esc(i.comentario) + '<br><span style="color:#5b6c5f">' + esc(i.nombre) + ' · ' + G.diaCorto(i.dia) + ' ' + G.hhmm(i.t) + '</span>').addTo(m);
        b.push([i.lat, i.lon]);
      });
    }
    if (b.length) m.fitBounds(b, { padding: [30, 30], maxZoom: 18 }); else m.setView(BASE, 15);
    setTimeout(() => m.invalidateSize(), 80);
  }
  const capasPor = { recorridos: true, jornada: false, posicion: true, incidencias: true };
  const refDia = () => { const d = G.periodo(); return d[d.length - 1]; };

  /* ---------- Piezas comunes ---------- */
  const chipEstado = e => e.sinSenal ? '<span class="chip c-mal">Sin señal</span>' : e.pausa ? '<span class="chip c-av">En pausa</span>' : e.enCurso ? '<span class="chip c-ok">Activo</span>' : '<span class="chip c-gr">Terminó</span>';
  const lista = (D, f) => {
    f = f || {};
    return G.jornadas(D, S().cfg, { emp: f.emp, lab: f.lab });
  };
  const vacio = t => '<div class="vacio">' + t + '</div>';
  const kpi = (l, v, s, extra) => '<div class="card kpi"' + (extra || '') + '><span class="lbl">' + l + '</span><span class="v">' + v + '</span><span class="sub">' + s + '</span></div>';
  const barras = (filas, max) => filas.map(([n, v, c, txt]) => '<div><div style="display:flex;justify-content:space-between;font-size:13px;font-weight:700"><span><i class="dot" style="background:' + c + '"></i>' + esc(n) + '</span><span class="num">' + txt + '</span></div><div class="bar" style="margin-top:4px"><i style="width:' + Math.max(1.5, v / (max || 1) * 100) + '%;background:' + c + '"></i></div></div>').join('');
  const horasPorLabor = (D, f) => {
    const t = {};
    D.acts.forEach(a => { if (a.L.jornada || a.L.pausa || (f.emp && a.nombre !== f.emp) || (f.lab && a.L.k !== f.lab)) return; t[a.L.k] = t[a.L.k] || { L: a.L, min: 0, km: 0, ha: 0, n: 0 }; const x = t[a.L.k]; x.min += a.trab; x.km += a.km || 0; x.ha += a.ha || 0; x.n++; });
    return Object.values(t).sort((a, b) => b.min - a.min);
  };

  /* ---------- Resumen ---------- */
  function resumen() {
    const s = S(), D = s.data, f = { emp: s.emp, lab: s.lab }, dia = refDia(), hoy = G.dayKey(new Date());
    const J = lista(D, f), est = G.estadoAhora(D, dia).filter(e => !f.emp || e.emp === f.emp);
    const trab = J.reduce((a, j) => a + j.trab, 0), km = J.reduce((a, j) => a + j.km, 0), ha = J.reduce((a, j) => a + j.ha, 0);
    const jornales = J.filter(j => j.jornal).length, extra = J.reduce((a, j) => a + j.extra, 0);
    const incs = D.inc.filter(i => !f.emp || i.nombre === f.emp);
    const k1 = dia === hoy && G.periodo().length === 1
      ? kpi('En jornada ahora', est.filter(e => e.enCurso).length + ' <span style="font-size:16px;color:#5b6c5f">de ' + est.length + '</span>', est.filter(e => e.enCurso && !e.pausa && !e.sinSenal).length + ' activos · ' + est.filter(e => e.pausa).length + ' en pausa · ' + est.filter(e => e.sinSenal).length + ' sin señal')
      : kpi('Empleados con jornada', new Set(J.map(j => j.emp)).size, J.length + ' jornadas en el periodo');
    const labs = horasPorLabor(D, f), maxL = labs.length ? labs[0].min : 1;
    const dias = G.periodo();
    const porDia = dias.map(d => ({ d, n: J.filter(j => j.dia === d && j.jornal).length, ex: J.filter(j => j.dia === d).reduce((a, j) => a + j.extra, 0) })), maxN = Math.max(1, ...porDia.map(x => x.n));
    return '<div class="kpis">' + k1
      + kpi('Horas trabajadas', G.fmtMin(trab), J.length ? 'Media ' + G.fmtMin(trab / J.length) + ' por jornada' : 'Sin jornadas')
      + kpi('Distancia recorrida', G.fmtNum(km, 1) + ' km', 'Suma de los recorridos GPS')
      + kpi('Superficie cubierta', G.fmtNum(ha, 1) + ' ha', 'Según las labores registradas')
      + kpi('Incidencias', incs.length, incs.length ? incs.slice(0, 2).map(i => esc(i.tipo)).join(' · ') : 'Ninguna en el periodo')
      + kpi('Jornales', jornales, 'Con ' + (s.cfg.jornalH) + ' h o más · ' + G.fmtMin(extra) + ' extra')
      + '</div>'
      + '<div class="fila"><div class="card" style="flex:2 1 560px;min-width:0;display:flex;flex-direction:column;gap:10px"><div><h2>Posición y recorridos</h2><span class="sub">Último punto GPS de cada empleado y recorridos del periodo</span></div><div id="mapa" class="mapa"></div></div>'
      + '<div style="flex:1 1 340px;min-width:0;display:flex;flex-direction:column;gap:16px"><div class="card"><div style="display:flex;justify-content:space-between;align-items:baseline"><h2>Personal · ' + G.diaCorto(dia) + '</h2><a href="#personal">Ver jornales →</a></div><div class="lista">'
      + (est.length ? est.map(e => '<div class="it"><span class="av" style="background:' + G.colorEmp(D.empleados, e.emp) + '">' + esc(G.inicial(e.emp)) + '</span><div style="flex:1;min-width:0"><div style="font-weight:700">' + esc(e.emp) + '</div><div class="sub">' + esc(e.act.actividad) + ' · desde ' + G.hhmm(e.desde) + (e.ult ? ' · último punto ' + G.hhmm(e.ult.t) : ' · sin puntos GPS') + '</div></div>' + chipEstado(e) + '</div>').join('') : vacio('Nadie ha registrado actividad este día.'))
      + '</div></div><div class="card"><div style="display:flex;justify-content:space-between;align-items:baseline"><h2>Incidencias recientes</h2><a href="#incidencias">Ver todas →</a></div><div class="lista">'
      + (incs.length ? incs.slice(0, 4).map(i => '<div class="it"><span class="chip c-av">' + esc(i.tipo) + '</span><div style="flex:1;min-width:0"><div style="font-weight:700">' + esc(i.comentario || 'Sin comentario') + '</div><div class="sub">' + esc(i.nombre) + ' · ' + G.diaCorto(i.dia) + ' ' + G.hhmm(i.t) + '</div></div></div>').join('') : vacio('Sin incidencias.'))
      + '</div></div></div></div>'
      + '<div class="fila"><div class="card" style="flex:2 1 560px;min-width:0"><h2>Jornada por empleado · ' + G.diaCorto(dia) + '</h2><span class="sub">Cada bloque es una actividad registrada; el rayado es el almuerzo</span><div style="margin-top:10px">' + gantt(D, dia, f) + '</div></div>'
      + '<div class="card" style="flex:1 1 300px;min-width:0;display:flex;flex-direction:column;gap:10px"><h2>Horas por labor</h2>' + (labs.length ? barras(labs.map(l => [l.L.n, l.min, l.L.c, G.fmtMin(l.min)]), maxL) : vacio('Sin labores en el periodo.')) + '</div>'
      + (dias.length > 1 ? '<div class="card" style="flex:1 1 300px;min-width:0"><h2>Jornales por día</h2><div style="display:flex;align-items:flex-end;gap:8px;height:130px;margin-top:10px">' + porDia.map(x => '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px"><span class="num" style="font-size:13px;font-weight:800">' + x.n + '</span><div style="width:100%;max-width:44px;height:' + Math.max(3, x.n / maxN * 90) + 'px;background:#0f4d2a;border-radius:6px 6px 0 0"></div></div>').join('') + '</div><div style="display:flex;gap:8px;text-align:center;font-size:12px;font-weight:700;margin-top:4px">' + porDia.map(x => '<span style="flex:1">' + G.diaCorto(x.d) + '</span>').join('') + '</div><div class="sub" style="margin-top:8px">Jornal = ' + s.cfg.jornalH + ' h o más. Extra desde las ' + esc(s.cfg.finHora) + '.</div></div>' : '')
      + '</div>';
  }
  function gantt(D, dia, f) {
    const acts = D.acts.filter(a => a.dia === dia && (!f.emp || a.nombre === f.emp));
    if (!acts.length) return vacio('Sin actividades este día.');
    const d0 = G.parseDay(dia).getTime(), H = 3600000;
    let h0 = Math.min(8, Math.floor((Math.min(...acts.map(a => a.t)) - d0) / H)), h1 = Math.max(17, Math.ceil((Math.max(...acts.map(a => a.fin)) - d0) / H));
    h0 = Math.max(0, h0); h1 = Math.min(24, Math.max(h1, h0 + 4));
    const pc = t => Math.min(100, Math.max(0, ((t - d0) / H - h0) / (h1 - h0) * 100)), emps = Array.from(new Set(acts.map(a => a.nombre)));
    let eje = '<div class="eje">'; for (let h = h0; h <= h1; h += 2) eje += '<span style="left:' + ((h - h0) / (h1 - h0) * 100) + '%">' + String(h).padStart(2, '0') + '</span>'; eje += '</div>';
    return '<div class="gantt">' + eje + emps.map(e => '<div class="fl"><span class="nom">' + esc(e) + '</span><div class="pista" style="--h:' + (100 / (h1 - h0)) + '%">' + acts.filter(a => a.nombre === e && !a.L.jornada).map(a => '<div class="gb blq" title="' + esc(a.actividad) + ' ' + G.hhmm(a.t) + '–' + G.hhmm(a.fin) + '" style="left:' + pc(a.t) + '%;width:' + Math.max(.4, pc(a.fin) - pc(a.t)) + '%;' + (a.L.pausa ? 'background:repeating-linear-gradient(45deg,#e0a63a 0,#e0a63a 3px,#fff 3px,#fff 6px)' : 'background:' + a.L.c) + '"></div>').join('') + '</div></div>').join('') + '</div>'
      + '<div style="display:flex;flex-wrap:wrap;gap:6px 16px;font-size:13px;font-weight:600;margin-top:10px">' + G.LABORES.filter(l => !l.pausa).map(l => '<span><i class="dot" style="background:' + l.c + '"></i>' + l.n + '</span>').join('') + '</div>';
  }

  /* ---------- Mapa ---------- */
  function mapa() {
    const c = capasPor, ch = (k, t) => '<label class="campo" style="cursor:pointer"><input type="checkbox" data-capa="' + k + '"' + (c[k] ? ' checked' : '') + '> ' + t + '</label>';
    return '<div class="barra">' + ch('recorridos', 'Recorridos por labor') + ch('jornada', 'Recorrido de la jornada') + ch('posicion', 'Última posición') + ch('incidencias', 'Incidencias') + '</div>'
      + '<div class="fila"><div class="card" style="flex:3 1 600px;min-width:0;padding:12px"><div id="mapa" class="mapa grande"></div></div>'
      + '<div style="flex:1 1 260px;min-width:0" class="card"><h2>Leyenda</h2><div class="lista" style="margin-top:6px">' + G.LABORES.filter(l => !l.pausa).map(l => '<div class="it" style="padding:8px 0"><i class="dot" style="background:' + l.c + '"></i><span style="flex:1">' + l.n + '</span></div>').join('') + '<div class="it" style="padding:8px 0"><i class="dot" style="background:#fff;border:1px solid #9aa89a"></i><span style="flex:1">Recorrido de la jornada</span></div></div><p class="sub">Las zonas se dibujan con los puntos GPS que envía la app. Cambia a «Mapa» con el selector de capas de la esquina del mapa.</p></div></div>';
  }

  /* ---------- Personal ---------- */
  function personal() {
    const s = S(), D = s.data, J = lista(D, { emp: s.emp, lab: s.lab }), dias = G.periodo();
    if (!J.length) return vacio('No hay jornadas en el periodo elegido.');
    const ir = e => '<a href="#mapa" data-ir="mapa" data-emp="' + esc(e) + '">Ver recorrido</a>';
    if (dias.length === 1) {
      return '<div class="card" style="overflow-x:auto"><h2 style="margin-bottom:8px">Jornadas · ' + G.diaLargo(dias[0]) + '</h2><table class="t"><thead><tr><th>Empleado</th><th class="r">Inicio</th><th class="r">Fin</th><th class="r">Trabajado</th><th class="r">Pausas</th><th class="r">Extra</th><th class="r">Distancia</th><th class="r">Superficie</th><th class="r">Incid.</th><th>Jornal</th><th></th></tr></thead><tbody>'
        + J.map(j => '<tr><td><b>' + esc(j.emp) + '</b></td><td class="r">' + G.hhmm(j.ini) + '</td><td class="r">' + G.hhmm(j.fin) + (j.jorn && /curso/i.test(j.jorn.estado) ? ' <span class="chip c-ok">en curso</span>' : '') + '</td><td class="r">' + G.fmtMin(j.trab) + '</td><td class="r">' + (j.pausa ? G.fmtMin(j.pausa) : '—') + '</td><td class="r">' + (j.extra ? G.fmtMin(j.extra) : '—') + '</td><td class="r">' + G.fmtNum(j.km, 2) + ' km</td><td class="r">' + G.fmtNum(j.ha, 2) + ' ha</td><td class="r">' + j.incid + '</td><td>' + (j.jornal ? '<span class="chip c-ok">Jornal</span>' : '<span class="chip c-av">Incompleto</span>') + '</td><td>' + ir(j.emp) + '</td></tr>').join('')
        + '</tbody></table>' + notaEstimacion(D) + '</div>';
    }
    const emps = Array.from(new Set(J.map(j => j.emp)));
    const filas = emps.map(e => { const m = J.filter(j => j.emp === e); return { e, m, jornales: m.filter(j => j.jornal).length, extra: m.reduce((a, j) => a + j.extra, 0), tot: m.reduce((a, j) => a + j.trab, 0) }; });
    return '<div class="card" style="overflow-x:auto"><h2 style="margin-bottom:8px">Horas por empleado y día</h2><table class="t"><thead><tr><th>Empleado</th>' + dias.map(d => '<th class="r">' + G.diaCorto(d) + '</th>').join('') + '<th class="r">Total</th><th class="r">Jornales</th><th class="r">Extra</th><th></th></tr></thead><tbody>'
      + filas.map(r => '<tr><td><b>' + esc(r.e) + '</b></td>' + dias.map(d => { const j = r.m.find(x => x.dia === d); return '<td class="r"' + (j && !j.jornal ? ' style="color:#7a4a00"' : '') + '>' + (j ? G.fmtMin(j.trab) : '—') + '</td>'; }).join('') + '<td class="r"><b>' + G.fmtMin(r.tot) + '</b></td><td class="r"><b>' + r.jornales + '</b></td><td class="r">' + (r.extra ? G.fmtMin(r.extra) : '—') + '</td><td>' + ir(r.e) + '</td></tr>').join('')
      + '</tbody><tfoot><tr><td>Total</td>' + dias.map(d => '<td class="r">' + G.fmtMin(J.filter(j => j.dia === d).reduce((a, j) => a + j.trab, 0)) + '</td>').join('') + '<td class="r">' + G.fmtMin(filas.reduce((a, r) => a + r.tot, 0)) + '</td><td class="r">' + filas.reduce((a, r) => a + r.jornales, 0) + '</td><td class="r">' + G.fmtMin(filas.reduce((a, r) => a + r.extra, 0)) + '</td><td></td></tr></tfoot></table>'
      + '<div class="sub" style="margin-top:8px">En ámbar, los días que no llegan a ' + s.cfg.jornalH + ' h (no cuentan jornal).</div>' + notaEstimacion(D) + '</div>';
  }
  const notaEstimacion = D => D.acts.some(a => !a.exacta) ? '<div class="sub" style="margin-top:6px">Las duraciones se estiman con el último punto GPS de cada actividad. Para que sean exactas, activa «Min activa» en el servicio (ver servicio/LEEME.md).</div>' : '';

  /* ---------- Incidencias ---------- */
  function incidencias() {
    const s = S(), D = s.data, tipos = Array.from(new Set(D.inc.map(i => i.tipo))).sort();
    let l = D.inc.filter(i => (!s.emp || i.nombre === s.emp) && (!s.tipo || i.tipo === s.tipo));
    const sel = l.find(i => i.id === s.incSel) || l[0];
    const adj = i => (i.adjuntos || []).map(a => { const u = G.urlSegura(a.url), t = { foto: 'Foto', video: 'Vídeo', audio: 'Audio' }[a.tipo] || 'Archivo'; return u ? '<a class="btn" style="display:inline-flex;align-items:center;text-decoration:none" href="' + esc(u) + '" target="_blank" rel="noopener">' + t + ' · ' + esc(a.nombre) + '</a>' : '<span class="chip c-gr">' + t + ' (sin enlace)</span>'; }).join(' ');
    return '<div class="barra"><label class="campo"><span>Tipo</span><select id="fTipo"><option value="">Todos</option>' + tipos.map(t => '<option' + (t === s.tipo ? ' selected' : '') + ' value="' + esc(t) + '">' + esc(t) + '</option>').join('') + '</select></label><span class="chip c-gr">' + l.length + ' incidencias</span></div>'
      + (!l.length ? vacio('No hay incidencias en el periodo.') : '<div class="fila"><div class="card" style="flex:1.2 1 440px;min-width:0"><div class="lista">' + l.map(i => '<div class="it clic' + (sel && i.id === sel.id ? ' sel' : '') + '" data-inc="' + esc(i.id) + '"><span class="chip c-av">' + esc(i.tipo) + '</span><div style="flex:1;min-width:0"><div style="font-weight:700">' + esc(i.comentario || 'Sin comentario') + '</div><div class="sub">' + esc(i.nombre) + ' · ' + G.diaCorto(i.dia) + ' ' + G.hhmm(i.t) + '</div></div>' + ((i.adjuntos || []).length ? '<span class="chip c-gr">' + i.adjuntos.length + ' adj.</span>' : '') + '</div>').join('') + '</div></div>'
        + '<div class="card" style="flex:1 1 380px;min-width:0;display:flex;flex-direction:column;gap:12px"><div><span class="lbl">' + esc(sel.tipo) + '</span><h2 style="font-size:20px;margin-top:4px">' + esc(sel.comentario || 'Sin comentario') + '</h2></div>'
        + '<div style="display:flex;flex-wrap:wrap;gap:8px 24px;font-size:14px"><div><span class="sub">Registrada por</span><br><b>' + esc(sel.nombre) + '</b></div><div><span class="sub">Fecha y hora</span><br><b class="num">' + G.diaCorto(sel.dia) + ' · ' + G.hhmm(sel.t) + '</b></div><div><span class="sub">Precisión GPS</span><br><b class="num">' + (sel.precision != null ? sel.precision + ' m' : '—') + '</b></div></div>'
        + (sel.lat != null ? '<div><a class="btn" style="display:inline-flex;align-items:center;text-decoration:none" target="_blank" rel="noopener" href="https://maps.google.com/?q=' + sel.lat + ',' + sel.lon + '">Abrir ubicación (' + sel.lat.toFixed(5) + ', ' + sel.lon.toFixed(5) + ')</a></div>' : '<span class="sub">Sin posición GPS.</span>')
        + '<div style="display:flex;flex-wrap:wrap;gap:8px">' + (adj(sel) || '<span class="sub">Sin adjuntos.</span>') + '</div></div></div>');
  }

  /* ---------- Labores ---------- */
  function labores() {
    const s = S(), D = s.data, f = { emp: s.emp, lab: s.lab }, labs = horasPorLabor(D, f);
    if (!labs.length) return vacio('No hay labores registradas en el periodo.');
    const emps = Array.from(new Set(D.acts.filter(a => !a.L.jornada && !a.L.pausa && (!f.emp || a.nombre === f.emp)).map(a => a.nombre)));
    const cel = (e, k) => D.acts.filter(a => a.nombre === e && a.L.k === k).reduce((t, a) => t + a.trab, 0);
    return '<div class="fila"><div class="card" style="flex:1 1 320px;min-width:0;display:flex;flex-direction:column;gap:10px"><h2>Horas por labor</h2>' + barras(labs.map(l => [l.L.n, l.min, l.L.c, G.fmtMin(l.min)]), labs[0].min) + '</div>'
      + '<div class="card" style="flex:2 1 560px;min-width:0;overflow-x:auto"><h2 style="margin-bottom:8px">Quién ha hecho qué</h2><table class="t"><thead><tr><th>Labor</th>' + emps.map(e => '<th class="r">' + esc(e) + '</th>').join('') + '<th class="r">Total</th><th class="r">Registros</th><th class="r">Distancia</th><th class="r">Superficie</th></tr></thead><tbody>'
      + labs.map(l => '<tr><td><i class="dot" style="background:' + l.L.c + '"></i><b>' + esc(l.L.n) + '</b></td>' + emps.map(e => { const m = cel(e, l.L.k); return '<td class="r">' + (m ? G.fmtMin(m) : '—') + '</td>'; }).join('') + '<td class="r"><b>' + G.fmtMin(l.min) + '</b></td><td class="r">' + l.n + '</td><td class="r">' + G.fmtNum(l.km, 2) + ' km</td><td class="r">' + G.fmtNum(l.ha, 2) + ' ha</td></tr>').join('')
      + '</tbody></table></div></div>'
      + '<div class="card" style="border-style:dashed;background:#fafaf4"><span class="chip c-gr">Fase 2</span><h2 style="margin:8px 0 4px">Trabajo por parcela y subparcela</h2><span class="sub">El Registro central guarda posiciones GPS, no polígonos de parcela. Para repartir las horas por parcela hace falta importar las parcelas (Catastro/SIGPAC) al panel.</span></div>';
  }

  /* ---------- Configuración ---------- */
  function config() {
    const c = S().cfg;
    return '<form class="card cfg" id="formCfg" autocomplete="off"><h2>Conexión con el Registro central</h2>'
      + '<label>Dirección del servicio<input type="text" id="cUrl" inputmode="url" spellcheck="false" placeholder="https://script.google.com/macros/s/…/exec" value="' + esc(c.url) + '"></label>'
      + '<label>Clave de lectura<input type="password" id="cClave" autocomplete="new-password" spellcheck="false" placeholder="La CLAVE_LECTURA del servicio" value="' + esc(c.clave) + '"></label>'
      + '<p class="sub" style="margin:0">La dirección y la clave se guardan solo en este navegador. No están en el código del panel.</p>'
      + '<h2 style="margin-top:6px">Reglas de jornada</h2><div class="barra"><label>Horas para contar jornal<input type="number" id="cJornal" min="1" max="12" step="0.5" value="' + esc(c.jornalH) + '"></label><label>Hora de fin (extra desde)<input type="time" id="cFin" value="' + esc(c.finHora) + '"></label></div>'
      + '<label class="chk"><input type="checkbox" id="cPrueba"' + (c.prueba ? ' checked' : '') + '> Incluir filas marcadas como «Datos de prueba»</label>'
      + '<label class="chk"><input type="checkbox" id="cDemo"' + (c.demo ? ' checked' : '') + '> Modo demostración (datos de ejemplo, sin conexión)</label>'
      + '<div class="barra"><button class="btn pri" type="submit">Guardar</button><button class="btn" type="button" id="bProbar">Probar conexión</button></div><div id="cEstado" class="sub" role="status"></div></form>';
  }

  G.vistas = {
    resumen: { t: 'Resumen', f: resumen, post: () => pintarMapa(document.getElementById('mapa'), S().data, { emp: S().emp, lab: S().lab, dia: refDia() }, capasPor) },
    mapa: { t: 'Dónde se ha trabajado', f: mapa, post: () => pintarMapa(document.getElementById('mapa'), S().data, { emp: S().emp, lab: S().lab, dia: refDia() }, capasPor) },
    personal: { t: 'Jornales y horas', f: personal },
    incidencias: { t: 'Incidencias', f: incidencias },
    labores: { t: 'Labores', f: labores },
    config: { t: 'Configuración', f: config, sinDatos: true }
  };
  G.repintarMapa = () => pintarMapa(document.getElementById('mapa'), S().data, { emp: S().emp, lab: S().lab, dia: refDia() }, capasPor);
  G.capas = capasPor;
})(typeof window !== 'undefined' ? window : globalThis);
