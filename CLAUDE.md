# EULALIA — contexto para Claude

## Qué es
EULALIA (antes se llamaba NUTRIO; renombrada el 2026-10-15) es una plataforma SaaS multi-tenant para
clínicas de nutrición y deporte. Los nombres internos (cookie `cnd_session`, rutas `/api/xenom`,
componente `XenomAdmin`) no se cambiaron para no cortar sesiones. El primer cliente es el
Centro de Nutrición y Deporte (CND), la clínica de Mariana Eulalia en Cipolletti, Río Negro.
Empresa slug `cnd`, id `7662b424-9068-42d4-8057-6c9427a5504e`.

Roles de clínica (definidos en `lib/roles.js`, se gestionan en Configuración → Usuarios):
- **Dirección** (`director`): todo, incluidas fichas clínicas, reportes, comisiones, reabrir cajas y usuarios.
- **Secretaría** (`secretaria`): turnos, recordatorios, alta/búsqueda de pacientes (solo contacto, columnas
  de `lib/pacientesColumnas.js`), cobros y cierre de caja del día. Sin datos clínicos ni configuración.
  Las rutas clínicas (`/api/pacientes/[id]/**`, `/api/cuestionarios/respuestas`) exigen `requireDirectorSession`.
- Usuarios con `activo=false` no pueden iniciar sesión (sus registros quedan). Las sesiones ya abiertas duran
  hasta 30 días: dar de baja no corta una sesión abierta (pendiente: versión de sesión).
- Usuario de secretaría de CND: Valentina Cabagna (usuario `admi@centronutriciondeporte.com`), a dar de alta
  desde la pantalla Usuarios. Las contraseñas las pone una persona, nunca se guardan en el repo.

Además: admin de plataforma (sin empresa, ve el Panel EULALIA en `app/XenomAdmin.js` y rutas
`/api/xenom/*`), `director` y `secretaria` (atados a una empresa). Los pacientes entran al portal
`/portal/<empresa>` con una cookie aparte.

## Stack
- Next.js 14 (App Router) + React 18, JavaScript (sin TypeScript). Desplegado en Vercel: push a `main`
  dispara el deploy. Remoto: `github.com/ricardocorbetta/centro-de-nutricion-y-deporte` (repo PÚBLICO de la
  cuenta `ricardocorbetta`; en esta compu se sube con `ricardocorbetta-cell`, colaboradora con escritura).
- Producción: https://centro-de-nutricion-y-deporte-vt6l.vercel.app (proyecto Vercel `...-vt6l`, el único:
  un segundo proyecto mal configurado que fallaba en cada deploy se borró el 2026-10-15). El estado del deploy se lee con
  `gh api repos/ricardocorbetta/centro-de-nutricion-y-deporte/commits/<sha>/status`.
- Supabase Postgres, proyecto "cnd-cipolletti-panel" (`jvutndjtqknbliayqkwl`), plan free: se pausa tras ~7 días sin uso
  y la app deja de andar; se reanuda con "Restore project" en el dashboard. `pacientes.id` es bigint y `empresas.id` es uuid.
- Toda la lectura/escritura pasa por API routes con `lib/supabaseAdmin.js` (service_role). Nunca
  importarlo desde un componente `'use client'`.
- Auth propia (no Supabase Auth): cookie HMAC firmada con `SESSION_SECRET` (`lib/session.js`).
  En las rutas usar `requireEmpresaSession`, `requireAdminPlataforma` o `requirePacienteSession`
  (`lib/auth.js`) y filtrar SIEMPRE por `session.empresaId`.
- Variables de entorno en `.env.local` (ver `.env.example`): NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, SESSION_SECRET (y opcionales de Google
  Calendar).
- Para verificar cambios: `npx next build`, `npm test` (unitarias de lib/: teléfonos, fechas, turnos,
  precios, sesiones y permisos; sin red) y `npm run test:humo` (contra producción, solo lectura o datos
  inválidos que se rechazan; otra URL con `BASE_URL=...`). Después de cambiar la base, correr también el
  auditor de seguridad (`get_advisors` del MCP): solo debe quedar el aviso INFO "RLS sin políticas".
