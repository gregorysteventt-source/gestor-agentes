# Gestor de Guardias v46 - JS dividido por módulos seguros

Esta versión divide el archivo JavaScript grande en varios archivos por área funcional, manteniendo el comportamiento global clásico del navegador.

## Estructura

```text
index.html
css/styles.css
js/00-core-config-state-utils.js
js/10-auth-navegacion.js
js/20-datos-fechas.js
js/30-planificador.js
js/40-ausencias.js
js/50-novedades.js
js/60-diario.js
js/70-calendario.js
js/80-exportaciones-alertas.js
js/90-personal.js
js/99-arranque.js
sql/guardar_cuadrante_seguro_v40.sql
```

## Qué cambió

- El CSS sigue separado en `css/styles.css`.
- El JavaScript ya no está en un solo `app.js`; quedó dividido por módulos funcionales.
- No se convirtió todavía a `type="module"`.
- No se cambiaron funciones, tablas, Supabase ni RLS.
- Se mantuvieron los `onclick` para evitar cambios grandes en la lógica.

## Orden de carga

El orden de los `<script>` en `index.html` es importante. El archivo `99-arranque.js` debe quedar al final porque inicia la aplicación.

## Uso

Extraer la carpeta completa y abrir `index.html`. No mover archivos sueltos, porque el HTML depende de las carpetas `css` y `js`.
