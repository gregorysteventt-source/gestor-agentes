        // 13) EXPORTACIÓN DE IMAGEN PARA WHATSAPP
        // ============================================================
        // Convertir la tabla en imagen limpia para WhatsApp
        document.getElementById('btnExportar').addEventListener('click', () => {
            const btn = document.getElementById('btnExportar');
            const target = document.getElementById('tabla-guardia');

            btn.innerText = "📸 Generando...";
            btn.disabled = true;

            document.querySelectorAll('.temp-text').forEach(span => span.remove());
            document.querySelectorAll('.no-captura-whatsapp').forEach(el => el.classList.add('hidden'));

            document.querySelectorAll('.agente-select').forEach(select => {
                const container = select.parentElement;
                const textSpan = document.createElement('span');
                textSpan.className = 'temp-text font-medium text-center block w-full text-gray-900';
                textSpan.innerText = select.selectedIndex >= 0 && select.value !== "" ? select.options[select.selectedIndex].text : '';
                select.classList.add('hidden');
                container.appendChild(textSpan);
            });

            setTimeout(() => {
                html2canvas(target, {
                    scale: 2,
                    useCORS: true,
                    logging: false
                }).then(canvas => {
                    const link = document.createElement('a');
                    link.download = `Planificacion_MITIC_${document.getElementById('fechaSabado').value || 'FinDeSemana'}.png`;
                    link.href = canvas.toDataURL('image/png');
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                }).catch(err => {
                    console.error("Error al exportar imagen:", err);
                }).finally(() => {
                    document.querySelectorAll('.temp-text').forEach(span => span.remove());
                    document.querySelectorAll('.agente-select').forEach(select => select.classList.remove('hidden'));
                    document.querySelectorAll('.no-captura-whatsapp').forEach(el => el.classList.remove('hidden'));
                    btn.innerText = "📸 Descargar para WhatsApp";
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

            // Ubicar sábados y domingos en la lista planificada
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
            const type = document.getElementById('exportFilterType').value;
            
            document.getElementById('divExportFecha').classList.add('hidden');
            document.getElementById('divExportRango').classList.add('hidden');
            document.getElementById('divExportMes').classList.add('hidden');
            document.getElementById('divExportAnio').classList.add('hidden');

            if (type === 'date') document.getElementById('divExportFecha').classList.remove('hidden');
            if (type === 'range') document.getElementById('divExportRango').classList.remove('hidden');
            if (type === 'month') document.getElementById('divExportMes').classList.remove('hidden');
            if (type === 'year') document.getElementById('divExportAnio').classList.remove('hidden');
        }

        function formatearFechaExcel(fechaStr) {
            if(!fechaStr) return '';
            const parts = fechaStr.split('-');
            return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : fechaStr;
        }

        function obtenerEtiquetaFiltroExcel(type) {
            if (type === 'all') return 'Todas las guardias';
            if (type === 'date') return `Fecha específica: ${formatearFechaExcel(document.getElementById('exportFecha').value)}`;
            if (type === 'range') return `Rango: ${formatearFechaExcel(document.getElementById('exportDesde').value)} al ${formatearFechaExcel(document.getElementById('exportHasta').value)}`;
            if (type === 'month') return `Mes: ${document.getElementById('exportMes').value || '-'}`;
            if (type === 'year') return `Año: ${document.getElementById('exportAnio').value || '-'}`;
            return type;
        }

        // Generar y descargar reporte estructurado en Excel
        async function exportarGuardiasExcel() {
            const type = document.getElementById('exportFilterType').value;
            
            let query = supabaseClient
                .from(TABLAS.TURNOS)
                .select('fecha, turno, modalidad, sucursal, agente_id')
                .order('fecha', { ascending: true });

            if (type === 'date') {
                const fecha = document.getElementById('exportFecha').value;
                if (!fecha) return mostrarToast('Por favor, selecciona una fecha.', 'warning');
                query = query.eq('fecha', fecha);
            } 
            else if (type === 'range') {
                const desde = document.getElementById('exportDesde').value;
                const hasta = document.getElementById('exportHasta').value;
                if (!desde || !hasta) return mostrarToast('Por favor, selecciona ambas fechas del rango.', 'warning');
                query = query.gte('fecha', desde).lte('fecha', hasta);
            } 
            else if (type === 'month') {
                const mesInput = document.getElementById('exportMes').value; 
                if (!mesInput) return mostrarToast('Por favor, selecciona un mes.', 'warning');
                const [anio, mes] = mesInput.split('-');
                const primerDia = `${anio}-${mes}-01`;
                const ultimoDia = new Date(anio, mes, 0).toISOString().split('T')[0];
                query = query.gte('fecha', primerDia).lte('fecha', ultimoDia);
            } 
            else if (type === 'year') {
                const anio = document.getElementById('exportAnio').value;
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
                if (esRegistroIdentificaciones(row)) {
                    identificacionesRows.push(row);
                } else {
                    callCenterRows.push(row);
                }
            });

            const ordenTurnos = { 'Mañana': 1, 'Tarde': 2, 'Noche': 3 };
            const ordenarPorFechaYHorario = (a, b) => {
                if (a.fecha !== b.fecha) {
                    return a.fecha.localeCompare(b.fecha);
                }
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

            // Título Principal en el Excel
            const mainTitleRow = worksheet.addRow(['CAMPAÑA MITIC - HISTORIAL DE GUARDIAS']);
            mainTitleRow.height = 32;
            worksheet.mergeCells(`A${mainTitleRow.number}:F${mainTitleRow.number}`);
            const mainTitleCell = mainTitleRow.getCell(1);
            mainTitleCell.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FF000000' } };
            mainTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF59E0B' } };
            mainTitleCell.alignment = { vertical: 'middle', horizontal: 'center' };

            worksheet.addRow([]);

            const metadataRow = worksheet.addRow([
                'Generado:',
                new Date().toLocaleString('es-PY'),
                'Filtro:',
                obtenerEtiquetaFiltroExcel(type),
                'Total registros:',
                data.length
            ]);
            metadataRow.height = 22;
            metadataRow.eachCell((cell) => {
                cell.font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: 'FF4B5563' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                    bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                    left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                    right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
                };
            });

            const resumenRow = worksheet.addRow([
                'Call Center:',
                callCenterRows.length,
                'Identificaciones:',
                identificacionesRows.length,
                'Total:',
                callCenterRows.length + identificacionesRows.length
            ]);
            resumenRow.height = 22;
            resumenRow.eachCell((cell, colNumber) => {
                cell.font = { name: 'Segoe UI', size: 10, bold: colNumber % 2 === 1, color: { argb: 'FF111827' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFD1FAE5' } },
                    bottom: { style: 'thin', color: { argb: 'FFD1FAE5' } },
                    left: { style: 'thin', color: { argb: 'FFD1FAE5' } },
                    right: { style: 'thin', color: { argb: 'FFD1FAE5' } }
                };
            });

            worksheet.addRow([]);

            // Generador de tablas con el formato Excel solicitado por módulos
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
                    ? ['Fecha', 'Día', 'Horario', 'Agente Asignado']
                    : ['Fecha', 'Día', 'Horario', 'Modalidad / Área', 'Sucursal', 'Agente Asignado'];
                
                const headerRow = worksheet.addRow(headers);
                headerRow.height = 24;

                headers.forEach((h, index) => {
                    const cell = headerRow.getCell(index + 1);
                    cell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FF000000' } };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
                    cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    cell.border = {
                        top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
                        bottom: { style: 'medium', color: { argb: 'FFF59E0B' } },
                        left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
                        right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
                    };
                });

                if (registros.length === 0) {
                    const noDataRow = worksheet.addRow(['Sin registros para esta sección en el período seleccionado']);
                    noDataRow.height = 22;
                    worksheet.mergeCells(`A${noDataRow.number}:${colLetra}${noDataRow.number}`);
                    const noDataCell = noDataRow.getCell(1);
                    noDataCell.font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: 'FF9CA3AF' } };
                    noDataCell.alignment = { vertical: 'middle', horizontal: 'center' };
                    noDataCell.border = {
                        top: { style: 'thin', color: { argb: 'FFE5E7EB' } }, bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                        left: { style: 'thin', color: { argb: 'FFE5E7EB' } }, right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
                    };
                    return;
                }

                registros.forEach((row, rowIndex) => {
                    const agente = agentesEnMemoria.find(a => a.id == row.agente_id);
                    const nombreAgente = agente ? agente.nombre_corto : 'No asignado';

                    const d = new Date(row.fecha + "T00:00:00");
                    const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
                    const nombreDia = dias[d.getDay()];

                    let horarioFormateado = row.turno;
                    if (row.turno === 'Mañana') horarioFormateado = '07:00 a 12:00 hs';
                    else if (row.turno === 'Tarde') horarioFormateado = '12:00 a 17:00 hs';
                    else if (row.turno === 'Noche') horarioFormateado = '17:00 a 22:00 hs';

                    let rowData = [];
                    if (esCallCenter) {
                        rowData = [formatearFechaExcel(row.fecha), nombreDia, horarioFormateado, nombreAgente];
                    } else {
                        rowData = [
                            formatearFechaExcel(row.fecha),
                            nombreDia,
                            horarioFormateado,
                            'Identificaciones',
                            'Dpto de Identificaciones',
                            nombreAgente
                        ];
                    }

                    const addedRow = worksheet.addRow(rowData);
                    addedRow.height = 22;

                    addedRow.eachCell((cell) => {
                        cell.font = { name: 'Segoe UI', size: 10 };
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                        if (rowIndex % 2 === 0) {
                            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
                        }
                        cell.border = {
                            top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                            bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                            left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                            right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
                        };
                    });
                });
            }

            generarTablaModulo('CAMPAÑA MITIC — CALL CENTER', callCenterRows, true);
            worksheet.addRow([]);
            worksheet.addRow([]);
            generarTablaModulo('CAMPAÑA MITIC — DPTO DE IDENTIFICACIONES', identificacionesRows, false);
            worksheet.addRow([]);

            const footerRow = worksheet.addRow(['Reporte generado desde Gestor de Guardias MITIC']);
            worksheet.mergeCells(`A${footerRow.number}:F${footerRow.number}`);
            const footerCell = footerRow.getCell(1);
            footerCell.font = { name: 'Segoe UI', size: 9, italic: true, color: { argb: 'FF6B7280' } };
            footerCell.alignment = { vertical: 'middle', horizontal: 'right' };

            const columnWidths = [14, 14, 22, 26, 20, 30];
            worksheet.columns.forEach((col, index) => {
                col.width = columnWidths[index];
            });

            const nombreArchivo = `Reporte_Guardias_MITIC_${type}_${new Date().toISOString().split('T')[0]}.xlsx`;
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = nombreArchivo;
            link.click();
            URL.revokeObjectURL(link.href);
        }

        // ============================================================
