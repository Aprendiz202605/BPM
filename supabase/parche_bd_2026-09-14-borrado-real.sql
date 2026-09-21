-- ============================================================================
-- BORRADO REAL DE INCUMPLIMIENTOS (con renumeración automática)
-- Reglas acordadas:
--  1) Si el incumplimiento YA generó un descargo (hay una fila en
--     "descargos" que lo referencia), NO se puede borrar de verdad —
--     rompería la relación y perdería ese descargo. En ese caso se sigue
--     usando el ocultar (activo=false), igual que hasta ahora.
--  2) Si NO tiene ningún descargo asociado, se borra físicamente
--     (DELETE real, desaparece de la base de datos, sin poder recuperarse).
--  3) Al borrarlo, los demás incumplimientos del MISMO colaborador y del
--     MISMO ciclo disciplinario que quedaron numerados por encima se
--     renumeran automáticamente (ej: si borras el 2 de un ciclo de 3, el
--     que era 3 pasa a ser 2), y su nivel (Observación/Alerta/Descargo) se
--     recalcula para que quede consistente con su nuevo número.
-- No cambia ninguna tabla, ni ningún nombre de columna existente.
-- ============================================================================

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

 -- límites del ciclo disciplinario al que pertenece esta fila, para no
 -- renumerar incumplimientos de un ciclo distinto (antes/después de un
 -- descargo ya "Enviado").
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
