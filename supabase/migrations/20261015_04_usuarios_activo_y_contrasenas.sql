-- Gestión de usuarios de cada clínica (pantalla Configuración → Usuarios):
-- - app_users.activo: dar de baja a alguien sin borrar su historial (cobros, cierres de caja con su nombre).
-- - app_users.ultimo_ingreso: para ver quién usa el sistema.
-- - verify_login deja entrar solo a usuarios activos.
-- - set_app_user_password: cambio y restablecimiento de contraseñas, solo desde el servidor.

alter table public.app_users
  add column if not exists activo boolean not null default true,
  add column if not exists ultimo_ingreso timestamptz;

-- Mismo resultado que antes, pero ignora usuarios dados de baja y registra el ingreso.
create or replace function public.verify_login(p_username text, p_password text)
returns table(id uuid, username text, role text, name text, empresa_id uuid, es_admin_plataforma boolean)
language sql security definer set search_path = public, extensions as $$
  update public.app_users u set ultimo_ingreso = now()
  where u.username = p_username and u.activo and u.password_hash = crypt(p_password, u.password_hash)
  returning u.id, u.username, u.role, u.name, u.empresa_id, u.es_admin_plataforma;
$$;

create or replace function public.set_app_user_password(p_user_id uuid, p_password text)
returns void
language sql security definer set search_path = public, extensions as $$
  update public.app_users set password_hash = crypt(p_password, gen_salt('bf')) where id = p_user_id;
$$;

revoke execute on function public.verify_login(text, text), public.set_app_user_password(uuid, text)
  from public, anon, authenticated;
grant execute on function public.verify_login(text, text), public.set_app_user_password(uuid, text)
  to service_role;
