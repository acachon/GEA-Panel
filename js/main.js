/* Arranque del panel: estado, carga de datos, navegación y eventos. */
(function () {
  const G = GEA, esc = G.esc, $ = s => document.querySelector(s), CLAVE_LS = 'gea.panel.cfg';
  const hoy = () => G.dayKey(new Date());
  const porDefecto = { url: 'https://script.google.com/macros/s/AKfycbwyxG9hLAvFaBGn_bjbZK-2vN-N8m_93iphLB91ertYT56SY0TQI_wEXtFVBdE4BP8o4Q/exec', clave: '', jornalH: 5, finHora: '17:00', prueba: true, demo: false };
  const leerCfg = () => { try { return Object.assign({}, porDefecto, JSON.parse(localStorage.getItem(CLAVE_LS) || '{}')); } catch (e) { return Object.assign({}, porDefecto); } };
  const guardarCfg = c => { try { localStorage.setItem(CLAVE_LS, JSON.stringify(c)); } catch (e) { /* sin almacenamiento: queda solo en memoria */ } };

  const S = G.state = { vista: 'resumen', modo: 'hoy', dia: hoy(), emp: '', lab: '', tipo: '', est: '', q: '', desde: '', hasta: '', incSel: null, incMsg: null, borrador: null, guardando: false, data: null, cargando: false, error: null, actualizado: null, cfg: leerCfg() };
  const MAX_DIAS = 92; // rango máximo (Desde / Hasta de Incidencias)
  const ultimos = n => { const h = hoy(); return Array.from({ length: n }, (_, i) => G.addDays(h, i - n + 1)); };
  G.periodo = () => {
    const h = hoy();
    if (S.modo === 'rango') { const l = []; for (let d = S.desde; d <= S.hasta && l.length < MAX_DIAS; d = G.addDays(d, 1)) l.push(d); return l.length ? l : [h]; }
    return S.modo === 'hoy' ? [h] : S.modo === 'ayer' ? [G.addDays(h, -1)] : S.modo === '7d' ? ultimos(7) : S.modo === '30d' ? ultimos(30) : [S.dia];
  };
  const conectado = () => S.cfg.demo || (S.cfg.url && S.cfg.clave);

  async function cargar(forzar, silencioso) {
    if (!conectado()) { S.data = null; S.error = null; render(); return; }
    if (!silencioso) { S.cargando = true; S.error = null; render(); }
    try { const raw = await G.api.dias(S.cfg, G.periodo(), forzar); S.data = G.construir(raw, S.cfg); S.actualizado = Date.now(); S.error = null; }
    catch (e) { S.error = (e && e.message) || String(e); if (!silencioso) S.data = null; }
    S.cargando = false; render();
  }

  function cabecera(v) {
    if (S.vista === 'config') return '<div class="cab"><div><span class="lbl">Finca El Caimbo</span><h1>' + v.t + '</h1></div></div>';
    const p = G.periodo(), D = S.data, filtroLab = S.vista !== 'incidencias' && S.vista !== 'personal' ? '' : '';
    const seg = (m, t) => '<button data-modo="' + m + '" class="' + (S.modo === m ? 'on' : '') + '">' + t + '</button>';
    const fecha = p.length === 1 ? G.diaLargo(p[0]) : G.diaCorto(p[0]) + ' – ' + G.diaCorto(p[p.length - 1]);
    const opts = (lista, sel, vacio) => '<option value="">' + vacio + '</option>' + lista.map(x => '<option value="' + esc(x[0]) + '"' + (x[0] === sel ? ' selected' : '') + '>' + esc(x[1]) + '</option>').join('');
    return '<div class="cab"><div><span class="lbl">Finca El Caimbo · ' + fecha + '</span><h1>' + v.t + '</h1><div class="barra" style="margin-top:6px">'
      + (S.actualizado ? '<span class="sub">Actualizado ' + G.hhmm(S.actualizado) + '</span>' : '')
      + (S.cfg.demo ? '<span class="chip c-av">Datos de ejemplo</span>' : D && D.hayPrueba ? '<span class="chip c-av">Incluye datos de prueba</span>' : '')
      + '</div></div><div class="barra"><div class="seg">' + seg('hoy', 'Hoy') + seg('ayer', 'Ayer') + seg('7d', '7 días') + seg('30d', '30 días') + '</div>'
      + '<label class="campo"><span>Día</span><input type="date" id="fDia" max="' + hoy() + '" value="' + (p.length === 1 ? p[0] : '') + '"></label>'
      + (D ? '<label class="campo"><span>Empleado</span><select id="fEmp">' + opts(D.empleados.map(e => [e, e]), S.emp, 'Todos') + '</select></label>'
        + (S.vista === 'resumen' || S.vista === 'mapa' || S.vista === 'labores' ? '<label class="campo"><span>Labor</span><select id="fLab">' + opts(G.LABORES.filter(l => !l.pausa).map(l => [l.k, l.n]), S.lab, 'Todas') + '</select></label>' : '') : '')
      + '<button class="btn pri" id="bAct"' + (S.cargando ? ' disabled' : '') + '>' + (S.cargando ? 'Cargando…' : 'Actualizar') + '</button></div></div>' + filtroLab;
  }

  function render() {
    G.destruirMapa();
    const v = G.vistas[S.vista] || G.vistas.resumen;
    document.querySelectorAll('#nav a.item').forEach(a => a.classList.toggle('on', a.dataset.v === S.vista));
    let h = cabecera(v), hayMapa = false;
    if (v.sinDatos) h += v.f();
    else if (!conectado()) h += '<div class="card" style="max-width:640px"><h2>Conecta el panel con el Registro central</h2><p class="sub">Escribe la dirección del servicio y la clave de lectura (las mismas que usa el supervisor en la app) o mira cómo quedaría con datos de ejemplo.</p><div class="barra"><a class="btn pri" style="display:inline-flex;align-items:center;text-decoration:none" href="#config">Configurar conexión</a><button class="btn" data-demo="1">Ver con datos de ejemplo</button></div></div>';
    else if (S.error) h += '<div class="aviso err" role="alert">No se pudieron leer los datos: ' + esc(S.error) + '. Revisa la conexión en <a href="#config">Configuración</a>.</div>';
    else if (!S.data) h += '<div class="vacio">Cargando datos del Registro central…</div>';
    else if (!S.data.acts.length && !S.data.inc.length) h += '<div class="vacio">El Registro central no tiene datos en este periodo.' + (S.cfg.prueba ? '' : ' Prueba a incluir los «Datos de prueba» en Configuración.') + '</div>';
    else { h += v.f(); hayMapa = !!v.post; }
    $('#vista').innerHTML = h;
    $('#main').classList.toggle('cargando', S.cargando && !!S.data);
    if (hayMapa && document.getElementById('mapa') && window.L) v.post();
  }

  G.render = render;

  // Pendiente / Resuelta (con la nota escrita) de la incidencia elegida
  async function guardarEstado(id, valor) {
    const caja = $('#incNota'), nota = caja ? caja.value.trim() : '';
    S.borrador = { id, t: nota }; S.guardando = true; S.incMsg = null; render();
    try {
      const r = await G.api.estado(S.cfg, id, valor, nota), i = S.data && S.data.inc.find(x => x.id === id);
      if (i) Object.assign(i, { estado: r.estado, nota: r.nota, fechaEstado: r.fechaEstado });
      S.borrador = null; S.incSel = id;
      S.incMsg = { ok: true, t: (i ? '«' + (i.comentario || i.tipo) + '»: ' : '') + (r.estado === 'Resuelta' ? 'resuelta' : 'pendiente') + (r.nota ? ', con la nota guardada.' : '.') };
    } catch (e) { S.incMsg = { ok: false, t: 'No se pudo guardar: ' + ((e && e.message) || e) }; }
    S.guardando = false; render();
  }

  function ruta() { const v = (location.hash || '#resumen').slice(1); S.vista = G.vistas[v] ? v : 'resumen'; render(); }
  window.addEventListener('hashchange', ruta);

  document.addEventListener('click', e => {
    const t = e.target.closest('[data-modo],[data-inc],[data-ir],[data-demo],[data-estado],[data-adj],#bAct,#bProbar,#bCsv'); if (!t) return;
    if (t.dataset.modo) { S.modo = t.dataset.modo; cargar(false); }
    else if (t.dataset.inc) { S.incSel = t.dataset.inc; S.incMsg = null; render(); }
    else if (t.dataset.estado) { if (!S.guardando) guardarEstado(t.dataset.id, t.dataset.estado); }
    else if (t.dataset.adj) G.abrirVisor(Number(t.dataset.adj));
    else if (t.id === 'bCsv') G.exportarInc();
    else if (t.dataset.ir) { S.emp = t.dataset.emp || ''; }
    else if (t.dataset.demo) { S.cfg.demo = true; guardarCfg(S.cfg); cargar(true); }
    else if (t.id === 'bAct') { cargar(true); }
    else if (t.id === 'bProbar') probar();
  });
  document.addEventListener('change', e => {
    const t = e.target;
    if (t.id === 'fDia') { if (t.value) { S.dia = t.value; S.modo = 'dia'; cargar(false); } }
    else if (t.id === 'fEmp') { S.emp = t.value; render(); }
    else if (t.id === 'fLab') { S.lab = t.value; render(); }
    else if (t.id === 'fTipo') { S.tipo = t.value; S.incMsg = null; render(); }
    else if (t.id === 'fEst') { S.est = t.value; S.incMsg = null; render(); }
    else if (t.id === 'fDesde' || t.id === 'fHasta') {
      const p = G.periodo(); let d = $('#fDesde').value || p[0], h = $('#fHasta').value || p[p.length - 1];
      if (d > h) [d, h] = [h, d];
      if (G.addDays(d, MAX_DIAS - 1) < h) { d = G.addDays(h, -(MAX_DIAS - 1)); alert('Como mucho se ven ' + MAX_DIAS + ' días seguidos: el periodo empieza el ' + G.diaLargo(d) + '.'); }
      S.desde = d; S.hasta = h; S.modo = d === h ? 'dia' : 'rango'; S.dia = d; S.incMsg = null; cargar(false);
    }
    else if (t.dataset && t.dataset.capa) { G.capas[t.dataset.capa] = t.checked; G.repintarMapa(); }
  });
  // Buscar en Incidencias: filtra mientras se escribe sin perder el cursor; la nota se guarda como borrador
  let tBuscar = null;
  document.addEventListener('input', e => {
    const t = e.target;
    if (t.id === 'incNota') S.borrador = { id: t.dataset.id, t: t.value };
    if (t.id !== 'fBuscar') return;
    S.q = t.value; clearTimeout(tBuscar);
    tBuscar = setTimeout(() => {
      const pos = t.selectionStart; render();
      const n = $('#fBuscar'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (err) { /* sin cursor */ } }
    }, 250);
  });
  document.addEventListener('submit', e => {
    if (e.target.id !== 'formCfg') return; e.preventDefault();
    S.cfg = { url: $('#cUrl').value.trim(), clave: $('#cClave').value.trim(), jornalH: Number($('#cJornal').value) || 5, finHora: $('#cFin').value || '17:00', prueba: $('#cPrueba').checked, demo: $('#cDemo').checked };
    guardarCfg(S.cfg); G.api.vaciar(); S.emp = ''; S.lab = '';
    $('#cEstado').textContent = 'Guardado.'; cargar(true).then(() => { if (conectado()) location.hash = '#resumen'; });
  });
  async function probar() {
    const est = $('#cEstado'), c = { url: $('#cUrl').value.trim(), clave: $('#cClave').value.trim() };
    if (!c.url || !c.clave) { est.textContent = 'Escribe la dirección y la clave.'; return; }
    est.textContent = 'Probando…';
    try { const j = await G.api.leerRangos(c, [G.api.rangoDia(hoy())]); est.textContent = 'Conexión correcta: hoy hay ' + j.actividades.length + ' actividades, ' + j.incidencias.length + ' incidencias y ' + j.puntos.length + ' puntos GPS.'; }
    catch (err) { est.textContent = 'No funciona: ' + (err.message || err); }
  }

  // Refresco automático cada 2 minutos mientras se mira el día en curso
  // (no mientras se escribe una nota o una búsqueda, ni con el visor de adjuntos abierto)
  setInterval(() => { if (!document.hidden && S.vista !== 'config' && !S.guardando && !document.querySelector('.visor') && !(document.activeElement && /^(incNota|fBuscar)$/.test(document.activeElement.id)) && conectado() && G.periodo().includes(hoy())) cargar(false, true); }, 120000);
  ruta(); cargar(false);
})();
