        // 17) ARRANQUE DE LA APLICACIÓN
        // ============================================================
        // Ajuste visual seguro: colorear ausencias del calendario según el tipo/motivo.
        // No cambia datos ni consultas; solo modifica la clase visual de los eventos ya generados.
        const obtenerEventosCalendarioPorFechaOriginal = obtenerEventosCalendarioPorFecha;

        const HORARIOS_PLANIFICADOR = {
            'Call Center': {
                'Mañana': '07:00 a 12:00',
                'Tarde': '12:00 a 17:00',
                'Noche': '17:00 a 22:00'
            },
            'Identificaciones': {
                'Mañana': '07:00 a 12:00',
                'Tarde': '12:00 a 17:00'
            }
        };
        const HORARIOS_CALL_CENTER_PLANIFICADOR = HORARIOS_PLANIFICADOR['Call Center'];
        const HORARIOS_IDENTIFICACIONES_PLANIFICADOR = HORARIOS_PLANIFICADOR['Identificaciones'];
        const MARCA_HORARIO_PLANIFICADOR = '[HORARIO:';
        const MARCA_HORARIO_IDENTIFICACIONES = MARCA_HORARIO_PLANIFICADOR;

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

        function normalizarAreaPlanificador(area = '') {
            return String(area || '').toLowerCase().includes('ident') ? 'Identificaciones' : 'Call Center';
        }

        function obtenerAreaPlanificadorDesdeFila(row = {}, areaFallback = '') {
            if(areaFallback) return normalizarAreaPlanificador(areaFallback);
            return esRegistroIdentificaciones(row) ? 'Identificaciones' : 'Call Center';
        }

        function formatearHorarioPlanificador(horario = '') {
            const limpio = String(horario || '')
                .replace(/\s+/g, ' ')
                .trim();
            if(!limpio) return '';
            if(/\bhs\.?$/i.test(limpio)) return limpio.replace(/\bhs\.?$/i, 'hs');
            if(/\bh\.?$/i.test(limpio)) return limpio.replace(/\bh\.?$/i, 'hs');
            return `${limpio} hs`;
        }

        function formatearHorarioIdentificacionesPlanificador(horario = '') {
            return formatearHorarioPlanificador(horario);
        }

        function obtenerHorarioBasePlanificador(area = '', turno = '') {
            const areaNormalizada = normalizarAreaPlanificador(area);
            const horarioBase = HORARIOS_PLANIFICADOR[areaNormalizada]?.[turno] || obtenerHorarioPorTurnoRegistroDiario(turno) || '';
            return formatearHorarioPlanificador(horarioBase);
        }

        function obtenerHorarioBaseIdentificaciones(turno = '') {
            return obtenerHorarioBasePlanificador('Identificaciones', turno);
        }

        function limpiarSucursalHorarioPlanificador(sucursal = '') {
            return String(sucursal || '')
                .replace(/\s*\[HORARIO:[^\]]+\]\s*/g, ' ')
                .replace(/\s{2,}/g, ' ')
                .trim();
        }

        function obtenerHorarioPersonalizadoPlanificador(row = {}, areaFallback = '') {
            const texto = String(row.sucursal || '');
            const match = texto.match(/\[HORARIO:([^\]]+)\]/);
            const horarioGuardado = match ? match[1].trim() : '';
            const area = obtenerAreaPlanificadorDesdeFila(row, areaFallback);
            return formatearHorarioPlanificador(horarioGuardado || obtenerHorarioBasePlanificador(area, row.turno || ''));
        }

        function construirSucursalConHorario(sucursalBase = '', horario = '') {
            const base = limpiarSucursalHorarioPlanificador(sucursalBase) || 'Call Center';
            const horarioLimpio = formatearHorarioPlanificador(horario);
            return horarioLimpio ? `${base} [HORARIO:${horarioLimpio}]` : base;
        }

        function construirSucursalIdentificacionesConHorario(sucursalBase = '', horario = '') {
            const base = limpiarSucursalHorarioPlanificador(sucursalBase) || 'Dpto de Identificaciones';
            return construirSucursalConHorario(base, horario);
        }

        function obtenerSlugAreaHorarioPlanificador(area = '') {
            return normalizarAreaPlanificador(area) === 'Identificaciones' ? 'ident' : 'cc';
        }

        function obtenerIdHorarioPlanificador(area, fecha, turno) {
            const slug = obtenerSlugAreaHorarioPlanificador(area);
            return slug === 'ident' ? `horario_ident_${fecha}_${turno}` : `horario_cc_${turno}`;
        }

        function obtenerIdHorarioIdentificacion(fecha, turno) {
            return obtenerIdHorarioPlanificador('Identificaciones', fecha, turno);
        }

        function leerHorarioPlanificadorDesdePantalla(area, fecha, turno) {
            const input = document.getElementById(obtenerIdHorarioPlanificador(area, fecha, turno));
            return formatearHorarioPlanificador(input?.value || obtenerHorarioBasePlanificador(area, turno));
        }

        function leerHorarioIdentificacionDesdePantalla(fecha, turno) {
            return leerHorarioPlanificadorDesdePantalla('Identificaciones', fecha, turno);
        }

        obtenerEventosCalendarioPorFecha = function(fechaISO) {
            const eventos = obtenerEventosCalendarioPorFechaOriginal(fechaISO);

            return eventos.map(evento => {
                if(evento.tipo === 'guardia') {
                    const turnoRelacionado = (turnosCalendarioEnMemoria || []).find(turno =>
                        turno.fecha === fechaISO &&
                        obtenerNombreAgentePorId(turno.agente_id) === evento.etiqueta
                    );
                    if(turnoRelacionado) {
                        const area = esRegistroIdentificaciones(turnoRelacionado) ? 'Identificaciones' : 'Call Center';
                        const horario = obtenerHorarioPersonalizadoPlanificador(turnoRelacionado, area);
                        return {
                            ...evento,
                            detalle: `Turno: ${turnoRelacionado.turno || '-'}\nHorario: ${horario || '-'}\nArea: ${area}`
                        };
                    }
                }

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

        const obtenerItemsVisiblesCalendarioParaCeldaOriginal = obtenerItemsVisiblesCalendarioParaCelda;

        function obtenerOrdenColorCalendario(clase = '') {
            const valor = String(clase || '').toLowerCase();

            if(valor.includes('red') || valor.includes('rose') || valor.includes('fuchsia')) return 10;
            if(valor.includes('orange') || valor.includes('amber') || valor.includes('yellow')) return 20;
            if(valor.includes('emerald') || valor.includes('green')) return 30;
            if(valor.includes('sky') || valor.includes('cyan') || valor.includes('blue')) return 40;
            if(valor.includes('violet') || valor.includes('purple') || valor.includes('indigo')) return 50;
            if(valor.includes('slate') || valor.includes('gray')) return 60;

            return 99;
        }

        function ordenarItemsCalendarioPorColor(items = []) {
            return [...items].sort((a, b) => {
                const ordenColor = obtenerOrdenColorCalendario(a.clase) - obtenerOrdenColorCalendario(b.clase);
                if(ordenColor !== 0) return ordenColor;

                return String(a.etiqueta || '').localeCompare(String(b.etiqueta || ''), 'es', { sensitivity: 'base' });
            });
        }

        obtenerItemsVisiblesCalendarioParaCelda = function(fechaISO, eventos) {
            const items = obtenerItemsVisiblesCalendarioParaCeldaOriginal(fechaISO, eventos);
            return ordenarItemsCalendarioPorColor(items);
        };

        construirDetalleDiaCalendarioHTML = function(fechaISO) {
            const eventos = obtenerEventosCalendarioPorFecha(fechaISO);
            const orden = ['Ausencias', 'Guardias', 'Registro diario', 'Notas'];
            if(eventos.length === 0) {
                return `<div class="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">Sin datos cargados para esta fecha.</div>`;
            }

            return orden.map((categoria, index) => {
                const items = ordenarItemsCalendarioPorColor(eventos.filter(ev => ev.categoria === categoria));
                if(items.length === 0) return '';
                const abrir = categoria === 'Guardias' || categoria === 'Notas' || items.length <= 2 || index === 0;
                const contenidoCategoria = categoria === 'Guardias'
                    ? construirCuadranteGuardiasCalendarioHTML(fechaISO)
                    : `<div class="divide-y divide-slate-100">${items.map(ev => construirItemDetalleCalendario(ev)).join('')}</div>`;

                return `
                    <details class="mb-1.5 last:mb-0 rounded-md border border-slate-200 bg-white overflow-hidden" ${abrir ? 'open' : ''}>
                        <summary class="cursor-pointer select-none px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 flex items-center justify-between gap-3">
                            <span class="text-[11px] font-black uppercase tracking-wide text-slate-600">${categoria}</span>
                            <span class="text-[10px] font-bold text-slate-400">${items.length}</span>
                        </summary>
                        <div class="p-2">
                            ${contenidoCategoria}
                        </div>
                    </details>
                `;
            }).join('');
        };

        const renderizarTablasPlanificacionOriginal = renderizarTablasPlanificacion;
        renderizarTablasPlanificacion = function() {
            renderizarTablasPlanificacionOriginal();
            agregarControlesHorarioPlanificador();
        };

        function agregarControlesHorarioIdentificaciones() {
            agregarControlesHorarioPlanificador();
        }

        function agregarControlesHorarioPlanificador() {
            document.querySelectorAll('.horario-planificador-input').forEach(input => input.remove());

            agregarControlesHorarioEnTabla({
                tbodyId: 'tbody-cc',
                area: 'Call Center',
                selectPrefix: 'cc',
                turnos: ['Mañana', 'Tarde', 'Noche']
            });

            agregarControlesHorarioEnTabla({
                tbodyId: 'tbody-ident',
                area: 'Identificaciones',
                selectPrefix: 'ident',
                turnos: ['Mañana', 'Tarde']
            });
        }

        function agregarControlesHorarioEnTabla({ tbodyId, area, selectPrefix, turnos }) {
            const tabla = document.getElementById(tbodyId)?.closest('table');
            if(!tabla) return;

            const headers = tabla.querySelectorAll('thead th');
            const esIdent = normalizarAreaPlanificador(area) === 'Identificaciones';

            turnos.forEach((turno, index) => {
                const select = document.querySelector(`select[id^="${selectPrefix}_"][id$="_${turno}"]`);
                const th = headers[index + 1];
                if(!select || !th) return;

                const parts = select.id.split('_');
                const fecha = parts[1];
                const idHorario = obtenerIdHorarioPlanificador(area, fecha, turno);
                const valorExistente = document.getElementById(idHorario)?.value;
                const valorGuardado = formatearHorarioPlanificador(seleccionesTemporales[idHorario] || valorExistente || obtenerHorarioBasePlanificador(area, turno));

                th.innerHTML = '';

                const label = document.createElement('div');
                label.className = 'font-bold';
                label.textContent = `Turno ${turno}`;

                const input = document.createElement('input');
                input.type = 'text';
                input.id = idHorario;
                input.value = valorGuardado;
                input.placeholder = obtenerHorarioBasePlanificador(area, turno);
                input.title = 'Horario real de cobertura';
                input.setAttribute('aria-label', `Horario ${turno} ${area}`);
                input.className = `horario-planificador-input ${esIdent ? 'horario-ident-input' : 'horario-cc-input'} mt-1 w-36 max-w-full rounded-md border border-transparent bg-transparent px-2 py-0.5 text-center text-xs font-normal text-emerald-950 outline-none transition hover:border-emerald-300 hover:bg-white/50 focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-200`;
                input.addEventListener('input', (e) => {
                    seleccionesTemporales[e.target.id] = e.target.value;
                });
                input.addEventListener('blur', (e) => {
                    e.target.value = formatearHorarioPlanificador(e.target.value || e.target.placeholder);
                    seleccionesTemporales[e.target.id] = e.target.value;
                });

                th.appendChild(label);
                th.appendChild(input);
            });
        }

        guardarSeleccionesTemporales = function() {
            seleccionesTemporales = {};
            document.querySelectorAll('.agente-select').forEach(select => {
                seleccionesTemporales[select.id] = select.value;
            });
            document.querySelectorAll('.horario-planificador-input').forEach(input => {
                seleccionesTemporales[input.id] = formatearHorarioPlanificador(input.value || input.placeholder);
            });
        };

        const cargarTurnosGuardadosParaPlanificacionOriginal = cargarTurnosGuardadosParaPlanificacion;
        cargarTurnosGuardadosParaPlanificacion = async function(fechasAFetch = []) {
            await cargarTurnosGuardadosParaPlanificacionOriginal(fechasAFetch);

            const fechas = fechasAFetch.length > 0 ? fechasAFetch : diasPlanificados.map(d => d.fecha);
            if(fechas.length === 0) return;

            const { data, error } = await supabaseClient
                .from(TABLAS.TURNOS)
                .select('fecha, turno, agente_id, modalidad, sucursal')
                .in('fecha', fechas);

            if(error || !data) return;

            data.forEach(turno => {
                const area = esRegistroIdentificaciones(turno) ? 'Identificaciones' : 'Call Center';
                const input = document.getElementById(obtenerIdHorarioPlanificador(area, turno.fecha, turno.turno));
                if(!input) return;
                const horario = obtenerHorarioPersonalizadoPlanificador(turno, area);
                input.value = horario;
                seleccionesTemporales[input.id] = horario;
            });
        };

        construirNombresTurnoCalendario = function(fechaISO, area, turno) {
            const items = obtenerTurnosPorAreaYTurnoCalendario(fechaISO, area, turno)
                .filter(item => obtenerNombreAgentePorId(item.agente_id) && obtenerNombreAgentePorId(item.agente_id) !== '-');

            if(items.length === 0) {
                return '<span class="text-slate-400 italic">Sin asignar</span>';
            }

            return items.map(item => {
                const nombre = obtenerNombreAgentePorId(item.agente_id);
                const horario = esRegistroIdentificaciones(item) ? obtenerHorarioPersonalizadoPlanificador(item, 'Identificaciones') : '';
                return `
                    <div class="font-bold text-slate-800">${escaparHTML(nombre)}</div>
                    ${horario ? `<div class="text-[10px] font-semibold text-slate-500">${escaparHTML(horario)}</div>` : ''}
                `;
            }).join('');
        };

        sincronizarTurnosIdentificacionesConRegistroDiario = async function(turnos, opciones = {}) {
            const filasIdentificacionesSabado = (turnos || []).filter(row => {
                if(!row || !row.fecha || !row.agente_id) return false;
                const dia = new Date(row.fecha + 'T00:00:00').getDay();
                return dia === 6 && esRegistroIdentificaciones(row);
            });

            const fechasSabadoIdent = [...new Set(filasIdentificacionesSabado.map(row => row.fecha))];
            if(fechasSabadoIdent.length === 0) {
                return {
                    ok: true,
                    insertados: 0,
                    reemplazados: 0,
                    omitidos: 0,
                    totalPlanificador: 0,
                    fechas: [],
                    registros: [],
                    conflictos: [],
                    omitidosDetalle: []
                };
            }

            const { data: existentes, error: errorExistentes } = await supabaseClient
                .from(TABLAS.COBERTURAS_DIARIAS)
                .select('id, fecha, area, turno, agente_titular_id, tipo_novedad, horario_afectado, estado_cobertura, observaciones, created_at')
                .in('fecha', fechasSabadoIdent)
                .eq('area', 'Identificaciones');

            if(errorExistentes) {
                console.error('Error al revisar registros diarios existentes:', errorExistentes);
                return { ok: false, mensaje: errorExistentes.message, insertados: 0, fechas: fechasSabadoIdent };
            }

            const registrosAutomaticosPrevios = (existentes || []).filter(esRegistroAutomaticoPlanificador);
            const registrosParaCompararManual = (existentes || []).filter(reg => !esRegistroAutomaticoPlanificador(reg));
            const registrosDiarios = [];
            const omitidosDetalle = [];
            const conflictos = [];

            filasIdentificacionesSabado.forEach(row => {
                const horarioPersonalizado = obtenerHorarioPersonalizadoPlanificador(row, 'Identificaciones');
                const registro = {
                    fecha: row.fecha,
                    area: 'Identificaciones',
                    turno: row.turno,
                    agente_titular_id: parseInt(row.agente_id),
                    tipo_novedad: 'Cobertura planificada de sábado',
                    motivo: 'Cobertura presencial de Identificaciones registrada desde el planificador de fin de semana.',
                    requiere_cobertura: true,
                    estado_cobertura: 'CUBIERTO',
                    agente_cobertura_id: parseInt(row.agente_id),
                    forma_cobertura: 'Guardia planificada de sábado',
                    horario_afectado: horarioPersonalizado,
                    resultado: 'Cobertura registrada automáticamente desde el planificador.',
                    observaciones: `${MARCA_AUTO_PLANIFICADOR_IDENTIFICACIONES} Sincronizado desde el planificador de sábado de Identificaciones.`,
                    novedad_id: null
                };

                const duplicadoManual = obtenerRegistrosDiariosExactos(registrosParaCompararManual, registro).length > 0;
                if(duplicadoManual) {
                    omitidosDetalle.push({ fecha: row.fecha, turno: row.turno, agente_id: row.agente_id });
                    return;
                }

                const conflictosRegistro = obtenerConflictosOperativosRegistroDiario(row.fecha, row.agente_id, existentes || [], {
                    area: registro.area,
                    turno: registro.turno,
                    tipo_novedad: registro.tipo_novedad,
                    horario_afectado: registro.horario_afectado,
                    ignorarAutoPlanificador: true
                });

                if(conflictosRegistro.length > 0) {
                    conflictos.push({ fecha: row.fecha, turno: row.turno, agente_id: row.agente_id, conflictos: conflictosRegistro });
                    registro.observaciones += ` Revisión sugerida: ${conflictosRegistro.join(' ')}`;
                }

                registrosDiarios.push(registro);
            });

            const resumen = {
                ok: true,
                insertados: registrosDiarios.length,
                reemplazados: registrosAutomaticosPrevios.length,
                omitidos: omitidosDetalle.length,
                omitidosDetalle,
                totalPlanificador: filasIdentificacionesSabado.length,
                fechas: fechasSabadoIdent,
                registros: registrosDiarios,
                conflictos
            };

            if(opciones.vistaPrevia) {
                return resumen;
            }

            const { error: deleteError } = await supabaseClient
                .from(TABLAS.COBERTURAS_DIARIAS)
                .delete()
                .in('fecha', fechasSabadoIdent)
                .eq('area', 'Identificaciones')
                .ilike('observaciones', `%${MARCA_AUTO_PLANIFICADOR_IDENTIFICACIONES}%`);

            if(deleteError) {
                console.error('Error al limpiar registros diarios automáticos:', deleteError);
                return { ok: false, mensaje: deleteError.message, insertados: 0, fechas: fechasSabadoIdent };
            }

            if(registrosDiarios.length === 0) {
                return resumen;
            }

            const { error: insertError } = await supabaseClient
                .from(TABLAS.COBERTURAS_DIARIAS)
                .insert(registrosDiarios);

            if(insertError) {
                console.error('Error al sincronizar registro diario:', insertError);
                return { ok: false, mensaje: insertError.message, insertados: 0, fechas: fechasSabadoIdent };
            }

            return resumen;
        };

        async function guardarPlanificadorConHorariosEspeciales() {
            if(diasPlanificados.length === 0) {
                mostrarToast('Por favor, selecciona la fecha del sábado antes de guardar.', 'warning');
                return;
            }

            const filasAInsertar = [];
            const fechasPlanificadas = diasPlanificados.map(d => d.fecha);

            diasPlanificados.forEach(dia => {
                ['Mañana', 'Tarde', 'Noche'].forEach(turno => {
                    const selectEl = document.getElementById(`cc_${dia.fecha}_${turno}`);
                    const agenteId = selectEl ? selectEl.value : '';
                    if(agenteId) {
                        const horario = leerHorarioPlanificadorDesdePantalla('Call Center', dia.fecha, turno);
                        filasAInsertar.push({
                            fecha: dia.fecha,
                            turno,
                            agente_id: parseInt(agenteId),
                            modalidad: 'Contact Center',
                            sucursal: construirSucursalConHorario('Call Center', horario)
                        });
                    }
                });

                if(dia.tipo === 'sabado') {
                    ['Mañana', 'Tarde'].forEach(turno => {
                        const selectEl = document.getElementById(`ident_${dia.fecha}_${turno}`);
                        const agenteId = selectEl ? selectEl.value : '';
                        if(agenteId) {
                            const datosAgente = agentesEnMemoria.find(a => a.id == agenteId);
                            const horario = leerHorarioIdentificacionDesdePantalla(dia.fecha, turno);
                            const sucursalBase = datosAgente && datosAgente.sucursal ? datosAgente.sucursal : 'Dpto de Identificaciones';
                            filasAInsertar.push({
                                fecha: dia.fecha,
                                turno,
                                agente_id: parseInt(agenteId),
                                modalidad: 'Presencial',
                                sucursal: construirSucursalIdentificacionesConHorario(sucursalBase, horario)
                            });
                        }
                    });
                }
            });

            if(filasAInsertar.length === 0) {
                mostrarToast('Por favor, selecciona al menos un agente antes de guardar.', 'warning');
                return;
            }

            const validacionCuadrante = validarCuadranteAntesDeGuardar(filasAInsertar);
            if(!validacionCuadrante.ok) {
                mostrarToast(validacionCuadrante.mensaje, 'warning');
                return;
            }

            const btn = document.getElementById('btnGuardar');
            if(btn) {
                btn.innerText = 'Guardando cuadrante...';
                btn.disabled = true;
            }

            try {
                const resultadoGuardado = await guardarCuadranteTransaccional(filasAInsertar, fechasPlanificadas);

                if(!resultadoGuardado.ok) {
                    mostrarToast(resultadoGuardado.mensaje, resultadoGuardado.tipo || 'error');
                    return;
                }

                const syncRegistroDiario = await sincronizarSabadosIdentificacionesConRegistroDiario(filasAInsertar, fechasPlanificadas);
                if(syncRegistroDiario.ok) {
                    await listarCoberturasDiarias();
                    await cargarDatosCalendario();
                    const extra = syncRegistroDiario.insertados > 0 ? ` Además, se sincronizaron ${syncRegistroDiario.insertados} cobertura(s) de sábado de Identificaciones en el Registro Diario.` : '';
                    mostrarToast('¡Planificación de fin de semana guardada con éxito!' + extra, 'success');
                } else {
                    mostrarToast('La planificación se guardó, pero no se pudo sincronizar el Registro Diario: ' + syncRegistroDiario.mensaje, 'warning');
                }
            } catch(errorInesperado) {
                console.error('Error inesperado al guardar cuadrante:', errorInesperado);
                mostrarToast('Ocurrió un error inesperado al guardar el cuadrante. Revisá la consola para más detalles.', 'error');
            } finally {
                if(btn) {
                    btn.innerText = 'Guardar Cuadrante en Base de Datos';
                    btn.disabled = false;
                }
            }
        }

        function instalarGuardadoPlanificadorConHorarios() {
            const btnOriginal = document.getElementById('btnGuardar');
            if(!btnOriginal || btnOriginal.dataset.horariosEspeciales === '1') return;
            const btnNuevo = btnOriginal.cloneNode(true);
            btnNuevo.dataset.horariosEspeciales = '1';
            btnOriginal.parentNode.replaceChild(btnNuevo, btnOriginal);
            btnNuevo.addEventListener('click', guardarPlanificadorConHorariosEspeciales);
        }

        function obtenerFechaSugeridaJornadaDiaria() {
            const filtroUnico = typeof obtenerFechaUnicaFiltroCoberturaDiaria === 'function'
                ? obtenerFechaUnicaFiltroCoberturaDiaria()
                : '';
            return filtroUnico || document.getElementById('cobertura_fecha')?.value || obtenerFechaActualISO();
        }

        function instalarFlujoJornadaDiaria() {
            const btnNormal = document.getElementById('btnGenerarCoberturaNormalDia');
            if(!btnNormal || btnNormal.dataset.jornadaDiaria === '1') return;

            const contenedorBotones = btnNormal.parentElement;
            const tarjetaAcciones = btnNormal.closest('.bg-white.border');
            const titulo = tarjetaAcciones?.querySelector('h3');
            if(titulo) titulo.textContent = 'Registrar jornada diaria';

            const btnAvanzado = Array.from(contenedorBotones?.querySelectorAll('button') || [])
                .find(btn => btn.getAttribute('onclick') === 'toggleRegistroAvanzadoDiario()');
            if(btnAvanzado) btnAvanzado.remove();

            const grupoFecha = document.createElement('label');
            grupoFecha.className = 'flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-2 py-1 text-xs font-bold text-emerald-800 shadow-sm';
            grupoFecha.innerHTML = `
                <span class="whitespace-nowrap">Fecha</span>
                <input type="date" id="fechaGenerarJornadaDiaria" class="w-36 border-0 bg-transparent p-0 text-xs font-semibold text-slate-800 outline-none focus:ring-0">
            `;

            const fechaJornada = grupoFecha.querySelector('#fechaGenerarJornadaDiaria');
            fechaJornada.value = obtenerFechaSugeridaJornadaDiaria();
            fechaJornada.addEventListener('change', () => {
                const fechaCobertura = document.getElementById('cobertura_fecha');
                if(fechaCobertura) fechaCobertura.value = fechaJornada.value || obtenerFechaActualISO();
            });

            btnNormal.dataset.jornadaDiaria = '1';
            btnNormal.innerText = 'Generar jornada diaria';
            btnNormal.title = 'Crea los registros habituales de la fecha elegida';
            btnNormal.className = 'bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-3 rounded-lg transition text-xs border border-emerald-700 shadow-sm';
            contenedorBotones?.insertBefore(grupoFecha, btnNormal);

            if(typeof armarMensajeVistaPreviaCoberturaNormal === 'function') {
                armarMensajeVistaPreviaCoberturaNormal = function(fecha, registrosAInsertar, omitidos, conflictosDetectados) {
                    const lineasNuevos = registrosAInsertar.map(reg =>
                        `• ${reg.area} | ${obtenerNombreAgentePorId(reg.agente_titular_id)} | ${reg.horario_afectado} | ${reg.estado_cobertura}`
                    );
                    const lineasConflictos = conflictosDetectados.map(item =>
                        `• ${item.area} | ${item.agente} | ${item.horario}: ${item.conflictos.join(' ')}`
                    );

                    return `Vista previa para generar la jornada diaria:\n\n` +
                        `Fecha: ${formatearFechaSimple(fecha)}\n` +
                        `Registros nuevos: ${registrosAInsertar.length}\n` +
                        `Ya existentes que se omiten: ${omitidos}\n` +
                        `Para revisar: ${conflictosDetectados.length}\n\n` +
                        `Registros a crear:\n${resumirLineasVistaPrevia(lineasNuevos)}\n` +
                        (lineasConflictos.length ? `\nPara revisar:\n${resumirLineasVistaPrevia(lineasConflictos, 6)}\n` : '') +
                        `\nLos registros con conflicto quedarán como FALTA CUBRIR para que los edites desde el historial.\n\n¿Querés continuar?`;
                };
            }

            const generarOriginal = window.generarCoberturaNormalDelDia;
            if(typeof generarOriginal === 'function') {
                window.generarCoberturaNormalDelDia = async function() {
                    const fechaElegida = document.getElementById('fechaGenerarJornadaDiaria')?.value || obtenerFechaActualISO();
                    const fechaCobertura = document.getElementById('cobertura_fecha');
                    if(fechaCobertura) fechaCobertura.value = fechaElegida;
                    await generarOriginal();
                    const btn = document.getElementById('btnGenerarCoberturaNormalDia');
                    if(btn && !btn.disabled) btn.innerText = 'Generar jornada diaria';
                };
            }
        }

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
        instalarGuardadoPlanificadorConHorarios();
        instalarFlujoJornadaDiaria();
        instalarIconoPestanaGestor();

        // Disparar inicialización general
        inicializarAutenticacion();
     