- Funciones de la base: nunca ejecutables por `anon`/`authenticated` (desde 2026-10-15 los privilegios por
  defecto de `public` ya no lo conceden). Si una función nueva debe ser pública, concederlo a propósito.
- MCP de Supabase: usar el servidor `supabase-nutrio` (HTTP oficial con OAuth, en `~/.claude.json`,
  fijado a `project_ref=jvutndjtqknbliayqkwl`). El servidor `supabase` es el de Balenzano (otra cuenta/org)
  y `supabase-aremat` / `supabase-copul` son de otros proyectos: no usarlos para EULALIA.
  `execute_sql` para leer; los cambios de esquema van por `apply_migration`, mostrando antes la migración.

## Que la base no se pause (plan free de Supabase)
- Supabase pausa un proyecto free tras 7 días sin actividad; restaurarlo tardó ~1 hora el 2026-10-15.
- `app/api/latido` hace una consulta mínima; `vercel.json` la programa con Vercel Cron todos los días a las
  11 UTC (8 h de Argentina). Es pública a propósito: no devuelve datos, solo 200 o 503.
- Monitor externo (UptimeRobot) sobre `https://<dominio>/api/latido`: avisa por mail si da 503.
- Lo único que lo garantiza es el plan Pro en la org "Ricardo Corbetta" (la paga la cuenta adm, que es Owner).
- La cuenta `ricardocorbetta` es Developer en esa org: si es Owner/Admin de otras orgs con proyectos free
  activos (Aremat, Copul, Balenzano), no puede restaurar este proyecto por el límite de 2 free activos.

## Mapa del código
- `app/AppClient.js`: shell interno (navegación y pantallas). `app/PacientesPanel.js`: pacientes y ficha.
- Agenda: `AgendaBuilder.js`, `AgendaSemana.js`, `AgendaLista.js`, `AgendaCrearTurnoModal.js`;
  estados en `lib/agendaEstados.js` (ESTADO_CLASS, ESTADO_LABEL, ESTADOS_FACTURABLES).
- Caja y cobros: `CajaComisionesSection.js`, `CobroTurnoModal.js`, `lib/cobrosTurno.js`, MercadoPago en
  `lib/mercadoPago.js` + `app/api/public/mercadopago/webhook`.
- Métricas y precios: `lib/stats.js`. `DEFAULT_PRECIOS` (20 min $30.000, 30 min $45.000, 40 min $60.000,
  60 min $80.000) es solo el valor por defecto; la configuración real por empresa está en `config.precios`
  (jsonb). `PRECIO_CONFIRMADO` marca 20 y 30 min como estimados. Al crear un turno se guarda una foto del
  precio en `turnos_propios.precio_total`.
- Datos históricos cargados desde CSV o a mano: tablas `periods` (por `month_key`) y `consumers`
  (`app/api/upload`).
- Públicas: `/reservar/<empresa>`, `/portal/<empresa>`, `/cartelera/<empresa>`,
  `/prefiltro/<empresa>`, `/cuestionario/<empresa>/<slug>`.

