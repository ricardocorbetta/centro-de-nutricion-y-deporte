# Xenom — Plataforma de gestión para centros de nutrición y deporte

App Next.js + Supabase, ahora **multi-tenant**: una sola instalación puede
alojar varias clínicas ("empresas"), cada una con sus propios usuarios,
pacientes, agenda, caja, comisiones y link público de reserva — sin verse
entre sí. **Centro de Nutrición y Deporte (CND)** es el primer cliente,
migrado con todos sus datos reales.

## Qué cambió en esta versión: multi-tenant

- Se agregó una tabla `empresas` (cada fila = una clínica cliente) y
  todas las tablas existentes (`config`, `consumers`, `periods`, `goals`,
  `app_users`, `comisiones_config`, `cobros`, `turnos_propios`,
  `profesionales_config`, `servicios_config`, `profesional_horarios`)
  ahora están asociadas a una `empresa_id`. **No se perdió ningún dato**:
  toda la información de CND se migró intacta a este nuevo esquema.
- Cada usuario (`director` o `secretaria`) pertenece a una sola empresa y
  solo ve/edita los datos de esa empresa. Es imposible que un usuario de
  una clínica vea datos de otra.
- El link público de reserva de turnos ahora es **por clínica**:
  `/reservar/<slug>`. El de CND es `/reservar/cnd` (antes era `/reservar`
  a secas).
- Nuevo rol: **administrador de plataforma** (Xenom/Ricardo). Este usuario
  no pertenece a ninguna empresa — al iniciar sesión ve un panel propio
  (**Panel Xenom**) para dar de alta nuevas clínicas clientes, sin tocar
  SQL a mano.

### Cómo dar de alta un cliente nuevo

1. Entrá con el usuario de plataforma (ver credenciales abajo).
2. En el Panel Xenom, "+ Nueva empresa": cargás nombre del centro, ciudad,
   y los datos del primer usuario (el director de esa clínica).
3. Al crear, la plataforma automáticamente:
   - crea la empresa y le genera un slug para su link de reserva,
   - siembra su configuración inicial (consultorios, precios por
     defecto, comisión por defecto),
   - crea el usuario director con contraseña ya hasheada.
4. Le pasás al cliente su usuario/contraseña y el link `/reservar/<slug>`.
   Desde ahí, esa clínica ya puede operar de forma completamente
   independiente — agenda, caja, comisiones, reserva pública.
5. Si hace falta suspenderla (por ejemplo, falta de pago), el Panel Xenom
   tiene un botón "Suspender" por empresa: sus usuarios no van a poder
   iniciar sesión hasta reactivarla.

### Usuarios actuales

| Usuario | Contraseña | Rol | Empresa |
|---|---|---|---|
| `xenom` | `Xenom-Plataforma2026!` | admin de plataforma | (ninguna — ve el Panel Xenom) |
| `mariana` | `CND-Directora2026!` | director | CND |
| `secretaria` | `CND-Secretaria2026!` | secretaria | CND |

**Recomendado cambiar estas tres contraseñas apenas se suba esta versión**
(no hay pantalla de "cambiar contraseña" todavía — se actualiza con una
consulta SQL puntual; lo hago yo si hace falta).

## Funciones (para cada clínica cliente)

- **Reserva pública** (`/reservar/<slug>`): el paciente elige profesional,
  servicio y fecha, ve los horarios libres y confirma con nombre y
  teléfono, sin necesidad de llamar. Esos turnos entran automáticamente a
  la agenda y a las estadísticas.
- **Agenda de secretaría**: grilla horaria por profesional, para armar
  turnos a mano o confirmar/cancelar los que entraron por el link
  público.
- **Caja diaria**: carga de cobros, recibos imprimibles, resumen y cierre
  del día por WhatsApp.
- **Comisiones**: cálculo y reporte por profesional.
- **Panel de dirección**: ocupación, facturación, objetivos comerciales,
  simulador de escenarios, tendencia mes a mes, mapa de calor de horarios,
  y un editor de profesionales (horarios/servicios) sin tocar SQL.

## Google Calendar (opcional)

Cada clínica puede conectar un Google Calendar propio para que cada turno
que se cargue (desde la agenda interna o desde el link público de reserva)
se agende ahí solo, y se borre solo al cancelarse. Usa un **Service
Account** de Google (sin que nadie tenga que "iniciar sesión con Google" —
es un usuario técnico que solo puede escribir en los calendarios que vos
le compartís).

**Esto lo tenés que armar vos una sola vez** (es a nivel de toda la
plataforma, no por clínica — después cada clínica solo comparte su
calendario con ese mismo Service Account):

