-- ============================================================
-- Gestor de Guardias — seguridad de las tablas
-- Ejecutar UNA vez en Supabase > SQL Editor.
--
-- IMPORTANTE: no modifica ni borra datos. Solo activa permisos:
--   - activa Row Level Security en las 6 tablas,
--   - crea una política que permite el acceso al usuario autenticado,
--   - ajusta los permisos de la función guardar_cuadrante_seguro.
--
-- Por qué: la app está publicada en GitHub Pages y la clave pública (anon key)
-- está en un repositorio público. Con RLS desactivado, cualquiera que tenga esa
-- clave puede leer y escribir las tablas sin pasar por la aplicación.
--
-- Además de esto, hay que cerrar el registro en el panel de Supabase:
--   Authentication > Sign In / Providers > desactivar "Allow new users to sign up".
-- ============================================================

-- ------------------------------------------------------------
-- 1) Diagnóstico: estado actual de las tablas
--    (queda en el resultado; sirve para comparar antes/después)
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
-- 2) Activar RLS y crear la política de acceso autenticado
--    Es idempotente: se puede ejecutar más de una vez.
-- ------------------------------------------------------------
do $$
declare
    tabla text;
    tablas text[] := array[
        'agentes',
        'turnos_fines_de_semana',
        'ausencias_agentes',
        'novedades_coberturas',
        'coberturas_diarias',
        'notas_calendario'
    ];
begin
    foreach tabla in array tablas loop
        if to_regclass(format('public.%I', tabla)) is null then
            raise notice 'Se omite %: la tabla no existe.', tabla;
            continue;
        end if;

        execute format('alter table public.%I enable row level security', tabla);

        execute format('drop policy if exists acceso_autenticado on public.%I', tabla);
        execute format(
            'create policy acceso_autenticado on public.%I
                for all
                to authenticated
                using (true)
                with check (true)',
            tabla
        );

        raise notice 'RLS activo y política creada en %.', tabla;
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
-- 4) Verificación: todas las tablas deben salir con rls_activo = true
--    y con 1 política.
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

-- ============================================================
-- DESHACER (solo si algo sale mal)
-- Descomentá y ejecutá este bloque. Deja las tablas como estaban:
-- sin RLS y sin la política.
-- ============================================================
-- do $$
-- declare
--     tabla text;
--     tablas text[] := array['agentes','turnos_fines_de_semana','ausencias_agentes',
--                            'novedades_coberturas','coberturas_diarias','notas_calendario'];
-- begin
--     foreach tabla in array tablas loop
--         if to_regclass(format('public.%I', tabla)) is null then continue; end if;
--         execute format('drop policy if exists acceso_autenticado on public.%I', tabla);
--         execute format('alter table public.%I disable row level security', tabla);
--         raise notice 'Revertido en %.', tabla;
--     end loop;
-- end
-- $$;