## Convenciones de diseño
- Estética inspirada en Balenzano (sus patrones, no su CSS: allá hay 70 hojas con `!important`).
- Tokens SOLO en `app/tokens.css`, con nombres semánticos: `--brand`/`--brand-strong`/`--brand-soft`/
  `--on-brand`, `--surface`/`--surface-2`, `--line`/`--line-strong`, `--text`/`--text-2`/`--text-3`,
  `--ok`/`--warn`/`--danger`/`--info` (cada uno con `-soft` y `-ink`), `--r-sm/md/lg`, `--shadow-1/2`,
  `--focus-ring`. Modo oscuro incluido. Los nombres viejos (`--primary`, `--ink`, `--rust`…) son alias:
  en código nuevo usar los semánticos. Nada de colores fijos (#fff, #1F7A68) en componentes.
- Tipografía: una sola, Plus Jakarta Sans con `next/font` (`app/layout.js`), con cifras de ancho fijo en
  toda la app. Nada de serif ni monoespaciada (`--serif`/`--mono` son alias de la misma fuente).
- Navegación (`app/AppShell.js`): barra superior con 6 destinos (Inicio, Agenda, Pacientes, Caja,
  Comunicación, Reportes) y menú del avatar (Configuración, Sugerencias, Salir). En celular (≤ 900px), barra
  inferior con 4 destinos + "Más". Comunicación, Reportes y Configuración tienen pestañas (`SubNav`). La
  pantalla activa va en la URL (`?s=<hoja>`, ver `HOJAS` en `app/AppClient.js`). No volver a una barra
  lateral ni a emojis como íconos: los íconos son de línea, en `app/Icono.js`.
- Clase `.solo-desktop` para ocultar textos o botones secundarios en pantallas de ≤ 640px.
- Clases en `app/globals.css`: `.tag` (`.sage`, `.rust`, `.gold`, `.info`), `.avatar`, `.card`, `.kpi-grid`,
  `.section-head`, `.empty-state`, `.prof-card`, `.icon-btn` (`.primary`, `.destructivo`).
- Pantalla de entrada "Inicio" (`app/InicioPendientes.js` + `/api/pendientes`): pendientes agrupados en
  Vencido / Hoy / Próximos 7 días / Más adelante. Para sumar un tipo de pendiente, agregarlo en la API con
  la forma `{ id, tipo, titulo, detalle, fecha, seccion, accion }`.
- Avisos de guardado globales (`app/AvisosGlobales.js`): todo POST/PUT/PATCH/DELETE a `/api/` muestra
  "Cambios guardados" o el `error` del servidor. Si una pantalla ya muestra su propio mensaje, mandar el
  header `x-sin-aviso`. Avisos manuales: `window.dispatchEvent(new CustomEvent('aviso', { detail: { texto, tipo } }))`.
- Las API devuelven errores como `{ error: 'mensaje para la persona' }`, nunca el mensaje técnico de Postgres.
- Cero modales: todo se hace con el panel lateral `app/SidePanel.js`. `ConfirmModal`, `PedirContactoModal`,
  `CobroTurnoModal`, etc. ya usan SidePanel por dentro (el nombre "Modal" quedó por historia).
- Evitar rótulos en mayúsculas con tracking, badges de solo emoji y el aspecto "plantilla".
- `app/Avatar.js` genera iniciales con color determinístico.

## Motor de cuestionarios (hecho)
- Tablas `cuestionarios` (campos jsonb: `{id, etiqueta, tipo, opciones?, requerido}`) y
  `cuestionario_respuestas`.
- Tipos de campo: texto, texto_largo, numero, fecha, select, nombre_paciente, email, telefono.
- Si `vincula_paciente` está activo, el envío busca o crea el paciente por teléfono y después por email.
- Admin: `app/CuestionariosAdmin.js` (constructor configurable en panel lateral).
- Público: `app/CuestionarioPublico.js` en `/cuestionario/<empresa>/<slug>` y `/prefiltro/<empresa>`
  (URL que ya se comparte por WhatsApp).
- Está sembrado el cuestionario "Entrevista de prefiltro". La tabla vieja `entrevistas_prefiltro` quedó sin uso.

## Reglas
- Responder en español rioplatense.
- Nunca pedir ni usar usuario y contraseña de DrApp para sacar datos del cliente.
- Antes de cambiar la base, mostrar la migración.
- Commits solo cuando Ricardo lo pida. Nunca saltear hooks.

## Pendiente, en este orden
1. Historial de precios de consultas por mes y por duración (fuentes: `cobros` monto y fecha,
   `turnos_propios.precio_total`, `config.precios`, `periods`). No inventar cifras.
2. Cargar cuestionarios de seguimiento/control periódico, satisfacción/feedback y anamnesis clínica
   detallada. Antes, preguntar si quiere preguntas precargadas o probar el constructor primero.
3. Menores: pestañas reales en la ficha del paciente, vista de solo lectura de planes nutricionales
   archivados, botón de copiar en las instrucciones de Google Calendar y MercadoPago, aviso de visibilidad
   por defecto en BibliotecaAdmin.
