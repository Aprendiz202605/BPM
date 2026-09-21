-- ============================================================================
-- LIMPIEZA DE DUPLICADOS EN INCUMPLIMIENTOS + PREVENCIÓN FUTURA
-- Causa raíz: el script de migración histórica no tenía protección contra
-- re-ejecución, y tampoco existía ninguna restricción a nivel de base de
-- datos que impidiera insertar el mismo incumplimiento dos veces.
-- Este script NO borra nada físicamente (evita el error de foreign key con
-- descargos): usa el mismo soft-delete (activo=false) que ya usa el botón
-- de eliminar en la aplicación.
-- ============================================================================

-- 1) DIAGNÓSTICO: ver los duplicados reales antes de tocar nada.
select colaborador_id, tipo_id, fecha, observacion, count(*) as veces,
       array_agg(id order by created_at) as ids_en_orden_de_creacion
from public.incumplimientos
where activo=true
group by colaborador_id, tipo_id, fecha, observacion
having count(*) > 1
order by veces desc;

-- 2) LIMPIEZA: conserva la fila más antigua de cada grupo duplicado
--    (la primera que se creó) y desactiva las demás. Se desactiva el
--    trigger de protección solo durante este UPDATE puntual porque, al
--    correr esto desde el SQL Editor, no hay una sesión de administrador
--    autenticada (is_admin() daría falso y bloquearía el UPDATE).
alter table public.incumplimientos disable trigger trg_protect_delete_incumplimientos;

with dup as (
 select id, row_number() over (
   partition by colaborador_id, tipo_id, fecha, observacion
   order by created_at asc
 ) as rn
 from public.incumplimientos where activo=true
)
update public.incumplimientos set activo=false
where id in (select id from dup where rn>1);

alter table public.incumplimientos enable trigger trg_protect_delete_incumplimientos;

-- 3) VERIFICACIÓN: no debe devolver ninguna fila.
select colaborador_id, tipo_id, fecha, observacion, count(*)
from public.incumplimientos where activo=true
group by 1,2,3,4 having count(*)>1;

-- 4) PREVENCIÓN: bloquea a nivel de base de datos que esto vuelva a pasar,
--    sin importar si viene de una migración repetida, un doble clic en la
--    app, o una llamada directa a la API de Supabase.
create unique index if not exists uniq_incumplimiento_activo
on public.incumplimientos(colaborador_id, tipo_id, fecha, observacion)
where activo=true;
