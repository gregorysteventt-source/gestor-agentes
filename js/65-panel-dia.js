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
                return { agente: null, estado: 'falto', cubreId: null, ausencia: null, registro: null };
            }

            const registro = registroDePuestoEnMemoria(base.area, base.turno, fecha, agente.id);
            const ausencia = ausenciaEnFechaPanelDia(agente.id, fecha);
            let estado = registro ? estadoDesdeRegistro(registro) : (ausencia ? 'falto' : 'vino');

            // Si el titular es otro agente, "quién cubrió" es el que figura guardado.
            const cubreId = registro && String(registro.agente_cobertura_id || '') !== String(agente.id)
                ? registro.agente_cobertura_id
                : null;

            return { agente, estado, cubreId, ausencia, registro };
        }

        function sincronizarPanelDiaDesdeDatos(fecha) {
            panelDiaEstado = {};
            HORARIOS_BASE_COBERTURA_NORMAL_DIARIA.forEach(base => {
                const info = estadoInicialPuestoPanelDia(base, fecha);
                panelDiaEstado[clavePuestoPanelDia(base)] = {
                    estado: info.estado,
                    cubreId: info.cubreId
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

            const selectorCubre = seleccion.estado === 'vino' ? '' : `
                <div class="mt-2 flex items-center gap-2">
                    <label class="text-[11px] font-bold text-slate-600 whitespace-nowrap">¿Quién cubrió?</label>
                    <select data-puesto="${escaparHTML(clave)}" class="flex-1 rounded-lg border border-slate-300 bg-white p-1 text-xs">
                        ${opcionesAgenteCoberturaPanelDia(seleccion.cubreId)}
                    </select>
                </div>
            `;

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

        function renderizarPanelDia() {
            const contenedor = document.getElementById('panelPuestosDia');
            if (!contenedor) return;

            const fecha = obtenerFechaPanelDia();
            contenedor.innerHTML = HORARIOS_BASE_COBERTURA_NORMAL_DIARIA
                .map(base => construirTarjetaPuestoPanelDia(base, fecha))
                .join('');

            const resumen = document.getElementById('panelDiaResumen');
            if (resumen) {
                const estados = Object.values(panelDiaEstado);
                const sinCobertura = estados.filter(item => item.estado === 'falto' && !item.cubreId).length;
                const tarde = estados.filter(item => item.estado === 'tarde').length;
                const cubiertosPorOtro = estados.filter(item => item.estado === 'falto' && item.cubreId).length;

                const partes = [`${estados.length} puesto(s)`];
                if (tarde) partes.push(`${tarde} tarde`);
                if (cubiertosPorOtro) partes.push(`${cubiertosPorOtro} cubierto(s) por otro`);
                if (sinCobertura) partes.push(`${sinCobertura} sin cobertura`);

                resumen.textContent = partes.join(' · ');
                resumen.className = sinCobertura
                    ? 'flex-1 text-xs font-bold text-rose-700'
                    : 'flex-1 text-xs text-gray-600';
            }
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

            const cubreOtro = seleccion.estado === 'falto' && seleccion.cubreId;
            const titularId = parseInt(info.agente.id);

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
                const boton = evento.target.closest('button[data-puesto][data-estado]');
                if (!boton) return;

                const { puesto, estado } = boton.dataset;
                const actual = panelDiaEstado[puesto] || { estado: 'vino', cubreId: null };
                panelDiaEstado[puesto] = {
                    estado: estado,
                    // Al volver a "Vino" deja de tener sentido quién cubrió.
                    cubreId: estado === 'vino' ? null : actual.cubreId
                };
                renderizarPanelDia();
            });

            contenedor.addEventListener('change', (evento) => {
                const selector = evento.target.closest('select[data-puesto]');
                if (!selector) return;

                const puesto = selector.dataset.puesto;
                const actual = panelDiaEstado[puesto] || { estado: 'falto', cubreId: null };
                panelDiaEstado[puesto] = {
                    ...actual,
                    cubreId: selector.value ? parseInt(selector.value) : null
                };
                renderizarPanelDia();
            });

            document.getElementById('btnDiaAnterior')?.addEventListener('click', () => moverDiaPanelDia(-1));
            document.getElementById('btnDiaSiguiente')?.addEventListener('click', () => moverDiaPanelDia(1));
            document.getElementById('btnDiaHoy')?.addEventListener('click', () => cargarPanelDia(obtenerFechaActualISO()));
            document.getElementById('panelDiaFecha')?.addEventListener('change', (evento) => cargarPanelDia(evento.target.value));
            document.getElementById('btnRegistrarDia')?.addEventListener('click', registrarDiaDelPanel);

            window.__panelDiaConfigurado = true;
            cargarPanelDia(obtenerFechaActualISO());
        }

        setupPanelDia();
