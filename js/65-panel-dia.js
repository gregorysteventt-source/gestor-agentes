        // ============================================================
        // 12b) PANEL DEL DÍA
        // ============================================================
        // Forma rápida de cargar el registro diario: una tarjeta por puesto habitual
        // (los de HORARIOS_BASE_COBERTURA_NORMAL_DIARIA) con tres estados.
        //
        // Antes, cargar el día obligaba a pasar por el modal de 13 campos, con área,
        // turno, tipo, estado, forma de cobertura, resultado y observaciones. Para el
        // caso normal (el titular vino) todo eso era redundante.
        //
        // Acá: un clic deja el puesto cubierto. Solo si falta o llega tarde aparece una
        // línea más para decir quién cubrió. El modal sigue existiendo como
        // "corrección avanzada" para el caso raro.

        const ESTADOS_PANEL_DIA = {
            vino: {
                etiqueta: 'Vino',
                estado_cobertura: 'CUBIERTO',
                tipo_novedad: 'Cobertura normal del titular',
                forma_cobertura: 'Cobertura habitual',
                requiere_cobertura: false,
                resultado: 'Puesto cubierto con normalidad.',
                chip: 'bg-emerald-100 text-emerald-800 border-emerald-200',
                boton: 'bg-emerald-600 text-white border-emerald-700',
                borde: 'border-emerald-200',
                fondo: 'bg-emerald-50/40'
            },
            tarde: {
                etiqueta: 'Tarde',
                estado_cobertura: 'CUBIERTO PARCIAL',
                tipo_novedad: 'Entrada más tarde',
                forma_cobertura: 'Cobertura habitual',
                requiere_cobertura: false,
                resultado: 'El titular llegó más tarde de su horario.',
                chip: 'bg-amber-100 text-amber-900 border-amber-200',
                boton: 'bg-amber-500 text-white border-amber-600',
                borde: 'border-amber-200',
                fondo: 'bg-amber-50/40'
            },
            falto: {
                etiqueta: 'No vino',
                estado_cobertura: 'FALTA CUBRIR',
                tipo_novedad: 'Ausencia imprevista',
                forma_cobertura: 'No se consiguió cobertura',
                requiere_cobertura: true,
                resultado: 'Puesto sin cobertura.',
                chip: 'bg-rose-100 text-rose-800 border-rose-200',
                boton: 'bg-rose-600 text-white border-rose-700',
                borde: 'border-rose-200',
                fondo: 'bg-rose-50/40'
            }
        };

        // clave "area|turno" -> { estado: 'vino'|'tarde'|'falto', cubreId: number|null }
        let panelDiaEstado = {};
        let panelDiaFechaActual = null;

        // ---- Cobertura partida ----
        // Un mismo puesto puede cubrirse en tramos: el agente A de 07:00 a 10:00 y el B
        // de 10:00 a 17:00. Se guarda en una sola fila (un registro por puesto) y los
        // tramos viajan en `observaciones` con esta marca, igual que el resto de las
        // marcas internas del proyecto ([HORARIO:...], [RANGO_HASTA:...]).
        const MARCA_TRAMOS_COBERTURA = '[TRAMOS:';

        // "07:00 a 13:00" -> { desde: '07:00', hasta: '13:00' }
        function parsearRangoHorario(texto) {
            const partes = String(texto || '').split(/\s+a\s+|\s*-\s*/);
            if (partes.length < 2) return null;

            const normalizar = (hora) => {
                const m = String(hora || '').trim().match(/^(\d{1,2}):(\d{2})/);
                return m ? `${String(m[1]).padStart(2, '0')}:${m[2]}` : '';
            };
            const desde = normalizar(partes[0]);
            const hasta = normalizar(partes[1]);
            return desde && hasta ? { desde, hasta } : null;
        }

        function minutosDeHora(hora) {
            const m = String(hora || '').match(/^(\d{1,2}):(\d{2})$/);
            return m ? (parseInt(m[1], 10) * 60) + parseInt(m[2], 10) : 0;
        }

        function serializarTramos(tramos) {
            const limpios = (tramos || [])
                .filter(tramo => tramo && tramo.desde && tramo.hasta)
                .map(tramo => `${tramo.desde}-${tramo.hasta}#${tramo.agenteId || 0}`);
            return limpios.length ? `${MARCA_TRAMOS_COBERTURA}${limpios.join(';')}]` : '';
        }

        function deserializarTramos(texto) {
            const match = String(texto || '').match(/\[TRAMOS:([^\]]+)\]/);
            if (!match) return null;

            const tramos = match[1].split(';').map(parte => {
                const trozo = parte.trim().match(/^(\d{1,2}:\d{2})-(\d{1,2}:\d{2})#(\d+)$/);
                if (!trozo) return null;
                return {
                    desde: trozo[1],
                    hasta: trozo[2],
                    agenteId: parseInt(trozo[3], 10) || null
                };
            }).filter(Boolean);

            return tramos.length ? tramos : null;
        }

        // Minutos cubiertos por los tramos, para saber si el puesto quedó completo.
        function minutosCubiertosPorTramos(tramos) {
            return (tramos || []).reduce((total, tramo) => {
                const desde = minutosDeHora(tramo.desde);
                const hasta = minutosDeHora(tramo.hasta);
                return total + Math.max(0, hasta - desde);
            }, 0);
        }

        // La clave incluye al agente de referencia y no solo área + turno: Registro
        // Civil tiene dos puestos en el turno Mañana (Adolfo y Andrea), así que con
        // "area|turno" las dos tarjetas compartían estado y se movían juntas.
        function clavePuestoPanelDia(base) {
            return `${base.area}|${base.turno}|${base.agente}`;
        }

        function obtenerFechaPanelDia() {
            return document.getElementById('panelDiaFecha')?.value || panelDiaFechaActual || obtenerFechaActualISO();
        }

        // Ausencia cargada en la pestaña Ausencias que cubre esa fecha.
        function ausenciaEnFechaPanelDia(agenteId, fecha) {
            if (!agenteId || !fecha) return null;
            return (ausenciasEnMemoria || []).find(ausencia =>
                ausencia.agente_id == agenteId &&
                fecha >= (ausencia.fecha_inicio || '') &&
                fecha <= (ausencia.fecha_fin || '')
            ) || null;
        }

        function registroDePuestoEnMemoria(area, turno, fecha, agenteId) {
            return (coberturasDiariasEnMemoria || []).find(registro =>
                registro.fecha === fecha &&
                String(registro.area || '') === String(area) &&
                String(registro.turno || '') === String(turno) &&
                String(registro.agente_titular_id) === String(agenteId)
            ) || null;
        }

        // Traduce lo guardado a uno de los tres estados del panel.
        function estadoDesdeRegistro(registro) {
            if (!registro) return 'vino';
            const estado = String(registro.estado_cobertura || '');
            if (estado === 'FALTA CUBRIR' || estado === 'NO CUBIERTO') return 'falto';
            if (estado === 'CUBIERTO PARCIAL') return 'tarde';
            return 'vino';
        }

        // Arma el estado inicial de un puesto: lo que ya está en la base o, si no hay
        // nada, la ausencia registrada en la pestaña Ausencias.
        function estadoInicialPuestoPanelDia(base, fecha) {
            const agente = buscarAgenteRegistroDiarioPorNombre(base.agente);
            if (!agente) {
                return { agente: null, estado: 'falto', cubreId: null, ausencia: null, registro: null, tramos: null };
            }

            const registro = registroDePuestoEnMemoria(base.area, base.turno, fecha, agente.id);
            const ausencia = ausenciaEnFechaPanelDia(agente.id, fecha);
            let estado = registro ? estadoDesdeRegistro(registro) : (ausencia ? 'falto' : 'vino');

            // Cobertura partida guardada: se recuperan los tramos y el puesto cuenta
            // como "no vino" el titular, aunque el estado diga CUBIERTO.
            const tramos = registro ? deserializarTramos(registro.observaciones) : null;
            if (tramos && tramos.length) estado = 'falto';

            // Si el titular es otro agente, "quién cubrió" es el que figura guardado.
            const cubreId = !tramos && registro && String(registro.agente_cobertura_id || '') !== String(agente.id)
                ? registro.agente_cobertura_id
                : null;

            return { agente, estado, cubreId, ausencia, registro, tramos };
        }

        function sincronizarPanelDiaDesdeDatos(fecha) {
            panelDiaEstado = {};
            HORARIOS_BASE_COBERTURA_NORMAL_DIARIA.forEach(base => {
                const info = estadoInicialPuestoPanelDia(base, fecha);
                panelDiaEstado[clavePuestoPanelDia(base)] = {
                    estado: info.estado,
                    cubreId: info.cubreId,
                    tramos: info.tramos ? info.tramos.map(tramo => ({ ...tramo })) : null
                };
            });
        }

        // ---- Pintado ----

        function opcionesAgenteCoberturaPanelDia(seleccionado) {
            const agentes = (agentesEnMemoria || [])
                .filter(agente => agente.activo !== false)
                .slice()
                .sort((a, b) => String(a.nombre_corto || '').localeCompare(String(b.nombre_corto || ''), 'es'));

            const opciones = agentes.map(agente => {
                const activo = String(agente.id) === String(seleccionado) ? 'selected' : '';
                return `<option value="${agente.id}" ${activo}>${escaparHTML(agente.nombre_corto || '')}</option>`;
            }).join('');

            return `<option value="" ${seleccionado ? '' : 'selected'}>Sin cobertura</option>${opciones}`;
        }

        function construirTarjetaPuestoPanelDia(base, fecha) {
            const clave = clavePuestoPanelDia(base);
            const seleccion = panelDiaEstado[clave] || { estado: 'vino', cubreId: null };
            const info = estadoInicialPuestoPanelDia(base, fecha);
            const config = ESTADOS_PANEL_DIA[seleccion.estado] || ESTADOS_PANEL_DIA.vino;

            if (!info.agente) {
                return `
                    <div class="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div class="text-[10px] font-black uppercase tracking-wide text-slate-500">${escaparHTML(base.area)} · ${escaparHTML(base.turno)}</div>
                        <div class="mt-1 text-sm font-bold text-slate-700">No encontrado en el plantel</div>
                        <div class="text-[11px] text-slate-500">${escaparHTML(base.agente)} · cargalo en Personal</div>
                    </div>
                `;
            }

            const nombre = `${info.agente.nombre_corto || base.agente}${info.agente.activo === false ? ' (Inactivo)' : ''}`;
            const notaAusencia = info.ausencia
                ? `<span class="ml-1 rounded bg-fuchsia-100 px-1.5 py-0.5 text-[10px] font-bold text-fuchsia-800">${escaparHTML(info.ausencia.tipo || 'Ausencia')}</span>`
                : '';

            const botones = Object.entries(ESTADOS_PANEL_DIA).map(([id, cfg]) => {
                const activo = seleccion.estado === id;
                const clases = activo
                    ? `${cfg.boton} shadow-sm`
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50';
                return `<button type="button" data-puesto="${escaparHTML(clave)}" data-estado="${id}"
                    class="rounded-lg border px-1 py-1.5 text-xs font-bold transition ${clases}">${cfg.etiqueta}</button>`;
            }).join('');

            const enTramos = Array.isArray(seleccion.tramos) && seleccion.tramos.length > 0;

            const bloqueCubre = `
                <div class="mt-2 flex items-center gap-2">
                    <label class="text-[11px] font-bold text-slate-600 whitespace-nowrap">¿Quién cubrió?</label>
                    <select data-puesto="${escaparHTML(clave)}" class="flex-1 rounded-lg border border-slate-300 bg-white p-1 text-xs">
                        ${opcionesAgenteCoberturaPanelDia(seleccion.cubreId)}
                    </select>
                </div>
                <button type="button" data-puesto="${escaparHTML(clave)}" data-accion="tramos"
                    class="mt-1.5 text-[11px] font-bold text-slate-500 hover:text-slate-800 underline">Se cubrió en dos tramos</button>
            `;

            const filasTramos = (seleccion.tramos || []).map((tramo, indice) => `
                <div class="flex items-center gap-1">
                    <input type="time" data-puesto="${escaparHTML(clave)}" data-tramo="${indice}" data-campo="desde"
                        value="${escaparHTML(tramo.desde || '')}" aria-label="Desde" class="w-[74px] shrink-0 rounded border border-slate-300 p-1 text-xs">
                    <span class="text-[11px] text-slate-500">a</span>
                    <input type="time" data-puesto="${escaparHTML(clave)}" data-tramo="${indice}" data-campo="hasta"
                        value="${escaparHTML(tramo.hasta || '')}" aria-label="Hasta" class="w-[74px] shrink-0 rounded border border-slate-300 p-1 text-xs">
                    <select data-puesto="${escaparHTML(clave)}" data-tramo="${indice}" data-campo="agenteId"
                        aria-label="Quién cubrió este tramo" class="min-w-0 flex-1 rounded border border-slate-300 p-1 text-xs">
                        ${opcionesAgenteCoberturaPanelDia(tramo.agenteId)}
                    </select>
                    <button type="button" data-puesto="${escaparHTML(clave)}" data-accion="quitar-tramo" data-tramo="${indice}"
                        class="shrink-0 rounded border border-slate-200 px-1.5 py-1 text-xs font-bold text-slate-500 hover:bg-slate-100"
                        title="Quitar este tramo" aria-label="Quitar este tramo">✕</button>
                </div>
            `).join('');

            const bloqueTramos = `
                <div class="mt-2 space-y-1">
                    <div class="flex items-center justify-between gap-2">
                        <span class="text-[11px] font-bold text-slate-600">Tramos de cobertura</span>
                        <button type="button" data-puesto="${escaparHTML(clave)}" data-accion="unico"
                            class="text-[11px] font-bold text-slate-500 hover:text-slate-800 underline">Un solo agente</button>
                    </div>
                    ${filasTramos}
                    <button type="button" data-puesto="${escaparHTML(clave)}" data-accion="agregar-tramo"
                        class="text-[11px] font-bold text-emerald-700 hover:underline">+ otro tramo</button>
                </div>
            `;

            const selectorCubre = seleccion.estado === 'vino'
                ? ''
                : (enTramos ? bloqueTramos : bloqueCubre);

            return `
                <div class="rounded-xl border ${config.borde} ${config.fondo} p-3">
                    <div class="flex items-start justify-between gap-2">
                        <div class="min-w-0">
                            <div class="text-[10px] font-black uppercase tracking-wide text-slate-500">${escaparHTML(base.area)} · ${escaparHTML(base.turno)}</div>
                            <div class="truncate text-sm font-black text-slate-800">${escaparHTML(nombre)}${notaAusencia}</div>
                            <div class="text-[11px] text-slate-500">${escaparHTML(base.horario)}</div>
                        </div>
                        <span class="shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${config.chip}">${config.etiqueta}</span>
                    </div>
                    <div class="mt-2 grid grid-cols-3 gap-1.5">${botones}</div>
                    ${selectorCubre}
                </div>
            `;
        }

        // Busca la configuración del puesto a partir de su clave, para precargar horarios.
        function basePorClavePanelDia(clave) {
            return HORARIOS_BASE_COBERTURA_NORMAL_DIARIA.find(base => clavePuestoPanelDia(base) === clave) || null;
        }

        function actualizarResumenPanelDia() {
            const resumen = document.getElementById('panelDiaResumen');
            if (!resumen) return;

            const estados = Object.values(panelDiaEstado);
            const conTramos = estados.filter(item => Array.isArray(item.tramos) && item.tramos.some(tramo => tramo.desde && tramo.hasta));
            const tarde = estados.filter(item => item.estado === 'tarde').length;
            const cubiertosPorOtro = estados.filter(item => item.estado === 'falto' && item.cubreId).length;
            const sinCobertura = estados.filter(item =>
                item.estado === 'falto' &&
                !item.cubreId &&
                !(Array.isArray(item.tramos) && item.tramos.some(tramo => tramo.agenteId))
            ).length;

            const partes = [`${estados.length} puesto(s)`];
            if (tarde) partes.push(`${tarde} tarde`);
            if (cubiertosPorOtro) partes.push(`${cubiertosPorOtro} por otro`);
            if (conTramos.length) partes.push(`${conTramos.length} en tramos`);
            if (sinCobertura) partes.push(`${sinCobertura} sin cobertura`);

            resumen.textContent = partes.join(' · ');
            resumen.className = sinCobertura
                ? 'flex-1 text-xs font-bold text-rose-700'
                : 'flex-1 text-xs text-gray-600';
        }

        function renderizarPanelDia() {
            const contenedor = document.getElementById('panelPuestosDia');
            if (!contenedor) return;

            const fecha = obtenerFechaPanelDia();
            contenedor.innerHTML = HORARIOS_BASE_COBERTURA_NORMAL_DIARIA
                .map(base => construirTarjetaPuestoPanelDia(base, fecha))
                .join('');

            actualizarResumenPanelDia();
        }

        function cargarPanelDia(fecha) {
            panelDiaFechaActual = fecha || panelDiaFechaActual || obtenerFechaActualISO();

            const input = document.getElementById('panelDiaFecha');
            if (input && input.value !== panelDiaFechaActual) input.value = panelDiaFechaActual;

            const texto = document.getElementById('panelDiaFechaTexto');
            if (texto) texto.textContent = `${obtenerDiaSemana(panelDiaFechaActual)} ${formatearFechaSimple(panelDiaFechaActual)}`;

            sincronizarPanelDiaDesdeDatos(panelDiaFechaActual);
            renderizarPanelDia();
        }

        function moverDiaPanelDia(desplazamiento) {
            const base = obtenerFechaPanelDia();
            cargarPanelDia(obtenerFechaRelativaISO(base, desplazamiento));
        }

        // ---- Guardado ----

        // Convierte el estado del panel en el registro que espera la tabla.
        function construirRegistroDePuestoPanelDia(base, fecha) {
            const info = estadoInicialPuestoPanelDia(base, fecha);
            if (!info.agente) return null;

            const clave = clavePuestoPanelDia(base);
            const seleccion = panelDiaEstado[clave] || { estado: 'vino', cubreId: null };
            const config = ESTADOS_PANEL_DIA[seleccion.estado] || ESTADOS_PANEL_DIA.vino;
            const titularId = parseInt(info.agente.id);

            // --- Cobertura partida: dos o más tramos en el mismo puesto ---
            const tramos = (Array.isArray(seleccion.tramos) ? seleccion.tramos : [])
                .filter(tramo => tramo && tramo.desde && tramo.hasta);

            if (tramos.length) {
                const rangoBase = parsearRangoHorario(base.horario);
                const minutosBase = rangoBase
                    ? minutosDeHora(rangoBase.hasta) - minutosDeHora(rangoBase.desde)
                    : 0;
                const completo = minutosBase > 0 && minutosCubiertosPorTramos(tramos) >= minutosBase;

                return {
                    fecha: fecha,
                    area: base.area,
                    turno: base.turno,
                    agente_titular_id: titularId,
                    tipo_novedad: 'Ausencia imprevista',
                    motivo: base.detalle,
                    requiere_cobertura: !completo,
                    estado_cobertura: completo ? 'CUBIERTO' : 'CUBIERTO PARCIAL',
                    // La fila guarda un solo agente; el detalle real de quién cubrió
                    // cada tramo va en la marca [TRAMOS:...] de observaciones.
                    agente_cobertura_id: tramos[0].agenteId || null,
                    forma_cobertura: 'Relevo parcial',
                    horario_afectado: tramos.map(tramo => `${tramo.desde} a ${tramo.hasta}`).join(' / '),
                    resultado: `Cubierto en ${tramos.length} tramo(s)${completo ? '' : ', no cubre el horario completo'}.`,
                    observaciones: `Registrado desde el panel del día. ${serializarTramos(tramos)}`,
                    novedad_id: null
                };
            }

            const cubreOtro = seleccion.estado === 'falto' && seleccion.cubreId;

            return {
                fecha: fecha,
                area: base.area,
                turno: base.turno,
                agente_titular_id: titularId,
                tipo_novedad: config.tipo_novedad,
                motivo: base.detalle,
                requiere_cobertura: cubreOtro ? false : config.requiere_cobertura,
                estado_cobertura: cubreOtro ? 'CUBIERTO' : config.estado_cobertura,
                agente_cobertura_id: cubreOtro ? parseInt(seleccion.cubreId) : (seleccion.estado === 'falto' ? null : titularId),
                forma_cobertura: cubreOtro ? 'Relevo total' : config.forma_cobertura,
                horario_afectado: base.horario,
                resultado: cubreOtro ? 'Cubierto por otro agente.' : config.resultado,
                observaciones: 'Registrado desde el panel del día.',
                novedad_id: null
            };
        }

        async function registrarDiaDelPanel() {
            const fecha = obtenerFechaPanelDia();
            const btn = document.getElementById('btnRegistrarDia');

            if (!fecha) {
                mostrarToast('Elegí la fecha antes de registrar.', 'warning');
                return;
            }

            const registros = HORARIOS_BASE_COBERTURA_NORMAL_DIARIA
                .map(base => construirRegistroDePuestoPanelDia(base, fecha))
                .filter(Boolean);

            if (registros.length === 0) {
                mostrarToast('No se encontraron los agentes habituales en el plantel. Cargalos en Personal.', 'warning');
                return;
            }

            if (btn) {
                btn.disabled = true;
                btn.innerText = 'Guardando…';
            }

            try {
                for (const registro of registros) {
                    const { error } = await guardarRegistroCambioDirecto(registro);
                    if (error) {
                        mostrarToast('No se pudo guardar: ' + error.message, 'error');
                        return;
                    }
                }

                await listarCoberturasDiarias();
                await cargarDatosCalendario();
                mostrarToast(`Día registrado: ${registros.length} puesto(s).`, 'success');
            } catch (error) {
                mostrarToast('Error inesperado al registrar el día.', 'error');
            } finally {
                if (btn) {
                    btn.disabled = false;
                    btn.innerText = 'Registrar el día';
                }
            }
        }

        // ---- Enganche de eventos (una sola vez) ----

        function setupPanelDia() {
            if (window.__panelDiaConfigurado) return;

            const contenedor = document.getElementById('panelPuestosDia');
            if (!contenedor) return;

            // Delegación: las tarjetas se repintan, los listeners no se duplican.
            contenedor.addEventListener('click', (evento) => {
                const botonEstado = evento.target.closest('button[data-puesto][data-estado]');
                if (botonEstado) {
                    const { puesto, estado } = botonEstado.dataset;
                    const actual = panelDiaEstado[puesto] || { estado: 'vino', cubreId: null, tramos: null };
                    panelDiaEstado[puesto] = {
                        estado: estado,
                        // Al volver a "Vino" deja de tener sentido quién cubrió.
                        cubreId: estado === 'vino' ? null : actual.cubreId,
                        tramos: estado === 'vino' ? null : actual.tramos
                    };
                    renderizarPanelDia();
                    return;
                }

                const botonAccion = evento.target.closest('button[data-accion]');
                if (!botonAccion) return;

                const puesto = botonAccion.dataset.puesto;
                const accion = botonAccion.dataset.accion;
                const actual = panelDiaEstado[puesto] || { estado: 'falto', cubreId: null, tramos: null };
                const base = basePorClavePanelDia(puesto);

                if (accion === 'tramos') {
                    // Primer tramo precargado con el horario del puesto, sin agente.
                    const rango = base ? parsearRangoHorario(base.horario) : null;
                    panelDiaEstado[puesto] = {
                        ...actual,
                        estado: 'falto',
                        tramos: [
                            { desde: rango ? rango.desde : '', hasta: rango ? rango.hasta : '', agenteId: null },
                            { desde: '', hasta: '', agenteId: null }
                        ]
                    };
                } else if (accion === 'unico') {
                    panelDiaEstado[puesto] = { ...actual, estado: 'falto', tramos: null };
                } else if (accion === 'agregar-tramo') {
                    const tramos = Array.isArray(actual.tramos) ? actual.tramos.slice() : [];
                    // Arranca donde termina el último tramo cargado.
                    const ultimo = tramos[tramos.length - 1];
                    tramos.push({ desde: ultimo?.hasta || '', hasta: '', agenteId: null });
                    panelDiaEstado[puesto] = { ...actual, tramos };
                } else if (accion === 'quitar-tramo') {
                    const indice = parseInt(botonAccion.dataset.tramo, 10);
                    const tramos = (Array.isArray(actual.tramos) ? actual.tramos.slice() : [])
                        .filter((_, i) => i !== indice);
                    panelDiaEstado[puesto] = { ...actual, tramos: tramos.length ? tramos : null };
                } else {
                    return;
                }

                renderizarPanelDia();
            });

            // Cambios dentro de una tarjeta: el selector de "quién cubrió" o un tramo.
            // No se repinta para no perder el foco mientras se tabula entre horarios.
            const alCambiarPuesto = (evento) => {
                const campo = evento.target.closest('[data-puesto][data-campo]');
                if (campo) {
                    const { puesto, tramo, campo: nombreCampo } = campo.dataset;
                    const actual = panelDiaEstado[puesto] || { estado: 'falto', cubreId: null, tramos: [] };
                    const tramos = (Array.isArray(actual.tramos) ? actual.tramos : []).map(item => ({ ...item }));
                    const indice = parseInt(tramo, 10);
                    if (!tramos[indice]) return;

                    if (nombreCampo === 'agenteId') {
                        tramos[indice].agenteId = campo.value ? parseInt(campo.value) : null;
                    } else {
                        tramos[indice][nombreCampo] = campo.value;
                    }

                    panelDiaEstado[puesto] = { ...actual, tramos };
                    actualizarResumenPanelDia();
                    return;
                }

                const selector = evento.target.closest('select[data-puesto]');
                if (!selector) return;

                const puesto = selector.dataset.puesto;
                const actual = panelDiaEstado[puesto] || { estado: 'falto', cubreId: null, tramos: null };
                panelDiaEstado[puesto] = {
                    ...actual,
                    cubreId: selector.value ? parseInt(selector.value) : null
                };
                actualizarResumenPanelDia();
            };

            contenedor.addEventListener('change', alCambiarPuesto);
            contenedor.addEventListener('input', alCambiarPuesto);

            document.getElementById('btnDiaAnterior')?.addEventListener('click', () => moverDiaPanelDia(-1));
            document.getElementById('btnDiaSiguiente')?.addEventListener('click', () => moverDiaPanelDia(1));
            document.getElementById('btnDiaHoy')?.addEventListener('click', () => cargarPanelDia(obtenerFechaActualISO()));
            document.getElementById('panelDiaFecha')?.addEventListener('change', (evento) => cargarPanelDia(evento.target.value));
            document.getElementById('btnRegistrarDia')?.addEventListener('click', registrarDiaDelPanel);

            window.__panelDiaConfigurado = true;
            cargarPanelDia(obtenerFechaActualISO());
        }

        setupPanelDia();
