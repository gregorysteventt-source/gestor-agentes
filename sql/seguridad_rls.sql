-- ============================================================
-- Gestor de Guardias — seguridad de las tablas
-- Ejecutar UNA vez en Supabase > SQL Editor.
--
-- Qué hace:
--   1. Activa Row Level Security en las 6 tablas del gestor.
--   2. Crea una única política: solo usuarios autenticados pueden leer y escribir.
--   3. Quita el acceso anónimo a la función guardar_cuadrante_seguro.
--
-- Por qué: la app está publicada en GitHub Pages y la clave pública (anon key)
-- está en el código. Con RLS desactivado, cualquiera que tenga esa clave puede
-- leer y escribir las tablas sin pasar por la aplicación.
--
-- IMPORTANTE: además de esto, en el panel de Supabase hay que cerrar el registro:
--   Authentication > Sign In / Providers > desactivar "Allow new users to sign up".
-- Sin eso, cualquiera puede crearse una cuenta y entrar como usuario autenticado.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Diagnóstico: qué tablas están abiertas AHORA
--    (ejecutá solo esta consulta primero si querés ver el estado actual)
-- ------------------------------------------------------------
-- select c.relname as tabla, c.relrowsecurity as rls_activo
-- from pg_class c
-- join pg_namespace n on n.oid = c.relnamespace
-- where n.nspname = 'public' and c.relkind = 'r'
-- order by c.relname;

-- ------------------------------------------------------------
-- 2) Activar RLS y crear la política de acceso autenticado
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
        -- Si la tabla no existe, se omite en vez de abortar el script.
        if to_regclass(format('public.%I', tabla)) is null then
            raise notice 'Se omite %: la tabla no existe.', tabla;
            continue;
        end if;

        execute format('alter table public.%I enable row level security', tabla);

        -- Una sola política: el dueño del gestor entra con su usuario autenticado.
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
-- 3) Cerrar la RPC a usuarios anónimos
--    El permiso por defecto de PostgreSQL se concede a PUBLIC, así que
--    revocar solo a "anon" no alcanza.
-- ------------------------------------------------------------
revoke execute on function public.guardar_cuadrante_seguro(date[], jsonb) from public;
revoke execute on function public.guardar_cuadrante_seguro(date[], jsonb) from anon;
grant execute on function public.guardar_cuadrante_seguro(date[], jsonb) to authenticated;

-- ------------------------------------------------------------
-- 4) Verificación final: todas las tablas deben salir con rls_activo = true
-- ------------------------------------------------------------
select c.relname as tabla, c.relrowsecurity as rls_activo
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname in ('agentes','turnos_fines_de_semana','ausencias_agentes',
                    'novedades_coberturas','coberturas_diarias','notas_calendario')
order by c.relname;
