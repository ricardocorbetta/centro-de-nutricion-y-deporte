# Migraciones

Cada cambio en la base de datos va en un archivo de esta carpeta, numerado por fecha
(`AAAAMMDD_NN_que_hace.sql`), y se aplica en el mismo orden con `apply_migration` del MCP
`supabase-nutrio` (o pegándolo en el SQL Editor de Supabase). Nunca se edita una migración ya
aplicada: si hay que corregir algo, va en una nueva.

Las tablas creadas antes del 2026-10-15 no tienen migración en esta carpeta (se crearon a mano).

Convenciones:
- La app accede con `service_role` desde las API routes: toda tabla nueva lleva
  `enable row level security` sin políticas y `revoke all ... from anon, authenticated`.
- Las reglas que no dependen de quién llama (largos, estados válidos, límites, historial) van en
  CHECK constraints y triggers, no solo en el código.
