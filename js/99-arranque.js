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
                return 'bg-red-50 text-red-700 border-red-100';
            }

            if(valor.includes('cumple')) {
                return 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-100';
            }

            if(valor.includes('dia libre') || valor.includes('libre') || valor.includes('horas extras')) {
                return 'bg-emerald-50 text-emerald-700 border-emerald-100';
            }

            if(valor.includes('permiso')) {
                return 'bg-violet-50 text-violet-700 border-violet-100';
            }

            if(valor.includes('reposo') || valor.includes('consulta') || valor.includes('medic')) {
                return 'bg-rose-50 text-rose-700 border-rose-100';
            }

            if(valor.includes('entrada') || valor.includes('salida') || valor.includes('cambio')) {
                return 'bg-amber-50 text-amber-700 border-amber-100';
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
                const textoParaClasificar = `${tipoAusencia} ${evento.detalle || ''}`;

                return {
                    ...evento,
                    clase: obtenerClaseAusenciaCalendario(textoParaClasificar)
                };
            });
        };

        function instalarOpcionesAusencia() {
            const select = document.getElementById('ausencia_tipo');
            if(!select) return;

            const opciones = [
                'Vacaciones',
                'Día Libre',
                'Cumpleaños',
                'Permiso',
                'Reposo',
                'Consulta médica',
                'Entrada más tarde',
                'Salida más temprano',
                'Otro'
            ];

            opciones.forEach(opcion => {
                const existe = Array.from(select.options).some(item => item.value === opcion);
                if(existe) return;

                const option = document.createElement('option');
                option.value = opcion;
                option.textContent = opcion;
                select.appendChild(option);
            });
        }

        function instalarIconoPestanaGestor() {
            const svg = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
                    <defs>
                        <linearGradient id="g" x1="10" y1="8" x2="54" y2="58" gradientUnits="userSpaceOnUse">
                            <stop offset="0" stop-color="#0f172a"/>
                            <stop offset="0.55" stop-color="#2563eb"/>
                            <stop offset="1" stop-color="#16a34a"/>
                        </linearGradient>
                    </defs>
                    <rect width="64" height="64" rx="16" fill="url(#g)"/>
                    <path d="M32 12l16 6v11c0 12-7 20-16 23-9-3-16-11-16-23V18l16-6z" fill="#ffffff" opacity="0.92"/>
                    <path d="M32 17l10 4v8c0 8-4 14-10 17V17z" fill="#dbeafe"/>
                    <rect x="22" y="25" width="20" height="16" rx="3" fill="#0f172a"/>
                    <path d="M26 22v6M38 22v6M25 31h14" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>
                    <circle cx="32" cy="36" r="3" fill="#22c55e"/>
                </svg>
            `.trim();
            const href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
            let icono = document.querySelector('link[rel="icon"]');
            if(!icono) {
                icono = document.createElement('link');
                icono.rel = 'icon';
                document.head.appendChild(icono);
            }
            icono.type = 'image/svg+xml';
            icono.href = href;
        }

        instalarOpcionesAusencia();
        instalarIconoPestanaGestor();

        // Disparar inicialización general
        inicializarAutenticacion();
     