# Panel de Ocupación & Facturación — Centro de Nutrición y Deporte

App Next.js + Supabase. Esta versión incluye el rediseño visual (estética
tipo app de gestión de salud, con la paleta de marca de CND) y funciones
nuevas: simulador de escenarios, objetivos comerciales por mes, y carga
manual de meses sin CSV.

## Qué cambió en esta versión

- **Rediseño completo**: fondo claro, tarjetas redondeadas con sombra suave,
  navegación por secciones arriba, tipografía Inter. Mantiene los colores
  de marca de CND (teal + arena) pero con un lenguaje visual de app de
  gestión, no de reporte editorial.
- **Simulador de escenarios** (`#simulador`): sliders de ocupación objetivo,
  consultorios, horas por semana y ajuste de tarifas — muestra la
  facturación proyectada y permite guardarla como objetivo del mes con un
  click.
- **Objetivos comerciales** (dentro de `#capacidad`): definís una meta de
  facturación y de ocupación por mes, y el panel muestra el progreso real
  contra esa meta. Se guarda en una tabla nueva (`goals`) en Supabase.
- **Carga manual de meses sin CSV** (botón "Cargar período" → pestaña
  "Carga manual"): para meses viejos de los que no tenés el export de
  drManager, cargás los totales a mano (turnos, horas ocupadas, facturación
  estimada). No tiene desglose por profesional ni mapa de calor, pero sí
  entra en la facturación y en el gráfico de tendencia mes a mes.

## Base de datos (ya actualizada)

El proyecto de Supabase (`cnd-cipolletti-panel`) ya tiene las tablas nuevas
aplicadas:
- `periods` ahora tiene `is_manual` y `manual_summary` (para los meses
  cargados a mano).
- `goals`: objetivos por mes (`month_key`, `revenue_target`,
  `occupancy_target`).

No hace falta que toques nada de la base — ya está lista.

## Cómo subir esta versión

Esta versión cambia muchos archivos (CSS, page.js, 2 API routes nuevas), así
que lo más simple es **reemplazar todo el contenido del repo**, no archivo
por archivo:

1. Borrá todos los archivos del repo en GitHub (o creá el repo de nuevo si
   preferís empezar limpio).
2. Descomprimí `panel-cnd-nextjs.zip` y subí todo el contenido con
   "uploading an existing file" (arrastrando todos los archivos de una).
3. Commit a `main`. Como ya tenés Vercel conectado con auto-deploy, el
   deploy nuevo se dispara solo — no hace falta reimportar nada en Vercel
   ni volver a cargar las environment variables (esas quedan igual).
4. Esperá el deploy y refrescá el panel.

Si en cambio preferís ir archivo por archivo, los que cambiaron o son
nuevos son: `app/globals.css`, `app/layout.js`, `app/page.js`,
`lib/stats.js`, `app/api/bootstrap/route.js`, `app/api/upload/route.js`,
`app/api/period/[key]/route.js`, y los dos nuevos `app/api/goals/route.js`.

## Estructura del proyecto

```
app/
  page.js                → dashboard completo (topbar, secciones, simulador)
  globals.css             → estilos, paleta CND, estética tipo app de salud
  layout.js
  api/
    bootstrap/route.js    → GET: config + períodos + pacientes + último período
    period/[key]/route.js → GET: turnos (o resumen manual) de un período
    config/route.js       → POST: guarda capacidad/precios
    upload/route.js       → POST: guarda un período (CSV normal o manual)
    goals/route.js        → GET/POST: objetivos comerciales por mes
lib/
  stats.js                → cálculos: ocupación, facturación, simulador, parser CSV
  supabaseAdmin.js         → cliente de Supabase server-side
  logo.js                  → isologo de CND en base64
```

## Si algo no anda

- Mismos pasos de siempre: revisá las 3 environment variables en Vercel
  (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`), y que el deployment más reciente en
  Vercel diga "Production" con el commit hash que corresponde al último
  commit de GitHub.
