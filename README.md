# Panel de gestión — Centro de Nutrición y Deporte

App Next.js + Supabase. Login con roles (Dirección / Secretaría), caja
diaria, comisiones, recordatorios por WhatsApp, recibos imprimibles, y
ahora un **link público de reserva de turnos**, independiente de drApp.

## Qué hay de nuevo en esta versión: reserva pública

- **`/reservar`**: página pública (sin login) para que cualquier paciente
  reserve un turno solo — elige profesional, servicio, fecha, ve los
  horarios libres y confirma con su nombre y teléfono.
- La disponibilidad se calcula contra **dos fuentes combinadas**: lo
  importado desde drManager (los reportes que cargás) + lo reservado por
  este mismo link, así nunca se pisan dos turnos.
- Esos turnos reservados por el link entran automáticamente a las
  estadísticas del panel (ocupación, facturación, agenda de la secretaria)
  — no hace falta hacer nada más para que se vean reflejados.
- Los horarios y servicios de cada profesional salen de una tabla de
  configuración (`profesionales_config` / `servicios_config`) que armé a
  partir de los turnos reales de septiembre 2026. Si algún horario o
  servicio cambia, se actualiza directo en Supabase (te paso el SQL si
  hace falta) — no requiere tocar código ni redeploy.

### Profesionales configurados hoy

| Profesional | Días | Horario |
|---|---|---|
| Eulalia, Mariana | Lun, Mar, Mié, Vie | 08:00–15:30 |
| Arias, Sofía Amparo | Lun, Mié, Jue, Vie, Sáb | 09:00–19:40 |
| Rodriguez, Romina | Mié, Jue | 09:00–18:00 |
| Ekkert, Eliana | Lun, Sáb | 09:00–17:20 |
| Zuazo, Mora | Mié, Sáb | 10:00–17:00 |

(Figueroa y Bello Darrieux no se incluyeron — ya no atienden en la clínica.)

## Resto de las funciones (de la versión anterior)

- **Login** (`/login`): `mariana` / `CND-Directora2026!` (Dirección) y
  `secretaria` / `CND-Secretaria2026!` (Secretaría) — cambiá estas
  contraseñas apenas puedas.
- **Dirección**: panel completo + Caja y comisiones.
- **Secretaría**: agenda del día/mañana, carga de cobros, recibos,
  recordatorios por WhatsApp, cierre del día.
- **Objetivos**: facturación, ocupación, y la base para turnos por
  profesional / mix de servicios / pacientes nuevos / ausentismo.

## Variables de entorno (4 en total)

| Nombre | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://jvutndjtqknbliayqkwl.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | la del `.env.example` |
| `SUPABASE_SERVICE_ROLE_KEY` | la sacás de Supabase → Project Settings → API |
| `SESSION_SECRET` | cualquier cadena larga aleatoria (ej: `openssl rand -hex 32`) |

## Base de datos

Ya está todo creado y cargado en Supabase (`cnd-cipolletti-panel`): las
tablas de siempre, más `turnos_propios` (reservas del link público),
`profesionales_config` y `servicios_config` (horarios y servicios por
profesional). No hace falta tocar nada ahí.

## Cómo subir esta versión

Igual que siempre: reemplazá todo el contenido del repo con lo de este
zip, commit a `main`, el deploy automático hace el resto (las 4
environment variables ya deberían estar cargadas de la vez pasada).

## Estructura del proyecto (resumen de lo nuevo)

```
app/
  reservar/page.js          → formulario público de reserva de turnos
  api/public/
    profesionales/route.js   → lista de profesionales + servicios (público)
    disponibilidad/route.js  → horarios libres para profesional+fecha+servicio
    reservar/route.js        → confirma la reserva (revalida disponibilidad)
lib/
  scheduling.js              → generación de horarios y chequeo de superposición
  mergeEvents.js              → combina turnos importados + turnos_propios por mes
```

## Si algo no anda

- Mismos pasos de siempre para el deploy (revisar el hash de commit y las
  4 environment variables).
- Si en `/reservar` no aparece ningún horario libre para nadie: puede ser
  que la fecha elegida caiga en un día que ese profesional no atiende
  (revisá la tabla de arriba), o que ya esté completo ese día.
