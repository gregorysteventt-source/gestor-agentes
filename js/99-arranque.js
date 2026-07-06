        // 17) ARRANQUE DE LA APLICACIÓN
        // ============================================================
        // Ajuste visual seguro: colorear ausencias del calendario según el tipo/motivo.
        // No cambia datos ni consultas; solo modifica la clase visual de los eventos ya generados.
        const obtenerEventosCalendarioPorFechaOriginal = obtenerEventosCalendarioPorFecha;

        function normalizarTipoAusenciaCalendario(tipo = '') {
            return String(tipo || '')
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toLowerCase()
                .trim();
        }

        function obtenerClaseAusenciaCalendario(tipo = '') {
            const valor = normalizarTipoAusenciaCalendario(tipo);

            if(valor.includes('vacacion')) {
                return 'bg-sky-50 text-sky-700 border-sky-100';
            }

            if(valor.includes('cumple')) {
                return 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-100';
            }

            if(valor.includes('dia libre') || valor.includes('libre') || valor.includes('horas extras')) {
                return 'bg-emerald-50 text-emerald-700 border-emerald-100';
            }

            if(valor.includes('reposo') || valor.includes('consulta') || valor.includes('medic')) {
                return 'bg-rose-50 text-rose-700 border-rose-100';
            }

            if(valor.includes('permiso')) {
                return 'bg-orange-50 text-orange-700 border-orange-100';
            }

            if(valor.includes('entrada') || valor.includes('salida') || valor.includes('cambio')) {
                return 'bg-violet-50 text-violet-700 border-violet-100';
            }

            return 'bg-slate-50 text-slate-700 border-slate-100';
        }

        obtenerEventosCalendarioPorFecha = function(fechaISO) {
            const eventos = obtenerEventosCalendarioPorFechaOriginal(fechaISO);

            return eventos.map(evento => {
                if(evento.tipo !== 'ausencia') return evento;

                const tipoAusencia = String(evento.titulo || '')
                    .split(' - ')
                    .slice(1)
                    .join(' - ');

                return {
                    ...evento,
                    clase: obtenerClaseAusenciaCalendario(tipoAusencia)
                };
            });
        };

        // Disparar inicialización general
        inicializarAutenticacion();
     