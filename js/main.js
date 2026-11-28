/* Arranque del panel: estado, carga de datos, navegación y eventos. */
(function () {
  const G = GEA, esc = G.esc, $ = s => document.querySelector(s), CLAVE_LS = 'gea.panel.cfg';
  const hoy = () => G.dayKey(new Date());
  const porDefecto = { url: 'https://script.google.com/macros/s/AKfycbwyxG9hLAvFaBGn_bjbZK-2vN-N8m_93iphLB91ertYT56SY0TQI_wEXtFVBdE4BP8o4Q/exec', clave: '', usuario: 'Admin', jornalH: 5, finHora: '17:00', prueba: true, demo: false };
  const leerCfg = () => { try { return Object.assign({}, porDefecto, JSON.parse(localStorage.getItem(CLAVE_LS) || '{}')); } catch (e) { return Object.assign({}, porDefecto); } };
  const guardarCfg = c => { try { localStorage.setItem(CLAVE_LS, JSON.stringify(c)); } catch (e) { /* sin almacenamiento: queda solo en memoria */ } };

  const S = G.state = { vista: 'resumen', modo: 'hoy', dia: hoy(), emp: '', lab: '', tipo: '', est: '', q: '', orden: 'fecha', dias: [], cal: null, incSels: [], incAncla: null, incMsg: null, borrador: null, guardando: false, data: null, cargando: false, error: null, actualizado: null, cfg: leerCfg() };
  const MAX_DIAS = 92; // días que se pueden elegir a la vez en el calendario
  const ultimos = n => { const h = hoy(); return Array.from({ length: n }, (_, i) => G.addDays(h, i - n + 1)); };
  G.periodo = () => {
    const h = hoy();
    if (S.modo === 'dias') return S.dias.length ? S.dias.slice() : [h];
    return S.modo === 'hoy' ? [h] : S.modo === 'ayer' ? [G.addDays(h, -1)] : S.modo === '7d' ? ultimos(7) : S.modo === '30d' ? ultimos(30) : [S.dia];
  };
  // Usuario que firma el seguimiento de las incidencias (Configuración); por defecto, «Admin»
  G.usuario = () => String(S.cfg.usuario || '').trim() || 'Admin';
  const conectado = () => S.cfg.demo || (S.cfg.url && S.cfg.clave);

  async function cargar(forzar, silencioso) {
    if (!conectado()) { S.data = null; S.error = null; render(); return; }
    if (!silencioso) { S.cargando = true; S.error = null; render(); }
    try { const raw = await G.api.dias(S.cfg, G.periodo(), forzar); S.data = G.construir(raw, S.cfg); S.actualizado = Date.now(); S.error = null; }
    catch (e) { S.error = (e && e.message) || String(e); if (!silencioso) S.data = null; }
    S.cargando = false; render();
  }

  function cabecera(v) {
    if (S.vista === 'config') return '<div class="cab"><div><h1>' + v.t + '</h1></div></div>';
    const p = G.periodo(), D = S.data, seguidos = esSeguido(p);
    const seg = (m, t) => '<button data-modo="' + m + '" class="' + (S.modo === m ? 'on' : '') + '">' + t + '</button>';
    const ddmm = k => k.split('-').reverse().slice(0, 2).join('/');
    const txtDias = p.length === 1 ? p[0].split('-').reverse().join('/') : seguidos ? ddmm(p[0]) + ' – ' + ddmm(p[p.length - 1]) : p.length + ' días';
    const opts = (lista, sel, vacio) => '<option value="">' + vacio + '</option>' + lista.map(x => '<option value="' + esc(x[0]) + '"' + (x[0] === sel ? ' selected' : '') + '>' + esc(x[1]) + '</option>').join('');
    const aviso = S.cfg.demo ? '<span class="chip c-av">Datos de ejemplo</span>' : D && D.hayPrueba ? '<span class="chip c-av">Incluye datos de prueba</span>' : '';
    return '<div class="cab"><div class="barra"><h1>' + v.t + '</h1>' + aviso + '</div><div class="barra"><div class="seg">' + seg('hoy', 'Hoy') + seg('ayer', 'Ayer') + seg('7d', '7 días') + seg('30d', '30 días') + '</div>'
      + '<div class="calw"><button type="button" class="campo" id="bCal" aria-haspopup="dialog" aria-expanded="' + !!S.cal + '" title="Elegir uno o varios días"><span>Días</span><b>' + txtDias + '</b>' + ICO_CAL + '</button>' + (S.cal ? htmlCal() : '') + '</div>'
      + (D ? (S.vista === 'incidencias' ? '' : '<label class="campo"><span>Empleado</span><select id="fEmp">' + opts(D.empleados.map(e => [e, e]), S.emp, 'Todos') + '</select></label>')
        + (S.vista === 'resumen' || S.vista === 'mapa' || S.vista === 'labores' ? '<label class="campo"><span>Labor</span><select id="fLab">' + opts(G.LABORES.filter(l => !l.pausa).map(l => [l.k, l.n]), S.lab, 'Todas') + '</select></label>' : '') : '')
      + '<button type="button" class="ico act' + (S.cargando ? ' gira' : '') + '" id="bAct"' + (S.cargando ? ' disabled' : '') + ' title="' + (S.cargando ? 'Cargando datos…' : 'Actualizar datos') + '" aria-label="' + (S.cargando ? 'Cargando datos' : 'Actualizar datos') + '">' + ICO_ACT + '</button></div></div>';
  }
  const ICO_ACT = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>';
  const esSeguido = p => p.every((d, i) => !i || G.addDays(p[i - 1], 1) === d);

  // Menú de la izquierda: días que se están viendo y hora de la última actualización
  function pintarEstado() {
    const p = G.periodo(), el = $('#navEstado'); if (!el) return;
    const fecha = p.length === 1 ? G.diaLargo(p[0]) : esSeguido(p) ? G.diaCorto(p[0]) + ' – ' + G.diaCorto(p[p.length - 1]) : p.length + ' días elegidos';
    el.innerHTML = '<span class="ed"><span class="lbl">Datos de</span> <b>' + fecha + '</b></span>'
      + '<span class="eh">' + (S.cargando ? 'Cargando…' : S.actualizado ? 'Actualizado a las ' + G.hhmm(S.actualizado) : conectado() ? '' : 'Sin conexión') + '</span>';
  }

  /* Calendario de la cabecera: se pueden marcar varios días (con Mayús, todos los de un tramo) y «Aplicar» los carga */
  const ICO_CAL = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>';
  function htmlCal() {
    const c = S.cal, [y, m] = c.mes.split('-').map(Number), h = hoy(), n = new Date(y, m, 0).getDate(), hueco = (new Date(y, m - 1, 1).getDay() + 6) % 7;
    const nombre = new Date(y, m - 1, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).replace(/^./, x => x.toUpperCase());
    let celdas = '<span></span>'.repeat(hueco);
    for (let d = 1; d <= n; d++) {
      const k = y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      celdas += '<button type="button" data-cald="' + k + '" class="' + (c.sel.has(k) ? 'on' : '') + (k === h ? ' hoy' : '') + '"' + (k > h ? ' disabled' : '') + ' aria-pressed="' + c.sel.has(k) + '">' + d + '</button>';
    }
    return '<div class="cal" role="dialog" aria-label="Elegir días"><div class="calcab"><button type="button" data-calm="-1" aria-label="Mes anterior">‹</button><b>' + nombre + '</b><button type="button" data-calm="1" aria-label="Mes siguiente"' + (c.mes >= h.slice(0, 7) ? ' disabled' : '') + '>›</button></div>'
      + '<div class="calsem"><span>L</span><span>M</span><span>X</span><span>J</span><span>V</span><span>S</span><span>D</span></div><div class="caldias">' + celdas + '</div>'
      + '<div class="calpie"><span class="sub">' + c.sel.size + (c.sel.size === 1 ? ' día' : ' días') + '</span><span style="flex:1"></span><button type="button" class="calb" data-calx="limpiar"' + (c.sel.size ? '' : ' disabled') + '>Limpiar</button><button type="button" class="calb pri" data-calx="aplicar"' + (c.sel.size ? '' : ' disabled') + '>Aplicar</button></div></div>';
  }
  // Repinta solo el calendario (sin volver a dibujar la pantalla ni el mapa)
  function pintarCal() {
    const w = $('.calw'); if (!w) return;
    const viejo = w.querySelector('.cal'); if (viejo) viejo.remove();
    if (S.cal) w.insertAdjacentHTML('beforeend', htmlCal());
    $('#bCal').setAttribute('aria-expanded', !!S.cal);
  }
  function clicCal(t, e) {
    const c = S.cal;
    if (t.id === 'bCal') { const p = G.periodo(); S.cal = c ? null : { mes: p[p.length - 1].slice(0, 7), sel: new Set(p), ult: null }; }
    else if (t.dataset.cald) {
      const k = t.dataset.cald;
      if (e.shiftKey && c.ult) { const [a, b] = c.ult < k ? [c.ult, k] : [k, c.ult]; for (let d = a; d <= b; d = G.addDays(d, 1)) c.sel.add(d); }
      else if (c.sel.has(k)) c.sel.delete(k); else c.sel.add(k);
      c.ult = k;
    }
    else if (t.dataset.calm) { const [y, m] = c.mes.split('-').map(Number), d = new Date(y, m - 1 + Number(t.dataset.calm), 1); c.mes = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
    else if (t.dataset.calx === 'limpiar') c.sel.clear();
    else if (t.dataset.calx === 'aplicar') {
      let dias = Array.from(c.sel).sort();
      if (dias.length > MAX_DIAS) { dias = dias.slice(-MAX_DIAS); alert('Como mucho se ven ' + MAX_DIAS + ' días a la vez: se cargan los ' + MAX_DIAS + ' más recientes.'); }
      S.cal = null; S.incMsg = null;
      if (dias.length === 1) { S.modo = 'dia'; S.dia = dias[0]; } else { S.modo = 'dias'; S.dias = dias; }
      cargar(false); return;
    }
    pintarCal();
  }

  function render() {
    G.destruirMapa();
    const v = G.vistas[S.vista] || G.vistas.resumen;
    document.querySelectorAll('#nav a.item').forEach(a => { const on = a.dataset.v === S.vista; a.classList.toggle('on', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    pintarEstado();
    // En el móvil el menú es un carrusel: se desliza hasta la sección abierta
    const menu = $('#nav .menu'), on = $('#nav a.item.on');
    if (menu && on && menu.scrollWidth > menu.clientWidth) menu.scrollTo({ left: Math.max(0, on.offsetLeft - menu.offsetLeft - 24), behavior: 'smooth' });
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
    const ct = $('#chkTodas'); if (ct) ct.indeterminate = ct.dataset.ind === '1';
    G.carrusel();
  }

  G.render = render;

  // Elegir incidencias en el listado o el mapa: clic = solo esa; sumar (casilla, Ctrl/Cmd) = añadir o quitar; tramo (Mayús) = desde la última pulsada
  G.elegirInc = (id, sumar, tramo) => {
    const l = G.incFiltradas().map(i => i.id), act = G.incSeleccionadas().map(i => i.id);
    if (tramo && S.incAncla && l.includes(S.incAncla)) {
      const a = l.indexOf(S.incAncla), b = l.indexOf(id);
      S.incSels = Array.from(new Set(act.concat(l.slice(Math.min(a, b), Math.max(a, b) + 1))));
    } else if (sumar) {
      S.incSels = act.includes(id) ? act.filter(x => x !== id) : act.concat(id);
      if (!S.incSels.length) S.incSels = [id];
      S.incAncla = id;
    } else { S.incSels = [id]; S.incAncla = id; }
    S.incMsg = null; render();
  };

  // Seguimiento («Actualizar») de una o varias incidencias: a cada una se le añade el comentario, firmado con fecha y usuario,
  // y el estado elegido pasa a ser el suyo. El servicio guarda una incidencia por llamada: se envían una tras otra.
  async function guardarSeguimiento(clave) {
    const ids = String(clave || '').split('|'), lista = ids.map(id => S.data && S.data.inc.find(x => x.id === id)).filter(Boolean); if (!lista.length) return;
    const txt = ($('#incNota').value || '').replace(/\s+/g, ' ').trim(), elegido = $('#incEstado').value, usuario = G.usuario();
    const aviso = t => { S.borrador = { id: clave, t: $('#incNota').value, est: elegido }; S.incMsg = { ok: false, t }; render(); };
    const d = new Date(), fecha = [d.getDate(), d.getMonth() + 1].map(n => String(n).padStart(2, '0')).join('/') + '/' + d.getFullYear();
    const tareas = lista.map(i => {
      const est = elegido || i.estado, cambio = est !== i.estado;
      if (!txt && !cambio) return null;
      const entrada = (cambio ? (est === 'Resuelta' ? 'Marcada como resuelta.' : 'Vuelve a pendiente.') : '') + (txt ? (cambio ? ' ' : '') + txt : '');
      return { i, est, entrada, nota: (i.nota ? i.nota + '\n' : '') + '[' + fecha + '] [' + usuario + '] ' + entrada };
    }).filter(Boolean);
    if (!tareas.length) return aviso('No hay nada que guardar: escribe un comentario o cambia el estado.');
    const n = tareas.length, varias = lista.length > 1, fallos = [];
    S.borrador = { id: clave, t: txt, est: elegido }; S.guardando = varias ? 'Guardando 1 de ' + n + '…' : true; S.incMsg = null; render();
    for (let k = 0; k < n; k++) {
      const { i, est, entrada, nota } = tareas[k], p = $('#segProg');
      if (p && varias) p.textContent = 'Guardando ' + (k + 1) + ' de ' + n + '…';
      try {
        const r = await G.api.estado(S.cfg, i.id, est, { entrada, usuario, nota });
        Object.assign(i, { estado: r.estado, nota: r.nota, fechaEstado: r.fechaEstado });
      } catch (e) { fallos.push((i.comentario || i.tipo) + ': ' + ((e && e.message) || e)); }
    }
    S.guardando = false;
    if (!fallos.length) {
      S.borrador = null;
      const i = tareas[0].i;
      S.incMsg = { ok: true, t: varias ? 'Seguimiento guardado en ' + n + ' incidencia' + (n > 1 ? 's' : '') + (elegido ? '; todas quedan ' + (elegido === 'Resuelta' ? 'resueltas.' : 'pendientes.') : '.')
        : 'Seguimiento guardado: «' + (i.comentario || i.tipo) + '» queda ' + (i.estado === 'Resuelta' ? 'resuelta.' : 'pendiente.') };
    } else S.incMsg = { ok: false, t: (n - fallos.length ? 'Guardadas ' + (n - fallos.length) + ' de ' + n + '. ' : '') + 'No se pudo guardar ' + (fallos.length > 1 ? fallos.length + ' incidencias: ' : '') + fallos.join(' · ') };
    render();
  }

  function ruta() { const v = (location.hash || '#resumen').slice(1); S.vista = G.vistas[v] ? v : 'resumen'; render(); }
  window.addEventListener('hashchange', ruta);

  document.addEventListener('click', e => {
    const tc = e.target.closest('#bCal,[data-cald],[data-calm],[data-calx]');
    if (tc) { clicCal(tc, e); return; }
    if (S.cal && !e.target.closest('.cal')) { S.cal = null; pintarCal(); }
    const t = e.target.closest('[data-modo],[data-inc],[data-ir],[data-demo],[data-adj],[data-carr],#bSeg,#bAct,#bProbar,#bCsv,#bQuitarSel'); if (!t) return;
    if (t.dataset.modo) { S.modo = t.dataset.modo; cargar(false); }
    else if (t.dataset.inc) G.elegirInc(t.dataset.inc, e.target.classList.contains('selc') || e.ctrlKey || e.metaKey, e.shiftKey);
    else if (t.id === 'bQuitarSel') { S.incSels = []; S.incAncla = null; S.borrador = null; S.incMsg = null; render(); }
    else if (t.id === 'bSeg') { if (!S.guardando) guardarSeguimiento(t.dataset.id); }
    else if (t.dataset.adj) G.abrirVisor(Number(t.dataset.adj));
    else if (t.dataset.carr) G.carrusel(Number(t.dataset.carr));
    else if (t.id === 'bCsv') G.exportarInc();
    else if (t.dataset.ir) { S.emp = t.dataset.emp || ''; }
    else if (t.dataset.demo) { S.cfg.demo = true; guardarCfg(S.cfg); cargar(true); }
    else if (t.id === 'bAct') { cargar(true); }
    else if (t.id === 'bProbar') probar();
  });
  // Mayús+clic en el listado elige un tramo: que no seleccione además el texto de las filas
  document.addEventListener('mousedown', e => { if (e.shiftKey && e.target.closest('.it[data-inc]')) e.preventDefault(); });
  document.addEventListener('change', e => {
    const t = e.target;
    if (t.id === 'fEmp') { S.emp = t.value; render(); }
    else if (t.id === 'fLab') { S.lab = t.value; render(); }
    else if (t.id === 'fTipo') { S.tipo = t.value; S.incMsg = null; render(); }
    else if (t.id === 'fEst') { S.est = t.value; S.incMsg = null; render(); }
    else if (t.id === 'fOrden') { S.orden = t.value; render(); }
    else if (t.id === 'chkTodas') { S.incSels = t.checked ? G.incFiltradas().map(i => i.id) : []; S.incAncla = null; S.incMsg = null; render(); }
    else if (t.dataset && t.dataset.capa) { G.capas[t.dataset.capa] = t.checked; G.repintarMapa(); }
  });
  // Buscar en Incidencias: filtra mientras se escribe sin perder el cursor; la nota se guarda como borrador
  let tBuscar = null;
  document.addEventListener('input', e => {
    const t = e.target;
    if (t.id === 'incNota' || t.id === 'incEstado') S.borrador = { id: t.dataset.id, t: $('#incNota').value, est: $('#incEstado').value };
    if (t.id !== 'fBuscar') return;
    S.q = t.value; clearTimeout(tBuscar);
    tBuscar = setTimeout(() => {
      const pos = t.selectionStart; render();
      const n = $('#fBuscar'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (err) { /* sin cursor */ } }
    }, 250);
  });
  document.addEventListener('submit', e => {
    if (e.target.id !== 'formCfg') return; e.preventDefault();
    S.cfg = { url: $('#cUrl').value.trim(), clave: $('#cClave').value.trim(), usuario: $('#cUsuario').value.replace(/[\[\]\r\n]/g, '').trim() || 'Admin', jornalH: Number($('#cJornal').value) || 5, finHora: $('#cFin').value || '17:00', prueba: $('#cPrueba').checked, demo: $('#cDemo').checked };
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

  document.addEventListener('keydown', e => { if (e.key === 'Escape' && S.cal) { S.cal = null; pintarCal(); $('#bCal').focus(); } });

  // Refresco automático cada 2 minutos mientras se mira el día en curso
  // (no mientras se escribe una nota o una búsqueda, ni con el visor de adjuntos o el calendario abiertos)
  setInterval(() => { if (!document.hidden && S.vista !== 'config' && !S.guardando && !S.cal && !document.querySelector('.visor') && !(document.activeElement && /^(incNota|fBuscar)$/.test(document.activeElement.id)) && conectado() && G.periodo().includes(hoy())) cargar(false, true); }, 120000);
  ruta(); cargar(false);
})();
