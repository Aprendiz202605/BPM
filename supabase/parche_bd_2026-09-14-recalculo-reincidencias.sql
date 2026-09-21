-- ============================================================================
-- RECÁLCULO REAL de numero_reincidencia y nivel para TODO el histórico.
--
-- Por qué hace falta: numero_reincidencia se calcula y se guarda una sola
-- vez, en el momento en que se inserta cada incumplimiento. Todos los
-- parches anteriores (duplicados, reinicio por "Enviado", borrado con
-- renumeración) corrigen la lógica hacia ADELANTE, pero no vuelven a
-- calcular lo que ya estaba guardado desde antes de esos parches — por eso
-- casos como Katherin quedaron con huecos y números repetidos.
--
-- Corrige: ordena por la fecha REAL del hecho (columna "fecha"), no por
-- created_at (que en los datos migrados es solo "cuándo corrió la
-- migración", igual para muchas filas, y por eso desordenaba el cálculo).
--
-- No borra nada, no toca fecha/observación/activo/descargos — SOLO
-- reescribe numero_reincidencia y nivel, fila por fila, respetando los
-- reinicios reales (descargos con fecha_envio).
-- ============================================================================

-- 1) Aplica el recálculo real.
do $$
declare
 colab record; fila record; n integer; v_nivel public.incumplimiento_nivel;
begin
 for colab in select id from public.colaboradores loop
  n := 0;
  for fila in
   select i.id,
          (select max(d.fecha_envio) from public.descargos d
            where d.incumplimiento_id=i.id and d.fecha_envio is not null) as mi_envio
   from public.incumplimientos i
   where i.colaborador_id=colab.id and i.activo=true
   order by i.fecha asc, i.created_at asc
  loop
   n := n+1;
   select nivel into v_nivel from public.reglas_reincidencia
    where activo and n between min_reincidencia and coalesce(max_reincidencia,2147483647)
    order by min_reincidencia desc limit 1;
   update public.incumplimientos
    set numero_reincidencia=n, nivel=coalesce(v_nivel,'observacion')
    where id=fila.id;
   if fila.mi_envio is not null then n:=0; end if; -- se envió el descargo de ESTE -> el siguiente arranca en 1
  end loop;
 end loop;
end $$;

-- 2) Verificación: no debe quedar NINGÚN hueco ni número repetido dentro
--    de un mismo ciclo. Si esto devuelve filas, avísame.
with resets as (
  select i.colaborador_id, d.fecha_envio as reset_at
  from public.descargos d join public.incumplimientos i on i.id=d.incumplimiento_id
  where d.fecha_envio is not null
),
base as (
  select i.*,
    (select count(*) from resets r where r.colaborador_id=i.colaborador_id and r.reset_at<i.fecha) as ciclo_idx
  from public.incumplimientos i where i.activo=true
)
select colaborador_id, ciclo_idx, count(*) as filas, min(numero_reincidencia) as minimo, max(numero_reincidencia) as maximo
from base
group by colaborador_id, ciclo_idx
having max(numero_reincidencia) <> count(*) or min(numero_reincidencia) <> 1;

-- 3) Caso puntual de Katherin, para que lo confirmes de un vistazo.
select i.fecha, i.observacion, i.numero_reincidencia, i.nivel
from public.incumplimientos i
join public.colaboradores c on c.id=i.colaborador_id
where c.nombre_completo ilike '%KATHERIN KAINA GUERRA%' and i.activo=true
order by i.fecha;
