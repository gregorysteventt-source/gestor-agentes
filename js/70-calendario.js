        // 13) CALENDARIO OPERATIVO
        // ============================================================
        function formatearFechaISODesdeDateLocal(fecha) {
            const yyyy = fecha.getFullYear();
            const mm = String(fecha.getMonth() + 1).padStart(2, '0');
            const dd = String(fecha.getDate()).padStart(2, '0');
            return `${yyyy}-${mm}-${dd}`;
        }

        function obtenerInicioFinMesCalendario() {
            const inicio = new Date(fechaCalendarioActual.getFullYear(), fechaCalendarioActual.getMonth(), 1);
            const fin = new Date(fechaCalendarioActual.getFullYear(), fechaCalendarioActual.getMonth() + 1, 0);
            return {
                inicio,
                fin,
                inicioISO: formatearFechaISODesdeDateLocal(inicio),
                finISO: formatearFechaISODesdeDateLocal(fin)
            };
        }

        function setupCalendarioInteractivo() {
            document.getElementById('btnCalendarioAnterior')?.addEventListener('click', async () => {
                fechaCalendarioActual.setMonth(fechaCalendarioActual.getMonth() - 1);
                await cargarDatosCalendario();
            });
            document.getElementById('btnCalendarioSiguiente')?.addEventListener('click', async () => {
                fechaCalendarioActual.setMonth(fechaCalendarioActual.getMonth() + 1);
                await cargarDatosCalendario();
            });
            document.getElementById('btnCalendarioHoy')?.addEventListener('click', async () => {
                fechaCalendarioActual = new Date();
                fechaCalendarioActual.setDate(1);
                await cargarDatosCalendario();
            });
            document.getElementById('btnCalendarioRecargar')?.addEventListener('click', cargarDatosCalendario);
            document.getElementById('btnToggleCalendario')?.addEventListener('click', alternarCalendarioPlanificador);
            document.getElementById('btnCerrarModalCalendario')?.addEventListener('click', cerrarDetalleCalendario);
            document.getElementById('modalCalendario')?.addEventListener('click', (e) => {
                if(e.target.id === 'modalCalendario') cerrarDetalleCalendario();
            });
            document.getElementById('btnAgregarNotaCalendario')?.addEventListener('click', async () => {
                if(fechaCalendarioSeleccionada) await abrirFormularioNotaCalendario(fechaCalendarioSeleccionada);
            });
        }
        function alternarCalendarioPlanificador() {
            const cuerpo = document.getElementById('calendarioCuerpo');
            const btn = document.getElementById('btnToggleCalendario');
            if(!cuerpo || !btn) return;
            const ocultar = !cuerpo.classList.contains('hidden');
            cuerpo.classList.toggle('hidden', ocultar);
            actualizarBotonCalendarioMinimizado(btn, ocultar);
            localStorage.setItem('calendario_planificador_minimizado', ocultar ? '1' : '0');
        }

        function aplicarEstadoCalendarioMinimizado() {
            const cuerpo = document.getElementById('calendarioCuerpo');
            const btn = document.getElementById('btnToggleCalendario');
            if(!cuerpo || !btn) return;
            const minimizado = localStorage.getItem('calendario_planificador_minimizado') === '1';
            cuerpo.classList.toggle('hidden', minimizado);
            actualizarBotonCalendarioMinimizado(btn, minimizado);
        }

        function actualizarBotonCalendarioMinimizado(btn, minimizado) {
            const texto = minimizado ? 'Mostrar calendario' : 'Minimizar calendario';
            btn.textContent = minimizado ? '▾' : '▴';
            btn.title = texto;
            btn.setAttribute('aria-label', texto);
        }
        async function cargarDatosCalendario() {
            const grid = document.getElementById('calendarioGrid');
            if(!grid || !usuarioActual) return;

            const { inicioISO, finISO } = obtenerInicioFinMesCalendario();
            const calendarioYaRenderizado = grid.dataset.calendarioRenderizado === '1' && grid.children.length > 0;
            if(!calendarioYaRenderizado) {
                grid.innerHTML = `<div class="col-span-full p-6 text-center text-sm text-slate-500 bg-white border rounded-lg">Cargando calendario...</div>`;
            }

            const [notasResp, turnosResp] = await Promise.all([
                supabaseClient
                    .from(TABLAS.NOTAS_CALENDARIO)
                    .select('id, fecha, titulo, detalle, color, creado_en, actualizado_en')
                    .gte('fecha', inicioISO)
                    .lte('fecha', finISO)
                    .order('fecha', { ascending: true }),
                supabaseClient
                    .from(TABLAS.TURNOS)
                    .select('fecha, turno, agente_id, modalidad, sucursal')
                    .gte('fecha', inicioISO)
                    .lte('fecha', finISO)
                    .order('fecha', { ascending: true })
            ]);

            if(notasResp.error) {
                console.error('Error cargando notas del calendario:', notasResp.error);
                mostrarToast('No se pudieron cargar las notas del calendario.', 'error');
            }
            if(turnosResp.error) {
                console.error('Error cargando turnos del calendario:', turnosResp.error);
                mostrarToast('No se pudieron cargar las guardias del calendario.', 'error');
            }

            notasCalendarioEnMemoria = notasResp.data || [];
            turnosCalendarioEnMemoria = turnosResp.data || [];
            renderizarCalendarioOperativo();
        }

        function crearEventoCalendario({ tipo, categoria, etiqueta, titulo, detalle = '', clase, nota = null }) {
            return { tipo, categoria, etiqueta, titulo: titulo || etiqueta, detalle, clase, nota };
        }

        function obtenerEventosCalendarioPorFecha(fechaISO) {
            const eventos = [];

            ausenciasEnMemoria
                .filter(aus => fechaISO >= aus.fecha_inicio && fechaISO <= aus.fecha_fin)
                .forEach(aus => {
                    const nombre = aus.agentes?.nombre_corto || obtenerNombreAgentePorId(aus.agente_id);
                    eventos.push(crearEventoCalendario({
                        tipo: 'ausencia',
                        categoria: 'Ausencias',
                        etiqueta: nombre,
                        titulo: `${nombre} - ${aus.tipo}`,
                        detalle: `Periodo: ${formatearFechaSimple(aus.fecha_inicio)} al ${formatearFechaSimple(aus.fecha_fin)}${aus.notas ? '\nNota: ' + aus.notas : ''}`,
                        clase: 'bg-red-50 text-red-700 border-red-100'
                    }));
                });

            turnosCalendarioEnMemoria
                .filter(turno => turno.fecha === fechaISO)
                .forEach(turno => {
                    const area = esRegistroIdentificaciones(turno) ? 'Identificaciones' : 'Call Center';
                    const nombre = obtenerNombreAgentePorId(turno.agente_id);
                    eventos.push(crearEventoCalendario({
                        tipo: 'guardia',
                        categoria: 'Guardias',
                        etiqueta: nombre,
                        titulo: `${nombre} - ${area}`,
                        detalle: `Turno: ${turno.turno || '-'}\nArea: ${area}`,
                        clase: 'bg-amber-50 text-amber-700 border-amber-100'
                    }));
                });


            const hayGuardiasPlanificadasEnFecha = turnosCalendarioEnMemoria.some(turno => turno.fecha === fechaISO);

            coberturasDiariasEnMemoria
                .filter(reg => reg.fecha === fechaISO)
                .filter(reg => !(hayGuardiasPlanificadasEnFecha && esRegistroAutomaticoPlanificador(reg)))
                .forEach(reg => {
                    const nombreTitular = obtenerNombreAgentePorId(reg.agente_titular_id);
                    const nombreCobertura = reg.agente_cobertura_id ? obtenerNombreAgentePorId(reg.agente_cobertura_id) : '';
                    const nombreVisible = nombreCobertura && nombreCobertura !== '-' ? nombreCobertura : nombreTitular;
                    const horarioVisible = limpiarMarcasInternasRegistroDiario(reg.horario_afectado) || obtenerHorarioPorTurnoRegistroDiario(reg.turno) || '';
                    const detalleDiario = [reg.turno || '', horarioVisible].filter(Boolean).join(' · ');
                    eventos.push(crearEventoCalendario({
                        tipo: 'diario',
                        categoria: 'Registro diario',
                        etiqueta: nombreVisible !== '-' ? nombreVisible : (reg.area || 'Diario'),
                        titulo: `${reg.area || 'Diario'} - ${nombreVisible}`,
                        detalle: detalleDiario,
                        clase: 'bg-emerald-50 text-emerald-700 border-emerald-100'
                    }));
                });

            notasCalendarioEnMemoria
                .filter(nota => nota.fecha === fechaISO)
                .forEach(nota => {
                    eventos.push(crearEventoCalendario({
                        tipo: 'nota',
                        categoria: 'Notas',
                        etiqueta: nota.titulo,
                        titulo: nota.titulo,
                        detalle: nota.detalle || 'Sin detalle.',
                        nota,
                        clase: obtenerClaseNotaCalendario(nota.color)
                    }));
                });

            return eventos;
        }

        function obtenerTurnosCalendarioPorFecha(fechaISO) {
            return (turnosCalendarioEnMemoria || [])
                .filter(turno => turno.fecha === fechaISO)
                .sort((a, b) => {
                    const areaA = esRegistroIdentificaciones(a) ? 'Identificaciones' : 'Call Center';
                    const areaB = esRegistroIdentificaciones(b) ? 'Identificaciones' : 'Call Center';
                    const ordenTurnos = { 'Mañana': 1, 'Tarde': 2, 'Noche': 3 };
                    return areaA.localeCompare(areaB) || ((ordenTurnos[a.turno] || 99) - (ordenTurnos[b.turno] || 99));
                });
        }

        function obtenerTurnosPorAreaYTurnoCalendario(fechaISO, area, turno) {
            return obtenerTurnosCalendarioPorFecha(fechaISO).filter(item => {
                const areaItem = esRegistroIdentificaciones(item) ? 'Identificaciones' : 'Call Center';
                return areaItem === area && item.turno === turno;
            });
        }

        function construirNombresTurnoCalendario(fechaISO, area, turno) {
            const nombres = obtenerTurnosPorAreaYTurnoCalendario(fechaISO, area, turno)
                .map(item => obtenerNombreAgentePorId(item.agente_id))
                .filter(nombre => nombre && nombre !== '-');

            if(nombres.length === 0) {
                return '<span class="text-slate-400 italic">Sin asignar</span>';
            }

            return nombres.map(nombre => `<div class="font-bold text-slate-800">${escaparHTML(nombre)}</div>`).join('');
        }

        function construirNombresSimplesTurnoCalendario(fechaISO, area, turno) {
            const nombres = obtenerTurnosPorAreaYTurnoCalendario(fechaISO, area, turno)
                .map(item => obtenerNombreAgentePorId(item.agente_id))
                .filter(nombre => nombre && nombre !== '-');

            if(nombres.length === 0) {
                return '<span class="text-slate-400 italic">Sin asignar</span>';
            }

            return nombres.map(nombre => `<div class="font-bold text-slate-800">${escaparHTML(nombre)}</div>`).join('');
        }

        function obtenerHorarioEncabezadoTurnoCalendario(fechaISO, area, turno, horarioBase) {
            const turnoGuardado = obtenerTurnosPorAreaYTurnoCalendario(fechaISO, area, turno)[0];
            if(turnoGuardado && typeof obtenerHorarioPersonalizadoPlanificador === 'function') {
                return obtenerHorarioPersonalizadoPlanificador(turnoGuardado) || horarioBase;
            }
            return horarioBase;
        }

        function construirCuadranteGuardiasCalendarioHTML(fechaISO) {
            const turnosFecha = obtenerTurnosCalendarioPorFecha(fechaISO);
            if(turnosFecha.length === 0) {
                return `<div class="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">No hay guardias planificadas para esta fecha.</div>`;
            }

            const labelFecha = `${obtenerDiaSemana(fechaISO)} ${formatearFechaSimple(fechaISO)}`;
            const hayCallCenter = turnosFecha.some(item => !esRegistroIdentificaciones(item));
            const hayIdentificaciones = turnosFecha.some(item => esRegistroIdentificaciones(item));
            const bloques = [];
            const horarioIdentManana = obtenerHorarioEncabezadoTurnoCalendario(fechaISO, 'Identificaciones', 'Mañana', '07:00 a 12:00 hs');
            const horarioIdentTarde = obtenerHorarioEncabezadoTurnoCalendario(fechaISO, 'Identificaciones', 'Tarde', '12:00 a 17:00 hs');

            if(hayCallCenter) {
                bloques.push(`
                    <div class="mb-3 last:mb-0 overflow-x-auto">
                        <div class="excel-header text-center font-bold text-xs py-2 uppercase tracking-wide border rounded-t-lg">
                            CAMPAÑA MITIC. Call Center
                        </div>
                        <table class="w-full min-w-[620px] border-collapse border border-slate-300 text-xs bg-white">
                            <thead>
                                <tr class="excel-sub font-semibold text-center">
                                    <th class="border border-slate-300 p-2 w-1/4">Horario</th>
                                    <th class="border border-slate-300 p-2 w-1/4">Turno Mañana<br><span class="text-[10px] font-normal">07:00 a 12:00 hs</span></th>
                                    <th class="border border-slate-300 p-2 w-1/4">Turno Tarde<br><span class="text-[10px] font-normal">12:00 a 17:00 hs</span></th>
                                    <th class="border border-slate-300 p-2 w-1/4">Turno Noche<br><span class="text-[10px] font-normal">17:00 a 22:00 hs</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td class="border border-slate-300 p-2 font-bold text-center bg-slate-50">${escaparHTML(labelFecha)}</td>
                                    <td class="border border-slate-300 p-2 text-center">${construirNombresTurnoCalendario(fechaISO, 'Call Center', 'Mañana')}</td>
                                    <td class="border border-slate-300 p-2 text-center">${construirNombresTurnoCalendario(fechaISO, 'Call Center', 'Tarde')}</td>
                                    <td class="border border-slate-300 p-2 text-center">${construirNombresTurnoCalendario(fechaISO, 'Call Center', 'Noche')}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                `);
            }

            if(hayIdentificaciones) {
                bloques.push(`
                    <div class="mb-3 last:mb-0 overflow-x-auto">
                        <div class="excel-header text-center font-bold text-xs py-2 uppercase tracking-wide border rounded-t-lg">
                            CAMPAÑA MITIC. Dpto de Identificaciones
                        </div>
                        <table class="w-full min-w-[520px] border-collapse border border-slate-300 text-xs bg-white">
                            <thead>
                                <tr class="excel-sub font-semibold text-center">
                                    <th class="border border-slate-300 p-2 w-1/3">Horario</th>
                                    <th class="border border-slate-300 p-2 w-1/3">Turno Mañana<br><span class="text-[10px] font-normal">${escaparHTML(horarioIdentManana)}</span></th>
                                    <th class="border border-slate-300 p-2 w-1/3">Turno Tarde<br><span class="text-[10px] font-normal">${escaparHTML(horarioIdentTarde)}</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td class="border border-slate-300 p-2 font-bold text-center bg-slate-50">${escaparHTML(labelFecha)}</td>
                                    <td class="border border-slate-300 p-2 text-center">${construirNombresSimplesTurnoCalendario(fechaISO, 'Identificaciones', 'Mañana')}</td>
                                    <td class="border border-slate-300 p-2 text-center">${construirNombresSimplesTurnoCalendario(fechaISO, 'Identificaciones', 'Tarde')}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                `);
            }

            return bloques.join('');
        }

        function obtenerItemsVisiblesCalendarioParaCelda(fechaISO, eventos) {
            const items = [];
            const guardias = eventos.filter(ev => ev.categoria === 'Guardias');
            if(guardias.length > 0) {
                items.push({
                    etiqueta: `Guardias: ${guardias.length}`,
                    clase: 'bg-amber-50 text-amber-700 border-amber-100'
                });
            }

            ['Ausencias', 'Notas'].forEach(categoria => {
                eventos
                    .filter(ev => ev.categoria === categoria)
                    .forEach(ev => items.push(ev));
            });

            return items;
        }


        function obtenerClaseNotaCalendario(color = 'azul') {
            const clases = {
                azul: 'bg-blue-50 text-blue-700 border-blue-100',
                violeta: 'bg-violet-50 text-violet-700 border-violet-100',
                verde: 'bg-emerald-50 text-emerald-700 border-emerald-100',
                amarillo: 'bg-amber-50 text-amber-700 border-amber-100',
                rojo: 'bg-rose-50 text-rose-700 border-rose-100'
            };
            return clases[color] || clases.azul;
        }

        function renderizarCalendarioOperativo() {
            const grid = document.getElementById('calendarioGrid');
            const titulo = document.getElementById('calendarioTituloMes');
            const resumen = document.getElementById('calendarioResumenMes');
            if(!grid) return;

            const { inicio } = obtenerInicioFinMesCalendario();
            const nombreMes = inicio.toLocaleDateString('es-PY', { month: 'long', year: 'numeric' });
            if(titulo) titulo.textContent = nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1);

            const primerDiaSemana = (inicio.getDay() + 6) % 7;
            const inicioGrid = new Date(inicio);
            inicioGrid.setDate(inicio.getDate() - primerDiaSemana);
            const hoyISO = obtenerFechaActualISO();
            const celdas = [];

            for(let i = 0; i < 42; i++) {
                const fecha = new Date(inicioGrid);
                fecha.setDate(inicioGrid.getDate() + i);
                const fechaISO = formatearFechaISODesdeDateLocal(fecha);
                const esMesActual = fecha.getMonth() === inicio.getMonth();
                const eventos = obtenerEventosCalendarioPorFecha(fechaISO);
                const itemsCelda = obtenerItemsVisiblesCalendarioParaCelda(fechaISO, eventos);
                const eventosVisibles = itemsCelda.slice(0, 4);
                const extras = itemsCelda.length - eventosVisibles.length;
                const esHoy = fechaISO === hoyISO;

                celdas.push(`
                    <button type="button" onclick="abrirDetalleDiaCalendario('${fechaISO}')" class="min-h-[132px] sm:min-h-[156px] text-left border rounded-lg p-2.5 transition hover:shadow-md hover:border-violet-300 ${esMesActual ? 'bg-white' : 'bg-slate-50 text-slate-400'} ${esHoy ? 'ring-2 ring-violet-500 border-violet-300' : 'border-slate-200'}">
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-sm font-black ${esMesActual ? 'text-slate-800' : 'text-slate-400'}">${fecha.getDate()}</span>
                            ${esHoy ? '<span class="text-[10px] font-black px-2 py-0.5 rounded-full bg-violet-600 text-white">Hoy</span>' : ''}
                        </div>
                        <div class="space-y-1">
                            ${eventosVisibles.map(ev => `<div class="border ${ev.clase} rounded px-2 py-1 text-[11px] font-bold truncate">${escaparHTML(ev.etiqueta)}</div>`).join('')}
                            ${extras > 0 ? `<div class="text-[11px] font-bold text-slate-400 px-1">+${extras} mas</div>` : ''}
                        </div>
                    </button>
                `);
            }

            grid.innerHTML = celdas.join('');
            grid.dataset.calendarioRenderizado = '1';
            if(resumen) resumen.textContent = '';
        }

        function cerrarDetalleCalendario() {
            document.getElementById('modalCalendario')?.classList.add('hidden');
        }

        window.abrirDetalleDiaCalendario = function(fechaISO) {
            fechaCalendarioSeleccionada = fechaISO;
            const modal = document.getElementById('modalCalendario');
            const titulo = document.getElementById('modalCalendarioTitulo');
            const contenido = document.getElementById('modalCalendarioContenido');
            if(!modal || !contenido) return;

            if(titulo) titulo.textContent = `${obtenerDiaSemana(fechaISO)} ${formatearFechaSimple(fechaISO)}`;
            contenido.innerHTML = construirDetalleDiaCalendarioHTML(fechaISO);
            modal.classList.remove('hidden');
        }

        function construirDetalleDiaCalendarioHTML(fechaISO) {
            const eventos = obtenerEventosCalendarioPorFecha(fechaISO);
            const orden = ['Ausencias', 'Guardias', 'Registro diario', 'Notas'];
            if(eventos.length === 0) {
                return `<div class="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">Sin datos cargados para esta fecha.</div>`;
            }

            return orden.map((categoria, index) => {
                const items = eventos.filter(ev => ev.categoria === categoria);
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
        }

        function construirItemDetalleCalendario(ev) {
            const detalle = escaparHTML(ev.detalle || '').replace(/\n/g, '<span class="mx-1 text-slate-300">|</span>');
            const accionesNota = ev.tipo === 'nota' && ev.nota ? `
                <div class="flex shrink-0 gap-1">
                    <button type="button" onclick="editarNotaCalendario(${ev.nota.id})" class="bg-white hover:bg-slate-50 border text-slate-700 font-bold px-2 py-0.5 rounded text-[10px] transition">Editar</button>
                    <button type="button" onclick="eliminarNotaCalendario(${ev.nota.id})" class="bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold px-2 py-0.5 rounded text-[10px] transition">Eliminar</button>
                </div>
            ` : '';

            return `
                <article class="border-l-4 ${ev.clase} px-2 py-1.5">
                    <div class="flex items-start justify-between gap-2">
                        <div class="min-w-0 flex-1">
                            <div class="font-extrabold text-xs leading-tight">${escaparHTML(ev.titulo)}</div>
                            ${detalle ? `<div class="mt-0.5 text-[11px] leading-tight opacity-85">${detalle}</div>` : ''}
                        </div>
                        ${accionesNota}
                    </div>
                </article>
            `;
        }
        async function abrirFormularioNotaCalendario(fechaISO, notaExistente = null) {
            const titulo = await mostrarModalTexto({
                titulo: notaExistente ? `Editar nota del ${formatearFechaSimple(fechaISO)}` : `Nota para ${formatearFechaSimple(fechaISO)}`,
                subtitulo: 'Este titulo corto se vera en el recuadro del calendario.',
                valorInicial: notaExistente?.titulo || '',
                placeholder: 'Ej: revisar cobertura de la tarde',
                textoAceptar: 'Siguiente'
            });
            if(!titulo || !titulo.trim()) return;

            const detalle = await mostrarModalTexto({
                titulo: 'Detalle de la nota',
                subtitulo: 'Este texto aparece al abrir el dia.',
                valorInicial: notaExistente?.detalle || '',
                placeholder: 'Detalle o recordatorio...',
                textoAceptar: notaExistente ? 'Actualizar nota' : 'Guardar nota'
            });
            if(detalle === null) return;

            const payload = {
                fecha: fechaISO,
                titulo: titulo.trim(),
                detalle: detalle ? detalle.trim() : null,
                color: notaExistente?.color || 'violeta',
                actualizado_en: new Date().toISOString()
            };

            const resultado = notaExistente
                ? await supabaseClient.from(TABLAS.NOTAS_CALENDARIO).update(payload).eq('id', notaExistente.id)
                : await supabaseClient.from(TABLAS.NOTAS_CALENDARIO).insert([payload]);

            if(resultado.error) {
                console.error('Error guardando nota del calendario:', resultado.error);
                mostrarToast('No se pudo guardar la nota del calendario.', 'error');
                return;
            }

            mostrarToast(notaExistente ? 'Nota actualizada.' : 'Nota agregada al calendario.', 'success');
            await cargarDatosCalendario();
            abrirDetalleDiaCalendario(fechaISO);
        }

        window.editarNotaCalendario = async function(id) {
            const nota = notasCalendarioEnMemoria.find(n => n.id == id);
            if(!nota) {
                mostrarToast('No se encontro la nota para editar.', 'warning');
                return;
            }
            await abrirFormularioNotaCalendario(nota.fecha, nota);
        }

        window.eliminarNotaCalendario = async function(id) {
            const nota = notasCalendarioEnMemoria.find(n => n.id == id);
            if(!nota) {
                mostrarToast('No se encontro la nota para eliminar.', 'warning');
                return;
            }

            const confirmar = await mostrarConfirmacionModerna({
                titulo: 'Eliminar nota',
                mensaje: `¿Seguro que querés eliminar la nota "${nota.titulo}" del ${formatearFechaSimple(nota.fecha)}?`,
                textoAceptar: 'Eliminar',
                tipo: 'danger'
            });
            if(!confirmar) return;

            const { error } = await supabaseClient
                .from(TABLAS.NOTAS_CALENDARIO)
                .delete()
                .eq('id', id);

            if(error) {
                console.error('Error eliminando nota del calendario:', error);
                mostrarToast('No se pudo eliminar la nota.', 'error');
                return;
            }

            mostrarToast('Nota eliminada.', 'success');
            await cargarDatosCalendario();
            abrirDetalleDiaCalendario(nota.fecha);
        }
