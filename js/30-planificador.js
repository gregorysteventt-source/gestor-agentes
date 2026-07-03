        // 7) RENDERIZADO DEL PLANIFICADOR
        // ============================================================
        // Genera visualmente la estructura de las tablas de planificación según las fechas activas
        function renderizarTablasPlanificacion() {
            const tbodyCC = document.getElementById('tbody-cc');
            const tbodyIdent = document.getElementById('tbody-ident');
            if(!tbodyCC || !tbodyIdent) return;

            tbodyCC.innerHTML = '';
            tbodyIdent.innerHTML = '';

            if (diasPlanificados.length === 0) {
                tbodyCC.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-gray-400">Seleccioná una fecha de sábado para iniciar la planificación.</td></tr>`;
                tbodyIdent.innerHTML = `<tr><td colspan="3" class="p-4 text-center text-gray-400">Seleccioná una fecha de sábado para iniciar la planificación.</td></tr>`;
                return;
            }

            diasPlanificados.forEach(dia => {
                const labelHTML = `
                    <div class="flex items-center justify-center gap-1.5">
                        <span>${obtenerLabelFecha(dia.fecha, dia.tipo)}</span>
                        ${dia.tipo === 'feriado' ? `<button onclick="eliminarFilaFeriado('${dia.fecha}')" class="no-captura-whatsapp text-red-600 hover:text-red-800 font-bold px-1.5 py-0.5 rounded hover:bg-red-50 transition text-xs" title="Remover feriado" data-html2canvas-ignore="true">✕</button>` : ''}
                    </div>
                `;

                // 1. Call Center Row
                const rowCC = document.createElement('tr');
                rowCC.className = "hover:bg-gray-50";
                rowCC.innerHTML = `
                    <td class="border border-gray-300 p-3 font-bold text-center bg-gray-50">${labelHTML}</td>
                    <td class="border border-gray-300 p-2 text-center"><select id="cc_${dia.fecha}_Mañana" class="agente-select w-full p-1.5 bg-transparent text-center outline-none cursor-pointer text-sm font-medium text-gray-800"></select></td>
                    <td class="border border-gray-300 p-2 text-center"><select id="cc_${dia.fecha}_Tarde" class="agente-select w-full p-1.5 bg-transparent text-center outline-none cursor-pointer text-sm font-medium text-gray-800"></select></td>
                    <td class="border border-gray-300 p-2 text-center"><select id="cc_${dia.fecha}_Noche" class="agente-select w-full p-1.5 bg-transparent text-center outline-none cursor-pointer text-sm font-medium text-gray-800"></select></td>
                `;
                tbodyCC.appendChild(rowCC);

                // 2. Identificaciones Row (Cerrado Domingos y Feriados - Solo se habilita los Sábados)
                if (dia.tipo === 'sabado') {
                    const rowIdent = document.createElement('tr');
                    rowIdent.className = "hover:bg-gray-50";
                    rowIdent.innerHTML = `
                        <td class="border border-gray-300 p-3 font-bold text-center bg-gray-50">${labelHTML}</td>
                        <td class="border border-gray-300 p-2 text-center"><select id="ident_${dia.fecha}_Mañana" class="agente-select w-full p-1.5 bg-transparent text-center outline-none cursor-pointer text-sm font-medium text-gray-800"></select></td>
                        <td class="border border-gray-300 p-2 text-center"><select id="ident_${dia.fecha}_Tarde" class="agente-select w-full p-1.5 bg-transparent text-center outline-none cursor-pointer text-sm font-medium text-gray-800"></select></td>
                    `;
                    tbodyIdent.appendChild(rowIdent);
                }
            });

            // Poblar dropdowns con lógica de inactividad y ausencias
            actualizarDropdownsGuardia();
            
            // Re-asignar verificadores de turnos consecutivos y registrar cambios manuales del supervisor
            document.querySelectorAll('.agente-select').forEach(select => {
                select.addEventListener('change', (e) => {
                    seleccionesTemporales[e.target.id] = e.target.value;
                    verificarTurnosConsecutivos();
                });
            });
        }

        // Guarda temporalmente las selecciones hechas en la interfaz
        function guardarSeleccionesTemporales() {
            seleccionesTemporales = {};
            document.querySelectorAll('.agente-select').forEach(select => {
                seleccionesTemporales[select.id] = select.value;
            });
        }

        // Elimina de forma segura un feriado local del cuadrante preservando el estado
        window.eliminarFilaFeriado = function(fechaStr) {
            guardarSeleccionesTemporales();
            // Limpiar la memoria de las selecciones asociadas a este feriado eliminado
            Object.keys(seleccionesTemporales).forEach(key => {
                if (key.includes(fechaStr)) {
                    delete seleccionesTemporales[key];
                }
            });
            diasPlanificados = diasPlanificados.filter(d => d.fecha !== fechaStr);
            renderizarTablasPlanificacion();
            mostrarToast("Fila de Feriado removida.", "info");
        };

        // Sincronizar dinámicamente el contenido de los dropdowns según inactividad o ausencias vigentes
        function actualizarDropdownsGuardia() {
            const selects = document.querySelectorAll('.agente-select');
            if(selects.length === 0) return;

            selects.forEach(select => {
                const parts = select.id.split('_'); // ['cc'/'ident', 'fecha', 'turno']
                if(parts.length < 3) return;

                const fechaEvaluar = parts[1];
                // Recuperar la selección guardada en memoria si existe
                const valorSeleccionado = select.value || seleccionesTemporales[select.id] || ""; 
                select.innerHTML = `<option value="">-- Seleccionar --</option>`;

                agentesEnMemoria.forEach(agente => {
                    if (agente.activo === false && agente.id.toString() !== valorSeleccionado) {
                        return;
                    }

                    let estaAusente = false;
                    let motivoAusencia = "";

                    const coincidencia = ausenciasEnMemoria.find(aus => 
                        aus.agente_id == agente.id && 
                        fechaEvaluar >= aus.fecha_inicio && 
                        fechaEvaluar <= aus.fecha_fin
                    );

                    if(coincidencia) {
                        estaAusente = true;
                        motivoAusencia = coincidencia.tipo;
                    }

                    const nombreMostrar = agente.activo === false ? `${agente.nombre_corto} (Inactivo)` : agente.nombre_corto;

                    if(estaAusente) {
                        select.innerHTML += `<option value="${agente.id}" disabled class="text-gray-300 font-italic">${escaparHTML(nombreMostrar)} (${escaparHTML(motivoAusencia)} 🚫)</option>`;
                    } else {
                        select.innerHTML += `<option value="${agente.id}">${escaparHTML(nombreMostrar)}</option>`;
                    }
                });

                select.value = valorSeleccionado;
            });
        }

        // ============================================================
        // 8) RECUPERACIÓN DE TURNOS GUARDADOS
        // ============================================================
        // Recuperar planificación de guardias históricas guardadas en Supabase de forma segmentada
        async function cargarTurnosGuardadosParaPlanificacion(fechasAFetch = []) {
            const fechas = fechasAFetch.length > 0 ? fechasAFetch : diasPlanificados.map(d => d.fecha);
            if (fechas.length === 0) return;

            try {
                const { data: turnos, error } = await supabaseClient
                    .from(TABLAS.TURNOS)
                    .select('fecha, turno, agente_id, modalidad, sucursal')
                    .in('fecha', fechas);

                if (error || !turnos || turnos.length === 0) return;

                turnos.forEach(turno => {
                    if (!turno.agente_id) return;
                    const agenteIdStr = turno.agente_id.toString();
                    
                    const suc = (turno.sucursal || "").toLowerCase();
                    const mod = (turno.modalidad || "").toLowerCase();
                    const esIdent = suc.includes("ident") || mod.includes("ident") || mod.includes("presencial");
                    
                    const prefix = esIdent ? 'ident' : 'cc';
                    const targetId = `${prefix}_${turno.fecha}_${turno.turno}`;
                    const el = document.getElementById(targetId);

                    if (el) {
                        if (!Array.from(el.options).some(opt => opt.value === agenteIdStr)) {
                            const agente = agentesEnMemoria.find(a => a.id == turno.agente_id);
                            const nombre = agente ? `${agente.nombre_corto} (Inactivo)` : 'Desconocido';
                            el.innerHTML += `<option value="${agenteIdStr}">${nombre}</option>`;
                        }
                        el.value = agenteIdStr;
                        // Guardar en la memoria temporal también
                        seleccionesTemporales[targetId] = agenteIdStr;
                    }
                });

                verificarTurnosConsecutivos();

            } catch (err) {
                console.error("Lectura de datos omitida de forma segura:", err);
            }
        }

        // ============================================================
        // 9) EVENTOS DEL PLANIFICADOR Y GUARDADO DE CUADRANTE
        // ============================================================
        function formatearFechaISODesdeDate(fecha) {
            const yyyy = fecha.getFullYear();
            const mm = String(fecha.getMonth() + 1).padStart(2, '0');
            const dd = String(fecha.getDate()).padStart(2, '0');
            return `${yyyy}-${mm}-${dd}`;
        }

        function obtenerProximoSabadoISO() {
            const fecha = new Date();
            fecha.setHours(0, 0, 0, 0);
            const dia = fecha.getDay();
            const diasHastaSabado = dia === 0 ? 6 : (6 - dia + 7) % 7;
            fecha.setDate(fecha.getDate() + diasHastaSabado);
            return formatearFechaISODesdeDate(fecha);
        }

        async function configurarPlanificacionFinDeSemana(fechaSeleccionada, opciones = {}) {
            const { mostrarAjuste = true } = opciones;
            const inputFecha = document.getElementById('fechaSabado');
            if(!fechaSeleccionada) return;

            let dateSab = new Date(fechaSeleccionada + "T00:00:00");

            // Validar si no es sábado y corregir al sábado de esa misma semana.
            if (dateSab.getDay() !== 6) {
                const day = dateSab.getDay();
                const diff = 6 - (day === 0 ? 7 : day);
                dateSab.setDate(dateSab.getDate() + diff);
                fechaSeleccionada = formatearFechaISODesdeDate(dateSab);

                if(mostrarAjuste) {
                    const [, mm, dd] = fechaSeleccionada.split('-');
                    mostrarToast(`Ajustamos automáticamente la fecha al sábado ${dd}/${mm} para tu planificación.`, 'warning');
                }
            }

            if(inputFecha) inputFecha.value = fechaSeleccionada;

            const dateDom = new Date(dateSab);
            dateDom.setDate(dateSab.getDate() + 1);
            const fechaDomStr = formatearFechaISODesdeDate(dateDom);

            // Limpiar las selecciones temporales antiguas de otros fines de semana.
            seleccionesTemporales = {};

            diasPlanificados = [
                { fecha: fechaSeleccionada, tipo: 'sabado' },
                { fecha: fechaDomStr, tipo: 'domingo' }
            ];

            // Auto-detectar días adicionales guardados, por ejemplo feriados pegados al fin de semana.
            const fechaPlus3 = new Date(dateSab);
            fechaPlus3.setDate(dateSab.getDate() + 4);
            const { data: diasEnBD } = await supabaseClient
                .from(TABLAS.TURNOS)
                .select('fecha')
                .gt('fecha', fechaDomStr)
                .lte('fecha', formatearFechaISODesdeDate(fechaPlus3))
                .order('fecha', { ascending: true });

            if (diasEnBD && diasEnBD.length > 0) {
                const fechasUnicas = [...new Set(diasEnBD.map(d => d.fecha))];
                fechasUnicas.forEach(f => {
                    if (!diasPlanificados.find(d => d.fecha === f)) {
                        diasPlanificados.push({ fecha: f, tipo: 'feriado' });
                    }
                });
                diasPlanificados.sort((a, b) => a.fecha.localeCompare(b.fecha));
            }

            renderizarTablasPlanificacion();
            await cargarTurnosGuardadosParaPlanificacion(diasPlanificados.map(d => d.fecha));
        }

        async function inicializarPlanificadorFinDeSemana() {
            const inputFecha = document.getElementById('fechaSabado');
            if(!inputFecha || inputFecha.value) return;
            await configurarPlanificacionFinDeSemana(obtenerProximoSabadoISO(), { mostrarAjuste: false });
        }

        // Listener cuando el supervisor cambia la fecha de planificación (sábado)
        document.getElementById('fechaSabado').addEventListener('change', async function(e) {
            await configurarPlanificacionFinDeSemana(e.target.value, { mostrarAjuste: true });
        });


        // Utilidad centralizada para mostrar nombres de agentes.
        // Se usa en el planificador, registro diario, calendario y exportaciones.
        function obtenerNombreAgentePorId(agenteId) {
            if(!agenteId) return '-';
            const agente = agentesEnMemoria.find(a => a.id == agenteId);
            return agente ? agente.nombre_corto : `Agente no encontrado (ID ${agenteId})`;
        }

        // Regla centralizada para saber si un turno pertenece a Identificaciones.
        // Antes el planificador y el Excel tenían criterios distintos; ahora ambos usan esta misma lógica.
        function esRegistroIdentificaciones(row) {
            const textoRegistro = normalizarTextoBusqueda(`${row.sucursal || ''} ${row.modalidad || ''}`);

            // Si el registro ya declara explícitamente Call Center, respetamos eso primero.
            if (textoRegistro.includes('call center') || textoRegistro.includes('contact center')) {
                return false;
            }

            // Identificaciones suele quedar guardado como Presencial o con sucursal/área Identificaciones.
            if (
                textoRegistro.includes('ident') ||
                textoRegistro.includes('presencial') ||
                textoRegistro.includes('dpto de identificaciones')
            ) {
                return true;
            }

            // Fallback para registros antiguos o incompletos: mirar los datos del agente en memoria.
            const agente = agentesEnMemoria.find(a => a.id == row.agente_id);
            const textoAgente = normalizarTextoBusqueda(`${agente?.sucursal || ''} ${agente?.modalidad || ''}`);
            return textoAgente.includes('ident') || textoAgente.includes('presencial');
        }

        function describirAsignacionGuardia(row) {
            const area = esRegistroIdentificaciones(row) ? "Identificaciones" : "Call Center";
            return `${area} - Turno ${row.turno}`;
        }

        function normalizarValorClaveDuplicado(valor) {
            return valor === null || valor === undefined ? '' : String(valor).trim().toLowerCase();
        }

        function obtenerClaveDuplicadoExactoCuadrante(row) {
            return [
                row.fecha,
                row.turno,
                row.modalidad,
                row.sucursal,
                row.agente_id
            ].map(normalizarValorClaveDuplicado).join('|');
        }

        function validarDuplicadosExactosCuadrante(filasAInsertar) {
            const asignacionesVistas = new Map();

            for (const row of filasAInsertar) {
                const claveDuplicado = obtenerClaveDuplicadoExactoCuadrante(row);
                const asignacionPrevia = asignacionesVistas.get(claveDuplicado);

                if (asignacionPrevia) {
                    const nombreAgente = obtenerNombreAgentePorId(row.agente_id);
                    const fechaVisual = formatearFechaSimple(row.fecha);
                    const area = esRegistroIdentificaciones(row) ? 'Identificaciones' : 'Call Center';
                    const sucursalTexto = row.sucursal ? ` - ${row.sucursal}` : '';

                    return {
                        ok: false,
                        mensaje: `Duplicado exacto detectado: ${nombreAgente} ya figura cargado para ${fechaVisual}, ${area}${sucursalTexto}, turno ${row.turno}. Revisá el cuadrante antes de guardar.`
                    };
                }

                asignacionesVistas.set(claveDuplicado, row);
            }

            return { ok: true };
        }

        function validarCuadranteAntesDeGuardar(filasAInsertar) {
            const validacionDuplicadosExactos = validarDuplicadosExactosCuadrante(filasAInsertar);
            if (!validacionDuplicadosExactos.ok) {
                return validacionDuplicadosExactos;
            }

            const asignacionesPorAgenteYFecha = {};

            for (const row of filasAInsertar) {
                const agente = agentesEnMemoria.find(a => a.id == row.agente_id);
                const nombreAgente = agente ? agente.nombre_corto : `Agente ID ${row.agente_id}`;
                const fechaVisual = formatearFechaSimple(row.fecha);
                const descripcionActual = describirAsignacionGuardia(row);

                if (!agente) {
                    return {
                        ok: false,
                        mensaje: `No se encontró en memoria el agente asignado para el ${fechaVisual}. Recargá la página e intentá nuevamente.`
                    };
                }

                if (agente.activo === false) {
                    return {
                        ok: false,
                        mensaje: `${nombreAgente} está inactivo y no puede quedar guardado en el cuadrante del ${fechaVisual}.`
                    };
                }

                const ausencia = ausenciasEnMemoria.find(aus =>
                    aus.agente_id == row.agente_id &&
                    row.fecha >= aus.fecha_inicio &&
                    row.fecha <= aus.fecha_fin
                );

                if (ausencia) {
                    return {
                        ok: false,
                        mensaje: `${nombreAgente} figura con ${ausencia.tipo} el ${fechaVisual}. No se puede guardar esa asignación.`
                    };
                }

                const clave = `${row.fecha}_${row.agente_id}`;
                const asignacionesPrevias = asignacionesPorAgenteYFecha[clave] || [];
                const esIdentificacionesActual = esRegistroIdentificaciones(row);

                if (asignacionesPrevias.length > 0) {
                    const permiteDobleTurnoIdentificaciones =
                        esIdentificacionesActual &&
                        asignacionesPrevias.length < 2 &&
                        asignacionesPrevias.every(asignacion =>
                            asignacion.esIdentificaciones && asignacion.turno !== row.turno
                        );

                    if (!permiteDobleTurnoIdentificaciones) {
                        const descripcionPrevia = asignacionesPrevias.map(asignacion => asignacion.descripcion).join(' y ');
                        return {
                            ok: false,
                            mensaje: `${nombreAgente} ya esta asignado el ${fechaVisual}: ${descripcionPrevia} y ${descripcionActual}.`
                        };
                    }
                }

                asignacionesPrevias.push({
                    descripcion: descripcionActual,
                    turno: row.turno,
                    esIdentificaciones: esIdentificacionesActual
                });
                asignacionesPorAgenteYFecha[clave] = asignacionesPrevias;
            }

            return { ok: true };
        }

        // Sincroniza las guardias de sábado de Identificaciones con el Registro Diario.
        // Como la tabla coberturas_diarias no tiene relación directa con turnos_fines_de_semana,
        // usamos una marca interna en observaciones para reemplazar solo los registros automáticos.
        function esRegistroAutomaticoPlanificador(registro) {
            return !!(registro && (registro.observaciones || '').includes(MARCA_AUTO_PLANIFICADOR_IDENTIFICACIONES));
        }

        function esRegistroAutomaticoCoberturaNormal(registro) {
            return !!(registro && (registro.observaciones || '').includes(MARCA_AUTO_COBERTURA_NORMAL_DIARIA));
        }

        function obtenerClaveRegistroDiarioExacto(registro) {
            if(!registro) return '';
            return [
                registro.fecha || '',
                registro.area || '',
                registro.turno || '',
                registro.agente_titular_id || '',
                registro.tipo_novedad || '',
                registro.horario_afectado || ''
            ].join('|');
        }

        function obtenerRegistrosDiariosExactos(registrosExistentes, registroObjetivo, opciones = {}) {
            const claveObjetivo = obtenerClaveRegistroDiarioExacto(registroObjetivo);
            return (registrosExistentes || []).filter(reg => {
                if(obtenerClaveRegistroDiarioExacto(reg) !== claveObjetivo) return false;
                if(opciones.excluirAutoPlanificador && esRegistroAutomaticoPlanificador(reg)) return false;
                if(opciones.excluirAutoNormal && esRegistroAutomaticoCoberturaNormal(reg)) return false;
                return true;
            });
        }

        function resumirLineasVistaPrevia(lineas, limite = 8) {
            const lista = (lineas || []).filter(Boolean);
            if(lista.length === 0) return '• Sin registros.';
            if(lista.length <= limite) return lista.join('\n');
            return lista.slice(0, limite).join('\n') + `\n• ... y ${lista.length - limite} más.`;
        }

        function obtenerNovedadesActivasDeAgenteEnFecha(agenteId, fecha) {
            return (novedadesEnMemoria || []).filter(novedad =>
                novedad &&
                novedad.agente_id == agenteId &&
                novedad.fecha_solicitada <= fecha &&
                obtenerFechaHastaNovedad(novedad) >= fecha &&
                (novedad.estado_cobertura || '') !== 'CANCELADO'
            );
        }

        function obtenerAusenciasDeAgenteEnFecha(agenteId, fecha) {
            return (ausenciasEnMemoria || []).filter(ausencia =>
                ausencia &&
                ausencia.agente_id == agenteId &&
                fecha >= ausencia.fecha_inicio &&
                fecha <= ausencia.fecha_fin
            );
        }

        function obtenerConflictosOperativosRegistroDiario(fecha, agenteId, registrosExistentes = [], contexto = {}) {
            const conflictos = [];
            const nombreAgente = obtenerNombreAgentePorId(agenteId);

            obtenerAusenciasDeAgenteEnFecha(agenteId, fecha).forEach(ausencia => {
                conflictos.push(`${nombreAgente} figura con ${ausencia.tipo || 'ausencia'} el ${formatearFechaSimple(fecha)}.`);
            });

            obtenerNovedadesActivasDeAgenteEnFecha(agenteId, fecha).forEach(novedad => {
                const estado = novedad.estado_cobertura ? ` (${novedad.estado_cobertura})` : '';
                const tiempo = novedad.observacion_tiempo ? ` - ${novedad.observacion_tiempo}` : '';
                conflictos.push(`${nombreAgente} tiene novedad: ${novedad.motivo_pedido || 'Novedad'}${estado}${tiempo}.`);
            });

            const otrosRegistros = (registrosExistentes || []).filter(reg => {
                if(!reg || reg.fecha !== fecha || reg.agente_titular_id != agenteId) return false;
                if(contexto.ignorarAutoPlanificador && esRegistroAutomaticoPlanificador(reg)) return false;
                if(contexto.ignorarAutoNormal && esRegistroAutomaticoCoberturaNormal(reg)) return false;

                const mismoRegistro =
                    reg.area === contexto.area &&
                    reg.turno === contexto.turno &&
                    (reg.tipo_novedad || '') === (contexto.tipo_novedad || '') &&
                    (reg.horario_afectado || '') === (contexto.horario_afectado || '');

                return !mismoRegistro;
            });

            if(otrosRegistros.length > 0) {
                const detalle = otrosRegistros
                    .slice(0, 3)
                    .map(reg => `${reg.area || 'Área'} ${reg.turno || ''} (${reg.tipo_novedad || 'registro'})`)
                    .join('; ');
                conflictos.push(`${nombreAgente} ya tiene otro registro diario ese día: ${detalle}${otrosRegistros.length > 3 ? '...' : ''}.`);
            }

            return conflictos;
        }

        function armarMensajeVistaPreviaSincronizacionDiario(vistaPrevia, rangoTexto) {
            const fechasTexto = (vistaPrevia.fechas || []).map(formatearFechaSimple).join(', ') || 'sin fechas';
            const lineasNuevos = (vistaPrevia.registros || []).map(reg =>
                `• ${formatearFechaSimple(reg.fecha)} | ${reg.turno} | ${obtenerNombreAgentePorId(reg.agente_titular_id)} | ${reg.horario_afectado}`
            );
            const lineasOmitidos = (vistaPrevia.omitidosDetalle || []).map(item =>
                `• ${formatearFechaSimple(item.fecha)} | ${item.turno} | ${obtenerNombreAgentePorId(item.agente_id)}: ya existe un registro manual equivalente.`
            );
            const lineasConflictos = (vistaPrevia.conflictos || []).map(item =>
                `• ${formatearFechaSimple(item.fecha)} | ${item.turno} | ${obtenerNombreAgentePorId(item.agente_id)}: ${item.conflictos.join(' ')}`
            );

            return `Vista previa de sincronización${rangoTexto}:\n\n` +
                `Fechas detectadas: ${fechasTexto}\n` +
                `Guardias de Identificaciones encontradas: ${vistaPrevia.totalPlanificador || 0}\n` +
                `Registros nuevos a insertar: ${vistaPrevia.insertados || 0}\n` +
                `Registros automáticos anteriores a reemplazar: ${vistaPrevia.reemplazados || 0}\n` +
                `Registros manuales ya existentes que se omitirán: ${vistaPrevia.omitidos || 0}\n` +
                `Posibles conflictos para revisar: ${(vistaPrevia.conflictos || []).length}\n\n` +
                `Nuevos registros:\n${resumirLineasVistaPrevia(lineasNuevos)}\n` +
                (lineasOmitidos.length ? `\nOmitidos:\n${resumirLineasVistaPrevia(lineasOmitidos, 5)}\n` : '') +
                (lineasConflictos.length ? `\nConflictos detectados:\n${resumirLineasVistaPrevia(lineasConflictos, 6)}\n` : '') +
                `\nEsto reemplaza solo los registros automáticos generados por el planificador. No borra registros diarios cargados manualmente.\n\n¿Querés continuar?`;
        }

        // Sincroniza las guardias de sábado de Identificaciones con el Registro Diario.
        // Como la tabla coberturas_diarias no tiene relación directa con turnos_fines_de_semana,
        // usamos una marca interna en observaciones para reemplazar solo los registros automáticos.
        async function sincronizarTurnosIdentificacionesConRegistroDiario(turnos, opciones = {}) {
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
                    horario_afectado: obtenerHorarioPorTurnoRegistroDiario(row.turno),
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
        }

        async function sincronizarSabadosIdentificacionesConRegistroDiario(filasAInsertar, fechasPlanificadas) {
            return await sincronizarTurnosIdentificacionesConRegistroDiario(filasAInsertar);
        }

        // Importa al Registro Diario las guardias de sábado de Identificaciones que ya estaban guardadas
        // en el planificador antes de que existiera la sincronización automática.
        window.sincronizarHistorialPlanificadorRegistroDiario = async function() {
            const btn = document.getElementById('btnSincronizarHistorialPlanificador');
            const textoOriginal = btn ? btn.innerText : '';

            const desde = document.getElementById('filtroCoberturaDesde')?.value || '';
            const hasta = document.getElementById('filtroCoberturaHasta')?.value || '';

            const rangoTexto = desde || hasta
                ? ` para el rango seleccionado${desde ? ' desde ' + formatearFechaSimple(desde) : ''}${hasta ? ' hasta ' + formatearFechaSimple(hasta) : ''}`
                : ' de todo el historial';

            if(btn) {
                btn.innerText = 'Analizando...';
                btn.disabled = true;
            }

            try {
                let query = supabaseClient
                    .from(TABLAS.TURNOS)
                    .select('fecha, turno, agente_id, modalidad, sucursal')
                    .order('fecha', { ascending: true });

                if(desde) query = query.gte('fecha', desde);
                if(hasta) query = query.lte('fecha', hasta);

                const { data, error } = await query;

                if(error) {
                    console.error('Error leyendo historial del planificador:', error);
                    mostrarToast('No se pudo leer el historial del planificador: ' + error.message, 'error');
                    return;
                }

                const vistaPrevia = await sincronizarTurnosIdentificacionesConRegistroDiario(data || [], { vistaPrevia: true });

                if(!vistaPrevia.ok) {
                    mostrarToast('No se pudo preparar la vista previa: ' + vistaPrevia.mensaje, 'error');
                    return;
                }

                if((vistaPrevia.totalPlanificador || 0) === 0) {
                    mostrarToast('No se encontraron guardias de sábado de Identificaciones para sincronizar en el rango indicado.', 'warning');
                    return;
                }

                const confirmar = await mostrarConfirmacionModerna({
                    titulo: 'Vista previa de sincronización',
                    mensaje: armarMensajeVistaPreviaSincronizacionDiario(vistaPrevia, rangoTexto),
                    textoAceptar: 'Sincronizar',
                    tipo: (vistaPrevia.conflictos || []).length > 0 ? 'warning' : 'info'
                });
                if(!confirmar) return;

                if(btn) btn.innerText = 'Sincronizando...';

                const resultado = await sincronizarTurnosIdentificacionesConRegistroDiario(data || []);

                if(!resultado.ok) {
                    mostrarToast('No se pudo sincronizar el historial: ' + resultado.mensaje, 'error');
                    return;
                }

                await listarCoberturasDiarias();

                const fechasTexto = resultado.fechas.map(formatearFechaSimple).join(', ');
                const detalleOmitidos = resultado.omitidos > 0 ? ` ${resultado.omitidos} registro(s) manual(es) ya existían y fueron omitidos.` : '';
                const detalleConflictos = (resultado.conflictos || []).length > 0 ? ` ${resultado.conflictos.length} posible(s) conflicto(s) quedaron marcados en observaciones.` : '';

                if(resultado.insertados === 0 && resultado.reemplazados === 0) {
                    mostrarToast('No había registros nuevos para sincronizar. No se duplicaron registros diarios.' + detalleOmitidos, 'info');
                } else {
                    mostrarToast(`Historial sincronizado: ${resultado.insertados} registro(s) importado(s), ${resultado.reemplazados} automático(s) reemplazado(s). Fechas: ${fechasTexto}.${detalleOmitidos}${detalleConflictos}`, 'success');
                }
            } finally {
                if(btn) {
                    btn.innerText = textoOriginal;
                    btn.disabled = false;
                }
            }
        }

        // Guardar/Actualizar la planificación de guardias de las fechas activas
        document.getElementById('btnGuardar').addEventListener('click', async () => {
            if(diasPlanificados.length === 0) {
                mostrarToast("Por favor, selecciona la fecha del sábado antes de guardar.", "warning");
                return;
            }

            const filasAInsertar = [];
            const fechasPlanificadas = diasPlanificados.map(d => d.fecha);

            diasPlanificados.forEach(dia => {
                // Procesar Call Center
                ['Mañana', 'Tarde', 'Noche'].forEach(turno => {
                    const selectEl = document.getElementById(`cc_${dia.fecha}_${turno}`);
                    const agenteId = selectEl ? selectEl.value : "";
                    if (agenteId) {
                        const datosAgente = agentesEnMemoria.find(a => a.id == agenteId);
                        filasAInsertar.push({
                            fecha: dia.fecha,
                            turno: turno,
                            agente_id: parseInt(agenteId),
                            // Guardamos el área del turno, no solo la modalidad original del agente.
                            // Esto evita que un agente presencial asignado al Call Center aparezca mal en reportes.
                            modalidad: 'Contact Center',
                            sucursal: null
                        });
                    }
                });

                // Procesar Identificaciones (Cerrado Domingos y Feriados - Solo Sábados)
                if(dia.tipo === 'sabado') {
                    ['Mañana', 'Tarde'].forEach(turno => {
                        const selectEl = document.getElementById(`ident_${dia.fecha}_${turno}`);
                        const agenteId = selectEl ? selectEl.value : "";
                        if (agenteId) {
                            const datosAgente = agentesEnMemoria.find(a => a.id == agenteId);
                            filasAInsertar.push({
                                fecha: dia.fecha,
                                turno: turno,
                                agente_id: parseInt(agenteId),
                                // Guardamos Identificaciones como área presencial para que el historial y Excel lo clasifiquen bien.
                                modalidad: 'Presencial',
                                sucursal: datosAgente && datosAgente.sucursal ? datosAgente.sucursal : 'Dpto de Identificaciones'
                            });
                        }
                    });
                }
            });

            if (filasAInsertar.length === 0) {
                mostrarToast("Por favor, selecciona al menos un agente antes de guardar.", "warning");
                return;
            }

            const validacionCuadrante = validarCuadranteAntesDeGuardar(filasAInsertar);
            if (!validacionCuadrante.ok) {
                mostrarToast(validacionCuadrante.mensaje, "warning");
                return;
            }

            const btn = document.getElementById('btnGuardar');
            btn.innerText = "Guardando cuadrante...";
            btn.disabled = true;

            try {
                const resultadoGuardado = await guardarCuadranteTransaccional(filasAInsertar, fechasPlanificadas);

                if(!resultadoGuardado.ok) {
                    mostrarToast(resultadoGuardado.mensaje, resultadoGuardado.tipo || "error");
                    return;
                }

                const syncRegistroDiario = await sincronizarSabadosIdentificacionesConRegistroDiario(filasAInsertar, fechasPlanificadas);
                if(syncRegistroDiario.ok) {
                    await listarCoberturasDiarias();
                    const extra = syncRegistroDiario.insertados > 0 ? ` Además, se sincronizaron ${syncRegistroDiario.insertados} cobertura(s) de sábado de Identificaciones en el Registro Diario.` : '';
                    mostrarToast("¡Planificación de fin de semana guardada con éxito!" + extra, "success");
                } else {
                    mostrarToast("La planificación se guardó, pero no se pudo sincronizar el Registro Diario: " + syncRegistroDiario.mensaje, "warning");
                }
            } catch(errorInesperado) {
                console.error("Error inesperado al guardar cuadrante:", errorInesperado);
                mostrarToast("Ocurrió un error inesperado al guardar el cuadrante. Revisá la consola para más detalles.", "error");
            } finally {
                btn.innerText = "Guardar Cuadrante en Base de Datos";
                btn.disabled = false;
            }
        });

        // Guarda el cuadrante usando una RPC de Supabase para que el borrado y la inserción
        // ocurran dentro de una sola transacción en la base de datos.
        async function guardarCuadranteTransaccional(filasAInsertar, fechasPlanificadas) {
            if(!Array.isArray(filasAInsertar) || filasAInsertar.length === 0) {
                return {
                    ok: false,
                    tipo: "warning",
                    mensaje: "No hay turnos para guardar."
                };
            }

            if(!Array.isArray(fechasPlanificadas) || fechasPlanificadas.length === 0) {
                return {
                    ok: false,
                    tipo: "warning",
                    mensaje: "No hay fechas planificadas para actualizar."
                };
            }

            const turnosNormalizados = filasAInsertar.map(turno => ({
                fecha: turno.fecha,
                turno: turno.turno,
                agente_id: turno.agente_id,
                modalidad: turno.modalidad || null,
                sucursal: turno.sucursal || null
            }));

            const { data, error } = await supabaseClient.rpc('guardar_cuadrante_seguro', {
                p_fechas: fechasPlanificadas,
                p_turnos: turnosNormalizados
            });

            if(error) {
                console.error("Error RPC guardar_cuadrante_seguro:", error);
                return {
                    ok: false,
                    tipo: "error",
                    mensaje: "No se pudo guardar el cuadrante con transacción. Verificá que la función RPC guardar_cuadrante_seguro esté creada en Supabase y que el usuario tenga permisos: " + error.message
                };
            }

            return {
                ok: true,
                data: data || null
            };
        }

        // Guarda el cuadrante con respaldo previo para reducir el riesgo de pérdida de datos.
        // Nota: esto no reemplaza una transacción real en Supabase/RPC, pero permite restaurar
        // la planificación anterior si falla la inserción después de limpiar las fechas activas.
        async function guardarCuadranteConRespaldo(filasAInsertar, fechasPlanificadas) {
            const { data: respaldoAnterior, error: respaldoError } = await supabaseClient
                .from(TABLAS.TURNOS)
                .select('*')
                .in('fecha', fechasPlanificadas);

            if(respaldoError) {
                console.error("Error al crear respaldo del cuadrante:", respaldoError);
                return {
                    ok: false,
                    tipo: "error",
                    mensaje: "No se pudo crear un respaldo de la planificación anterior. No se modificó el cuadrante: " + respaldoError.message
                };
            }

            const { error: deleteError } = await supabaseClient
                .from(TABLAS.TURNOS)
                .delete()
                .in('fecha', fechasPlanificadas);

            if(deleteError) {
                console.error("Error al limpiar registros:", deleteError);
                return {
                    ok: false,
                    tipo: "error",
                    mensaje: "No se pudo limpiar la planificación anterior. No se modificó el cuadrante: " + deleteError.message
                };
            }

            const { error: insertError } = await supabaseClient
                .from(TABLAS.TURNOS)
                .insert(filasAInsertar);

            if(!insertError) {
                return { ok: true };
            }

            console.error("Error al insertar nuevo cuadrante:", insertError);

            const restauracion = await restaurarTurnosDesdeRespaldo(respaldoAnterior || [], fechasPlanificadas);
            if(restauracion.ok) {
                return {
                    ok: false,
                    tipo: "warning",
                    mensaje: "No se pudo guardar el nuevo cuadrante: " + insertError.message + ". Se restauró automáticamente la planificación anterior."
                };
            }

            return {
                ok: false,
                tipo: "error",
                mensaje: "No se pudo guardar el nuevo cuadrante: " + insertError.message + ". Además, falló la restauración automática del respaldo: " + restauracion.mensaje
            };
        }

        async function restaurarTurnosDesdeRespaldo(respaldoAnterior, fechasPlanificadas) {
            try {
                // Evita dejar datos parciales si alguna fila nueva llegó a insertarse antes del error.
                const { error: limpiarError } = await supabaseClient
                    .from(TABLAS.TURNOS)
                    .delete()
                    .in('fecha', fechasPlanificadas);

                if(limpiarError) {
                    console.error("Error al limpiar antes de restaurar respaldo:", limpiarError);
                    return { ok: false, mensaje: limpiarError.message };
                }

                if(!respaldoAnterior.length) {
                    return { ok: true };
                }

                const respaldoLimpio = respaldoAnterior.map(limpiarTurnoParaReinsertar);
                const { error: restaurarError } = await supabaseClient
                    .from(TABLAS.TURNOS)
                    .insert(respaldoLimpio);

                if(restaurarError) {
                    console.error("Error al restaurar respaldo del cuadrante:", restaurarError);
                    return { ok: false, mensaje: restaurarError.message };
                }

                return { ok: true };
            } catch(error) {
                console.error("Error inesperado al restaurar respaldo:", error);
                return { ok: false, mensaje: error.message || String(error) };
            }
        }

        function limpiarTurnoParaReinsertar(turno) {
            const copia = { ...turno };
            // Estos campos suelen ser generados por la base. Se eliminan para evitar conflictos
            // con columnas identity/default al restaurar desde el navegador.
            delete copia.id;
            delete copia.created_at;
            delete copia.updated_at;
            return copia;
        }

        // Validación preventiva antes de registrar o actualizar una ausencia
        async function validarAusenciaAntesDeRegistrar(agenteId, fechaInicio, fechaFin, ausenciaIgnoradaId = null) {
            const agente = agentesEnMemoria.find(a => a.id == agenteId);
            const nombreAgente = agente ? agente.nombre_corto : `Agente ID ${agenteId}`;

            if (!agenteId) {
                return {
                    ok: false,
                    mensaje: "Seleccioná un agente antes de registrar la ausencia."
                };
            }

            if (!agente) {
                return {
                    ok: false,
                    mensaje: "No se encontró el agente seleccionado. Recargá la página e intentá nuevamente."
                };
            }

            if (agente.activo === false) {
                return {
                    ok: false,
                    mensaje: `${nombreAgente} está inactivo. Reactivalo antes de registrar una ausencia.`
                };
            }

            // Detectar vacaciones/permisos/reposos/días libres que se pisan con el nuevo rango.
            // Dos rangos se superponen cuando: nuevoInicio <= existenteFin && nuevoFin >= existenteInicio.
            // En modo edición se ignora el propio registro que se está actualizando.
            const ausenciaSolapada = ausenciasEnMemoria.find(aus =>
                aus.id != ausenciaIgnoradaId &&
                aus.agente_id == agenteId &&
                fechaInicio <= aus.fecha_fin &&
                fechaFin >= aus.fecha_inicio
            );

            if (ausenciaSolapada) {
                return {
                    ok: false,
                    mensaje: `${nombreAgente} ya tiene ${ausenciaSolapada.tipo} del ${formatearFechaSimple(ausenciaSolapada.fecha_inicio)} al ${formatearFechaSimple(ausenciaSolapada.fecha_fin)}. No se puede cargar otra ausencia superpuesta.`
                };
            }

            // Avisar si ya existen guardias guardadas en la base para ese mismo período.
            // No se bloquea automáticamente: se pide confirmación para que el supervisor decida.
            const { data: guardiasExistentes, error } = await supabaseClient
                .from(TABLAS.TURNOS)
                .select('fecha, turno, modalidad, sucursal')
                .eq('agente_id', parseInt(agenteId))
                .gte('fecha', fechaInicio)
                .lte('fecha', fechaFin)
                .order('fecha', { ascending: true });

            if (error) {
                return {
                    ok: false,
                    mensaje: "No se pudo verificar si el agente ya tiene guardias en ese período: " + error.message
                };
            }

            if (guardiasExistentes && guardiasExistentes.length > 0) {
                const resumenGuardias = guardiasExistentes
                    .slice(0, 4)
                    .map(g => `${formatearFechaSimple(g.fecha)} ${g.turno}`)
                    .join(', ');

                const extra = guardiasExistentes.length > 4 ? ` y ${guardiasExistentes.length - 4} más` : '';

                return {
                    ok: true,
                    requiereConfirmacion: true,
                    mensaje: `${nombreAgente} ya tiene ${guardiasExistentes.length} guardia(s) guardada(s) en ese período: ${resumenGuardias}${extra}.

¿Querés registrar la ausencia de todos modos? Recordá ajustar el cuadrante después.`
                };
            }

            return { ok: true };
        }

        // ============================================================
