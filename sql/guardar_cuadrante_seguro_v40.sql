-- ============================================================
-- Gestor de Guardias v40
-- RPC transaccional para guardar cuadrantes de fin de semana
-- Ejecutar una sola vez en Supabase > SQL Editor.
-- ============================================================

create or replace function public.guardar_cuadrante_seguro(
    p_fechas date[],
    p_turnos jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
    v_eliminados integer := 0;
    v_insertados integer := 0;
begin
    if p_fechas is null or array_length(p_fechas, 1) is null then
        raise exception 'No se recibieron fechas para actualizar el cuadrante.';
    end if;

    if p_turnos is null or jsonb_typeof(p_turnos) <> 'array' then
        raise exception 'No se recibieron turnos válidos para guardar.';
    end if;

    -- Borra solamente las fechas activas del cuadrante.
    -- Al estar dentro de la función, si el INSERT falla, PostgreSQL revierte también este DELETE.
    with filas_eliminadas as (
        delete from public.turnos_fines_de_semana
        where fecha = any(p_fechas)
        returning 1
    )
    select count(*) into v_eliminados
    from filas_eliminadas;

    -- Inserta el nuevo cuadrante recibido desde el HTML.
    insert into public.turnos_fines_de_semana (
        fecha,
        turno,
        agente_id,
        modalidad,
        sucursal
    )
    select
        (item->>'fecha')::date,
        nullif(item->>'turno', ''),
        nullif(item->>'agente_id', '')::integer,
        nullif(item->>'modalidad', ''),
        nullif(item->>'sucursal', '')
    from jsonb_array_elements(p_turnos) as item;

    get diagnostics v_insertados = row_count;

    return jsonb_build_object(
        'ok', true,
        'eliminados', v_eliminados,
        'insertados', v_insertados
    );
end;
$$;

-- Permite ejecutar la RPC a usuarios autenticados.
-- El RLS de la tabla sigue aplicando porque la función es SECURITY INVOKER.
grant execute on function public.guardar_cuadrante_seguro(date[], jsonb) to authenticated;

-- Opcional: evita ejecución desde usuarios anónimos si no querés que el endpoint quede disponible sin sesión.
revoke execute on function public.guardar_cuadrante_seguro(date[], jsonb) from anon;
