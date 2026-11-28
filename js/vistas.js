/* Pantallas del panel. Cada vista devuelve HTML (todo lo que viene de la hoja se escapa con G.esc) y, si lleva mapa, una función post. */
(function (root) {
  const G = root.GEA, esc = G.esc, S = () => G.state;
  const BASE = [37.8526, -3.7303];

  /* ---------- Mapa (Leaflet) ---------- */
  let mapaActual = null;
  G.destruirMapa = () => { if (mapaActual) { mapaActual.remove(); mapaActual = null; } document.body.style.overflow = ''; };
  // Escape cierra la pantalla completa del mapa
  document.addEventListener('keydown', e => {
    const x = e.key === 'Escape' && document.querySelector('.mapa.completa');
    if (x) { x.classList.remove('completa'); document.body.style.overflow = ''; if (mapaActual) { const mm = mapaActual; setTimeout(() => { if (mapaActual === mm) mm.invalidateSize(); }, 50); } }
  });
  // Recorrido / Área visibles en el mapa (se conserva al repintar)
  const verMapa = { recorrido: true, area: true };
  // Envolvente convexa de unos puntos [lat,lon] (cadena monótona): el polígono más sencillo que los contiene
  function envolvente(pts) {
    const u = [...new Map(pts.map(q => [q.join(), q])).values()].sort((a, b) => a[1] - b[1] || a[0] - b[0]);
    if (u.length < 3) return u;
    const cruz = (o, a, b) => (a[1] - o[1]) * (b[0] - o[0]) - (a[0] - o[0]) * (b[1] - o[1]);
    const medio = orden => { const h = []; orden.forEach(q => { while (h.length > 1 && cruz(h[h.length - 2], h[h.length - 1], q) <= 0) h.pop(); h.push(q); }); h.pop(); return h; };
    return medio(u).concat(medio(u.slice().reverse()));
  }
  const ICO_YO ='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8"/><path d="M12 1v3M12 20v3M1 12h3M20 12h3"/></svg>';
  const ICO_TODO = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';
  // Fondos del mapa
  const crearFondos = () => ({
    // Aérea: ortofoto del PNOA (IGN España), sin nubes y con detalle de 25 cm; es el fondo por defecto (la misma que usa la app)
    'Aérea': L.tileLayer.wms('https://www.ign.es/wms-inspire/pnoa-ma', { layers: 'OI.OrthoimageCoverage', format: 'image/jpeg', version: '1.3.0', maxZoom: 21, maxNativeZoom: 20,
      attribution: 'PNOA © <a href="https://www.scne.es/" target="_blank" rel="noopener">IGN</a> (CC BY 4.0)' }),
    // Satélite: Esri World Imagery (en zonas rurales solo hay imagen hasta el zoom 18)
    'Satélite': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, maxNativeZoom: 18, attribution: 'Imágenes © Esri, Maxar, Earthstar Geographics' }),
    'Mapa': L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' })
  });
  function pintarMapa(el, D, f, capas) {
    G.destruirMapa();
    const m = L.map(el); mapaActual = m;
    const { 'Aérea': aerea, 'Satélite': sat, 'Mapa': osm } = crearFondos();
    const control = (pos, clase, crear) => {
      const C = L.Control.extend({ options: { position: pos }, onAdd() { const c = L.DomUtil.create('div', clase); crear(c); L.DomEvent.disableClickPropagation(c); return c; } });
      new C().addTo(m);
    };
    // Pantalla completa: ⤢ la abre, ✕ (o Escape) la cierra
    control('topright', 'leaflet-bar completo', c => {
      const a = L.DomUtil.create('a', '', c); a.href = '#'; a.setAttribute('role', 'button');
      const etiqueta = () => { const v = el.classList.contains('completa'); a.textContent = v ? '✕' : '⤢'; a.title = v ? 'Salir de pantalla completa' : 'Mapa a pantalla completa'; a.setAttribute('aria-label', a.title); };
      L.DomEvent.on(a, 'click', e => { L.DomEvent.preventDefault(e); const v = !el.classList.contains('completa'); el.classList.toggle('completa', v); document.body.style.overflow = v ? 'hidden' : ''; etiqueta(); setTimeout(() => { if (mapaActual === m) m.invalidateSize(); }, 50); });
      m.on('resize', etiqueta); etiqueta();
    });
    document.body.style.overflow = el.classList.contains('completa') ? 'hidden' : '';
    // Fondo elegido: se recuerda en este navegador (por defecto, Aérea)
    const fondos = { 'Aérea': aerea, 'Satélite': sat, 'Mapa': osm };
    let fondo = 'Aérea'; try { fondo = localStorage.getItem('gea.panel.fondo') || fondo; } catch (e) { /* sin almacenamiento */ }
    (fondos[fondo] || aerea).addTo(m);
    // Catastro: parcelas (con su referencia) de la Dirección General del Catastro (WMS INSPIRE), como capa que se superpone al fondo
    const catastro = L.tileLayer.wms('https://ovc.catastro.meh.es/cartografia/INSPIRE/spadgcwms.aspx', { layers: 'CP.CadastralParcel', format: 'image/png', transparent: true, version: '1.1.1', minZoom: 13, maxZoom: 21, className: 'cat-lineas',
      attribution: '© <a href="https://www.sedecatastro.gob.es/" target="_blank" rel="noopener">Dirección General del Catastro</a>' });
    let conCatastro = false; try { conCatastro = localStorage.getItem('gea.panel.catastro') === '1'; } catch (e) { /* sin almacenamiento */ }
    if (conCatastro) catastro.addTo(m);
    // Las líneas del Catastro son negras: sobre imagen aérea se pintan en blanco (en el mapa de calles, se dejan negras)
    const tinta = n => el.classList.toggle('fondo-mapa', n === 'Mapa'); tinta(fondos[fondo] ? fondo : 'Aérea');
    // Cultivos: subparcelas del Catastro (cada recinto de cultivo o aprovechamiento dentro de la parcela, con su clave de cultivo)
    const cultivos = L.tileLayer.wms('https://ovc.catastro.meh.es/Cartografia/WMS/ServidorWMS.aspx', { layers: 'SUBPARCE,TXTSUBPARCE', format: 'image/png', transparent: true, version: '1.1.1', minZoom: 14, maxZoom: 21, className: 'cat-lineas',
      attribution: '© <a href="https://www.sedecatastro.gob.es/" target="_blank" rel="noopener">Dirección General del Catastro</a>' });
    let conCultivos = false; try { conCultivos = localStorage.getItem('gea.panel.cultivos') === '1'; } catch (e) { /* sin almacenamiento */ }
    if (conCultivos) cultivos.addTo(m);
    L.control.layers(fondos, { 'Catastro (parcelas)': catastro, 'Catastro (cultivos)': cultivos }, { position: 'topright' }).addTo(m);
    m.on('baselayerchange', e => { tinta(e.name); try { localStorage.setItem('gea.panel.fondo', e.name); } catch (e2) { /* sin almacenamiento */ } });
    const marca = (clave, v) => { try { localStorage.setItem(clave, v ? '1' : '0'); } catch (e) { /* sin almacenamiento */ } };
    const claveDe = l => l === catastro ? 'gea.panel.catastro' : l === cultivos ? 'gea.panel.cultivos' : null;
    m.on('overlayadd', e => { const k = claveDe(e.layer); if (k) marca(k, true); }); m.on('overlayremove', e => { const k = claveDe(e.layer); if (k) marca(k, false); });
    const b = [], quien = a => (!f.emp || a.nombre === f.emp);
    const yo = L.layerGroup().addTo(m), aviso = t => L.popup().setLatLng(m.getCenter()).setContent(t).openOn(m);
    // Ir a mi ubicación (punto azul) y Ver todo (encuadra recorridos, posiciones e incidencias dibujados)
    control('topleft', 'leaflet-bar ubic', c => [['Ir a mi ubicación actual', ICO_YO, () => {
      if (!('geolocation' in navigator)) { aviso('Este navegador no puede dar tu ubicación.'); return; }
      navigator.geolocation.getCurrentPosition(p => {
        const pos = [p.coords.latitude, p.coords.longitude]; yo.clearLayers();
        if (p.coords.accuracy <= 100) L.circle(pos, { radius: p.coords.accuracy, color: '#1a73e8', weight: 1, fillOpacity: .12 }).addTo(yo);
        L.circleMarker(pos, { radius: 8, color: '#fff', weight: 2, fillColor: '#1a73e8', fillOpacity: 1 }).bindTooltip('Estás aquí (±' + Math.round(p.coords.accuracy) + ' m)').addTo(yo);
        m.setView(pos, Math.max(m.getZoom(), 17));
      }, () => aviso('No se ha podido obtener tu ubicación.'), { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 });
    }], ['Ver todo lo marcado en el mapa', ICO_TODO, () => { if (b.length) m.fitBounds(L.latLngBounds(b).pad(0.3), { maxZoom: 18 }); else aviso('No hay nada marcado con ubicación.'); }]].forEach(([t, svg, accion]) => {
      const a = L.DomUtil.create('a', '', c); a.href = '#'; a.setAttribute('role', 'button'); a.title = t; a.setAttribute('aria-label', t); a.innerHTML = svg;
      L.DomEvent.on(a, 'click', e => { L.DomEvent.preventDefault(e); accion(); });
    }));
    // Recorrido / Área (como en la pestaña Supervisor de la app): el recorrido son las líneas GPS y el área, el polígono más pequeño que contiene los puntos de cada actividad
    const pol = L.layerGroup(), lin = L.layerGroup();
    const aplicarVista = () => { [[pol, verMapa.area], [lin, verMapa.recorrido]].forEach(([g, v]) => { if (v) g.addTo(m); else m.removeLayer(g); }); };
    control('bottomleft', 'vistamapa', c => [['recorrido', 'Recorrido'], ['area', 'Área']].forEach(([k, t]) => {
      const bt = L.DomUtil.create('button', '', c); bt.type = 'button'; bt.textContent = t; bt.setAttribute('aria-pressed', verMapa[k]);
      L.DomEvent.on(bt, 'click', e => { L.DomEvent.stop(e); verMapa[k] = !verMapa[k]; bt.setAttribute('aria-pressed', verMapa[k]); aplicarVista(); });
    }));
    aplicarVista();
    D.acts.filter(a => quien(a) && (!f.lab || a.L.k === f.lab) && !(f.lab && a.L.jornada)).forEach(a => {
      const l = (D.pts.get(a.id) || []).map(p => [p.lat, p.lon]); if (!l.length) return;
      if (!a.L.jornada && !a.L.pausa) { const h = envolvente(l); if (h.length >= 3) L.polygon(h, { color: a.L.c, weight: 3, opacity: 1, fillColor: a.L.c, fillOpacity: .5, interactive: false }).addTo(pol); }
      b.push(...l);
      if (a.L.jornada ? !capas.jornada : !capas.recorridos) return;
      L.polyline(l, { color: a.L.jornada ? '#ffffff' : a.L.c, weight: a.L.jornada ? 2 : 5, opacity: a.L.jornada ? .7 : .95, dashArray: a.L.jornada ? '2 7' : null })
        .bindTooltip(esc(a.nombre) + ' · ' + esc(a.actividad) + ' · ' + G.hhmm(a.t)).addTo(lin);
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
    setTimeout(() => { if (mapaActual === m) m.invalidateSize(); }, 80);
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
      + kpi('Incidencias', incs.length, incs.length ? incs.filter(i => i.estado !== 'Resuelta').length + ' pendientes · ' + incs.filter(i => i.estado === 'Resuelta').length + ' resueltas' : 'Ninguna en el periodo')
      + kpi('Jornales', jornales, 'Con ' + (s.cfg.jornalH) + ' h o más · ' + G.fmtMin(extra) + ' extra')
      + '</div>'
      + '<div class="fila"><div class="card" style="flex:2 1 560px;min-width:0;display:flex;flex-direction:column;gap:10px"><div><h2>Posición y recorridos</h2><span class="sub">Último punto GPS de cada empleado y recorridos del periodo</span></div><div id="mapa" class="mapa"></div></div>'
      + '<div style="flex:1 1 340px;min-width:0;display:flex;flex-direction:column;gap:16px"><div class="card"><div style="display:flex;justify-content:space-between;align-items:baseline"><h2>Personal · ' + G.diaCorto(dia) + '</h2><a href="#personal">Ver jornales →</a></div><div class="lista">'
      + (est.length ? est.map(e => '<div class="it"><span class="av" style="background:' + G.colorEmp(D.empleados, e.emp) + '">' + esc(G.inicial(e.emp)) + '</span><div style="flex:1;min-width:0"><div style="font-weight:700">' + esc(e.emp) + '</div><div class="sub">' + esc(e.act.actividad) + ' · desde ' + G.hhmm(e.desde) + (e.ult ? ' · último punto ' + G.hhmm(e.ult.t) : ' · sin puntos GPS') + '</div></div>' + chipEstado(e) + '</div>').join('') : vacio('Nadie ha registrado actividad este día.'))
      + '</div></div><div class="card"><div style="display:flex;justify-content:space-between;align-items:baseline"><h2>Incidencias recientes</h2><a href="#incidencias">Ver todas →</a></div><div class="lista">'
      + (incs.length ? incs.slice(0, 4).map(i => '<div class="it"><span class="chip c-gr">' + esc(i.tipo) + '</span><div style="flex:1;min-width:0"><div style="font-weight:700">' + esc(i.comentario || 'Sin comentario') + '</div><div class="sub">' + esc(i.nombre) + ' · ' + G.diaCorto(i.dia) + ' ' + G.hhmm(i.t) + '</div></div>' + chipEst(i.estado) + '</div>').join('') : vacio('Sin incidencias.'))
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
  const TIPO_ADJ = { foto: 'Foto', video: 'Vídeo', audio: 'Audio' };
  const ICO_ADJ = {
    video: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="5" width="14" height="14" rx="2"/><path d="m16 10 6-4v12l-6-4"/></svg>',
    audio: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4"/></svg>',
    foto: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="15" rx="2"/><circle cx="12" cy="12.5" r="3.5"/><path d="M8 5l1.5-2h5L16 5"/></svg>'
  };
  const chipEst = e => e === 'Resuelta' ? '<span class="chip c-ok">Resuelta</span>' : '<span class="chip c-av">Pendiente</span>';
  const normal = x => String(x || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  // Adjuntos que se pueden abrir: con enlace de Google Drive (o, en el modo demostración, de ejemplo)
  const esDemo = a => /^demo:/.test(a.url || '');
  const adjVisibles = i => (i.adjuntos || []).filter(a => G.urlSegura(a.url) || esDemo(a));
  // Incidencias que pasan los filtros de la pantalla (tipo, estado y texto buscado), en el orden elegido
  const ORDENES = { fecha: 'Fecha', operario: 'Operario', tipo: 'Tipo de incidencia', estado: 'Estado' };
  G.incFiltradas = () => {
    const s = S(), q = normal(s.q).trim(), es = (a, b) => String(a || '').localeCompare(String(b || ''), 'es');
    const l = s.data.inc.filter(i => (!s.tipo || i.tipo === s.tipo) && (!s.est || i.estado === s.est)
      && (!q || normal([i.comentario, i.tipo, i.nombre, i.nota].join(' ')).includes(q)));
    // Dentro de cada grupo, la más reciente primero (los datos ya vienen así)
    const cmp = { operario: (a, b) => es(a.nombre, b.nombre), tipo: (a, b) => es(a.tipo, b.tipo), estado: (a, b) => (a.estado === 'Resuelta') - (b.estado === 'Resuelta') }[s.orden];
    return cmp ? l.sort((a, b) => cmp(a, b) || b.t - a.t) : l;
  };
  // Selección (una o varias filas): las elegidas que siguen visibles con los filtros, en el orden del listado; si no hay ninguna, la primera
  G.incSeleccionadas = () => { const l = G.incFiltradas(), q = S().incSels || []; const v = l.filter(i => q.includes(i.id)); return v.length ? v : l.slice(0, 1); };
  G.incSeleccionada = () => G.incSeleccionadas()[0];
  const ICO_EXP = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M12 12v6M9 15l3 3 3-3"/></svg>';

  function incidencias() {
    const s = S(), D = s.data;
    const tipos = Array.from(new Set(D.inc.map(i => i.tipo))).sort((a, b) => a.localeCompare(b, 'es'));
    const l = G.incFiltradas(), sels = G.incSeleccionadas(), sel = sels[0], multi = sels.length > 1, enSel = new Set(sels.map(i => i.id));
    const op = (v, t, a) => '<option value="' + esc(v) + '"' + (v === a ? ' selected' : '') + '>' + esc(t) + '</option>';
    const msg = s.incMsg ? '<div class="aviso ' + (s.incMsg.ok ? 'ok' : 'err') + '" role="status">' + esc(s.incMsg.t) + '</div>' : '';
    const barra = '<div class="barra">'
      + '<label class="campo"><span>Ordenar por</span><select id="fOrden">' + Object.keys(ORDENES).map(k => op(k, ORDENES[k], s.orden)).join('') + '</select></label>'
      + '<label class="campo"><span>Estado</span><select id="fEst">' + op('', 'Todas', s.est) + op('Pendiente', 'Pendientes', s.est) + op('Resuelta', 'Resueltas', s.est) + '</select></label>'
      + '<label class="campo"><span>Tipo</span><select id="fTipo">' + op('', 'Todos', s.tipo) + tipos.map(t => op(t, t, s.tipo)).join('') + '</select></label>'
      + '<label class="campo buscar"><span>Buscar</span><input type="search" id="fBuscar" placeholder="Comentario, operario, nota…" value="' + esc(s.q) + '"></label></div>';
    // Ficha del listado: título, contador y, a la derecha, el icono para exportar a Excel
    // Casilla «todas»: marcada si están todas elegidas, a medias (indeterminada) si hay varias pero no todas
    const todas = l.length > 1 && sels.length === l.length;
    const ficha = cuerpo => '<div class="card" style="flex:1.2 1 440px;min-width:0"><div class="lcab">'
      + (l.length > 1 ? '<input type="checkbox" class="selc" id="chkTodas" title="Seleccionar todas" aria-label="Seleccionar todas las incidencias"' + (todas ? ' checked' : '') + ' data-ind="' + (multi && !todas ? 1 : 0) + '">' : '')
      + '<h2>Listado Incidencias</h2><span class="chip c-gr num" aria-label="' + l.length + ' incidencias">' + l.length + '</span><span style="flex:1"></span>'
      + '<button type="button" class="ico" id="bCsv"' + (l.length ? '' : ' disabled') + ' title="Exportar a Excel" aria-label="Exportar a Excel">' + ICO_EXP + '</button></div>' + cuerpo + '</div>';
    if (!l.length) return barra + msg + '<div class="fila">' + ficha(vacio(D.inc.length ? 'Ninguna incidencia cumple los filtros.' : 'No hay incidencias en el periodo.')) + '</div>';

    // El tipo ocupa siempre el mismo ancho: si el nombre es largo se recorta con «…» (completo al pasar el ratón)
    // El número (con el color del tipo) es el mismo que lleva su triángulo en el mapa
    // Casilla de cada fila: suma o quita esa incidencia de la selección (también Ctrl+clic; Mayús+clic elige un tramo)
    const item = (i, k) => '<div class="it clic' + (enSel.has(i.id) ? ' sel' : '') + (i.estado === 'Resuelta' ? ' res' : '') + '" data-inc="' + esc(i.id) + '"><input type="checkbox" class="selc" aria-label="Seleccionar la incidencia ' + (k + 1) + '"' + (enSel.has(i.id) ? ' checked' : '') + '><span class="nro num" style="background:' + G.colorTipo(i.tipo) + '" aria-label="Número ' + (k + 1) + ' en el mapa">' + (k + 1) + '</span><span class="chip c-gr tipo" title="' + esc(i.tipo) + '">' + esc(i.tipo) + '</span><div style="flex:1;min-width:0"><div style="font-weight:700">' + esc(i.comentario || 'Sin comentario') + '</div><div class="sub">' + esc(i.nombre) + ' · ' + G.diaCorto(i.dia) + ' ' + G.hhmm(i.t) + '</div></div>'
      + ((i.adjuntos || []).length ? '<span class="chip c-gr" title="Adjuntos">' + i.adjuntos.length + ' adj.</span>' : '') + chipEst(i.estado) + '</div>';
    // Adjuntos: miniatura de las fotos (si Drive la da) e icono para vídeos y audios; al pulsar se abren en el visor
    const va = adjVisibles(sel);
    const tesela = a => {
      const k = va.indexOf(a), t = TIPO_ADJ[a.tipo] || 'Archivo', id = G.driveId(a.url);
      const img = a.tipo === 'foto' && id ? '<img alt="" loading="lazy" src="https://drive.google.com/thumbnail?id=' + encodeURIComponent(id) + '&amp;sz=w400" onerror="this.remove()">' : '';
      return k < 0 ? '<span class="adj sin" title="Este adjunto aún no tiene enlace en Drive">' + (ICO_ADJ[a.tipo] || ICO_ADJ.foto) + '<span>' + t + ' (sin enlace)</span></span>'
        : '<button type="button" class="adj" data-adj="' + k + '" title="Ver ' + esc(a.nombre) + '">' + (ICO_ADJ[a.tipo] || ICO_ADJ.foto) + img + '<span>' + t + '</span></button>';
    };
    // Seguimiento: historial «[DD/MM/AAAA] [Usuario] comentario» (una línea por comentario guardado), comentario nuevo y estado
    // Con varias elegidas, el comentario se añade a cada una y el estado elegido pasa a ser el de todas («Sin cambiar» si no coinciden)
    const clave = sels.map(i => i.id).join('|'), comun = new Set(sels.map(i => i.estado)).size === 1 ? sel.estado : '';
    const borr = s.borrador && s.borrador.id === clave ? s.borrador : { t: '', est: comun };
    const res = sel.estado === 'Resuelta', dis = s.guardando ? ' disabled' : '';
    const hist = String(sel.nota || '').split('\n').filter(x => x.trim()).map(x => {
      const m = x.match(/^\[(\d{2}\/\d{2}\/\d{4})\]\s*\[([^\]]*)\]\s*(.*)$/);
      return m ? '<li><span class="hq">[' + esc(m[1]) + '] [' + esc(m[2]) + ']</span> ' + esc(m[3]) + '</li>' : '<li>' + esc(x) + '</li>';
    }).join('');
    const seguimiento = '<div class="gestion"><h2 style="font-size:14px">Seguimiento</h2>'
      + (multi ? '<span class="sub">El comentario se añadirá al seguimiento de <b>cada una de las ' + sels.length + ' incidencias</b>, y el estado que elijas será el de todas.</span>'
        : hist ? '<ol class="hist">' + hist + '</ol>' : '<span class="sub">Todavía no hay comentarios de seguimiento.</span>')
      + '<div class="segfila"><textarea id="incNota" data-id="' + esc(clave) + '" rows="2" maxlength="1000" aria-label="Comentario de seguimiento" placeholder="Añade un comentario: qué se ha hecho, quién se encarga…"' + dis + '>' + esc(borr.t) + '</textarea>'
      // Estado: dos botones a la derecha del texto; el activo se destaca y al pulsar el otro cambia (se guarda con «Actualizar»)
      + '<div class="segest" role="group" aria-label="Estado"><input type="hidden" id="incEstado" data-id="' + esc(clave) + '" value="' + esc(borr.est) + '">'
      + ['Pendiente', 'Resuelta'].map(v => '<button type="button" class="estb ' + (v === 'Resuelta' ? 'r' : 'p') + (borr.est === v ? ' on' : '') + '" data-est="' + v + '" aria-pressed="' + (borr.est === v) + '"' + dis + '>' + v + '</button>').join('') + '</div></div>'
      + '<div class="barra"><span style="flex:1"></span>' + (s.guardando ? '<span class="sub" id="segProg">' + esc(typeof s.guardando === 'string' ? s.guardando : 'Guardando…') + '</span>' : '')
      + '<button type="button" class="btn pri" id="bSeg" data-id="' + esc(clave) + '"' + dis + '>' + (multi ? 'Actualizar las ' + sels.length : 'Actualizar') + '</button></div></div>';
    const detalle = '<div class="card" style="flex:1 1 400px;min-width:0;display:flex;flex-direction:column;gap:14px">'
      + '<div><div class="barra" style="gap:8px"><span class="lbl">' + esc(sel.tipo) + '</span>' + chipEst(sel.estado) + '</div><h2 style="font-size:20px;margin-top:6px">' + esc(sel.comentario || 'Sin comentario') + '</h2></div>'
      + '<div style="display:flex;flex-wrap:wrap;gap:8px 24px;font-size:14px"><div><span class="sub">Registrada por</span><br><b>' + esc(sel.nombre) + '</b></div><div><span class="sub">Fecha y hora</span><br><b class="num">' + G.diaCorto(sel.dia) + ' · ' + G.hhmm(sel.t) + '</b></div>'
      + (sel.fechaEstado && !isNaN(new Date(sel.fechaEstado)) ? '<div><span class="sub">' + (res ? 'Resuelta' : 'Último cambio') + '</span><br><b class="num">' + G.diaCorto(G.dayKey(new Date(sel.fechaEstado))) + ' · ' + G.hhmm(new Date(sel.fechaEstado).getTime()) + '</b></div>' : '') + '</div>'
      // Adjuntos en carrusel (una fila que se desliza, con ‹ › si no caben), encima del mapa
      + '<div><h2 style="font-size:14px;margin-bottom:8px">Adjuntos' + ((sel.adjuntos || []).length ? ' <span class="chip c-gr num">' + sel.adjuntos.length + '</span>' : '') + '</h2>'
      + ((sel.adjuntos || []).length ? '<div class="carr"><button type="button" class="carrb" data-carr="-1" aria-label="Adjuntos anteriores" hidden>‹</button><div class="adjs">' + sel.adjuntos.map(tesela).join('') + '</div><button type="button" class="carrb" data-carr="1" aria-label="Más adjuntos" hidden>›</button></div>' : '<span class="sub">Sin adjuntos.</span>') + '</div>'
      + (sel.lat != null ? '<div id="mapa" class="mapa mini" aria-label="Ubicación de la incidencia"></div>' : '<span class="sub">Sin posición GPS.</span>')
      + seguimiento + '</div>';
    // Varias elegidas: resumen de cada una (al pulsarla se queda solo esa), todas en el mapa y un seguimiento común
    const detalleMulti = '<div class="card" style="flex:1 1 400px;min-width:0;display:flex;flex-direction:column;gap:14px">'
      + '<div class="barra" style="gap:8px"><h2 style="font-size:20px">' + sels.length + ' incidencias seleccionadas</h2><span style="flex:1"></span><button type="button" class="btn" id="bQuitarSel">Quitar selección</button></div>'
      + '<div class="selchips">' + sels.map(i => { const k = l.indexOf(i) + 1; return '<button type="button" class="selchip" data-inc="' + esc(i.id) + '" title="Ver solo esta"><span class="nro num" style="background:' + G.colorTipo(i.tipo) + '">' + k + '</span><span class="chip c-gr tipo" title="' + esc(i.tipo) + '">' + esc(i.tipo) + '</span><span class="scn">' + esc(i.nombre) + ' · ' + G.diaCorto(i.dia) + ' ' + G.hhmm(i.t) + '</span>' + chipEst(i.estado) + '</button>'; }).join('') + '</div>'
      + (sels.some(i => i.lat != null) ? '<div id="mapa" class="mapa mini" aria-label="Ubicación de las incidencias seleccionadas"></div>' : '<span class="sub">Ninguna tiene posición GPS.</span>')
      + seguimiento + '</div>';
    return barra + msg + '<div class="fila">' + ficha('<div class="lista larga">' + l.map(item).join('') + '</div>') + (multi ? detalleMulti : detalle) + '</div>';
  }

  // Mapa pequeño del detalle: la incidencia elegida y, más pequeñas, las demás del listado (al pulsarlas se eligen)
  // Triángulo de la incidencia: color de su tipo y su número del listado (la elegida, más grande y con borde lima)
  const triangulo = (i, n, elegida) => {
    const w = elegida ? 40 : 30, h = Math.round(w * .92), c = G.colorTipo(i.tipo), fs = String(n).length > 2 ? 8 : String(n).length > 1 ? 10 : 12;
    return L.divIcon({ className: 'mk tri' + (elegida ? ' sel' : ''), iconSize: [w, h], iconAnchor: [w / 2, h - 2],
      html: '<svg width="' + w + '" height="' + h + '" viewBox="0 0 30 28" aria-hidden="true"><path d="M15 2 L28.5 25.5 H1.5 Z" fill="' + c + '" stroke="' + (elegida ? '#a6cd3a' : '#fff') + '" stroke-width="' + (elegida ? 3 : 2) + '" stroke-linejoin="round"/><text x="15" y="22" text-anchor="middle" font-size="' + fs + '" font-weight="800" fill="#fff" font-family="Figtree,system-ui,sans-serif">' + n + '</text></svg>' });
  };
  const ICO_GMAPS = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>';
  function miniMapa() {
    const el = document.getElementById('mapa'), l = G.incFiltradas(), sels = G.incSeleccionadas().filter(i => i.lat != null), sel = sels[0];
    if (!el || !sel) return;
    const enSel = new Set(sels.map(i => i.id));
    G.destruirMapa();
    const m = L.map(el, { scrollWheelZoom: false }); mapaActual = m;
    const fondos = crearFondos();
    let fondo = 'Aérea'; try { fondo = localStorage.getItem('gea.panel.fondo') || fondo; } catch (e) { /* sin almacenamiento */ }
    (fondos[fondo] || fondos['Aérea']).addTo(m);
    L.control.layers(fondos, null, { position: 'topright' }).addTo(m);
    // Abrir en Google Maps: icono dentro del mapa, bajo el zoom
    const GM = L.Control.extend({ options: { position: 'topleft' }, onAdd() {
      const c = L.DomUtil.create('div', 'leaflet-bar ubic'), a = L.DomUtil.create('a', '', c);
      a.href = 'https://maps.google.com/?q=' + sel.lat + ',' + sel.lon; a.target = '_blank'; a.rel = 'noopener'; a.title = 'Abrir en Google Maps'; a.setAttribute('aria-label', a.title); a.innerHTML = ICO_GMAPS;
      L.DomEvent.disableClickPropagation(c); return c; } });
    new GM().addTo(m);
    // Cada incidencia con su número del listado (mismo orden y filtros)
    // Las elegidas, grandes y con borde lima; las demás, pequeñas y atenuadas (clic: elegir solo esa; Ctrl/Mayús+clic: sumarla)
    l.forEach((i, k) => {
      if (i.lat == null || enSel.has(i.id)) return;
      L.marker([i.lat, i.lon], { icon: triangulo(i, k + 1, false), opacity: sels.length > 1 ? .6 : 1 })
        .bindTooltip((k + 1) + '. ' + esc(i.tipo) + ' · ' + esc(i.nombre) + ' · ' + G.diaCorto(i.dia))
        .on('click', e => { const o = e.originalEvent || {}; G.elegirInc(i.id, o.ctrlKey || o.metaKey || o.shiftKey); }).addTo(m);
    });
    if (sels.length === 1 && sel.precision && sel.precision <= 200) L.circle([sel.lat, sel.lon], { radius: sel.precision, color: G.colorTipo(sel.tipo), weight: 1, fillOpacity: .15, interactive: false }).addTo(m);
    sels.forEach(i => {
      const k = l.indexOf(i) + 1;
      L.marker([i.lat, i.lon], { zIndexOffset: 1000, icon: triangulo(i, k, true) }).bindTooltip(k + '. ' + esc(i.tipo) + ' · ' + esc(i.nombre)).addTo(m);
    });
    if (sels.length === 1) m.setView([sel.lat, sel.lon], 17);
    else m.fitBounds(L.latLngBounds(sels.map(i => [i.lat, i.lon])), { padding: [36, 36], maxZoom: 18 });
    setTimeout(() => { if (mapaActual === m) m.invalidateSize(); }, 80);
  }

  // Visor de adjuntos dentro del panel (vista previa de Drive). Flechas o ‹ › para pasar; Escape o ✕ para cerrar.
  let visor = null;
  function cerrarVisor() { if (visor) { visor.el.remove(); visor = null; document.body.style.overflow = ''; } }
  // Carrusel de adjuntos: las flechas solo aparecen si hay más adjuntos de los que caben a cada lado
  G.carrusel = paso => {
    const c = document.querySelector('.carr'); if (!c) return;
    const a = c.querySelector('.adjs'), [ant, sig] = c.querySelectorAll('.carrb');
    if (paso) { a.scrollBy({ left: paso * Math.max(120, a.clientWidth * .8), behavior: 'smooth' }); return; }
    const flechas = () => { ant.hidden = a.scrollLeft <= 2; sig.hidden = a.scrollLeft + a.clientWidth >= a.scrollWidth - 2; };
    a.addEventListener('scroll', flechas, { passive: true }); flechas();
  };
  function pintarVisor() {
    const a = visor.lista[visor.k], id = G.driveId(a.url), u = G.urlSegura(a.url), n = visor.lista.length;
    visor.el.querySelector('.vt').textContent = (TIPO_ADJ[a.tipo] || 'Archivo') + ' · ' + a.nombre + (n > 1 ? '  (' + (visor.k + 1) + ' de ' + n + ')' : '');
    visor.el.querySelector('.vdrive').href = u || '#'; visor.el.querySelector('.vdrive').hidden = !u;
    visor.el.querySelectorAll('.vnav').forEach(b => { b.hidden = n < 2; });
    visor.el.querySelector('.vmarco').innerHTML = esDemo(a) ? '<div class="vdemo">' + (ICO_ADJ[a.tipo] || ICO_ADJ.foto) + '<b>' + esc(TIPO_ADJ[a.tipo] || 'Archivo') + ' de ejemplo</b><span>' + esc(a.nombre) + '</span><span class="sub" style="color:#cfe0cf">En el modo demostración no hay archivos reales.</span></div>' : id ? '<iframe title="' + esc(a.nombre) + '" src="https://drive.google.com/file/d/' + encodeURIComponent(id) + '/preview" allow="autoplay; fullscreen" allowfullscreen></iframe>'
      : '<div class="vacio" style="color:#fff">No se puede mostrar aquí. Usa «Abrir en Drive».</div>';
  }
  G.abrirVisor = k => {
    const sel = G.incSeleccionada(); if (!sel) return;
    const lista = adjVisibles(sel); if (!lista[k]) return;
    cerrarVisor();
    const el = document.createElement('div'); el.className = 'visor'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Adjuntos de la incidencia');
    el.innerHTML = '<div class="vcab"><span class="vt"></span><a class="btn vdrive" target="_blank" rel="noopener">Abrir en Drive</a><button type="button" class="btn vx" aria-label="Cerrar">✕</button></div>'
      + '<div class="vcuerpo"><button type="button" class="vnav" data-paso="-1" aria-label="Anterior">‹</button><div class="vmarco"></div><button type="button" class="vnav" data-paso="1" aria-label="Siguiente">›</button></div>';
    el.addEventListener('click', e => {
      const b = e.target.closest('.vx,.vnav');
      if (b && b.classList.contains('vx')) cerrarVisor();
      else if (b) { visor.k = (visor.k + Number(b.dataset.paso) + visor.lista.length) % visor.lista.length; pintarVisor(); }
      else if (e.target === el || e.target.classList.contains('vcuerpo')) cerrarVisor();
    });
    document.body.appendChild(el); document.body.style.overflow = 'hidden';
    visor = { el, lista, k }; pintarVisor(); el.querySelector('.vx').focus();
  };
  document.addEventListener('keydown', e => {
    if (!visor) return;
    if (e.key === 'Escape') cerrarVisor();
    else if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && visor.lista.length > 1) { visor.k = (visor.k + (e.key === 'ArrowRight' ? 1 : -1) + visor.lista.length) % visor.lista.length; pintarVisor(); }
  });

  // Exporta las incidencias filtradas a CSV (separado por «;» y con coma decimal: lo abre Excel en español tal cual)
  G.exportarInc = () => {
    const l = G.incFiltradas(), p = G.periodo();
    const cel = v => { let t = String(v == null ? '' : v); if (/^[=+\-@]/.test(t) && !/^-?\d/.test(t)) t = "'" + t; return /[";\r\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
    const dec = n => n == null ? '' : String(n).replace('.', ',');
    const cab = ['Fecha', 'Hora', 'Empleado', 'Tipo', 'Comentario', 'Estado', 'Nota supervisor', 'Latitud', 'Longitud', 'Precisión (m)', 'Ver en mapa', 'Adjuntos', 'Enlaces adjuntos'];
    const filas = l.map(i => [i.dia.split('-').reverse().join('/'), G.hhmm(i.t), i.nombre, i.tipo, i.comentario, i.estado, i.nota, dec(i.lat), dec(i.lon), dec(i.precision),
      i.lat != null ? 'https://maps.google.com/?q=' + i.lat + ',' + i.lon : '', (i.adjuntos || []).map(a => a.nombre).join('\n'), (i.adjuntos || []).map(a => G.urlSegura(a.url)).filter(Boolean).join('\n')]);
    const txt = '﻿' + [cab].concat(filas).map(f => f.map(cel).join(';')).join('\r\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'text/csv;charset=utf-8' }));
    a.download = 'incidencias_' + p[0] + (p.length > 1 ? '_' + p[p.length - 1] : '') + '.csv';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

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
      + '<label>Usuario <span class="sub" style="font-weight:600">(firma los comentarios de seguimiento de las incidencias)</span><input type="text" id="cUsuario" maxlength="40" autocomplete="name" placeholder="Admin" value="' + esc(G.usuario()) + '"></label>'
      + '<h2 style="margin-top:6px">Reglas de jornada</h2><div class="barra"><label>Horas para contar jornal<input type="number" id="cJornal" min="1" max="12" step="0.5" value="' + esc(c.jornalH) + '"></label><label>Hora de fin (extra desde)<input type="time" id="cFin" value="' + esc(c.finHora) + '"></label></div>'
      + '<label class="chk"><input type="checkbox" id="cPrueba"' + (c.prueba ? ' checked' : '') + '> Incluir filas marcadas como «Datos de prueba»</label>'
      + '<label class="chk"><input type="checkbox" id="cDemo"' + (c.demo ? ' checked' : '') + '> Modo demostración (datos de ejemplo, sin conexión)</label>'
      + '<div class="barra"><button class="btn pri" type="submit">Guardar</button><button class="btn" type="button" id="bProbar">Probar conexión</button></div><div id="cEstado" class="sub" role="status"></div></form>';
  }

  G.vistas = {
    resumen: { t: 'Resumen', f: resumen, post: () => pintarMapa(document.getElementById('mapa'), S().data, { emp: S().emp, lab: S().lab, dia: refDia() }, capasPor) },
    mapa: { t: 'Dónde se ha trabajado', f: mapa, post: () => pintarMapa(document.getElementById('mapa'), S().data, { emp: S().emp, lab: S().lab, dia: refDia() }, capasPor) },
    personal: { t: 'Jornales y horas', f: personal },
    incidencias: { t: 'Incidencias', f: incidencias, post: miniMapa },
    labores: { t: 'Labores', f: labores },
    config: { t: 'Configuración', f: config, sinDatos: true }
  };
  G.repintarMapa = () => pintarMapa(document.getElementById('mapa'), S().data, { emp: S().emp, lab: S().lab, dia: refDia() }, capasPor);
  G.capas = capasPor;
})(typeof window !== 'undefined' ? window : globalThis);
