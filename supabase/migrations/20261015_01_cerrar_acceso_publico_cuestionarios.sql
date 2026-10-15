-- Aplicada el 2026-10-15. Cierra el acceso directo a cuestionarios y respuestas (datos de salud):
-- estaban sin RLS y el rol anon podía leerlas con la clave pública.
-- La app usa service_role, que no está sujeta a RLS: no cambia nada para EULALIA.
alter table public.cuestionarios enable row level security;
alter table public.cuestionario_respuestas enable row level security;
revoke all on public.cuestionarios, public.cuestionario_respuestas from anon, authenticated;