1. Entrá a [console.cloud.google.com](https://console.cloud.google.com),
   creá un proyecto nuevo (o usá uno existente).
2. "APIs y servicios" → "Biblioteca" → buscá **Google Calendar API** →
   Habilitar.
3. "APIs y servicios" → "Credenciales" → "Crear credenciales" → **Cuenta
   de servicio**. Le ponés un nombre (ej: "xenom-calendar") y la creás.
4. Entrá a esa cuenta de servicio → pestaña "Claves" → "Agregar clave" →
   "Crear clave nueva" → JSON. Se descarga un archivo `.json`.
5. De ese archivo, copiás dos valores a las Environment Variables de
   Vercel:
   - `client_email` → va en `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `private_key` → va en `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` (pegalo
     completo, con los `\n` incluidos, entre comillas)
6. Redeploy. A partir de ahí, cada clínica conecta su propio calendario
   desde su panel de dirección (⚙ Configurar → Google Calendar): ahí ve
   el email de esa cuenta de servicio, lo comparte desde Google Calendar
   con permiso "Hacer cambios en los eventos", y pega el ID de su
   calendario.

Si estas dos variables no están cargadas, esa sección simplemente le
avisa a cada clínica que la funcionalidad no está disponible — el resto
del sistema sigue funcionando normal.

## Variables de entorno (6 en total)

| Nombre | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://jvutndjtqknbliayqkwl.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | la del `.env.example` |
| `SUPABASE_SERVICE_ROLE_KEY` | la sacás de Supabase → Project Settings → API |
| `SESSION_SECRET` | cualquier cadena larga aleatoria (ej: `openssl rand -hex 32`) |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | opcional — ver sección "Google Calendar" |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | opcional — ver sección "Google Calendar" |

Todos los clientes nuevos comparten el mismo proyecto de Supabase y el
mismo deploy de Vercel — no hace falta crear nada nuevo por cliente.

## Base de datos

Todo ya está migrado y cargado en Supabase (`jvutndjtqknbliayqkwl`). La
migración a multi-tenant se hizo sin downtime ni pérdida de datos
(verificado fila por fila contra los datos previos). No hace falta tocar
nada ahí — las clínicas nuevas se crean desde el Panel Xenom.

## Cómo subir esta versión

Igual que siempre: reemplazá todo el contenido del repo con lo de este
zip, commit a `main`, el deploy automático hace el resto (las 4
environment variables ya deberían estar cargadas de la vez pasada).

## Estructura del proyecto (resumen de lo nuevo)

```
app/
  XenomAdmin.js                    → panel de administración de plataforma (alta/baja de clínicas)
  reservar/[slug]/page.js          → formulario público de reserva, por clínica
  api/xenom/
    empresas/route.js              → listar / crear clínicas (solo admin de plataforma)
    empresas/[id]/route.js         → editar branding / suspender-reactivar una clínica
  api/public/
    profesionales/route.js         → lista de profesionales + servicios (requiere ?empresa=slug)
    disponibilidad/route.js        → horarios libres (requiere ?empresa=slug)
    reservar/route.js              → confirma la reserva (requiere empresa=slug en el body)
  GoogleCalendarConfig.js           → panel para que cada clínica conecte su Google Calendar
  AgendaLista.js / AgendaSemana.js / AgendaCrearTurnoModal.js → vistas de la agenda
  api/agenda/rango/route.js         → turnos de un rango de fechas (para la vista semanal)
  api/config/google-calendar/route.js → conectar/desconectar el Google Calendar de la empresa
lib/
  empresas.js                      → resuelve una empresa por su slug
  horarios.js                      → resuelve el horario de un profesional para una fecha (con excepciones)
  auth.js                          → requireEmpresaSession (usuarios de clínica) y requireAdminPlataforma (Xenom)
  agendaEstados.js                 → los 6 estados de turno (Reservado/Esperando/En consulta/Atendido/Cancelado/Ausente)
  googleCalendar.js                → integración con Google Calendar vía Service Account
```

## Qué falta para venderlo como producto (honesto, no está armado todavía)

Esta versión deja la base técnica multi-tenant lista y funcionando (CND
como primer cliente real), pero para salir a vender a otras clínicas
todavía faltaría:

- **Cobro/suscripción**: hoy el campo `plan` y el botón "Suspender" del
  Panel Xenom existen, pero no hay integración de cobro automático (Mercado
  Pago, etc.) ni corte automático por falta de pago.
- **Alta autoservicio**: hoy solo vos (Xenom) podés dar de alta una
  clínica nueva desde el panel. No hay un formulario público de "quiero
  contratar" que se autogestione.
- **Dominio propio por cliente**: todas las clínicas comparten el mismo
  dominio de Vercel, diferenciadas por `/reservar/<slug>`. Un dominio
  propio por cliente (ej. `reservas.otraclinica.com`) es una mejora
  aparte.
- **Términos de servicio / tratamiento de datos**: al alojar datos de
  pacientes de terceros (no solo de CND), conviene tener un contrato o
  términos claros de manejo de datos de salud antes de sumar el segundo
  cliente real.
- **Estados de turno**: siguen siendo 4 (`booked/cancelled/cumplido/
  noshow`) en vez de los 6 que maneja drApp (Reservado/Esperando/En
  consulta/Atendido/Cancelado/Ausente) — pendiente, no bloqueante.
- **Ficha de pacientes**: todavía no hay una base de pacientes propia
  (nombre/teléfono quedan sueltos en cada turno/cobro) — pendiente.

## Si algo no anda

- Mismos pasos de siempre para el deploy (revisar el hash de commit y las
  4 environment variables).
- Si un usuario no puede entrar: puede ser que su empresa esté
  "Suspendida" en el Panel Xenom.
- Si en `/reservar/<slug>` no aparece ningún horario libre: puede ser que
  la fecha caiga en un día que ese profesional no atiende, o que el slug
  esté mal escrito (revisá el link exacto en el Panel Xenom).
