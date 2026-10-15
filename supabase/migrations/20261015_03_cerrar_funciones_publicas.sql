-- Cierra 4 funciones SECURITY DEFINER que el rol público (anon) y authenticated podían ejecutar por
-- /rest/v1/rpc con la clave pública (que está en el repo). Con eso cualquiera podía:
--   - crear_app_user: crearse un usuario director de cualquier clínica;
--   - set_paciente_password: cambiar la clave del portal de cualquier paciente;
--   - verify_login / verify_login_paciente: probar contraseñas sin pasar por la app.
-- La app las llama solo desde el servidor con service_role, que conserva el permiso.
-- Detectado por el auditor de seguridad de Supabase el 2026-10-15 (sin rastros de uso indebido).

revoke execute on function
  public.crear_app_user(text, text, text, text, uuid),
  public.set_paciente_password(bigint, text, text),
  public.verify_login(text, text),
  public.verify_login_paciente(text, text, text)
from public, anon, authenticated;

grant execute on function
  public.crear_app_user(text, text, text, text, uuid),
  public.set_paciente_password(bigint, text, text),
  public.verify_login(text, text),
  public.verify_login_paciente(text, text, text)
to service_role;

-- search_path fijo: evita que una función SECURITY DEFINER resuelva objetos de otro esquema.
-- pgcrypto (crypt, gen_salt) está instalado en el esquema "extensions".
alter function public.crear_app_user(text, text, text, text, uuid) set search_path = public, extensions;
alter function public.set_paciente_password(bigint, text, text) set search_path = public, extensions;
alter function public.verify_login(text, text) set search_path = public, extensions;
alter function public.verify_login_paciente(text, text, text) set search_path = public, extensions;

-- Para que no vuelva a pasar: las funciones que se creen en adelante en "public" no quedan
-- ejecutables por el público salvo que se lo conceda explícitamente.
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
