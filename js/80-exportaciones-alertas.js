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
                        // Si hay más de un agente en el mismo turno, se listan todos:
                        // antes se sobrescribía la celda y quedaba solo el último.
                        const agregarEnCelda = (indice, nombre) => {
                            rowData[indice] = rowData[indice] ? `${rowData[indice]}, ${nombre}` : nombre;
                        };
                        registros.filter(r => r.fecha === fecha).forEach(r => {
                            const nombre = obtenerNombreAgentePorId(r.agente_id);
                            if (r.turno === 'Mañana') agregarEnCelda(1, nombre);
                            if (r.turno === 'Tarde') agregarEnCelda(2, nombre);
                            if (r.turno === 'Noche') agregarEnCelda(3, nombre);
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
