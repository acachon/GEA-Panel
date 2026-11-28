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

# Estado de las incidencias (pendiente / resuelta)

En la pantalla Incidencias, el supervisor puede marcar cada incidencia como **resuelta** (o volver a **pendiente**) y dejar una nota.
Se guarda en la Hoja «GEA - Registro central», pestaña Incidencias, en tres columnas que el servicio crea solo la primera vez:
**Estado**, **Nota supervisor** y **Fecha estado**. Las demás columnas no se tocan, y cuando un móvil vuelve a sincronizar una
incidencia, estas tres columnas se conservan.

Para activarlo hay que poner en Apps Script el código nuevo del servicio (archivo
«GEA - Servicio Registro central (Apps Script).gs.txt», en la carpeta «Actividades» de Drive, junto a la Hoja «GEA - Registro central»; es siempre la versión vigente y no está en este repositorio porque lleva las claves):

1. En la Hoja: Extensiones → Apps Script → sustituir todo el código por el del archivo y guardar.
2. Implementar → Gestionar implementaciones → lápiz → Versión: «Nueva versión» → Implementar (la dirección del servicio no cambia).

Cambios en el código: nueva petición `{ tipo: 'estado', clave: CLAVE_LECTURA, id, estado: 'Pendiente'|'Resuelta', nota }`
(función `guardarEstado`), `leer()` devuelve `estado`, `nota` y `fechaEstado` de cada incidencia, y `volcar()` conserva las
columnas del Panel al actualizar filas de Incidencias. Mientras no se actualice el servicio, el panel sigue funcionando y
muestra todas las incidencias como pendientes; al intentar marcar una avisa de que falta este paso.

## Seguimiento con historial (versión del 28/11/2026)

Desde esta versión, cada «Actualizar» del seguimiento envía `entrada` (el comentario) y `usuario` (el nombre puesto en el panel).
El servicio añade al final de «Nota supervisor» una línea `[DD/MM/AAAA] [Usuario] comentario`, con la fecha del día en que se guarda,
y así queda el historial completo. Hay que volver a pegar el código del servicio y crear una «Nueva versión» de la implementación
(mismos pasos de arriba). Con el servicio anterior el panel sigue funcionando: guarda el historial compuesto en el panel (hasta 1.000 caracteres).
