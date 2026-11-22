# GEA · Panel de gestión (finca El Caimbo)

Panel web para el dueño o capataz de la explotación. Lee del **Registro central** (la Hoja de Google «GEA - Registro central») las
actividades, incidencias y puntos GPS que envía la app GEA, y los muestra en cinco pantallas:

| Pantalla | Qué enseña |
|---|---|
| Resumen | Indicadores del día, posición de cada empleado, recorridos, jornada por empleado, horas por labor |
| Mapa | Recorridos por labor, recorrido de la jornada, última posición e incidencias sobre imagen aérea o mapa |
| Personal | Jornadas, horas trabajadas, jornales y horas extra por empleado y día |
| Incidencias | Lista por tipo, comentario, ubicación y adjuntos (enlaces de Drive) |
| Labores | Horas, distancia y superficie por labor y quién la ha hecho |

Es una web **estática** (HTML + JS, sin servidor ni compilación). Funciona en GitHub Pages.

## Publicar en GitHub Pages

1. Sube todo el contenido de esta carpeta a la raíz del repositorio (rama `main`).
2. En GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch → `main` / `(root)` → Save**.
3. En un minuto la web queda en `https://<tu-usuario>.github.io/<nombre-del-repositorio>/`.

> Con una cuenta gratuita, Pages exige que el repositorio sea **público**. No hay ninguna clave ni dato de la finca en el código:
> la dirección del servicio y la clave de lectura se escriben en la propia web y quedan solo en el navegador de quien las escribe.
> La página lleva `noindex` para que los buscadores no la listen.

## Conectar con el Registro central

La web usa el mismo servicio de Apps Script que la app de registro («GEA - Código del servicio de sincronización»), con la operación de **lectura**.
Hace falta una vez:

1. En Apps Script del Registro central, poner un valor en `CLAVE_LECTURA` (distinto de `CLAVE`). Ahora está vacío y, con eso, la lectura está desactivada.
2. Implementar → Gestionar implementaciones → lápiz → Versión: «Nueva versión» → Implementar (la dirección no cambia).
3. Abrir el panel → **Configuración** → pegar la *Dirección del servicio* (`https://script.google.com/macros/s/…/exec`) y la *Clave de lectura* → **Probar conexión** → **Guardar**.

Detalles de lectura: el servicio devuelve como máximo 3 días por petición; el panel pide los días de 3 en 3 y guarda en memoria lo ya leído
(el día en curso se vuelve a pedir pasado un minuto, y cada 2 minutos se refresca solo).

## Duraciones exactas (recomendado)

El servicio de lectura no devuelve la duración de cada actividad. Mientras tanto el panel la **estima** con el último punto GPS de la actividad.
Para tenerla exacta, ver `servicio/LEEME.md` (una línea en `leer()`).

## Cómo se calculan los indicadores

- **Jornada** = actividad «Inicio Jornada» de cada empleado y día (si no existe, la suma de sus labores).
- **Jornal** = jornada con el mínimo de horas configurado (por defecto 5 h). **Extra** = tiempo a partir de la hora de fin (por defecto 17:00). Ambos se cambian en Configuración.
- **Distancia** = suma de los km de la jornada. **Superficie** = suma de las hectáreas de las labores (el almuerzo no cuenta).
- Las filas con «Datos de prueba = Sí» se incluyen o no según Configuración (hoy todo lo que hay en el Registro es de prueba).

## Modo demostración

En Configuración se puede activar el modo demostración: datos inventados, sin conexión, para ver cómo queda.

## Estructura

```
index.html        página única (menú + vistas)
css/panel.css     estilos (identidad GEA)
js/util.js        utilidades (fechas, escapado de texto, colores)
js/api.js         lectura del servicio y caché por día
js/datos.js       labores, duraciones, jornadas, extras, estado de cada empleado
js/vistas.js      pantallas y mapa (Leaflet)
js/main.js        estado, navegación y eventos
js/demo.js        datos de ejemplo
servicio/LEEME.md cambio opcional en el servicio de Apps Script
```

Mapas: Leaflet + imágenes de ortofoto del PNOA (IGN), Esri World Imagery y OpenStreetMap (se cargan desde Internet).

## Pendiente (Fase 2)

- Reparto de horas por parcela y subparcela (hay que importar las parcelas del Catastro/SIGPAC).
- Costes por labor y rendimiento (la app no recoge todavía precios por hora ni pesos de cosecha).
- Informes descargables.
