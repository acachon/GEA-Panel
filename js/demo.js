/* Datos de ejemplo (modo demostración). Mismo formato que devuelve el servicio de lectura: sirve para probar el panel sin conexión.
   Todo es inventado; las posiciones están en torno a la zona de El Caimbo. */
(function (root) {
  const G = root.GEA;
  const prng = seed => { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
  const BASE = [37.8526, -3.7303];
  const EMP = [
    ['Justo', 0.0000, 0.0030, ['Reparación', 'Otros']],
    ['Andrés', -0.0014, 0.0016, ['Recolección', 'Recolección']],
    ['Juan', 0.0016, -0.0012, ['Poda', 'Poda']],
    ['Pepe', 0.0008, -0.0030, ['Riego', 'Poda']],
    ['Sebastián', -0.0024, -0.0008, ['Tractor', 'Preparación de suelos']]
  ];
  const INC = [['Olivo', 'Olivo partido por el viento junto al camino.'], ['Riego', 'Fuga en un gotero de la línea 4.'], ['Vehículo/Herramienta', 'La tijera eléctrica no carga la batería.'], ['Otros', 'Puerta del cercado abierta.']];
  const km = (a, b) => { const R = 6371, r = Math.PI / 180, dl = (b[0] - a[0]) * r, dn = (b[1] - a[1]) * r; const h = Math.sin(dl / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dn / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };

  function leer(lote) {
    const out = { ok: true, actividades: [], incidencias: [], puntos: [] }, ahora = Date.now();
    lote.forEach(dia => {
      const rnd = prng(Number(dia.replace(/-/g, '')));
      const base = G.parseDay(dia).getTime();
      EMP.forEach(([nombre, dLat, dLon, labores], ie) => {
        const ini = base + (8 * 60 + Math.round(rnd() * 20)) * 60000;
        const fin = base + (16 * 60 + 30 + Math.round(rnd() * (rnd() < .3 ? 120 : 40))) * 60000;
        const tramos = [['Inicio Jornada', ini, fin], [labores[0], ini + 10 * 60000, base + 750 * 60000], ['Almuerzo', base + 750 * 60000, base + 780 * 60000], [labores[1], base + 780 * 60000, fin - 15 * 60000]];
        let pos = [BASE[0] + dLat, BASE[1] + dLon];
        const lim = Math.min(fin, ahora);
        tramos.forEach(([act, t0, t1], k) => {
          if (t0 >= ahora) return;
          const id = `demo-${dia}-${ie}-${k}`, fin2 = Math.min(t1, ahora), pts = [];
          let kms = 0, p = pos.slice();
          for (let t = t0; t <= fin2; t += 5 * 60000) {
            const q = [p[0] + (rnd() - .5) * 0.0006, p[1] + (rnd() - .5) * 0.0006];
            if (pts.length) kms += km(p, q);
            p = q; pts.push([id, Math.round(t / 1000), +p[0].toFixed(6), +p[1].toFixed(6), 6 + Math.round(rnd() * 8)]);
          }
          if (k > 0) pos = p;
          out.puntos.push(...pts);
          out.actividades.push({ id, nombre, actividad: act, estado: t1 > ahora ? 'En curso' : 'Cerrada', iso: new Date(t0).toISOString(), lat: pts[0][2], lon: pts[0][3], precision: pts[0][4], km: +kms.toFixed(3), ha: act === 'Inicio Jornada' || act === 'Almuerzo' ? null : +(kms * 1000 * 3 / 10000).toFixed(4), vel: 3.2, pts: pts.length, pausa: 0, prueba: false });
        });
        if (rnd() < .35 && ini < ahora) {
          const [tipo, com] = INC[Math.floor(rnd() * INC.length)], t = Math.min(ini + (120 + Math.round(rnd() * 240)) * 60000, lim);
          out.incidencias.push({ id: `demo-i-${dia}-${ie}`, nombre, tipo, comentario: com, iso: new Date(t).toISOString(), lat: +(pos[0]).toFixed(6), lon: +(pos[1]).toFixed(6), precision: 8, prueba: false, estado: rnd() < .4 ? 'Resuelta' : 'Pendiente', nota: '', adjuntos: rnd() < .5 ? [{ tipo: 'foto', nombre: 'demo_foto1.jpg', url: '' }] : [] });
        }
      });
      // Hoy, tres incidencias con varios adjuntos de cada clase (para ver el visor con muchos archivos); las dos primeras, con
      // historial de seguimiento de varios días (hace 2 días, ayer y hoy), igual que los datos de prueba de la web
      if (dia === G.dayKey(new Date())) {
        const adj = (pref, lista) => lista.map((t, k) => { const n = lista.slice(0, k).filter(x => x === t).length; return { tipo: t, nombre: pref + '_' + t + (n ? n + 1 : '') + '.' + { foto: 'jpg', video: 'webm', audio: 'wav' }[t], url: 'demo:' + t }; });
        const seg = l => l.map(([n, u, t]) => '[' + G.addDays(dia, -n).split('-').reverse().join('/') + '] [' + u + '] ' + t).join('\n');
        [['Sebastián', 'Riego', 'Varias fugas en el cabezal de riego: dejo fotos, vídeos y notas de voz.', 9.5, ['foto', 'foto', 'video', 'video', 'audio', 'audio'], 'Pendiente',
          seg([[2, 'Ángel', 'Avisado el fontanero; viene en un par de días.'], [1, 'Isabel', 'El fontanero pide la referencia de los goteros del cabezal.'], [0, 'Ángel', 'Cambiados los goteros. Falta revisar la presión de la línea 4.']])],
         ['Andrés', 'Olivo', 'Rama grande partida en la parcela sur, cerca del camino de servicio.', 10.25, ['foto', 'video', 'audio', 'foto', 'video', 'audio', 'foto'], 'Resuelta',
          seg([[1, 'Isabel', 'Señalizada la rama para que nadie pase por debajo.'], [0, 'Ángel', 'Marcada como resuelta. Retirada con la motosierra y el camino limpio.']])],
         ['Pepe', 'Vehículo/Herramienta', 'El tractor pierde aceite por el lado izquierdo; grabo cómo suena el motor.', 11, ['audio', 'audio', 'audio', 'video', 'video', 'foto', 'foto'], 'Pendiente', '']]
          .forEach(([nombre, tipo, com, h, lista, estado, nota], k) => {
            const t = Math.min(G.parseDay(dia).getTime() + h * 3600000, ahora - (3 - k) * 60000);
            out.incidencias.push({ id: `demo-v-${dia}-${k}`, nombre, tipo, comentario: com, iso: new Date(t).toISOString(), lat: BASE[0] + 0.0004 * (k - 1), lon: BASE[1] + 0.0005 * (1 - k), precision: 6, prueba: false, estado, nota, adjuntos: adj(`${dia}_${nombre}_${tipo.replace(/\W+/g, '-')}`, lista) });
          });
      }
    });
    return out;
  }
  G.demo = { leer };
})(typeof window !== 'undefined' ? window : globalThis);
