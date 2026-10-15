-- Caja de feedback ("Mejoras"), inspirada en el Cuadro de mejoras de Copul.
-- Los usuarios de cada clínica mandan pedidos (algo no funciona / mejora / idea / consulta);
-- los gestiona el administrador de la plataforma desde el Panel EULALIA.
--
-- Igual que el resto de EULALIA, la app accede con service_role desde API routes (los permisos se
-- validan ahí). Igual: RLS activada sin políticas y sin grants para anon/authenticated, para que la
-- clave pública no pueda leer ni escribir nada. Las reglas que no dependen de quién llama (límites,
-- largos, estados válidos, historial de cambios de estado) las impone la base.

create table public.mejoras (
  id            bigint generated always as identity primary key,
  empresa_id    uuid not null references public.empresas(id) on delete cascade,
  autor_id      uuid references public.app_users(id) on delete set null,
  autor_nombre  text not null,
  tipo          text not null check (tipo in ('error', 'mejora', 'idea', 'consulta')),
  titulo        text not null check (char_length(btrim(titulo)) between 3 and 160),
  detalle       text not null default '' check (char_length(detalle) <= 4000),
  pantalla      text check (char_length(pantalla) <= 200),          -- dónde estaba el usuario (sección / ruta)
  navegador     text check (char_length(navegador) <= 300),
  adjuntos      text[] not null default '{}' check (cardinality(adjuntos) <= 3), -- rutas en el bucket "mejoras"
  estado        text not null default 'nuevo'
                check (estado in ('nuevo', 'en_analisis', 'planificado', 'en_curso', 'hecho', 'descartado')),
  prioridad     text check (prioridad in ('baja', 'media', 'alta')),
  cerrado_en    timestamptz,
  confirmacion  text check (confirmacion in ('resuelto', 'no_resuelto')),
  confirmado_en timestamptz,
  reaperturas   int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index mejoras_empresa_idx on public.mejoras (empresa_id, created_at desc);
create index mejoras_estado_idx on public.mejoras (estado, created_at desc);

create table public.mejoras_comentarios (
  id          bigint generated always as identity primary key,
  mejora_id   bigint not null references public.mejoras(id) on delete cascade,
  autor_nombre text not null,
  de_plataforma boolean not null default false,   -- lo escribió el equipo de EULALIA
  tipo        text not null default 'comentario' check (tipo in ('comentario', 'estado')),
  texto       text not null check (char_length(btrim(texto)) between 1 and 4000),
  interno     boolean not null default false,     -- nota que solo ve la plataforma
  created_at  timestamptz not null default now()
);
create index mejoras_comentarios_mejora_idx on public.mejoras_comentarios (mejora_id, created_at);

-- Antes de insertar/actualizar: estado inicial, límite diario, updated_at y fecha de cierre.
create or replace function public.mejoras_antes() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.estado := 'nuevo';
    new.confirmacion := null; new.confirmado_en := null; new.cerrado_en := null; new.reaperturas := 0;
    if (select count(*) from public.mejoras
        where autor_id is not distinct from new.autor_id and empresa_id = new.empresa_id
          and created_at > now() - interval '1 day') >= 30 then
      raise exception 'Límite de 30 pedidos por día alcanzado.' using errcode = 'P0001';
    end if;
  else
    new.updated_at := now();
    if new.estado is distinct from old.estado then
      new.cerrado_en := case when new.estado in ('hecho', 'descartado') then now() else null end;
    end if;
  end if;
  return new;
end $$;

create trigger mejoras_antes before insert or update on public.mejoras
  for each row execute function public.mejoras_antes();

-- Después de cambiar el estado: deja el cambio en el historial del pedido.
create or replace function public.mejoras_despues() returns trigger
language plpgsql set search_path = public as $$
declare
  etiqueta jsonb := '{"nuevo":"Nuevo","en_analisis":"En análisis","planificado":"Planificado",
                      "en_curso":"En curso","hecho":"Hecho","descartado":"Descartado"}';
begin
  if new.estado is distinct from old.estado then
    insert into public.mejoras_comentarios (mejora_id, autor_nombre, de_plataforma, tipo, texto)
    values (new.id, 'EULALIA', true, 'estado',
            'Pasó de «' || (etiqueta ->> old.estado) || '» a «' || (etiqueta ->> new.estado) || '».');
  end if;
  return new;
end $$;

create trigger mejoras_despues after update on public.mejoras
  for each row execute function public.mejoras_despues();

-- Seguridad: solo service_role (la app) toca estas tablas y funciones.
alter table public.mejoras enable row level security;
alter table public.mejoras_comentarios enable row level security;
revoke all on public.mejoras, public.mejoras_comentarios from anon, authenticated;
revoke execute on function public.mejoras_antes(), public.mejoras_despues() from public, anon, authenticated;

-- Capturas de pantalla: bucket privado, solo imágenes, hasta 8 MB cada una.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('mejoras', 'mejoras', false, 8388608, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;
