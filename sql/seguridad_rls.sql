-- ============================================================
-- Gestor de Guardias — activar Row Level Security
-- Ejecutar en Supabase > SQL Editor.
--
-- IMPORTANTE: no modifica ni borra datos. Solo activa permisos.
--
-- Este script NO crea políticas. Cada tabla ya tiene la suya, restringida al
-- usuario dueño con auth.uid(), por ejemplo:
--
--   "Solo Gregory gestiona agentes"  roles={authenticated}
--   qual: (auth.uid() = 'e7fd2b32-9ce7-405c-acfc-c94b590dbe19')
--
-- Una versión anterior de este archivo creaba además una política
-- "acceso_autenticado" con USING (true). Eso era un error: en PostgreSQL las
-- políticas permisivas se combinan con OR, así que ampliaba el acceso a
-- cualquier usuario autenticado y anulaba la restricción por auth.uid().
-- Si ejecutaste aquella versión, corré primero el bloque 0.
--
-- Contexto: la app está publicada en GitHub Pages y la clave pública (anon key)
-- está en un repositorio público. Sin RLS, cualquiera con esa clave lee y escribe.
-- ============================================================

-- ------------------------------------------------------------
-- 0) Limpieza: quitar la política amplia que creaba la versión anterior
--    (inofensivo si no existe)
-- ------------------------------------------------------------
do $$
declare
    tabla text;
    tablas text[] := array[
        'agentes','turnos_fines_de_semana','ausencias_agentes',
        'novedades_coberturas','coberturas_diarias','notas_calendario'
    ];
begin
    foreach tabla in array tablas loop
        if to_regclass(format('public.%I', tabla)) is null then continue; end if;
        execute format('drop policy if exists acceso_autenticado on public.%I', tabla);
    end loop;
    raise notice 'Limpieza lista: política acceso_autenticado eliminada si existía.';
end
$$;

-- ------------------------------------------------------------
-- 1) Diagnóstico previo
-- ------------------------------------------------------------
select c.relname as tabla,
       c.relrowsecurity as rls_activo,
       (select count(*) from pg_policy p where p.polrelid = c.oid) as politicas
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname in ('agentes','turnos_fines_de_semana','ausencias_agentes',
                    'novedades_coberturas','coberturas_diarias','notas_calendario')
order by c.relname;

-- ------------------------------------------------------------
-- 2) Activar RLS, sin crear políticas
--    Si una tabla no tuviera ninguna política, queda bloqueada por completo
--    (deny all): el aviso te lo dice para que la crees a mano.
-- ------------------------------------------------------------
do $$
declare
    tabla text;
    total_politicas integer;
    tablas text[] := array[
        'agentes','turnos_fines_de_semana','ausencias_agentes',
        'novedades_coberturas','coberturas_diarias','notas_calendario'
    ];
begin
    foreach tabla in array tablas loop
        if to_regclass(format('public.%I', tabla)) is null then
            raise notice 'Se omite %: la tabla no existe.', tabla;
            continue;
        end if;

        execute format('alter table public.%I enable row level security', tabla);

        select count(*) into total_politicas
        from pg_policy p
        where p.polrelid = to_regclass(format('public.%I', tabla));

        if total_politicas = 0 then
            raise warning 'ATENCIÓN: % quedó con RLS y sin políticas: nadie podrá acceder. Creá una restringida con auth.uid().', tabla;
        else
            raise notice 'RLS activo en % (% política/s).', tabla, total_politicas;
        end if;
    end loop;
end
$$;

-- ------------------------------------------------------------
-- 3) Permisos de la RPC guardar_cuadrante_seguro
--    El permiso por defecto de PostgreSQL se concede a PUBLIC, así que
--    revocar solo a "anon" no alcanza.
--    Si la función no existe con esa firma, se omite en vez de fallar.
-- ------------------------------------------------------------
do $$
begin
    if to_regprocedure('public.guardar_cuadrante_seguro(date[], jsonb)') is null then
        raise notice 'La función guardar_cuadrante_seguro no existe: se omite el ajuste de permisos.';
    else
        execute 'revoke execute on function public.guardar_cuadrante_seguro(date[], jsonb) from public';
        execute 'revoke execute on function public.guardar_cuadrante_seguro(date[], jsonb) from anon';
        execute 'grant execute on function public.guardar_cuadrante_seguro(date[], jsonb) to authenticated';
        raise notice 'Permisos de guardar_cuadrante_seguro ajustados.';
    end if;
end
$$;

-- ------------------------------------------------------------
-- 4) Verificación: RLS activo, 1 política por tabla y sin políticas abiertas
--    Todas las filas deben salir con rls_activo = true,
--    politica_abierta = false y roles = {authenticated}.
-- ------------------------------------------------------------
select c.relname as tabla,
       c.relrowsecurity as rls_activo,
       count(p.oid) as politicas,
       bool_or(p.polroles::text like '%anon%') as politica_abierta,
       string_agg(p.polname, ' | ' order by p.polname) as nombres
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policy p on p.polrelid = c.oid
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname in ('agentes','turnos_fines_de_semana','ausencias_agentes',
                    'novedades_coberturas','coberturas_diarias','notas_calendario')
group by c.relname, c.relrowsecurity
order by c.relname;

-- ============================================================
-- DESHACER (solo si algo sale mal)
-- Descomentá y ejecutá. Deja las tablas sin RLS, como estaban al principio.
-- Las políticas NO se borran: solo dejan de aplicarse.
-- ============================================================
-- do $$
-- declare
--     tabla text;
--     tablas text[] := array['agentes','turnos_fines_de_semana','ausencias_agentes',
--                            'novedades_coberturas','coberturas_diarias','notas_calendario'];
-- begin
--     foreach tabla in array tablas loop
--         if to_regclass(format('public.%I', tabla)) is null then continue; end if;
--         execute format('alter table public.%I disable row level security', tabla);
--         raise notice 'Revertido en %.', tabla;
--     end loop;
-- end
-- $$;
