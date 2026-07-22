        // 13) EXPORTACIÓN DE IMAGEN PARA WHATSAPP
        // ============================================================
        // Convertir la tabla en imagen limpia para WhatsApp
        document.getElementById('btnExportar')?.addEventListener('click', () => {
            const btn = document.getElementById('btnExportar');
            const target = document.getElementById('tabla-guardia');
            if(!btn || !target) return;

            btn.innerText = '📸 Generando...';
            btn.disabled = true;

            document.querySelectorAll('.temp-text').forEach(span => span.remove());
            document.querySelectorAll('.no-captura-whatsapp').forEach(el => el.classList.add('hidden'));

            document.querySelectorAll('.agente-select').forEach(select => {
                const container = select.parentElement;
                const textSpan = document.createElement('span');
                textSpan.className = 'temp-text font-medium text-center block w-full text-gray-900';
                textSpan.innerText = select.selectedIndex >= 0 && select.value !== '' ? select.options[select.selectedIndex].text : '';
                select.classList.add('hidden');
                container.appendChild(textSpan);
            });

            document.querySelectorAll('.horario-planificador-input').forEach(input => {
                const container = input.parentElement;
                const textSpan = document.createElement('span');
                textSpan.className = 'temp-text block w-full text-center text-xs font-normal text-emerald-950';
                const horario = input.value || input.placeholder || '';
                textSpan.innerText = typeof formatearHorarioPlanificador === 'function'
                    ? formatearHorarioPlanificador(horario)
                    : (typeof formatearHorarioIdentificacionesPlanificador === 'function'
                        ? formatearHorarioIdentificacionesPlanificador(horario)
                        : horario);
                input.classList.add('hidden');
                container.appendChild(textSpan);
            });

            setTimeout(() => {
                html2canvas(target, {
                    scale: 2,
                    useCORS: true,
                    logging: false
                }).then(canvas => {
                    const link = document.createElement('a');
                    link.download = `Planificacion_MITIC_${document.getElementById('fechaSabado')?.value || 'FinDeSemana'}.png`;
                    link.href = canvas.toDataURL('image/png');
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                }).catch(err => {
                    console.error('Error al exportar imagen:', err);
                    mostrarToast('No se pudo generar la imagen.', 'error');
                }).finally(() => {
                    document.querySelectorAll('.temp-text').forEach(span => span.remove());
                    document.querySelectorAll('.agente-select').forEach(select => select.classList.remove('hidden'));
                    document.querySelectorAll('.horario-planificador-input').forEach(input => input.classList.remove('hidden'));
                    document.querySelectorAll('.no-captura-whatsapp').forEach(el => el.classList.remove('hidden'));
                    btn.innerText = '📸 Descargar para WhatsApp';
                    btn.disabled = false;
                });
            }, 100);
        });

        // ============================================================
        // 14) ALERTAS OPERATIVAS
        // ============================================================
        // Alerta de turnos consecutivos (Sábado noche + Domingo mañana)
        function verificarTurnosConsecutivos() {
            const alertaDiv = document.getElementById('alertas');
            const alertaMsg = document.getElementById('alerta-mensaje');

            if (!alertaDiv || !alertaMsg) return;

            const sabado = diasPlanificados.find(d => d.tipo === 'sabado');
            const domingo = diasPlanificados.find(d => d.tipo === 'domingo');

            if (sabado && domingo) {
                const selectSabNoche = document.getElementById(`cc_${sabado.fecha}_Noche`);
                const selectDomManana = document.getElementById(`cc_${domingo.fecha}_Mañana`);

                if (selectSabNoche && selectDomManana && selectSabNoche.value && selectSabNoche.value === selectDomManana.value) {
                    const nombre = selectSabNoche.options[selectSabNoche.selectedIndex].text;
                    alertaMsg.innerText = `${nombre} está asignado el Sábado a la Noche y Domingo a la Mañana consecutivamente en Call Center. Recordar asignarle libre el viernes.`;
                    alertaDiv.classList.remove('hidden');
                } else {
                    alertaDiv.classList.add('hidden');
                }
            } else {
                alertaDiv.classList.add('hidden');
            }
        }

        // ============================================================
        // 15) EXPORTACIÓN A EXCEL
        // ============================================================
        // Visibilidad de controles del panel de reportes Excel
        function toggleExportInputs() {
            const type = document.getElementById('exportFilterType')?.value || 'all';
            document.getElementById('divExportFecha')?.classList.add('hidden');
            document.getElementById('divExportRango')?.classList.add('hidden');
            document.getElementById('divExportMes')?.classList.add('hidden');
            document.getElementById('divExportAnio')?.classList.add('hidden');

            if (type === 'date') document.getElementById('divExportFecha')?.classList.remove('hidden');
            if (type === 'range') document.getElementById('divExportRango')?.classList.remove('hidden');
            if (type === 'month') document.getElementById('divExportMes')?.classList.remove('hidden');
            if (type === 'year') document.getElementById('divExportAnio')?.classList.remove('hidden');
        }

        function formatearFechaExcel(fechaStr) {
            if(!fechaStr) return '';
            const parts = fechaStr.split('-');
            return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : fechaStr;
        }

        function obtenerEtiquetaFiltroExcel(type) {
            if (type === 'all') return 'Todas las guardias';
            if (type === 'date') return `Fecha específica: ${formatearFechaExcel(document.getElementById('exportFecha')?.value || '')}`;
            if (type === 'range') return `Rango: ${formatearFechaExcel(document.getElementById('exportDesde')?.value || '')} al ${formatearFechaExcel(document.getElementById('exportHasta')?.value || '')}`;
            if (type === 'month') return `Mes: ${document.getElementById('exportMes')?.value || '-'}`;
            if (type === 'year') return `Año: ${document.getElementById('exportAnio')?.value || '-'}`;
            return type;
        }

        // Generar y descargar reporte estructurado en Excel
        async function exportarGuardiasExcel() {
            const type = document.getElementById('exportFilterType')?.value || 'all';
            let query = supabaseClient
                .from(TABLAS.TURNOS)
                .select('fecha, turno, modalidad, sucursal, agente_id')
                .order('fecha', { ascending: true });

            if (type === 'date') {
                const fecha = document.getElementById('exportFecha')?.value;
                if (!fecha) return mostrarToast('Por favor, selecciona una fecha.', 'warning');
                query = query.eq('fecha', fecha);
            } else if (type === 'range') {
                const desde = document.getElementById('exportDesde')?.value;
                const hasta = document.getElementById('exportHasta')?.value;
                if (!desde || !hasta) return mostrarToast('Por favor, selecciona ambas fechas del rango.', 'warning');
                query = query.gte('fecha', desde).lte('fecha', hasta);
            } else if (type === 'month') {
                const mesInput = document.getElementById('exportMes')?.value;
                if (!mesInput) return mostrarToast('Por favor, selecciona un mes.', 'warning');
                const [anio, mes] = mesInput.split('-');
                const primerDia = `${anio}-${mes}-01`;
                const ultimoDia = new Date(anio, mes, 0).toISOString().split('T')[0];
                query = query.gte('fecha', primerDia).lte('fecha', ultimoDia);
            } else if (type === 'year') {
                const anio = document.getElementById('exportAnio')?.value;
                if (!anio) return mostrarToast('Por favor, ingresa el año.', 'warning');
                query = query.gte('fecha', `${anio}-01-01`).lte('fecha', `${anio}-12-31`);
            }

            const { data, error } = await query;
            if (error) {
                console.error('Error en exportación:', error);
                return mostrarToast('Hubo un error al extraer los datos históricos.', 'error');
            }
            if (!data || data.length === 0) {
                return mostrarToast('No se encontraron guardias registradas para el período seleccionado.', 'warning');
            }

            const callCenterRows = [];
            const identificacionesRows = [];
            data.forEach(row => {
                if (esRegistroIdentificaciones(row)) identificacionesRows.push(row);
                else callCenterRows.push(row);
            });

            const ordenTurnos = { 'Mañana': 1, 'Tarde': 2, 'Noche': 3 };
            const ordenarPorFechaYHorario = (a, b) => {
                if (a.fecha !== b.fecha) return a.fecha.localeCompare(b.fecha);
                return (ordenTurnos[a.turno] || 0) - (ordenTurnos[b.turno] || 0);
            };
            callCenterRows.sort(ordenarPorFechaYHorario);
            identificacionesRows.sort(ordenarPorFechaYHorario);

            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'Gestor de Guardias MITIC';
            workbook.created = new Date();
            const worksheet = workbook.addWorksheet('Historial Guardias');
            worksheet.views = [{ showGridLines: false, state: 'frozen', ySplit: 3 }];
            worksheet.properties.defaultRowHeight = 20;
            worksheet.pageSetup = {
                orientation: 'landscape',
                fitToPage: true,
                fitToWidth: 1,
                fitToHeight: 0,
                margins: { left: 0.3, right: 0.3, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 }
            };

            const mainTitleRow = worksheet.addRow(['CAMPAÑA MITIC - HISTORIAL DE GUARDIAS']);
            mainTitleRow.height = 32;
            worksheet.mergeCells(`A${mainTitleRow.number}:F${mainTitleRow.number}`);
            const mainTitleCell = mainTitleRow.getCell(1);
            mainTitleCell.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FF000000' } };
            mainTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF59E0B' } };
            mainTitleCell.alignment = { vertical: 'middle', horizontal: 'center' };

            worksheet.addRow([]);
            worksheet.addRow(['Generado:', new Date().toLocaleString('es-PY'), 'Filtro:', obtenerEtiquetaFiltroExcel(type), 'Total registros:', data.length]);
            worksheet.addRow(['Call Center:', callCenterRows.length, 'Identificaciones:', identificacionesRows.length, 'Total:', callCenterRows.length + identificacionesRows.length]);
            worksheet.addRow([]);

            function estilizarFila(row, fill = null, bold = false) {
                row.eachCell(cell => {
                    cell.font = { name: 'Segoe UI', size: 10, bold, color: { argb: 'FF111827' } };
                    if(fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
                    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                    cell.border = {
                        top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
                        bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
                        left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
                        right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
                    };
                });
            }

            function generarTablaModulo(tituloModulo, registros, esCallCenter) {
                const maxCol = esCallCenter ? 4 : 6;
                const colLetra = String.fromCharCode(64 + maxCol);
                const modTitleRow = worksheet.addRow([tituloModulo]);
                modTitleRow.height = 26;
                worksheet.mergeCells(`A${modTitleRow.number}:${colLetra}${modTitleRow.number}`);
                const modTitleCell = modTitleRow.getCell(1);
                modTitleCell.font = { name: 'Segoe UI', size: 12, bold: true, color: { argb: 'FF000000' } };
                modTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF59E0B' } };
                modTitleCell.alignment = { vertical: 'middle', horizontal: 'center' };

                const headers = esCallCenter
                    ? ['Fecha', 'Turno Mañana', 'Turno Tarde', 'Turno Noche']
                    : ['Fecha', 'Agente', 'Sucursal', 'Modalidad', 'Turno', 'Observación'];
                const headerRow = worksheet.addRow(headers);
                estilizarFila(headerRow, 'FFFFF2CC', true);

                if (esCallCenter) {
                    const fechas = [...new Set(registros.map(r => r.fecha))];
                    fechas.forEach(fecha => {
                        const rowData = [formatearFechaExcel(fecha), '', '', ''];
                        registros.filter(r => r.fecha === fecha).forEach(r => {
                            const nombre = obtenerNombreAgentePorId(r.agente_id);
                            if (r.turno === 'Mañana') rowData[1] = nombre;
                            if (r.turno === 'Tarde') rowData[2] = nombre;
                            if (r.turno === 'Noche') rowData[3] = nombre;
                        });
                        estilizarFila(worksheet.addRow(rowData));
                    });
                } else {
                    registros.forEach(r => {
                        estilizarFila(worksheet.addRow([
                            formatearFechaExcel(r.fecha),
                            obtenerNombreAgentePorId(r.agente_id),
                            r.sucursal || '-',
                            r.modalidad || '-',
                            r.turno || '-',
                            'Guardia Identificaciones'
                        ]));
                    });
                }
                worksheet.addRow([]);
            }

            generarTablaModulo('CAMPAÑA MITIC. CALL CENTER', callCenterRows, true);
            generarTablaModulo('CAMPAÑA MITIC. DPTO DE IDENTIFICACIONES', identificacionesRows, false);
            worksheet.columns = [{ width: 18 }, { width: 28 }, { width: 28 }, { width: 24 }, { width: 18 }, { width: 26 }];

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `Historial_Guardias_${new Date().toISOString().split('T')[0]}.xlsx`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            mostrarToast('Excel descargado correctamente.', 'success');
        }

        // ============================================================
        // 15.1) AJUSTES TEMPORALES DE INTERFAZ Y NOTAS DEL CALENDARIO
        // ============================================================
        const COLORES_NOTAS_CALENDARIO = [
            { id: 'violeta', nombre: 'Violeta', clase: 'bg-violet-600 text-white border-violet-700 shadow-sm', punto: 'bg-white/90 ring-2 ring-white/60' },
            { id: 'azul', nombre: 'Azul', clase: 'bg-blue-600 text-white border-blue-700 shadow-sm', punto: 'bg-white/90 ring-2 ring-white/60' },
            { id: 'celeste', nombre: 'Celeste', clase: 'bg-cyan-500 text-white border-cyan-600 shadow-sm', punto: 'bg-white/90 ring-2 ring-white/60' },
            { id: 'verde', nombre: 'Verde', clase: 'bg-emerald-600 text-white border-emerald-700 shadow-sm', punto: 'bg-white/90 ring-2 ring-white/60' },
            { id: 'amarillo', nombre: 'Amarillo', clase: 'bg-yellow-400 text-yellow-950 border-yellow-500 shadow-sm', punto: 'bg-yellow-950' },
            { id: 'naranja', nombre: 'Naranja', clase: 'bg-orange-500 text-white border-orange-600 shadow-sm', punto: 'bg-white/90 ring-2 ring-white/60' },
            { id: 'rojo', nombre: 'Rojo', clase: 'bg-red-600 text-white border-red-700 shadow-sm', punto: 'bg-white/90 ring-2 ring-white/60' },
            { id: 'fucsia', nombre: 'Fucsia', clase: 'bg-fuchsia-600 text-white border-fuchsia-700 shadow-sm', punto: 'bg-white/90 ring-2 ring-white/60' },
            { id: 'gris', nombre: 'Gris', clase: 'bg-slate-600 text-white border-slate-700 shadow-sm', punto: 'bg-white/90 ring-2 ring-white/60' }
        ];

        obtenerClaseNotaCalendario = function(color = 'violeta') {
            const item = COLORES_NOTAS_CALENDARIO.find(opcion => opcion.id === color);
            return item ? item.clase : COLORES_NOTAS_CALENDARIO[0].clase;
        };

        function mostrarSelectorColorNotaCalendario(colorActual = 'violeta') {
            return new Promise(resolve => {
                let colorSeleccionado = COLORES_NOTAS_CALENDARIO.some(opcion => opcion.id === colorActual) ? colorActual : 'violeta';
                const backdrop = document.createElement('div');
                backdrop.className = 'fixed inset-0 z-[95] bg-slate-900/45 flex items-center justify-center p-4';
                backdrop.innerHTML = `
                    <div class="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
                        <div class="px-5 py-4 border-b bg-slate-50">
                            <h3 class="text-base font-black text-slate-900">Elegir color de la nota</h3>
                            <p class="text-xs text-slate-500 mt-1">Este color se verá en el calendario y en el detalle del día.</p>
                        </div>
                        <div class="p-4 grid grid-cols-2 sm:grid-cols-3 gap-2" id="selectorColorNotaOpciones">
                            ${COLORES_NOTAS_CALENDARIO.map(opcion => `
                                <button type="button" data-color="${opcion.id}" class="color-nota-opcion border ${opcion.clase} rounded-xl px-3 py-2 text-xs font-black flex items-center gap-2 hover:scale-[1.02] transition ${opcion.id === colorSeleccionado ? 'ring-2 ring-slate-900 ring-offset-2' : ''}">
                                    <span class="w-3 h-3 rounded-full ${opcion.punto}"></span>
                                    ${opcion.nombre}
                                </button>
                            `).join('')}
                        </div>
                        <div class="px-5 py-3 bg-slate-50 border-t flex justify-end gap-2">
                            <button type="button" id="btnCancelarColorNota" class="bg-white hover:bg-slate-100 border text-slate-700 font-bold px-4 py-2 rounded-lg text-xs transition">Cancelar</button>
                            <button type="button" id="btnAceptarColorNota" class="bg-violet-600 hover:bg-violet-700 text-white font-bold px-4 py-2 rounded-lg text-xs transition">Usar color</button>
                        </div>
                    </div>
                `;
                document.body.appendChild(backdrop);

                const cerrar = valor => {
                    backdrop.remove();
                    resolve(valor);
                };

                backdrop.querySelectorAll('[data-color]').forEach(btn => {
                    btn.addEventListener('click', () => {
                        colorSeleccionado = btn.dataset.color;
                        backdrop.querySelectorAll('[data-color]').forEach(item => item.classList.remove('ring-2', 'ring-slate-900', 'ring-offset-2'));
                        btn.classList.add('ring-2', 'ring-slate-900', 'ring-offset-2');
                    });
                });
                backdrop.querySelector('#btnCancelarColorNota')?.addEventListener('click', () => cerrar(null));
                backdrop.querySelector('#btnAceptarColorNota')?.addEventListener('click', () => cerrar(colorSeleccionado));
                backdrop.addEventListener('click', e => {
                    if(e.target === backdrop) cerrar(null);
                });
            });
        }

        abrirFormularioNotaCalendario = async function(fechaISO, notaExistente = null) {
            const titulo = await mostrarModalTexto({
                titulo: notaExistente ? `Editar nota del ${formatearFechaSimple(fechaISO)}` : `Nota para ${formatearFechaSimple(fechaISO)}`,
                subtitulo: 'Este título corto se verá en el recuadro del calendario.',
                valorInicial: notaExistente?.titulo || '',
                placeholder: 'Ej: revisar cobertura de la tarde',
                textoAceptar: 'Siguiente'
            });
            if(!titulo || !titulo.trim()) return;

            const detalle = await mostrarModalTexto({
                titulo: 'Detalle de la nota',
                subtitulo: 'Este texto aparece al abrir el día.',
                valorInicial: notaExistente?.detalle || '',
                placeholder: 'Detalle o recordatorio...',
                textoAceptar: 'Elegir color'
            });
            if(detalle === null) return;

            const color = await mostrarSelectorColorNotaCalendario(notaExistente?.color || 'violeta');
            if(color === null) return;

            const payload = {
                fecha: fechaISO,
                titulo: titulo.trim(),
                detalle: detalle ? detalle.trim() : null,
                color: color || 'violeta',
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
        };

        window.editarNotaCalendario = async function(id) {
            const nota = notasCalendarioEnMemoria.find(n => n.id == id);
            if(!nota) {
                mostrarToast('No se encontró la nota para editar.', 'warning');
                return;
            }
            await abrirFormularioNotaCalendario(nota.fecha, nota);
        };

        function retirarTemporalmentePestanasNovedadesDiario() {
            const styleId = 'retirar-tabs-novedades-diario-v50';
            if(!document.getElementById(styleId)) {
                const style = document.createElement('style');
                style.id = styleId;
                style.textContent = `
                    button[onclick*="tab-novedades"],
                    button[onclick*="tab-diario"],
                    #tab-novedades,
                    #tab-diario {
                        display: none !important;
                    }
                `;
                document.head.appendChild(style);
            }

            document.querySelectorAll('button[onclick*="tab-novedades"], button[onclick*="tab-diario"]').forEach(btn => {
                btn.setAttribute('aria-hidden', 'true');
                btn.tabIndex = -1;
            });

            ['tab-novedades', 'tab-diario'].forEach(tabId => {
                const tab = document.getElementById(tabId);
                if(tab) {
                    tab.classList.add('hidden');
                    tab.dataset.retiradoTemporalmente = 'true';
                }
            });
        }

        retirarTemporalmentePestanasNovedadesDiario();

        const activarPestanaOriginalV50 = typeof activarPestaña === 'function' ? activarPestaña : null;
        if(activarPestanaOriginalV50) {
            activarPestaña = function(tabId) {
                if(tabId === 'tab-novedades' || tabId === 'tab-diario') {
                    return activarPestanaOriginalV50('tab-cuadrante');
                }
                const resultado = activarPestanaOriginalV50(tabId);
                retirarTemporalmentePestanasNovedadesDiario();
                return resultado;
            };
        }
