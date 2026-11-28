/* Lectura del Registro central a través del servicio de Apps Script («GEA - Código del servicio de sincronización»).
   Pide los días con { tipo:'leer', clave: CLAVE_LECTURA, rangos:[[desde,hasta],…] } (máximo 3 días por petición).
   El envío es un POST de texto plano, sin cabeceras, igual que el de la web de registro: así no hay petición previa CORS. */
(function (root) {
  const G = root.GEA;
  const cache = {};            // 'AAAA-MM-DD' → { t, act, inc, pts }
  const TTL_HOY = 60 * 1000;   // el día en curso se vuelve a pedir pasado un minuto

  async function leerRangos(cfg, rangos) {
    const res = await fetch(cfg.url, { method: 'POST', body: JSON.stringify({ tipo: 'leer', clave: cfg.clave, rangos }) });
    if (!res.ok) throw new Error('El servicio respondió ' + res.status);
    let j;
    try { j = await res.json(); } catch (e) { throw new Error('La respuesta del servicio no es válida: comprueba la dirección'); }
    if (!j.ok) throw new Error(j.error || 'Error del servicio');
    return j;
  }

  function rangoDia(k) {
    return [G.parseDay(k).toISOString(), G.parseDay(G.addDays(k, 1)).toISOString()];
  }

  // Devuelve { actividades, incidencias, puntos } de los días pedidos (array de 'AAAA-MM-DD')
  async function dias(cfg, lista, forzar) {
    const hoy = G.dayKey(new Date()), ahora = Date.now();
    const faltan = lista.filter(k => forzar || !cache[k] || (k >= hoy && ahora - cache[k].t > TTL_HOY));
    const lotes = []; for (let i = 0; i < faltan.length; i += 3) lotes.push(faltan.slice(i, i + 3));
    // Hasta 4 peticiones a la vez (un mes son 10 lotes de 3 días)
    const uno = async lote => {
      const j = cfg.demo ? G.demo.leer(lote) : await leerRangos(cfg, lote.map(rangoDia));
      const por = {}; lote.forEach(k => { por[k] = { t: Date.now(), act: [], inc: [], pts: [] }; });
      (j.actividades || []).forEach(a => { const c = por[G.dayKey(new Date(a.iso))]; if (c) c.act.push(a); });
      (j.incidencias || []).forEach(a => { const c = por[G.dayKey(new Date(a.iso))]; if (c) c.inc.push(a); });
      (j.puntos || []).forEach(p => { const c = por[G.dayKey(new Date(p[1] * 1000))]; if (c) c.pts.push(p); });
      Object.assign(cache, por);
    };
    let sig = 0;
    await Promise.all(Array.from({ length: Math.min(4, lotes.length) }, async () => { while (sig < lotes.length) await uno(lotes[sig++]); }));
    const r = { actividades: [], incidencias: [], puntos: [] };
    lista.forEach(k => { const c = cache[k]; if (!c) return; r.actividades.push(...c.act); r.incidencias.push(...c.inc); r.puntos.push(...c.pts); });
    return r;
  }

  // Marca una incidencia como «Pendiente» o «Resuelta» (con una nota) en la Hoja. En modo demostración solo cambia en memoria.
  async function estado(cfg, id, valor, nota) {
    let r = { ok: true, id, estado: valor, nota, fechaEstado: new Date().toISOString() };
    if (!cfg.demo) {
      const res = await fetch(cfg.url, { method: 'POST', body: JSON.stringify({ tipo: 'estado', clave: cfg.clave, id, estado: valor, nota }) });
      if (!res.ok) throw new Error('El servicio respondió ' + res.status);
      try { r = await res.json(); } catch (e) { throw new Error('La respuesta del servicio no es válida'); }
      // El servicio antiguo no conoce «estado» y lo trata como un envío con la clave de escritura
      if (!r.ok) throw new Error(r.error === 'Clave incorrecta' ? 'el servicio aún no sabe guardar el estado. Actualiza su código en Apps Script (ver servicio/LEEME.md)' : (r.error || 'Error del servicio'));
    }
    Object.values(cache).forEach(c => c.inc.forEach(i => { if (i.id === id) Object.assign(i, { estado: r.estado, nota: r.nota, fechaEstado: r.fechaEstado }); }));
    return r;
  }

  G.api = { dias, leerRangos, rangoDia, estado, vaciar: () => Object.keys(cache).forEach(k => delete cache[k]) };
})(typeof window !== 'undefined' ? window : globalThis);
