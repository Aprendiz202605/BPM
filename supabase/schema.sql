-- BPM Control de Incumplimientos / Supabase PostgreSQL
create extension if not exists pgcrypto;

do $$ begin create type public.app_role as enum ('administrador','supervisor_bpm','coordinador','consulta'); exception when duplicate_object then null; end $$;
do $$ begin create type public.incumplimiento_nivel as enum ('observacion','alerta','descargo','alerta_critica'); exception when duplicate_object then null; end $$;
do $$ begin create type public.descargo_estado as enum ('pendiente','enviado','vencido','cerrado'); exception when duplicate_object then null; end $$;

create table if not exists public.profiles(
 id uuid primary key references auth.users(id) on delete cascade,
 nombre text,
 correo text,
 rol public.app_role not null default 'consulta',
 activo boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.colaboradores(
 id uuid primary key default gen_random_uuid(), cedula text not null unique, nombre_completo text not null,
 correo text, telefono text, area text not null, cargo text not null, tipo_vinculacion text,
 fecha_ingreso date, activo boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.tipos_incumplimiento(
 id uuid primary key default gen_random_uuid(), codigo text not null unique, nombre text not null,
 descripcion text, activo boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.configuracion(
 id integer primary key default 1 check(id=1), dias_plazo_descargo integer not null default 3 check(dias_plazo_descargo between 1 and 365),
 notificar_generacion boolean not null default true, notificar_dos_dias boolean not null default true, notificar_vencido boolean not null default true,
 updated_at timestamptz not null default now()
);
create table if not exists public.reglas_reincidencia(
 id uuid primary key default gen_random_uuid(), min_reincidencia integer not null, max_reincidencia integer,
 nivel public.incumplimiento_nivel not null, accion text not null, activo boolean not null default true,
 constraint reglas_rango check(max_reincidencia is null or max_reincidencia>=min_reincidencia)
);
create table if not exists public.incumplimientos(
 id uuid primary key default gen_random_uuid(), colaborador_id uuid not null references public.colaboradores(id),
 tipo_id uuid not null references public.tipos_incumplimiento(id), fecha date not null default current_date,
 observacion text not null, numero_reincidencia integer not null default 1,
 nivel public.incumplimiento_nivel not null default 'observacion', registrado_por uuid references public.profiles(id), created_at timestamptz not null default now(),
 activo boolean not null default true
);
create table if not exists public.descargos(
 id uuid primary key default gen_random_uuid(), colaborador_id uuid not null references public.colaboradores(id),
 incumplimiento_id uuid not null unique references public.incumplimientos(id), fecha_generacion timestamptz not null default now(),
 fecha_limite date not null, enviado boolean not null default false, fecha_envio timestamptz, fecha_cierre timestamptz,
 estado public.descargo_estado not null default 'pendiente', observaciones text, pdf_url text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 activo boolean not null default true
);
create table if not exists public.notificaciones(
 id uuid primary key default gen_random_uuid(), usuario_id uuid references public.profiles(id),
 tipo text not null, mensaje text not null, referencia_id uuid, leida boolean not null default false, created_at timestamptz not null default now()
);
create table if not exists public.audit_log(
 id bigserial primary key, usuario uuid references public.profiles(id), accion text not null, tabla text not null,
 registro jsonb, fecha timestamptz not null default now(), ip inet
);

create index if not exists idx_colaboradores_cedula on public.colaboradores(cedula);
create index if not exists idx_colaboradores_nombre on public.colaboradores using gin(to_tsvector('spanish', nombre_completo));
create index if not exists idx_incumplimientos_colaborador_fecha on public.incumplimientos(colaborador_id,fecha desc);
create index if not exists idx_incumplimientos_tipo on public.incumplimientos(tipo_id);
create index if not exists idx_incumplimientos_fecha on public.incumplimientos(fecha);
create index if not exists idx_descargos_estado_limite on public.descargos(estado,fecha_limite);
create index if not exists idx_audit_fecha on public.audit_log(fecha desc);

insert into public.configuracion(id,dias_plazo_descargo) values(1,3) on conflict(id) do nothing;
insert into public.reglas_reincidencia(min_reincidencia,max_reincidencia,nivel,accion) values
(1,1,'observacion','Observación'),(2,2,'alerta','Alerta'),(3,3,'descargo','Descargo'),(4,null,'alerta_critica','Alerta crítica') on conflict do nothing;
insert into public.tipos_incumplimiento(codigo,nombre,descripcion) values
('BPM-001','Uso incorrecto de EPP','Incumplimiento del estándar de elementos de protección personal'),
('BPM-002','Ingreso de alimentos','Ingreso o consumo de alimentos en área no autorizada'),
('BPM-003','Manejo inadecuado de residuos','Disposición no conforme de residuos') on conflict(codigo) do nothing;

create or replace function public.current_app_role() returns public.app_role language sql stable security definer set search_path=public as $$
 select coalesce((select rol from public.profiles where id=auth.uid()),'consulta'::public.app_role)
$$;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$ select public.current_app_role()='administrador'::public.app_role $$;
create or replace function public.can_manage_incidents() returns boolean language sql stable security definer set search_path=public as $$ select public.current_app_role() in ('administrador','supervisor_bpm') $$;

create or replace function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;

drop trigger if exists profiles_updated_at on public.profiles; create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists colaboradores_updated_at on public.colaboradores; create trigger colaboradores_updated_at before update on public.colaboradores for each row execute function public.set_updated_at();
drop trigger if exists tipos_updated_at on public.tipos_incumplimiento; create trigger tipos_updated_at before update on public.tipos_incumplimiento for each row execute function public.set_updated_at();
drop trigger if exists descargos_updated_at on public.descargos; create trigger descargos_updated_at before update on public.descargos for each row execute function public.set_updated_at();

create or replace function public.assign_profile_on_signup() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into public.profiles(id,nombre,correo,rol) values(new.id,coalesce(new.raw_user_meta_data->>'nombre',new.email),new.email,'consulta') on conflict(id) do nothing; return new; end $$;
drop trigger if exists on_auth_user_created on auth.users; create trigger on_auth_user_created after insert on auth.users for each row execute function public.assign_profile_on_signup();

-- Reincidencia por ciclo: cuenta desde el último descargo de este colaborador
-- marcado como "Enviado" (si nunca se ha enviado uno, cuenta desde siempre).
-- No borra ni recalcula histórico: solo cambia cómo se cuenta hacia adelante.
create or replace function public.calculate_incidence() returns trigger language plpgsql as $$
declare n integer; r record; last_reset timestamptz;
begin
 select max(d.fecha_envio) into last_reset
 from public.descargos d join public.incumplimientos i on i.id=d.incumplimiento_id
 where i.colaborador_id=new.colaborador_id and d.fecha_envio is not null;

 select count(*)+1 into n from public.incumplimientos
 where colaborador_id=new.colaborador_id
   and id<>coalesce(new.id,'00000000-0000-0000-0000-000000000000')
   and coalesce(activo,true)=true
   and (last_reset is null or created_at>last_reset);

 new.numero_reincidencia=n;
 select * into r from public.reglas_reincidencia where activo and n between min_reincidencia and coalesce(max_reincidencia,2147483647) order by min_reincidencia desc limit 1;
 if found then new.nivel=r.nivel; else new.nivel='observacion'; end if;
 if new.registrado_por is null then new.registrado_por=auth.uid(); end if;
 return new;
end $$;
drop trigger if exists trg_calculate_incidence on public.incumplimientos; create trigger trg_calculate_incidence before insert on public.incumplimientos for each row execute function public.calculate_incidence();

-- Protección de eliminación (soft-delete): nadie puede desactivar un
-- incumplimiento o descargo si no es administrador, así intente llamarlo
-- directamente por la API de Supabase.
create or replace function public.protect_soft_delete() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if old.activo=true and new.activo=false and not public.is_admin() then
  raise exception 'No autorizado: solo un administrador puede eliminar este registro';
 end if;
 return new;
end $$;
drop trigger if exists trg_protect_delete_incumplimientos on public.incumplimientos; create trigger trg_protect_delete_incumplimientos before update on public.incumplimientos for each row execute function public.protect_soft_delete();
drop trigger if exists trg_protect_delete_descargos on public.descargos; create trigger trg_protect_delete_descargos before update on public.descargos for each row execute function public.protect_soft_delete();

-- Borrado real de incumplimientos (solo si no tienen descargo asociado),
-- con renumeración automática del resto del ciclo. Si sí tienen descargo
-- asociado, cae al ocultar (activo=false) para no perder esa relación.
create or replace function public.eliminar_incumplimiento_real(p_id uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
 v_row record; v_has_descargo boolean; v_cycle_start timestamptz; v_cycle_end timestamptz;
 r record; v_new_n integer; v_new_nivel public.incumplimiento_nivel;
begin
 if not public.is_admin() then
  raise exception 'No autorizado: solo un administrador puede eliminar este registro';
 end if;
 select * into v_row from public.incumplimientos where id=p_id;
 if v_row is null then return jsonb_build_object('ok',false,'motivo','no_existe'); end if;
 select exists(select 1 from public.descargos where incumplimiento_id=p_id) into v_has_descargo;
 if v_has_descargo then
  update public.incumplimientos set activo=false where id=p_id;
  return jsonb_build_object('ok',true,'modo','oculto','motivo','tiene_descargo_asociado');
 end if;
 select max(d.fecha_envio) into v_cycle_start
 from public.descargos d join public.incumplimientos i on i.id=d.incumplimiento_id
 where i.colaborador_id=v_row.colaborador_id and d.fecha_envio is not null and d.fecha_envio<v_row.created_at;
 select min(d.fecha_envio) into v_cycle_end
 from public.descargos d join public.incumplimientos i on i.id=d.incumplimiento_id
 where i.colaborador_id=v_row.colaborador_id and d.fecha_envio is not null and d.fecha_envio>v_row.created_at;
 delete from public.incumplimientos where id=p_id;
 for r in
  select id, numero_reincidencia from public.incumplimientos
  where colaborador_id=v_row.colaborador_id and activo=true
    and numero_reincidencia>v_row.numero_reincidencia
    and (v_cycle_start is null or created_at>v_cycle_start)
    and (v_cycle_end is null or created_at<v_cycle_end)
  order by created_at asc
 loop
  v_new_n:=r.numero_reincidencia-1;
  select nivel into v_new_nivel from public.reglas_reincidencia
   where activo and v_new_n between min_reincidencia and coalesce(max_reincidencia,2147483647)
   order by min_reincidencia desc limit 1;
  update public.incumplimientos set numero_reincidencia=v_new_n, nivel=coalesce(v_new_nivel,'observacion') where id=r.id;
 end loop;
 return jsonb_build_object('ok',true,'modo','eliminado');
end $$;
grant execute on function public.eliminar_incumplimiento_real(uuid) to authenticated;

create or replace function public.create_descargo_on_third() returns trigger language plpgsql security definer set search_path=public as $$
declare days integer; due date;
begin
 if new.numero_reincidencia=3 then
  select dias_plazo_descargo into days from public.configuracion where id=1;
  due:=current_date+coalesce(days,3);
  insert into public.descargos(colaborador_id,incumplimiento_id,fecha_limite) values(new.colaborador_id,new.id,due) on conflict(incumplimiento_id) do nothing;
  if (select notificar_generacion from public.configuracion where id=1) then
    insert into public.notificaciones(usuario_id,tipo,mensaje,referencia_id) select p.id,'descargo_generado','Se generó un descargo automático para un colaborador.',new.id from public.profiles p where p.rol in ('administrador','supervisor_bpm') and p.activo;
  end if;
 end if; return new;
end $$;
drop trigger if exists trg_create_descargo on public.incumplimientos; create trigger trg_create_descargo after insert on public.incumplimientos for each row execute function public.create_descargo_on_third();

create or replace function public.sync_descargo_status() returns trigger language plpgsql as $$ begin if new.estado='pendiente' and new.fecha_limite<current_date then new.estado='vencido'; end if; return new; end $$;
drop trigger if exists trg_sync_descargo_status on public.descargos; create trigger trg_sync_descargo_status before insert or update on public.descargos for each row execute function public.sync_descargo_status();

create or replace function public.write_audit() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into public.audit_log(usuario,accion,tabla,registro) values(auth.uid(),tg_op,tg_table_name,case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end); if tg_op='DELETE' then return old; else return new; end if; end $$;

create or replace function public.attach_audit(t text) returns void language plpgsql as $$ begin execute format('drop trigger if exists audit_%I on public.%I',t,t); execute format('create trigger audit_%I after insert or update or delete on public.%I for each row execute function public.write_audit()',t,t); end $$;
select public.attach_audit('colaboradores'); select public.attach_audit('tipos_incumplimiento'); select public.attach_audit('incumplimientos'); select public.attach_audit('descargos'); select public.attach_audit('configuracion'); select public.attach_audit('reglas_reincidencia');

create or replace function public.procesar_notificaciones() returns integer language plpgsql security definer set search_path=public as $$
declare d record; n integer:=0; days integer;
begin
 select dias_plazo_descargo into days from public.configuracion where id=1;
 update public.descargos set estado='vencido' where estado='pendiente' and fecha_limite<current_date;
 for d in select * from public.descargos where estado='pendiente' loop
   if d.fecha_limite=current_date+2 and (select notificar_dos_dias from public.configuracion where id=1) then
     insert into public.notificaciones(tipo,mensaje,referencia_id) values('vence_en_2_dias','Un descargo vence en 2 días.',d.id); n:=n+1;
   elsif d.fecha_limite<=current_date and (select notificar_vencido from public.configuracion where id=1) then
     insert into public.notificaciones(tipo,mensaje,referencia_id) values('descargo_vencido','Un descargo se encuentra vencido.',d.id); n:=n+1;
   end if;
 end loop; return n;
end $$;

-- RLS
alter table public.profiles enable row level security;
alter table public.colaboradores enable row level security;
alter table public.tipos_incumplimiento enable row level security;
alter table public.configuracion enable row level security;
alter table public.reglas_reincidencia enable row level security;
alter table public.incumplimientos enable row level security;
alter table public.descargos enable row level security;
alter table public.notificaciones enable row level security;
alter table public.audit_log enable row level security;

create policy profiles_select on public.profiles for select using(auth.uid() is not null and (id=auth.uid() or public.is_admin()));
create policy profiles_admin on public.profiles for all using(public.is_admin()) with check(public.is_admin());
create policy col_read on public.colaboradores for select using(auth.uid() is not null);
create policy col_write on public.colaboradores for insert with check(public.is_admin());
create policy col_update on public.colaboradores for update using(public.is_admin()) with check(public.is_admin());
create policy type_read on public.tipos_incumplimiento for select using(auth.uid() is not null);
create policy type_write on public.tipos_incumplimiento for all using(public.is_admin()) with check(public.is_admin());
create policy config_admin on public.configuracion for all using(public.is_admin()) with check(public.is_admin());
create policy rule_read on public.reglas_reincidencia for select using(auth.uid() is not null);
create policy rule_admin on public.reglas_reincidencia for all using(public.is_admin()) with check(public.is_admin());
create policy inc_read on public.incumplimientos for select using(auth.uid() is not null);
create policy inc_write on public.incumplimientos for insert with check(public.can_manage_incidents());
create policy inc_admin_update on public.incumplimientos for update using(public.is_admin()) with check(public.is_admin());
create policy desc_read on public.descargos for select using(auth.uid() is not null);
create policy desc_write on public.descargos for update using(public.current_app_role() in ('administrador','supervisor_bpm')) with check(public.current_app_role() in ('administrador','supervisor_bpm'));
create policy notif_own on public.notificaciones for select using(usuario_id=auth.uid() or public.is_admin());
create policy audit_admin_read on public.audit_log for select using(public.is_admin());

-- Storage buckets / policies (bucket privado)
insert into storage.buckets(id,name,public) values('descargos','descargos',false) on conflict(id) do nothing;
create policy storage_descargos_read on storage.objects for select using(bucket_id='descargos' and auth.uid() is not null);
create policy storage_descargos_write on storage.objects for insert with check(bucket_id='descargos' and public.current_app_role() in ('administrador','supervisor_bpm'));
create policy storage_descargos_update on storage.objects for update using(bucket_id='descargos' and public.current_app_role() in ('administrador','supervisor_bpm'));

-- Demo data (only collaboraters/types; profiles are created by Auth)
insert into public.colaboradores(cedula,nombre_completo,correo,telefono,area,cargo,tipo_vinculacion,fecha_ingreso) values
('1001001001','Ana Pérez','ana@empresa.co','3001111111','Producción','Operaria','Directo','2024-02-15'),
('1001001002','Carlos Gómez','carlos@empresa.co','3002222222','Calidad','Analista','Directo','2023-06-01'),
('1001001003','María Torres','maria@empresa.co','3003333333','Producción','Operaria','Temporal','2025-01-10') on conflict(cedula) do nothing;
