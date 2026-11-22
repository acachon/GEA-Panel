# Cambio opcional en el servicio de Apps Script

El panel funciona sin tocar nada más que `CLAVE_LECTURA`. Para que las **duraciones sean exactas** (en vez de estimadas con el último punto GPS),
en el servicio de Apps Script hay que devolver también los minutos activos de cada actividad.

En la función `leer(d)`, dentro del objeto que se construye para cada actividad, añadir una línea después de `pausa`:

```js
pts: numero(f[a('Puntos GPS')]), pausa: numero(f[a('Min pausada')]),
activa: numero(f[a('Min activa')]),   // ← línea nueva
prueba: texto(f[a('Datos de prueba')]) === 'Sí'
```

Después: Implementar → Gestionar implementaciones → lápiz → Versión: «Nueva versión» → Implementar.

El panel usa `activa` (minutos) cuando llega; si la columna «Min activa» está vacía, sigue estimando.
No se usa la columna «Duración» porque Sheets la entrega como fecha/hora y depende de la zona horaria del script.
