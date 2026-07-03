        // 5) CARGA DE DATOS DESDE SUPABASE
        // ============================================================
        // Cargar Agentes desde Supabase
        async function cargarAgentes() {
            const { data: agentes, error } = await supabaseClient
                .from(TABLAS.AGENTES)
                .select('id, nombre_corto, nombre_completo, modalidad, sucursal, activo')
                .order('nombre_corto', { ascending: true });

            if (error) {
                console.error("Error cargando agentes:", error);
                return;
            }
            agentesEnMemoria = agentes;

            // Rellenar select de agentes en formulario de ausencias
            const selectAusencia = document.getElementById('ausencia_agente');
            if(selectAusencia) {
                selectAusencia.innerHTML = `<option value="">-- Elegir Agente --</option>`;
                agentes.forEach(a => {
                    if (a.activo !== false) {
                        selectAusencia.innerHTML += `<option value="${a.id}">${escaparHTML(a.nombre_corto)}</option>`;
                    }
                });
            }

            // Rellenar select de agentes en formulario de novedades / coberturas
            const selectNovedad = document.getElementById('novedad_agente');
            if(selectNovedad) {
                selectNovedad.innerHTML = `<option value="">-- Elegir Agente --</option>`;
                agentes.forEach(a => {
                    if (a.activo !== false) {
                        selectNovedad.innerHTML += `<option value="${a.id}">${escaparHTML(a.nombre_corto)}</option>`;
                    }
                });
            }

            // Rellenar selectores del Registro Diario de Coberturas con agentes presenciales/híbridos.
            actualizarSelectoresRegistroDiario();
            actualizarSelectoresCambioDirectoDiario();

            renderizarTablasPlanificacion();
            renderizarTablaPersonal();
            renderizarTablaCoberturasDiarias();
        }

        // Obtener listado de ausencias desde Supabase
        async function listarAusencias() {
            const { data: ausencias, error } = await supabaseClient
                .from(TABLAS.AUSENCIAS)
                .select(`
                    id, fecha_inicio, fecha_fin, tipo, notas, agente_id,
                    agentes ( nombre_corto )
                `)
                .order('fecha_inicio', { ascending: false });

            if (error) {
                console.error("Error cargando ausencias:", error);
                return;
            }
            ausenciasEnMemoria = ausencias || [];
            renderizarTablaAusencias();
        }

        function setupOrdenAusencias() {
            const selectOrden = document.getElementById('ordenAusencias');
            if(!selectOrden) return;

            selectOrden.value = ordenAusenciasActual;
            selectOrden.addEventListener('change', () => {
                ordenAusenciasActual = selectOrden.value;
                renderizarTablaAusencias();
            });
        }

        function obtenerNombreAgenteAusencia(ausencia) {
            return ausencia.agentes ? ausencia.agentes.nombre_corto : 'Desconocido';
        }

        function obtenerEstadoAusencia(ausencia) {
            const hoy = obtenerFechaActualISO();

            if(ausencia.fecha_inicio <= hoy && ausencia.fecha_fin >= hoy) {
                return 'Vigente';
            }

            if(ausencia.fecha_inicio > hoy) {
                return 'Próxima';
            }

            return 'Finalizada';
        }

        function obtenerClaseEstadoAusencia(estado) {
            if(estado === 'Vigente') return 'bg-green-100 text-green-800';
            if(estado === 'Próxima') return 'bg-blue-100 text-blue-800';
            return 'bg-gray-100 text-gray-500';
        }

        function obtenerAusenciasOrdenadas() {
            const ausencias = [...ausenciasEnMemoria];
            const prioridadOperativa = { 'Vigente': 1, 'Próxima': 2, 'Finalizada': 3 };

            return ausencias.sort((a, b) => {
                if(ordenAusenciasActual === 'fecha_asc') {
                    return a.fecha_inicio.localeCompare(b.fecha_inicio) || obtenerNombreAgenteAusencia(a).localeCompare(obtenerNombreAgenteAusencia(b));
                }

                if(ordenAusenciasActual === 'fecha_desc') {
                    return b.fecha_inicio.localeCompare(a.fecha_inicio) || obtenerNombreAgenteAusencia(a).localeCompare(obtenerNombreAgenteAusencia(b));
                }

                if(ordenAusenciasActual === 'agente') {
                    return obtenerNombreAgenteAusencia(a).localeCompare(obtenerNombreAgenteAusencia(b)) || a.fecha_inicio.localeCompare(b.fecha_inicio);
                }

                if(ordenAusenciasActual === 'tipo') {
                    return (a.tipo || '').localeCompare(b.tipo || '') || a.fecha_inicio.localeCompare(b.fecha_inicio);
                }

                const estadoA = obtenerEstadoAusencia(a);
                const estadoB = obtenerEstadoAusencia(b);
                const prioridadA = prioridadOperativa[estadoA] || 99;
                const prioridadB = prioridadOperativa[estadoB] || 99;

                if(prioridadA !== prioridadB) {
                    return prioridadA - prioridadB;
                }

                if(estadoA === 'Finalizada') {
                    return b.fecha_fin.localeCompare(a.fecha_fin);
                }

                return a.fecha_inicio.localeCompare(b.fecha_inicio) || a.fecha_fin.localeCompare(b.fecha_fin);
            });
        }

        function actualizarResumenAusencias() {
            const resumen = document.getElementById('resumenAusencias');
            if(!resumen) return;

            const total = ausenciasEnMemoria.length;
            const vigentes = ausenciasEnMemoria.filter(aus => obtenerEstadoAusencia(aus) === 'Vigente').length;
            const proximas = ausenciasEnMemoria.filter(aus => obtenerEstadoAusencia(aus) === 'Próxima').length;
            const finalizadas = ausenciasEnMemoria.filter(aus => obtenerEstadoAusencia(aus) === 'Finalizada').length;

            resumen.innerText = `${total} registro(s): ${vigentes} vigente(s), ${proximas} próxima(s), ${finalizadas} finalizada(s).`;
        }

        function renderizarTablaAusencias() {
            const tbody = document.getElementById('listaAusencias');
            if(!tbody) return;

            actualizarResumenAusencias();

            if(ausenciasEnMemoria.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-gray-400">No hay ausencias registradas.</td></tr>`;
                return;
            }

            const ausenciasOrdenadas = obtenerAusenciasOrdenadas();
            tbody.innerHTML = "";

            ausenciasOrdenadas.forEach(aus => {
                const nombre = obtenerNombreAgenteAusencia(aus);
                const estado = obtenerEstadoAusencia(aus);
                const claseEstado = obtenerClaseEstadoAusencia(estado);

                tbody.innerHTML += `
                    <tr class="border-b hover:bg-gray-50 text-gray-700 ${ausenciaEditandoId == aus.id ? 'bg-red-50' : ''}">
                        <td class="p-3 font-medium">${escaparHTML(nombre)}</td>
                        <td class="p-3"><span class="px-2 py-0.5 rounded bg-red-100 text-red-800 text-[10px] font-bold uppercase">${escaparHTML(aus.tipo)}</span></td>
                        <td class="p-3"><span class="px-2 py-0.5 rounded ${claseEstado} text-[10px] font-bold uppercase">${estado}</span></td>
                        <td class="p-3">${formatearFechaSimple(aus.fecha_inicio)}</td>
                        <td class="p-3">${formatearFechaSimple(aus.fecha_fin)}</td>
                        <td class="p-3 text-center whitespace-nowrap">
                            <button onclick="iniciarEdicionAusencia(${aus.id})" class="text-blue-600 hover:text-blue-900 font-bold px-2 py-1" title="Editar ausencia">✏️</button>
                            <button onclick="eliminarAusencia(${aus.id})" class="text-red-600 hover:text-red-900 font-bold px-2 py-1" title="Eliminar ausencia">✕</button>
                        </td>
                    </tr>
                `;
            });
        }

        // Obtener listado de novedades / coberturas desde Supabase
        async function listarNovedades() {
            const { data: novedades, error } = await supabaseClient
                .from(TABLAS.NOVEDADES)
                .select(`
                    id, agente_id, fecha_pedido, fecha_solicitada, motivo_pedido,
                    observacion_tiempo, estado_cobertura, notas_relevo,
                    agentes ( nombre_corto )
                `)
                .order('fecha_solicitada', { ascending: true });

            if (error) {
                console.error("Error cargando novedades:", error);
                const tbody = document.getElementById('listaNovedades');
                if(tbody) {
                    tbody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-red-500">No se pudieron cargar las novedades.</td></tr>`;
                }
                return;
            }

            novedadesEnMemoria = novedades || [];
            renderizarTablaNovedades();
        }

                // ============================================================
        // 6) FORMATEO Y AYUDANTES DE FECHA
        // ============================================================
        // Formato utilitario de fechas
        function formatearFechaSimple(fechaStr) {
            if(!fechaStr) return '--/--';
            const parts = fechaStr.split('-');
            return parts.length === 3 ? `${parts[2]}/${parts[1]}` : fechaStr;
        }

        // Obtener formato visual de día de la semana y fecha
        function obtenerLabelFecha(fechaStr, tipo) {
            const d = new Date(fechaStr + "T00:00:00");
            const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
            const diaSemana = diasSemana[d.getDay()];
            const opciones = { day: '2-digit', month: '2-digit' };
            const fechaFormateada = d.toLocaleDateString('es-PY', opciones);
            
            if (tipo === 'sabado') return `Sábado ${fechaFormateada}`;
            if (tipo === 'domingo') return `Domingo ${fechaFormateada}`;
            if (tipo === 'feriado') return `Feriado ${fechaFormateada}`;
            return `${diaSemana} ${fechaFormateada}`;
        }

        // ============================================================
