        // 11) GESTIÓN DE NOVEDADES Y COBERTURAS
        // ============================================================
        function obtenerClaseEstadoNovedad(estado) {
            if(estado === 'CUBIERTO') return 'bg-green-100 text-green-800';
            if(estado === 'NO REQUIERE COBERTURA') return 'bg-blue-100 text-blue-800';
            if(estado === 'CANCELADO') return 'bg-gray-100 text-gray-500';
            return 'bg-yellow-100 text-yellow-800';
        }

        // Motivos de novedades que pueden convertirse de forma segura en una ausencia de jornada.
        // Los pedidos de entrada/salida más temprano quedan fuera porque son parciales y no conviene bloquear todo el día.
        function obtenerTipoAusenciaDesdeNovedad(motivoPedido) {
            const motivo = normalizarTextoBusqueda(motivoPedido);

            if(motivo.includes('vacaciones')) return 'Vacaciones';
            if(motivo.includes('dia libre por horas extras') || motivo.includes('cumpleanos')) return 'Día Libre';
            if(motivo.includes('consulta medica') || motivo.includes('permiso particular')) return 'Permiso';

            return null;
        }

        function novedadPuedeConvertirseEnAusencia(novedad) {
            if(!novedad || !novedad.fecha_solicitada || !novedad.agente_id) return false;
            if((novedad.estado_cobertura || '') === 'CANCELADO') return false;
            return obtenerTipoAusenciaDesdeNovedad(novedad.motivo_pedido) !== null;
        }

        function obtenerFechaHastaNovedad(novedad) {
            const notas = novedad?.notas_relevo || '';
            const match = notas.match(/\[RANGO_HASTA:(\d{4}-\d{2}-\d{2})\]/);
            return match ? match[1] : novedad?.fecha_solicitada;
        }

        function formatearRangoNovedad(novedad) {
            const desde = novedad?.fecha_solicitada;
            const hasta = obtenerFechaHastaNovedad(novedad);
            if(!desde) return '-';
            if(!hasta || hasta === desde) return formatearFechaSimple(desde);
            return `${formatearFechaSimple(desde)} al ${formatearFechaSimple(hasta)}`;
        }

        function limpiarNotasRelevoNovedad(notas) {
            return (notas || '')
                .replace(/\s*\|\s*\[RANGO_HASTA:\d{4}-\d{2}-\d{2}\]/g, '')
                .replace(/\[RANGO_HASTA:\d{4}-\d{2}-\d{2}\]\s*\|\s*/g, '')
                .replace(/\[RANGO_HASTA:\d{4}-\d{2}-\d{2}\]/g, '')
                .trim();
        }

        function construirNotasRelevoConRango(notas, fechaDesde, fechaHasta) {
            const partes = [];
            const notaLimpia = limpiarNotasRelevoNovedad(notas);
            if(notaLimpia) partes.push(notaLimpia);
            if(fechaHasta && fechaDesde && fechaHasta > fechaDesde) {
                partes.push(`${MARCA_RANGO_NOVEDAD}${fechaHasta}]`);
            }
            return partes.join(' | ') || null;
        }

        function novedadYaFueConvertidaEnAusencia(novedad) {
            if(!novedad || !novedad.fecha_solicitada || !novedad.agente_id) return false;
            const fechaHasta = obtenerFechaHastaNovedad(novedad);

            return ausenciasEnMemoria.some(aus =>
                aus.agente_id == novedad.agente_id &&
                novedad.fecha_solicitada >= aus.fecha_inicio &&
                fechaHasta <= aus.fecha_fin
            );
        }

        function construirNotasAusenciaDesdeNovedad(novedad) {
            const partes = [
                `Generado desde Novedades/Coberturas. Motivo: ${novedad.motivo_pedido || 'Sin motivo'}`
            ];

            if(novedad.observacion_tiempo) {
                partes.push(`Horario / tiempo afectado: ${novedad.observacion_tiempo}`);
            }

            const notasLimpias = limpiarNotasRelevoNovedad(novedad.notas_relevo);
            if(notasLimpias) {
                partes.push(`Notas de cobertura: ${notasLimpias}`);
            }

            return partes.join(' | ');
        }

        function filtrarNovedadesSegunVista() {
            const filtro = document.getElementById('filtroEstadoNovedades')?.value || 'pendientes';

            if(filtro === 'todos') return novedadesEnMemoria;

            if(filtro === 'pendientes') {
                return novedadesEnMemoria.filter(n =>
                    (n.estado_cobertura || 'FALTA CUBRIR') === 'FALTA CUBRIR'
                );
            }

            return novedadesEnMemoria.filter(n =>
                (n.estado_cobertura || 'FALTA CUBRIR') === filtro
            );
        }

        function renderizarResumenNovedades(novedadesFiltradas) {
            const contenedor = document.getElementById('resumenNovedades');
            if(!contenedor) return;

            const resumen = {
                total: novedadesFiltradas.length,
                pendientes: novedadesFiltradas.filter(n => (n.estado_cobertura || 'FALTA CUBRIR') === 'FALTA CUBRIR').length,
                convertidas: novedadesFiltradas.filter(n => novedadYaFueConvertidaEnAusencia(n)).length
            };

            const partes = [`${resumen.total} pedido(s)`];
            if(resumen.pendientes > 0) partes.push(`${resumen.pendientes} pendiente(s)`);
            if(resumen.convertidas > 0) partes.push(`${resumen.convertidas} ya registradas como ausencia`);
            contenedor.textContent = partes.join(' · ');
        }

        function renderizarTablaNovedades() {
            const tbody = document.getElementById('listaNovedades');
            if(!tbody) return;

            const novedadesFiltradas = filtrarNovedadesSegunVista();
            renderizarResumenNovedades(novedadesFiltradas);

            if(novedadesFiltradas.length === 0) {
                tbody.innerHTML = `<div class="novedad-card text-center text-gray-400">No hay novedades para el filtro seleccionado.</div>`;
                return;
            }

            tbody.innerHTML = "";
            novedadesFiltradas.forEach(nov => {
                const nombre = nov.agentes ? nov.agentes.nombre_corto : 'Desconocido';
                const estado = nov.estado_cobertura || 'FALTA CUBRIR';
                const estadoOptions = ['FALTA CUBRIR', 'CUBIERTO', 'NO REQUIERE COBERTURA', 'CANCELADO']
                    .map(opcion => `<option value="${opcion}" ${opcion === estado ? 'selected' : ''}>${opcion}</option>`)
                    .join('');

                const puedeConvertirse = novedadPuedeConvertirseEnAusencia(nov);
                const yaConvertida = novedadYaFueConvertidaEnAusencia(nov);
                const botonConvertirAusencia = yaConvertida
                    ? `<span class="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-red-50 text-red-700 font-black" title="Ausencia ya registrada">✓</span>`
                    : (puedeConvertirse
                        ? `<button onclick="convertirNovedadEnAusencia(${nov.id})" class="novedad-action-btn bg-red-50 text-red-700 border border-red-100 hover:bg-red-100" title="Convertir en ausencia">Ausencia</button>`
                        : '');

                const resumenMotivo = nov.motivo_pedido || '-';
                const resumenTiempo = nov.observacion_tiempo ? ` · ${nov.observacion_tiempo}` : '';
                const notas = limpiarNotasRelevoNovedad(nov.notas_relevo) || 'Sin notas registradas.';
                const rangoPedido = formatearRangoNovedad(nov);

                const card = document.createElement('div');
                card.className = 'novedad-card';
                card.innerHTML = `
                    <div class="min-w-0">
                        <div class="flex items-start justify-between gap-2">
                            <div class="min-w-0">
                                <h4 class="text-sm font-extrabold text-gray-800 truncate">${escaparHTML(nombre)}</h4>
                                <div class="mt-1 text-sm font-semibold text-gray-800 line-clamp-2">${escaparHTML(resumenMotivo)}</div>
                                ${resumenTiempo ? `<div class="text-xs text-gray-500 line-clamp-1">${escaparHTML(resumenTiempo.replace(/^ · /, ''))}</div>` : ''}
                            </div>
                            <span class="novedad-chip bg-sky-50 text-sky-700 shrink-0">${rangoPedido}</span>
                        </div>
                        <details class="mt-2 bg-gray-50 border rounded-lg px-2.5 py-1.5">
                            <summary class="cursor-pointer select-none text-[11px] font-bold text-gray-600">Ver detalle</summary>
                            <div class="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                                <div>
                                    <div class="text-[10px] uppercase font-bold text-gray-500 mb-1">Pedido</div>
                                    <div class="text-gray-600">${formatearFechaSimple(nov.fecha_pedido)}</div>
                                </div>
                                <div>
                                    <div class="text-[10px] uppercase font-bold text-gray-500 mb-1">Motivo completo</div>
                                    <div class="text-gray-700 whitespace-pre-line">${escaparHTML(resumenMotivo)}</div>
                                </div>
                                <div>
                                    <div class="text-[10px] uppercase font-bold text-gray-500 mb-1">Cobertura / notas</div>
                                    <div class="text-gray-600 whitespace-pre-line">${escaparHTML(notas)}</div>
                                </div>
                            </div>
                        </details>
                        <div class="mt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <select onchange="actualizarEstadoNovedad(${nov.id}, this.value)" class="w-full sm:max-w-[210px] border rounded-lg p-2 text-[11px] bg-white ${obtenerClaseEstadoNovedad(estado)} font-bold">
                                ${estadoOptions}
                            </select>
                            <div class="flex flex-wrap gap-1.5 sm:justify-end">
                                ${botonConvertirAusencia}
                                <button onclick="editarNotaCobertura(${nov.id})" class="novedad-action-btn bg-sky-50 text-sky-700 border border-sky-100 hover:bg-sky-100" title="Editar nota">Nota</button>
                                <button onclick="eliminarNovedad(${nov.id})" class="novedad-action-btn bg-red-50 text-red-700 border border-red-100 hover:bg-red-100" title="Eliminar novedad">✕</button>
                            </div>
                        </div>
                    </div>
                `;
                tbody.appendChild(card);
            });
        }

        function setupFiltroNovedades() {
            const filtro = document.getElementById('filtroEstadoNovedades');
            const fechaPedido = document.getElementById('novedad_fecha_pedido');

            if(filtro) {
                filtro.addEventListener('change', renderizarTablaNovedades);
            }

            if(fechaPedido && !fechaPedido.value) {
                fechaPedido.value = obtenerFechaActualISO();
            }

            document.getElementById('btnAbrirModalNovedad')?.addEventListener('click', abrirModalNovedad);
            document.getElementById('btnCerrarModalNovedad')?.addEventListener('click', cerrarModalNovedad);
            document.getElementById('btnCancelarNovedad')?.addEventListener('click', cerrarModalNovedad);
            document.getElementById('modalNovedad')?.addEventListener('click', (e) => {
                if(e.target.id === 'modalNovedad') cerrarModalNovedad();
            });
        }

        function abrirModalNovedad() {
            const modal = document.getElementById('modalNovedad');
            if(!modal) return;
            const fechaPedido = document.getElementById('novedad_fecha_pedido');
            if(fechaPedido && !fechaPedido.value) fechaPedido.value = obtenerFechaActualISO();
            modal.classList.remove('hidden');
            setTimeout(() => document.getElementById('novedad_agente')?.focus(), 50);
        }

        function cerrarModalNovedad() {
            document.getElementById('modalNovedad')?.classList.add('hidden');
        }

        function construirMotivoNovedad() {
            const motivoTipo = document.getElementById('novedad_motivo_tipo').value;
            const detalle = document.getElementById('novedad_motivo_detalle').value.trim();

            if(motivoTipo === 'Otro') {
                return detalle;
            }

            return detalle ? `${motivoTipo} — ${detalle}` : motivoTipo;
        }

        function obtenerResumenTurnos(turnos) {
            return (turnos || []).map(t => {
                const area = ((t.modalidad || '').toLowerCase().includes('presencial') || (t.sucursal || '').toLowerCase().includes('ident'))
                    ? 'Identificaciones'
                    : 'Call Center';
                return `${formatearFechaSimple(t.fecha)} ${t.turno} (${area})`;
            }).join(', ');
        }

        if (document.getElementById('formNovedad')) {
            document.getElementById('formNovedad').addEventListener('submit', async (e) => {
                e.preventDefault();

                const agente_id = document.getElementById('novedad_agente').value;
                const fecha_pedido = document.getElementById('novedad_fecha_pedido').value || obtenerFechaActualISO();
                const fecha_solicitada = document.getElementById('novedad_fecha_solicitada').value;
                const fecha_hasta = document.getElementById('novedad_fecha_hasta').value || fecha_solicitada;
                const motivo_pedido = construirMotivoNovedad();
                const observacion_tiempo = document.getElementById('novedad_observacion_tiempo').value.trim() || null;
                const estado_cobertura = document.getElementById('novedad_estado').value;
                const notas_relevo = construirNotasRelevoConRango(
                    document.getElementById('novedad_notas_relevo').value.trim(),
                    fecha_solicitada,
                    fecha_hasta
                );

                if(!agente_id) {
                    mostrarToast("Seleccioná el agente que realiza el pedido.", "warning");
                    return;
                }

                if(!fecha_solicitada) {
                    mostrarToast("Seleccioná desde qué fecha solicita el agente.", "warning");
                    return;
                }

                if(fecha_hasta < fecha_solicitada) {
                    mostrarToast("La fecha Hasta no puede ser anterior a Desde.", "warning");
                    return;
                }

                if(!motivo_pedido) {
                    mostrarToast("Indicá el motivo del pedido. Si elegiste Otro, completá el detalle.", "warning");
                    return;
                }

                if(fecha_pedido > fecha_solicitada) {
                    const continuar = await mostrarConfirmacionModerna({
                        titulo: 'Revisar fecha del pedido',
                        mensaje: 'La fecha del pedido es posterior a la fecha solicitada. ¿Querés registrar la novedad de todos modos?',
                        textoAceptar: 'Registrar igual',
                        tipo: 'warning'
                    });
                    if(!continuar) return;
                }

                const agente = agentesEnMemoria.find(a => a.id == agente_id);
                if(!agente || agente.activo === false) {
                    mostrarToast("Ese agente no existe o está inactivo.", "warning");
                    return;
                }

                const duplicado = novedadesEnMemoria.find(n =>
                    n.agente_id == agente_id &&
                    n.fecha_solicitada === fecha_solicitada &&
                    normalizarTextoBusqueda(n.motivo_pedido) === normalizarTextoBusqueda(motivo_pedido)
                );

                if(duplicado) {
                    mostrarToast("Ya existe una novedad similar para ese agente en esa fecha.", "warning");
                    return;
                }

                const btn = document.getElementById('btnGuardarNovedad');
                btn.innerText = "Validando...";
                btn.disabled = true;

                const { data: turnosExistentes, error: errorTurnos } = await supabaseClient
                    .from(TABLAS.TURNOS)
                    .select('fecha, turno, modalidad, sucursal')
                    .eq('agente_id', parseInt(agente_id))
                    .gte('fecha', fecha_solicitada)
                    .lte('fecha', fecha_hasta);

                if(errorTurnos) {
                    btn.innerText = "Guardar pedido";
                    btn.disabled = false;
                    mostrarToast("No se pudo verificar si el agente tiene guardias en esa fecha: " + errorTurnos.message, "error");
                    return;
                }

                if(turnosExistentes && turnosExistentes.length > 0) {
                    const resumen = obtenerResumenTurnos(turnosExistentes);
                    const continuar = await mostrarConfirmacionModerna({
                        titulo: 'El agente ya tiene guardia',
                        mensaje: `${agente.nombre_corto} ya tiene guardia guardada en esa fecha: ${resumen}.

¿Querés registrar la novedad de todos modos para gestionar la cobertura?`,
                        textoAceptar: 'Registrar igual',
                        tipo: 'warning'
                    });
                    if(!continuar) {
                        btn.innerText = "Guardar pedido";
                        btn.disabled = false;
                        return;
                    }
                }

                btn.innerText = "Registrando...";

                const { error } = await supabaseClient
                    .from(TABLAS.NOVEDADES)
                    .insert([{
                        agente_id: parseInt(agente_id),
                        fecha_pedido,
                        fecha_solicitada,
                        motivo_pedido,
                        observacion_tiempo,
                        estado_cobertura,
                        notas_relevo
                    }]);

                btn.innerText = "Guardar pedido";
                btn.disabled = false;

                if(error) {
                    mostrarToast("No se pudo registrar la novedad: " + error.message, "error");
                } else {
                    document.getElementById('formNovedad').reset();
                    cerrarModalNovedad();
                    document.getElementById('novedad_fecha_pedido').value = obtenerFechaActualISO();
                    document.getElementById('novedad_estado').value = 'FALTA CUBRIR';
                    await listarNovedades();
                    mostrarToast("Pedido registrado con éxito.", "success");
                }
            });
        }

        window.convertirNovedadEnAusencia = async function(id) {
            const novedad = novedadesEnMemoria.find(n => n.id == id);
            if(!novedad) {
                mostrarToast("No se encontró la novedad seleccionada.", "error");
                return;
            }

            const tipoAusencia = obtenerTipoAusenciaDesdeNovedad(novedad.motivo_pedido);
            if(!tipoAusencia) {
                mostrarToast("Esta novedad no se puede convertir automáticamente en ausencia porque parece ser un pedido parcial de horario.", "warning");
                return;
            }

            if(novedadYaFueConvertidaEnAusencia(novedad)) {
                mostrarToast("Esta novedad ya tiene una ausencia registrada para esa fecha.", "warning");
                return;
            }

            const agente = agentesEnMemoria.find(a => a.id == novedad.agente_id);
            const nombreAgente = agente ? agente.nombre_corto : 'Agente seleccionado';
            const fechaHasta = obtenerFechaHastaNovedad(novedad);
            const rangoTexto = formatearRangoNovedad(novedad);

            const continuar = await mostrarConfirmacionModerna({
                titulo: 'Convertir en ausencia',
                mensaje: `Se registrará una ausencia de tipo "${tipoAusencia}" para ${nombreAgente}: ${rangoTexto}.

¿Querés continuar?`,
                textoAceptar: 'Convertir',
                tipo: 'warning'
            });
            if(!continuar) return;

            const validacionAusencia = await validarAusenciaAntesDeRegistrar(
                novedad.agente_id,
                novedad.fecha_solicitada,
                fechaHasta
            );

            if(!validacionAusencia.ok) {
                mostrarToast(validacionAusencia.mensaje, "warning");
                return;
            }

            if(validacionAusencia.requiereConfirmacion) {
                const confirmarGuardias = await mostrarConfirmacionModerna({
                    titulo: 'El agente ya tiene guardias',
                    mensaje: validacionAusencia.mensaje,
                    textoAceptar: 'Crear igual',
                    tipo: 'warning'
                });
                if(!confirmarGuardias) {
                    mostrarToast("Conversión cancelada.", "info");
                    return;
                }
            }

            const notas = construirNotasAusenciaDesdeNovedad(novedad);

            const { error } = await supabaseClient
                .from(TABLAS.AUSENCIAS)
                .insert([{
                    agente_id: parseInt(novedad.agente_id),
                    fecha_inicio: novedad.fecha_solicitada,
                    fecha_fin: fechaHasta,
                    tipo: tipoAusencia,
                    notas
                }]);

            if(error) {
                mostrarToast("No se pudo convertir la novedad en ausencia: " + error.message, "error");
                return;
            }

            const notaConversion = `Convertido en ausencia (${tipoAusencia}) el ${formatearFechaSimple(obtenerFechaActualISO())}.`;
            const notasActuales = novedad.notas_relevo || '';
            const nuevasNotas = notasActuales
                ? `${notasActuales} | ${notaConversion}`
                : notaConversion;

            await supabaseClient
                .from(TABLAS.NOVEDADES)
                .update({ notas_relevo: nuevasNotas })
                .eq('id', id);

            await listarAusencias();
            await listarNovedades();
            actualizarDropdownsGuardia();
            mostrarToast("Novedad convertida en ausencia con éxito.", "success");
        }

        window.actualizarEstadoNovedad = async function(id, nuevoEstado) {
            const { error } = await supabaseClient
                .from(TABLAS.NOVEDADES)
                .update({ estado_cobertura: nuevoEstado })
                .eq('id', id);

            if(error) {
                mostrarToast("No se pudo actualizar el estado de cobertura.", "error");
                await listarNovedades();
            } else {
                await listarNovedades();
                mostrarToast("Estado de cobertura actualizado.", "success");
            }
        }

        window.editarNotaCobertura = async function(id) {
            const novedad = novedadesEnMemoria.find(n => n.id == id);
            if(!novedad) {
                mostrarToast("No se encontró la novedad seleccionada.", "error");
                return;
            }

            const notaActual = limpiarNotasRelevoNovedad(novedad.notas_relevo);
            const nuevaNota = await mostrarModalTexto({
                titulo: 'Notas de relevo / cobertura',
                subtitulo: 'Registrá quién cubre, el horario o cualquier detalle necesario.',
                valorInicial: notaActual,
                placeholder: 'Ej: Cubre M. González de 07:00 a 12:00',
                textoAceptar: 'Guardar nota'
            });
            if(nuevaNota === null) return;

            const { error } = await supabaseClient
                .from(TABLAS.NOVEDADES)
                .update({
                    notas_relevo: construirNotasRelevoConRango(
                        nuevaNota.trim(),
                        novedad.fecha_solicitada,
                        obtenerFechaHastaNovedad(novedad)
                    )
                })
                .eq('id', id);

            if(error) {
                mostrarToast("No se pudo actualizar la nota de cobertura.", "error");
            } else {
                await listarNovedades();
                mostrarToast("Nota de cobertura actualizada.", "success");
            }
        }

        window.eliminarNovedad = async function(id) {
            if(!await mostrarConfirmacionModerna({
                titulo: 'Eliminar novedad',
                mensaje: '¿Seguro que querés eliminar esta novedad?',
                textoAceptar: 'Eliminar',
                tipo: 'danger'
            })) return;

            const { error } = await supabaseClient
                .from(TABLAS.NOVEDADES)
                .delete()
                .eq('id', id);

            if(error) {
                mostrarToast("No se pudo eliminar la novedad.", "error");
            } else {
                await listarNovedades();
                mostrarToast("Novedad eliminada con éxito.", "success");
            }
        }

        // ============================================================
