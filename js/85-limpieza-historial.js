        // ============================================================
        // 16b) LIMPIEZA DE HISTORIAL
        // ============================================================
        // Borra guardias, registros diarios y notas anteriores al mes elegido.
        //
        // Reglas de seguridad, porque esto no se puede deshacer:
        //   1. El botón de eliminar está deshabilitado hasta que se muestran los conteos.
        //   2. Antes de borrar se ofrece la descarga del respaldo en Excel.
        //   3. Se pide confirmación explícita con el detalle de cuántos registros son.
        //   4. Después de borrar se recargan los datos en memoria (calendario y planificador).

        const TABLAS_LIMPIEZA = [
            {
                clave: 'TURNOS',
                etiqueta: 'Guardias de fin de semana',
                columnas: [
                    { header: 'Fecha', key: 'fecha', width: 14 },
                    { header: 'Turno', key: 'turno', width: 12 },
                    { header: 'Agente', key: 'agente', width: 28 },
                    { header: 'Modalidad', key: 'modalidad', width: 18 },
                    { header: 'Sucursal', key: 'sucursal', width: 30 }
                ]
            },
            {
                clave: 'COBERTURAS_DIARIAS',
                etiqueta: 'Registro diario',
                columnas: [
                    { header: 'Fecha', key: 'fecha', width: 14 },
                    { header: 'Área', key: 'area', width: 20 },
                    { header: 'Turno', key: 'turno', width: 12 },
                    { header: 'Titular', key: 'agente_titular', width: 28 },
                    { header: 'Cubrió', key: 'agente_cobertura', width: 28 },
                    { header: 'Tipo', key: 'tipo_novedad', width: 28 },
                    { header: 'Estado', key: 'estado_cobertura', width: 20 },
                    { header: 'Horario', key: 'horario_afectado', width: 22 },
                    { header: 'Observaciones', key: 'observaciones', width: 40 }
                ]
            },
            {
                clave: 'NOTAS_CALENDARIO',
                etiqueta: 'Notas del calendario',
                columnas: [
                    { header: 'Fecha', key: 'fecha', width: 14 },
                    { header: 'Título', key: 'titulo', width: 30 },
                    { header: 'Detalle', key: 'detalle', width: 50 },
                    { header: 'Color', key: 'color', width: 12 }
                ]
            }
        ];

        // 'YYYY-MM' -> 'YYYY-MM-01' (primer día del mes elegido)
        function obtenerCorteLimpieza() {
            const valor = document.getElementById('limpiezaCorteMes')?.value || '';
            if (!/^\d{4}-\d{2}$/.test(valor)) return null;
            return `${valor}-01`;
        }

        function nombreMesCorte(corte) {
            if (!corte) return '';
            const [anio, mes] = corte.split('-');
            const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
            return `${meses[parseInt(mes, 10) - 1]} de ${anio}`;
        }

        async function contarFilasAnteriores(corte) {
            const conteos = {};
            for (const item of TABLAS_LIMPIEZA) {
                const { count, error } = await supabaseClient
                    .from(TABLAS[item.clave])
                    .select('id', { count: 'exact', head: true })
                    .lt('fecha', corte);

                conteos[item.clave] = error ? null : (count || 0);
            }
            return conteos;
        }

        function mostrarConteosLimpieza(conteos, corte) {
            const contenedor = document.getElementById('limpiezaConteo');
            if (!contenedor) return;

            const total = Object.values(conteos).reduce((suma, valor) => suma + (valor || 0), 0);
            const detalle = TABLAS_LIMPIEZA
                .map(item => `${item.etiqueta}: <strong>${conteos[item.clave] === null ? '?' : conteos[item.clave]}</strong>`)
                .join(' · ');

            contenedor.innerHTML = total > 0
                ? `<div class="font-bold text-slate-800">${total} registro(s) anteriores a ${nombreMesCorte(corte)}</div><div class="mt-0.5">${detalle}</div>`
                : `<div class="font-bold text-emerald-700">No hay registros anteriores a ${nombreMesCorte(corte)}.</div><div class="mt-0.5">${detalle}</div>`;

            const boton = document.getElementById('btnLimpiezaEliminar');
            if (boton) boton.disabled = total === 0;
        }

        async function actualizarConteoLimpieza() {
            const corte = obtenerCorteLimpieza();
            const contenedor = document.getElementById('limpiezaConteo');

            if (!corte) {
                if (contenedor) contenedor.textContent = 'Elegí un mes para ver cuántos registros se van a borrar.';
                const boton = document.getElementById('btnLimpiezaEliminar');
                if (boton) boton.disabled = true;
                return null;
            }

            if (contenedor) contenedor.textContent = 'Contando…';
            const conteos = await contarFilasAnteriores(corte);
            mostrarConteosLimpieza(conteos, corte);
            return conteos;
        }

        async function obtenerFilasAnteriores(corte) {
            const filas = {};
            for (const item of TABLAS_LIMPIEZA) {
                const { data, error } = await supabaseClient
                    .from(TABLAS[item.clave])
                    .select('*')
                    .lt('fecha', corte)
                    .order('fecha', { ascending: true });

                if (error) throw new Error(`No se pudo leer ${item.etiqueta}: ${error.message}`);
                filas[item.clave] = data || [];
            }
            return filas;
        }

        // Prepara una fila para el Excel resolviendo los ids de agente a nombres.
        function filaParaRespaldo(clave, fila) {
            if (clave === 'TURNOS') {
                return {
                    fecha: fila.fecha,
                    turno: fila.turno || '',
                    agente: obtenerNombreAgentePorId(fila.agente_id),
                    modalidad: fila.modalidad || '',
                    sucursal: fila.sucursal || ''
                };
            }

            if (clave === 'COBERTURAS_DIARIAS') {
                return {
                    fecha: fila.fecha,
                    area: fila.area || '',
                    turno: fila.turno || '',
                    agente_titular: obtenerNombreAgentePorId(fila.agente_titular_id),
                    agente_cobertura: fila.agente_cobertura_id ? obtenerNombreAgentePorId(fila.agente_cobertura_id) : '',
                    tipo_novedad: fila.tipo_novedad || '',
                    estado_cobertura: fila.estado_cobertura || '',
                    horario_afectado: fila.horario_afectado || '',
                    observaciones: fila.observaciones || ''
                };
            }

            return {
                fecha: fila.fecha,
                titulo: fila.titulo || '',
                detalle: fila.detalle || '',
                color: fila.color || ''
            };
        }

        async function descargarRespaldoHistorial() {
            const corte = obtenerCorteLimpieza();
            if (!corte) {
                mostrarToast('Elegí el mes de corte antes de descargar el respaldo.', 'warning');
                return;
            }

            const boton = document.getElementById('btnLimpiezaRespaldo');
            if (boton) { boton.disabled = true; boton.textContent = 'Preparando…'; }

            try {
                const filas = await obtenerFilasAnteriores(corte);

                const workbook = new ExcelJS.Workbook();
                TABLAS_LIMPIEZA.forEach(item => {
                    const hoja = workbook.addWorksheet(item.etiqueta.slice(0, 30));
                    hoja.columns = item.columnas;

                    const cabecera = hoja.getRow(1);
                    cabecera.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                    cabecera.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };

                    (filas[item.clave] || []).forEach(fila => {
                        hoja.addRow(filaParaRespaldo(item.clave, fila));
                    });
                });

                const contenido = await workbook.xlsx.writeBuffer();
                const blob = new Blob([contenido], {
                    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                });
                const url = URL.createObjectURL(blob);

                const enlace = document.createElement('a');
                enlace.href = url;
                enlace.download = `Respaldo_historial_anterior_a_${corte.slice(0, 7)}.xlsx`;
                document.body.appendChild(enlace);
                enlace.click();
                document.body.removeChild(enlace);

                // Se libera con demora: revocarlo enseguida corta la descarga en algunos navegadores.
                setTimeout(() => URL.revokeObjectURL(url), 1500);

                const total = Object.values(filas).reduce((suma, lista) => suma + lista.length, 0);
                mostrarToast(`Respaldo descargado: ${total} registro(s).`, 'success');
            } catch (error) {
                mostrarToast('No se pudo armar el respaldo: ' + error.message, 'error');
            } finally {
                if (boton) { boton.disabled = false; boton.textContent = '📥 Descargar respaldo'; }
            }
        }

        async function eliminarHistorialAnterior() {
            const corte = obtenerCorteLimpieza();
            const boton = document.getElementById('btnLimpiezaEliminar');

            if (!corte) {
                mostrarToast('Elegí el mes de corte.', 'warning');
                return;
            }

            // Se vuelve a contar para confirmar sobre el número real, no sobre uno viejo.
            const conteos = await actualizarConteoLimpieza();
            const total = Object.values(conteos || {}).reduce((suma, valor) => suma + (valor || 0), 0);

            if (!total) {
                mostrarToast('No hay registros anteriores a esa fecha.', 'info');
                return;
            }

            const detalle = TABLAS_LIMPIEZA
                .map(item => `• ${item.etiqueta}: ${conteos[item.clave] || 0}`)
                .join('\n');

            const confirmado = await mostrarConfirmacionModerna({
                titulo: 'Eliminar historial',
                mensaje: `Se van a eliminar ${total} registro(s) anteriores a ${nombreMesCorte(corte)}:\n\n${detalle}\n\nEsta acción no se puede deshacer. ¿Descargaste el respaldo?`,
                textoAceptar: 'Sí, eliminar',
                textoCancelar: 'Cancelar',
                tipo: 'danger'
            });

            if (!confirmado) return;

            if (boton) { boton.disabled = true; boton.textContent = 'Eliminando…'; }

            try {
                const resultados = [];
                for (const item of TABLAS_LIMPIEZA) {
                    const { error } = await supabaseClient
                        .from(TABLAS[item.clave])
                        .delete()
                        .lt('fecha', corte);

                    if (error) throw new Error(`${item.etiqueta}: ${error.message}`);
                    resultados.push(item.etiqueta);
                }

                mostrarToast(`Historial eliminado: ${total} registro(s).`, 'success');

                // Refrescar lo que está en pantalla.
                if (typeof cargarDatosCalendario === 'function') await cargarDatosCalendario();
                if (typeof listarCoberturasDiarias === 'function') await listarCoberturasDiarias();
                if (typeof cargarTurnosGuardadosParaPlanificacion === 'function'
                    && Array.isArray(diasPlanificados) && diasPlanificados.length) {
                    await cargarTurnosGuardadosParaPlanificacion(diasPlanificados.map(dia => dia.fecha));
                }

                await actualizarConteoLimpieza();
            } catch (error) {
                mostrarToast('No se pudo eliminar todo: ' + error.message, 'error');
                await actualizarConteoLimpieza();
            } finally {
                if (boton) { boton.disabled = false; boton.textContent = 'Eliminar registros anteriores'; }
            }
        }

        function setupLimpiezaHistorial() {
            if (window.__limpiezaHistorialLista) return;

            const mes = document.getElementById('limpiezaCorteMes');
            if (!mes) return;

            mes.addEventListener('change', () => actualizarConteoLimpieza());
            document.getElementById('btnLimpiezaContar')?.addEventListener('click', () => actualizarConteoLimpieza());
            document.getElementById('btnLimpiezaRespaldo')?.addEventListener('click', descargarRespaldoHistorial);
            document.getElementById('btnLimpiezaEliminar')?.addEventListener('click', eliminarHistorialAnterior);

            window.__limpiezaHistorialLista = true;
        }

        setupLimpiezaHistorial();
