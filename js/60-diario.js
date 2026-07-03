        // 12) REGISTRO DIARIO DE COBERTURAS
        // ============================================================
        async function listarCoberturasDiarias() {
            const { data, error } = await supabaseClient
                .from(TABLAS.COBERTURAS_DIARIAS)
                .select('id, fecha, area, turno, agente_titular_id, tipo_novedad, motivo, requiere_cobertura, estado_cobertura, agente_cobertura_id, forma_cobertura, horario_afectado, resultado, observaciones, novedad_id, created_at')
                .order('fecha', { ascending: false })
                .order('created_at', { ascending: false });

            if(error) {
                console.error('Error cargando registros diarios:', error);
                const tbody = document.getElementById('listaCoberturasDiarias');
                if(tbody) {
                    tbody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-red-500">No se pudieron cargar los registros diarios. Verificá que exista la tabla coberturas_diarias.</td></tr>`;
                }
                return;
            }

            coberturasDiariasEnMemoria = data || [];
            aplicarFiltroInicialCoberturasDiarias();
            renderizarTablaCoberturasDiarias();
        }


        function buscarAgenteRegistroDiarioPorNombre(nombreReferencia) {
            return agentesEnMemoria.find(agente => agente.activo !== false && esNombreDeLista(agente.nombre_corto, [nombreReferencia])) || null;
        }

        function obtenerBaseRegistroDiarioPorAgenteId(agenteId) {
            if(!agenteId) return null;
            const agente = agentesEnMemoria.find(a => a.id == agenteId && a.activo !== false);
            if(!agente) return null;
            const base = HORARIOS_BASE_COBERTURA_NORMAL_DIARIA.find(item => esNombreDeLista(agente.nombre_corto, [item.agente]));
            return base ? { ...base, agente } : null;
        }

        function obtenerBasesCambioDirectoDiario() {
            return HORARIOS_BASE_COBERTURA_NORMAL_DIARIA
                .map(base => ({ ...base, agente: buscarAgenteRegistroDiarioPorNombre(base.agente) }))
                .filter(base => base.agente);
        }

        function actualizarSelectoresCambioDirectoDiario() {
            const fecha = document.getElementById('cambio_directo_fecha');
            const selectA = document.getElementById('cambio_directo_agente_a');
            const selectB = document.getElementById('cambio_directo_agente_b');
            if(!fecha || !selectA || !selectB) return;

            if(!fecha.value) fecha.value = obtenerFechaActualISO();
            const valorA = selectA.value;
            const valorB = selectB.value;
            const bases = obtenerBasesCambioDirectoDiario();
            const opciones = bases.map(base => `<option value="${base.agente.id}">${escaparHTML(base.agente.nombre_corto)}</option>`).join('');
            selectA.innerHTML = `<option value="">-- Agente --</option>${opciones}`;
            selectB.innerHTML = `<option value="">-- Agente --</option>${opciones}`;

            const andrea = buscarAgenteRegistroDiarioPorNombre('Andrea Melgarejo');
            const cesar = buscarAgenteRegistroDiarioPorNombre('Cesar Arzamendia');
            selectA.value = valorA || (andrea?.id || bases[0]?.agente.id || '');
            selectB.value = valorB || (cesar?.id || bases.find(base => String(base.agente.id) !== String(selectA.value))?.agente.id || '');
            actualizarVistaPreviaCambioDirectoDiario();
        }


        function toggleCambioDirectoDiario() {
            const panel = document.getElementById('panelCambioDirectoDiario');
            if(!panel) return;
            panel.classList.toggle('hidden');
            if(!panel.classList.contains('hidden')) actualizarVistaPreviaCambioDirectoDiario();
        }

        function toggleRegistroAvanzadoDiario() {
            abrirModalCoberturaDiaria();
        }

        function abrirModalCoberturaDiaria() {
            const modal = document.getElementById('modalCoberturaDiaria');
            if(!modal) return;
            modal.classList.remove('hidden');
            const fechaInput = document.getElementById('cobertura_fecha');
            if(fechaInput && !fechaInput.value) fechaInput.value = obtenerFechaActualISO();
            setTimeout(() => fechaInput?.focus(), 50);
        }

        function cerrarModalCoberturaDiaria() {
            document.getElementById('modalCoberturaDiaria')?.classList.add('hidden');
        }
        function setupCambioDirectoDiario() {
            ['cambio_directo_fecha', 'cambio_directo_agente_a', 'cambio_directo_agente_b'].forEach(id => {
                document.getElementById(id)?.addEventListener('change', actualizarVistaPreviaCambioDirectoDiario);
            });
            actualizarSelectoresCambioDirectoDiario();
        }

        function describirBaseCambioDirecto(base) {
            if(!base) return '';
            return `${base.area} · ${base.turno} · ${base.horario}`;
        }

        function actualizarVistaPreviaCambioDirectoDiario() {
            const preview = document.getElementById('cambio_directo_preview');
            const selectA = document.getElementById('cambio_directo_agente_a');
            const selectB = document.getElementById('cambio_directo_agente_b');
            if(!preview || !selectA || !selectB) return;

            const baseA = obtenerBaseRegistroDiarioPorAgenteId(selectA.value);
            const baseB = obtenerBaseRegistroDiarioPorAgenteId(selectB.value);
            if(!baseA || !baseB) {
                preview.innerHTML = 'Seleccioná dos agentes con puesto habitual.';
                return;
            }
            if(String(baseA.agente.id) === String(baseB.agente.id)) {
                preview.innerHTML = 'Elegí dos agentes distintos.';
                return;
            }

            preview.innerHTML = `
                <div class="font-bold">${escaparHTML(baseA.agente.nombre_corto)} → ${escaparHTML(describirBaseCambioDirecto(baseB))}</div>
                <div class="font-bold mt-1">${escaparHTML(baseB.agente.nombre_corto)} → ${escaparHTML(describirBaseCambioDirecto(baseA))}</div>
            `;
        }

        function crearRegistroCambioDirecto(fecha, baseTitular, baseCobertura) {
            return {
                fecha,
                area: baseTitular.area,
                turno: baseTitular.turno,
                agente_titular_id: parseInt(baseTitular.agente.id),
                tipo_novedad: 'Cambio de turno',
                motivo: `Cambio directo con ${baseCobertura.agente.nombre_corto}.`,
                requiere_cobertura: true,
                estado_cobertura: 'CUBIERTO',
                agente_cobertura_id: parseInt(baseCobertura.agente.id),
                forma_cobertura: 'Cambio de turno',
                horario_afectado: baseTitular.horario,
                resultado: `${baseCobertura.agente.nombre_corto} cubrió ${baseTitular.area}.`,
                observaciones: null,
                novedad_id: null
            };
        }

        async function guardarRegistroCambioDirecto(datos) {
            const existente = coberturasDiariasEnMemoria.find(reg =>
                reg.fecha === datos.fecha &&
                String(reg.agente_titular_id) === String(datos.agente_titular_id)
            );

            if(existente) {
                return supabaseClient
                    .from(TABLAS.COBERTURAS_DIARIAS)
                    .update(datos)
                    .eq('id', existente.id);
            }

            return supabaseClient
                .from(TABLAS.COBERTURAS_DIARIAS)
                .insert([datos]);
        }

        window.guardarCambioDirectoDiario = async function() {
            const fecha = document.getElementById('cambio_directo_fecha')?.value || obtenerFechaActualISO();
            const baseA = obtenerBaseRegistroDiarioPorAgenteId(document.getElementById('cambio_directo_agente_a')?.value);
            const baseB = obtenerBaseRegistroDiarioPorAgenteId(document.getElementById('cambio_directo_agente_b')?.value);
            const btn = document.getElementById('btnGuardarCambioDirectoDiario');

            if(!fecha) {
                mostrarToast('Seleccioná la fecha del cambio directo.', 'warning');
                return;
            }
            const mensajeNoLaboral = obtenerMensajeDiaNoLaboralRegistroDiario(fecha);
            if(mensajeNoLaboral) {
                mostrarToast(mensajeNoLaboral, 'warning');
                return;
            }
            if(!baseA || !baseB) {
                mostrarToast('Seleccioná dos agentes con puesto habitual.', 'warning');
                return;
            }
            if(String(baseA.agente.id) === String(baseB.agente.id)) {
                mostrarToast('Elegí dos agentes distintos para el cambio directo.', 'warning');
                return;
            }

            const registros = [
                crearRegistroCambioDirecto(fecha, baseB, baseA),
                crearRegistroCambioDirecto(fecha, baseA, baseB)
            ];

            if(btn) {
                btn.disabled = true;
                btn.innerText = 'Registrando...';
            }

            for(const registro of registros) {
                const { error } = await guardarRegistroCambioDirecto(registro);
                if(error) {
                    if(btn) {
                        btn.disabled = false;
                        btn.innerText = 'Registrar cambio directo';
                    }
                    mostrarToast('No se pudo guardar el cambio directo: ' + error.message, 'error');
                    return;
                }
            }

            if(btn) {
                btn.disabled = false;
                btn.innerText = 'Registrar cambio directo';
            }
            await listarCoberturasDiarias();
            await cargarDatosCalendario();
            mostrarToast('Cambio directo registrado.', 'success');
        }
        function setupFormularioCoberturaDiaria() {
            const form = document.getElementById('formCoberturaDiaria');
            const fechaInput = document.getElementById('cobertura_fecha');
            const requiereSelect = document.getElementById('cobertura_requiere');
            const estadoSelect = document.getElementById('cobertura_estado');
            const areaSelect = document.getElementById('cobertura_area');
            const tipoSelect = document.getElementById('cobertura_tipo_novedad');
            const titularSelect = document.getElementById('cobertura_agente_titular');
            const coberturaSelect = document.getElementById('cobertura_agente_cobertura');
            const formaSelect = document.getElementById('cobertura_forma');

            if(areaSelect) {
                areaSelect.addEventListener('change', () => {
                    actualizarSelectoresRegistroDiario();
                    prepararCoberturaNormalSiCorresponde();
                });
            }

            actualizarSelectoresRegistroDiario();

            if(fechaInput && !fechaInput.value) {
                fechaInput.value = obtenerFechaActualISO();
            }

            if(titularSelect) {
                titularSelect.addEventListener('change', () => {
                    if(esFormularioCoberturaNormal()) {
                        coberturaSelect.value = titularSelect.value || '';
                    }
                });
            }

            if(tipoSelect) {
                tipoSelect.addEventListener('change', () => prepararCoberturaNormalSiCorresponde(true));
            }

            if(requiereSelect && estadoSelect) {
                requiereSelect.addEventListener('change', () => {
                    if(requiereSelect.value === 'false') {
                        if(tipoSelect) tipoSelect.value = 'Cobertura normal del titular';
                        estadoSelect.value = 'CUBIERTO';
                        if(formaSelect) formaSelect.value = 'Cobertura habitual';
                        if(coberturaSelect && titularSelect && !coberturaSelect.value) coberturaSelect.value = titularSelect.value || '';
                    } else if(tipoSelect && tipoSelect.value === 'Cobertura normal del titular') {
                        tipoSelect.value = 'Otro';
                    }
                });

                estadoSelect.addEventListener('change', () => {
                    if(['FALTA CUBRIR', 'NO CUBIERTO', 'CUBIERTO PARCIAL'].includes(estadoSelect.value)) {
                        requiereSelect.value = 'true';
                    }
                    if(estadoSelect.value === 'CUBIERTO' && esFormularioCoberturaNormal()) {
                        requiereSelect.value = 'false';
                        if(formaSelect) formaSelect.value = 'Cobertura habitual';
                        if(coberturaSelect && titularSelect && !coberturaSelect.value) coberturaSelect.value = titularSelect.value || '';
                    }
                    if(estadoSelect.value === 'NO REQUIERE COBERTURA') {
                        requiereSelect.value = 'false';
                        if(formaSelect) formaSelect.value = 'No requería cobertura';
                    }
                });
            }

            prepararCoberturaNormalSiCorresponde(false);

            if(!form) return;

            document.getElementById('btnCerrarModalCoberturaDiaria')?.addEventListener('click', () => {
                cancelarEdicionCoberturaDiaria(false);
            });
            document.getElementById('btnCerrarFormCoberturaDiaria')?.addEventListener('click', () => {
                cancelarEdicionCoberturaDiaria(false);
            });
            document.getElementById('modalCoberturaDiaria')?.addEventListener('click', (e) => {
                if(e.target.id === 'modalCoberturaDiaria') {
                    cancelarEdicionCoberturaDiaria(false);
                }
            });

            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                await guardarCoberturaDiaria();
            });
        }

        function esFormularioCoberturaNormal() {
            return document.getElementById('cobertura_tipo_novedad')?.value === 'Cobertura normal del titular';
        }

        function prepararCoberturaNormalSiCorresponde(forzarTextos = false) {
            if(!esFormularioCoberturaNormal()) return;

            const titularSelect = document.getElementById('cobertura_agente_titular');
            const coberturaSelect = document.getElementById('cobertura_agente_cobertura');
            const requiereSelect = document.getElementById('cobertura_requiere');
            const estadoSelect = document.getElementById('cobertura_estado');
            const formaSelect = document.getElementById('cobertura_forma');
            const motivoInput = document.getElementById('cobertura_motivo');
            const resultadoInput = document.getElementById('cobertura_resultado');
            const horarioInput = document.getElementById('cobertura_horario_afectado');

            if(requiereSelect) requiereSelect.value = 'false';
            if(estadoSelect) estadoSelect.value = 'CUBIERTO';
            if(formaSelect) formaSelect.value = 'Cobertura habitual';
            if(coberturaSelect && titularSelect && titularSelect.value) coberturaSelect.value = titularSelect.value;

            if(forzarTextos || !motivoInput?.value.trim()) {
                if(motivoInput) motivoInput.value = 'Cobertura habitual del puesto.';
            }
            if(forzarTextos || !resultadoInput?.value.trim()) {
                if(resultadoInput) resultadoInput.value = 'Puesto cubierto con normalidad.';
            }
            if(forzarTextos || !horarioInput?.value.trim()) {
                if(horarioInput) horarioInput.value = obtenerHorarioPorTurnoRegistroDiario(document.getElementById('cobertura_turno')?.value) || 'Horario habitual';
            }
        }

        window.marcarRegistroComoNovedad = function() {
            const tipoSelect = document.getElementById('cobertura_tipo_novedad');
            const requiereSelect = document.getElementById('cobertura_requiere');
            const estadoSelect = document.getElementById('cobertura_estado');
            const formaSelect = document.getElementById('cobertura_forma');
            const motivoInput = document.getElementById('cobertura_motivo');

            if(tipoSelect && tipoSelect.value === 'Cobertura normal del titular') tipoSelect.value = 'Otro';
            if(requiereSelect) requiereSelect.value = 'true';
            if(estadoSelect && estadoSelect.value === 'CUBIERTO') estadoSelect.value = 'FALTA CUBRIR';
            if(formaSelect && formaSelect.value === 'Cobertura habitual') formaSelect.value = '';
            if(motivoInput && motivoInput.value === 'Cobertura habitual del puesto.') motivoInput.value = '';
            mostrarToast('Formulario preparado para registrar una novedad o relevo.', 'info');
        }

        function obtenerFechaRelativaISO(fechaISO, diferenciaDias) {
            const fecha = new Date(fechaISO + 'T00:00:00');
            fecha.setDate(fecha.getDate() + diferenciaDias);
            const yyyy = fecha.getFullYear();
            const mm = String(fecha.getMonth() + 1).padStart(2, '0');
            const dd = String(fecha.getDate()).padStart(2, '0');
            return `${yyyy}-${mm}-${dd}`;
        }

        function aplicarFiltroInicialCoberturasDiarias() {
            if(filtroDiarioInicialAplicado) return;
            filtroDiarioInicialAplicado = true;

            const filtroDesde = document.getElementById('filtroCoberturaDesde');
            const filtroHasta = document.getElementById('filtroCoberturaHasta');
            const filtroArea = document.getElementById('filtroAreaCoberturaDiaria');
            const filtroEstado = document.getElementById('filtroEstadoCoberturaDiaria');

            if(!filtroDesde || !filtroHasta || !Array.isArray(coberturasDiariasEnMemoria) || coberturasDiariasEnMemoria.length === 0) {
                return;
            }

            const fechasDisponibles = [...new Set(
                coberturasDiariasEnMemoria
                    .map(reg => reg.fecha)
                    .filter(Boolean)
            )].sort((a, b) => b.localeCompare(a));

            const hoy = obtenerFechaActualISO();
            const ayer = obtenerFechaRelativaISO(hoy, -1);
            const fechaInicial = fechasDisponibles.includes(hoy)
                ? hoy
                : (fechasDisponibles.includes(ayer) ? ayer : fechasDisponibles[0]);

            if(!fechaInicial) return;

            filtroDesde.value = fechaInicial;
            filtroHasta.value = fechaInicial;
            if(filtroArea) filtroArea.value = 'todas';
            if(filtroEstado) filtroEstado.value = 'todos';
        }
        function setupFiltrosCoberturasDiarias() {
            ['filtroCoberturaDesde', 'filtroCoberturaHasta', 'filtroAreaCoberturaDiaria', 'filtroEstadoCoberturaDiaria'].forEach(id => {
                const el = document.getElementById(id);
                if(el) {
                    el.addEventListener('change', renderizarTablaCoberturasDiarias);
                    el.addEventListener('input', renderizarTablaCoberturasDiarias);
                }
            });
        }

        function esNombreDeLista(nombreAgente, listaNombres) {
            const nombre = normalizarTextoBusqueda(nombreAgente);
            return listaNombres.some(nombreReferencia => nombre.includes(normalizarTextoBusqueda(nombreReferencia)) || normalizarTextoBusqueda(nombreReferencia).includes(nombre));
        }

        function esAgenteRegistroDiario(agente) {
            if(!agente || agente.activo === false) return false;
            const texto = normalizarTextoBusqueda(`${agente.nombre_corto || ''} ${agente.modalidad || ''} ${agente.sucursal || ''}`);
            const esPresencialOHibrido =
                texto.includes('presencial') ||
                texto.includes('hibrido') ||
                texto.includes('hybrid') ||
                texto.includes('ident') ||
                texto.includes('registro civil') ||
                texto.includes('civil');

            const nombresClave = [
                ...Object.values(TITULARES_REGISTRO_DIARIO).flat(),
                ...AGENTES_CLAVE_REGISTRO_DIARIO
            ];

            return esPresencialOHibrido || esNombreDeLista(agente.nombre_corto, nombresClave);
        }

        function obtenerAgentesRegistroDiario() {
            return agentesEnMemoria
                .filter(esAgenteRegistroDiario)
                .sort((a, b) => (a.nombre_corto || '').localeCompare(b.nombre_corto || '', 'es'));
        }

        function obtenerTitularesPorAreaRegistroDiario(area) {
            const nombresTitulares = TITULARES_REGISTRO_DIARIO[area] || [];
            const titulares = agentesEnMemoria
                .filter(a => a.activo !== false && esNombreDeLista(a.nombre_corto, nombresTitulares))
                .sort((a, b) => (a.nombre_corto || '').localeCompare(b.nombre_corto || '', 'es'));

            // Si algún nombre no coincide exactamente con el plantel, dejamos como apoyo la lista presencial/híbrida
            // para que el supervisor pueda registrar igual y corregir después el nombre del agente en Plantel.
            if(titulares.length === 0) return obtenerAgentesRegistroDiario();
            return titulares;
        }

        function actualizarSelectoresRegistroDiario(valores = {}) {
            const area = document.getElementById('cobertura_area')?.value || 'Registro Civil';
            const selectTitular = document.getElementById('cobertura_agente_titular');
            const selectCobertura = document.getElementById('cobertura_agente_cobertura');

            if(selectTitular) {
                const valorActual = valores.titular ?? selectTitular.value;
                const titulares = obtenerTitularesPorAreaRegistroDiario(area);
                const otros = obtenerAgentesRegistroDiario().filter(a => !titulares.some(t => t.id == a.id));

                selectTitular.innerHTML = `<option value="">-- Elegir titular de ${escaparHTML(area)} --</option>`;
                titulares.forEach(a => {
                    selectTitular.innerHTML += `<option value="${a.id}">${escaparHTML(a.nombre_corto)}</option>`;
                });

                if(otros.length > 0) {
                    selectTitular.innerHTML += `<option disabled>──────── Otros presenciales / híbridos ────────</option>`;
                    otros.forEach(a => {
                        selectTitular.innerHTML += `<option value="${a.id}">${escaparHTML(a.nombre_corto)}</option>`;
                    });
                }

                selectTitular.value = valorActual || '';
            }

            if(selectCobertura) {
                const valorActual = valores.cobertura ?? selectCobertura.value;
                const agentes = obtenerAgentesRegistroDiario();
                selectCobertura.innerHTML = `<option value="">-- Sin asignar / no aplica --</option>`;
                agentes.forEach(a => {
                    selectCobertura.innerHTML += `<option value="${a.id}">${escaparHTML(a.nombre_corto)}</option>`;
                });
                selectCobertura.value = valorActual || '';
            }
        }

        function esFinDeSemana(fechaStr) {
            const d = new Date(fechaStr + 'T00:00:00');
            return d.getDay() === 0 || d.getDay() === 6;
        }

        function obtenerHorarioPorTurnoRegistroDiario(turno) {
            if(turno === 'Mañana') return '07:00 a 12:00 hs';
            if(turno === 'Tarde') return '12:00 a 17:00 hs';
            return turno || '';
        }

        function obtenerClaseEstadoCobertura(estado) {
            if(estado === 'CUBIERTO') return 'bg-green-100 text-green-800';
            if(estado === 'CUBIERTO PARCIAL') return 'bg-yellow-100 text-yellow-800';
            if(estado === 'NO REQUIERE COBERTURA') return 'bg-blue-100 text-blue-800';
            if(estado === 'NO CUBIERTO') return 'bg-red-100 text-red-800';
            if(estado === 'CANCELADO') return 'bg-gray-100 text-gray-500';
            return 'bg-orange-100 text-orange-800';
        }

        function limpiarMarcasInternasRegistroDiario(valor) {
            return (valor || '')
                .toString()
                .replaceAll(MARCA_AUTO_PLANIFICADOR_IDENTIFICACIONES, '')
                .replaceAll(MARCA_AUTO_COBERTURA_NORMAL_DIARIA, '')
                .replace(/\s{2,}/g, ' ')
                .replace(/\s+([.,;:])/g, '$1')
                .trim();
        }
        function obtenerFechaUnicaFiltroCoberturaDiaria() {
            const desde = document.getElementById('filtroCoberturaDesde')?.value || '';
            const hasta = document.getElementById('filtroCoberturaHasta')?.value || '';
            if(desde && hasta && desde === hasta) return desde;
            if(desde && !hasta) return desde;
            if(!desde && hasta) return hasta;
            return '';
        }

        function obtenerFechaPascuaISO(anio) {
            const a = anio % 19;
            const b = Math.floor(anio / 100);
            const c = anio % 100;
            const d = Math.floor(b / 4);
            const e = b % 4;
            const f = Math.floor((b + 8) / 25);
            const g = Math.floor((b - f + 1) / 3);
            const h = (19 * a + b - d - g + 15) % 30;
            const i = Math.floor(c / 4);
            const k = c % 4;
            const l = (32 + 2 * e + 2 * i - h - k) % 7;
            const m = Math.floor((a + 11 * h + 22 * l) / 451);
            const mes = Math.floor((h + l - 7 * m + 114) / 31);
            const dia = ((h + l - 7 * m + 114) % 31) + 1;
            return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
        }

        function obtenerFeriadoParaguay(fechaStr) {
            if(!fechaStr) return '';
            const [anioTexto, mes, dia] = fechaStr.split('-');
            const anio = parseInt(anioTexto, 10);
            const clave = `${mes}-${dia}`;
            const feriadosFijos = {
                '01-01': 'Año Nuevo',
                '03-01': 'Día de los Héroes',
                '05-01': 'Día del Trabajador',
                '05-14': 'Independencia Nacional',
                '05-15': 'Independencia Nacional',
                '06-12': 'Paz del Chaco',
                '08-15': 'Fundación de Asunción',
                '09-29': 'Victoria de Boquerón',
                '12-08': 'Virgen de Caacupé',
                '12-25': 'Navidad'
            };

            if(feriadosFijos[clave]) return feriadosFijos[clave];

            const pascua = obtenerFechaPascuaISO(anio);
            if(fechaStr === obtenerFechaRelativaISO(pascua, -3)) return 'Jueves Santo';
            if(fechaStr === obtenerFechaRelativaISO(pascua, -2)) return 'Viernes Santo';

            return '';
        }

        function obtenerMensajeDiaNoLaboralRegistroDiario(fechaStr) {
            if(!fechaStr) return '';
            const fecha = new Date(fechaStr + 'T00:00:00');
            const esDomingo = fecha.getDay() === 0;
            const feriado = obtenerFeriadoParaguay(fechaStr);

            if(esDomingo && feriado) {
                return `${formatearFechaSimple(fechaStr)} es domingo y feriado (${feriado}). Identificaciones y Registro Civil no trabajan.`;
            }
            if(esDomingo) {
                return `${formatearFechaSimple(fechaStr)} es domingo. Identificaciones y Registro Civil no trabajan.`;
            }
            if(feriado) {
                return `${formatearFechaSimple(fechaStr)} es feriado (${feriado}). Identificaciones y Registro Civil no trabajan.`;
            }
            return '';
        }

        function obtenerMensajeSinRegistrosCoberturasDiarias() {
            const fechaUnica = obtenerFechaUnicaFiltroCoberturaDiaria();
            return obtenerMensajeDiaNoLaboralRegistroDiario(fechaUnica) || 'No hay registros diarios para los filtros seleccionados.';
        }
        function obtenerCoberturasDiariasFiltradas() {
            const desde = document.getElementById('filtroCoberturaDesde')?.value || '';
            const hasta = document.getElementById('filtroCoberturaHasta')?.value || '';
            const area = document.getElementById('filtroAreaCoberturaDiaria')?.value || 'todas';
            const estado = document.getElementById('filtroEstadoCoberturaDiaria')?.value || 'todos';
            const estadosPendientes = ['FALTA CUBRIR', 'NO CUBIERTO', 'CUBIERTO PARCIAL'];

            return [...coberturasDiariasEnMemoria]
                .filter(reg => {
                    if(desde && reg.fecha < desde) return false;
                    if(hasta && reg.fecha > hasta) return false;
                    if(area !== 'todas' && reg.area !== area) return false;
                    if(estado === 'pendientes' && !estadosPendientes.includes(reg.estado_cobertura)) return false;
                    if(estado !== 'todos' && estado !== 'pendientes' && reg.estado_cobertura !== estado) return false;
                    return true;
                })
                .sort((a, b) => {
                    if(a.fecha !== b.fecha) return b.fecha.localeCompare(a.fecha);
                    return (b.created_at || '').localeCompare(a.created_at || '');
                });
        }

        function actualizarResumenCoberturasDiarias(registrosFiltrados) {
            const total = registrosFiltrados.length;
            const cubiertos = registrosFiltrados.filter(r => r.estado_cobertura === 'CUBIERTO').length;
            const pendientes = registrosFiltrados.filter(r => ['FALTA CUBRIR', 'NO CUBIERTO', 'CUBIERTO PARCIAL'].includes(r.estado_cobertura)).length;
            const coberturaNormal = registrosFiltrados.filter(r => r.tipo_novedad === 'Cobertura normal del titular' || (r.requiere_cobertura === false && r.estado_cobertura === 'CUBIERTO')).length;
            const textoResumen = `${total} registro(s) filtrado(s): ${cubiertos} cubierto(s), ${pendientes} pendiente(s)/problema(s), ${coberturaNormal} cobertura(s) normal(es).`;

            const resumen = document.getElementById('resumenCoberturasDiarias');
            if(resumen) resumen.innerText = textoResumen;

            const badge = document.getElementById('badgeCoberturasDiariasTotal');
            if(badge) badge.innerText = `${total} registro${total === 1 ? '' : 's'}`;

            const statTotal = document.getElementById('statCobTotal');
            const statCubiertas = document.getElementById('statCobCubiertas');
            const statPendientes = document.getElementById('statCobPendientes');
            const statSinCobertura = document.getElementById('statCobSinCobertura');

            if(statTotal) statTotal.innerText = total;
            if(statCubiertas) statCubiertas.innerText = cubiertos;
            if(statPendientes) statPendientes.innerText = pendientes;
            if(statSinCobertura) statSinCobertura.innerText = coberturaNormal;
        }

        function renderizarTablaCoberturasDiarias() {
            const contenedor = document.getElementById('listaCoberturasDiarias');
            if(!contenedor) return;

            const registros = obtenerCoberturasDiariasFiltradas();
            actualizarResumenCoberturasDiarias(registros);

            if(registros.length === 0) {
                contenedor.innerHTML = `<div class="p-4 text-center text-gray-500 text-xs">${escaparHTML(obtenerMensajeSinRegistrosCoberturasDiarias())}</div>`;
                return;
            }

            contenedor.innerHTML = '';
            registros.forEach(reg => {
                const claseEstado = obtenerClaseEstadoCobertura(reg.estado_cobertura);
                const nombreTitular = obtenerNombreAgentePorId(reg.agente_titular_id);
                const nombreCobertura = reg.agente_cobertura_id ? obtenerNombreAgentePorId(reg.agente_cobertura_id) : '-';
                const esCoberturaNormal = reg.tipo_novedad === 'Cobertura normal del titular' || (reg.requiere_cobertura === false && reg.estado_cobertura === 'CUBIERTO');
                const horarioVisible = reg.horario_afectado || obtenerHorarioPorTurnoRegistroDiario(reg.turno) || 'Horario no indicado';
                const tipoVisible = limpiarMarcasInternasRegistroDiario(reg.tipo_novedad);
                const formaVisible = limpiarMarcasInternasRegistroDiario(reg.forma_cobertura);
                const titularYCoberturaMismoAgente = reg.agente_titular_id && reg.agente_cobertura_id && String(reg.agente_titular_id) === String(reg.agente_cobertura_id);
                const esPlanificacionSabado = tipoVisible === 'Cobertura planificada de sábado' || formaVisible === 'Guardia planificada de sábado';
                const mostrarTipoNovedad = !esCoberturaNormal && !esPlanificacionSabado;
                const mostrarCobertura = !esCoberturaNormal && !titularYCoberturaMismoAgente;
                const mostrarFormaCobertura = !esCoberturaNormal && !esPlanificacionSabado && !!formaVisible;
                const coberturaTexto = nombreCobertura && nombreCobertura !== '-'
                    ? `Cubre: ${nombreCobertura}`
                    : 'Cubre: pendiente';
                const resumenNovedad = [mostrarTipoNovedad ? tipoVisible : '', horarioVisible].filter(Boolean).join(' · ');
                const resumenCobertura = mostrarCobertura
                    ? [coberturaTexto, mostrarFormaCobertura ? formaVisible : ''].filter(Boolean).join(' · ')
                    : '';
                const motivoVisible = limpiarMarcasInternasRegistroDiario(reg.motivo);
                const resultadoVisible = limpiarMarcasInternasRegistroDiario(reg.resultado);
                const observacionesVisibles = limpiarMarcasInternasRegistroDiario(reg.observaciones);
                const detalleInterno = [
                    motivoVisible ? `Detalle: ${motivoVisible}` : '',
                    resultadoVisible ? `Resultado: ${resultadoVisible}` : '',
                    observacionesVisibles ? `Observaciones: ${observacionesVisibles}` : ''
                ].filter(Boolean).join('\n');

                const card = document.createElement('div');
                card.className = `border rounded-xl p-2.5 text-xs bg-white hover:bg-gray-50 min-w-0 ${coberturaDiariaEditandoId == reg.id ? 'ring-2 ring-emerald-300 bg-emerald-50' : ''}`;
                card.innerHTML = `
                    <div class="min-w-0">
                        <div class="min-w-0">
                            <div class="flex flex-wrap items-center gap-1.5 mb-1.5">
                                <span class="font-extrabold text-gray-800">${formatearFechaSimple(reg.fecha)}</span>
                                <span class="text-[10px] text-gray-400">${escaparHTML(obtenerDiaSemana(reg.fecha))}</span>
                                <span class="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 font-bold">${escaparHTML(reg.area || '-')}</span>
                                <span class="px-2 py-0.5 rounded ${claseEstado} text-[10px] font-bold uppercase">${escaparHTML(reg.estado_cobertura || 'FALTA CUBRIR')}</span>
                            </div>
                            <div class="font-bold text-gray-800">${escaparHTML(nombreTitular)}</div>
                            <div class="text-gray-600 mt-0.5 line-clamp-1">${escaparHTML(resumenNovedad || '-')}</div>
                            ${resumenCobertura ? `<div class="text-gray-500 mt-0.5 line-clamp-1">${escaparHTML(resumenCobertura)}</div>` : ''}
                            ${detalleInterno ? `
                                <details class="mt-2 bg-gray-50 border rounded-lg px-2.5 py-1.5">
                                    <summary class="cursor-pointer select-none text-[11px] font-bold text-gray-600">Ver detalle</summary>
                                    <div class="mt-2 text-[11px] text-gray-500 whitespace-pre-line">${escaparHTML(detalleInterno)}</div>
                                </details>
                            ` : ''}
                        </div>
                        <div class="mt-2 flex gap-1.5 justify-end">
                            <button onclick="iniciarEdicionCoberturaDiaria(${reg.id})" class="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-100 font-bold px-2.5 py-1.5 rounded-lg" title="Editar registro diario">Editar</button>
                            <button onclick="eliminarCoberturaDiaria(${reg.id})" class="bg-red-50 hover:bg-red-100 text-red-700 border border-red-100 font-bold px-2.5 py-1.5 rounded-lg" title="Eliminar registro diario">✕</button>
                        </div>
                    </div>
                `;
                contenedor.appendChild(card);
            });
        }

        function obtenerDiaSemana(fechaStr) {
            if(!fechaStr) return '';
            const d = new Date(fechaStr + 'T00:00:00');
            const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
            return dias[d.getDay()] || '';
        }

        function obtenerDatosFormularioCoberturaDiaria() {
            const requiere = document.getElementById('cobertura_requiere').value === 'true';
            const agenteTitularValue = document.getElementById('cobertura_agente_titular').value;
            let agenteCoberturaValue = document.getElementById('cobertura_agente_cobertura').value;
            const tipoRegistro = document.getElementById('cobertura_tipo_novedad').value;

            // En una cobertura normal, quien cubre puede ser el mismo titular.
            if(tipoRegistro === 'Cobertura normal del titular' && !agenteCoberturaValue) {
                agenteCoberturaValue = agenteTitularValue;
            }

            return {
                fecha: document.getElementById('cobertura_fecha').value,
                area: document.getElementById('cobertura_area').value,
                turno: document.getElementById('cobertura_turno').value || null,
                agente_titular_id: parseInt(agenteTitularValue),
                tipo_novedad: tipoRegistro,
                motivo: document.getElementById('cobertura_motivo').value.trim(),
                requiere_cobertura: requiere,
                estado_cobertura: document.getElementById('cobertura_estado').value,
                agente_cobertura_id: agenteCoberturaValue ? parseInt(agenteCoberturaValue) : null,
                forma_cobertura: document.getElementById('cobertura_forma').value || null,
                horario_afectado: document.getElementById('cobertura_horario_afectado').value.trim() || null,
                resultado: document.getElementById('cobertura_resultado').value.trim() || null,
                observaciones: document.getElementById('cobertura_observaciones').value.trim() || null,
                novedad_id: null
            };
        }

        function validarDatosCoberturaDiaria(datos) {
            if(!datos.fecha) return 'Seleccioná la fecha del registro diario.';
            if(!datos.area) return 'Seleccioná el área.';
            if(!AREAS_REGISTRO_DIARIO.includes(datos.area)) return 'El registro diario solo admite Registro Civil e Identificaciones.';
            if(datos.area === 'Registro Civil' && esFinDeSemana(datos.fecha)) {
                return 'Registro Civil trabaja de lunes a viernes. Para sábados usá Identificaciones desde el planificador.';
            }
            if(!datos.agente_titular_id) return 'Seleccioná el agente del puesto o titular.';
            if(!datos.tipo_novedad) return 'Seleccioná el tipo de registro.';

            if(datos.tipo_novedad === 'Cobertura normal del titular') {
                datos.requiere_cobertura = false;
                datos.estado_cobertura = 'CUBIERTO';
                datos.agente_cobertura_id = datos.agente_cobertura_id || datos.agente_titular_id;
                datos.forma_cobertura = datos.forma_cobertura || 'Cobertura habitual';
                datos.motivo = datos.motivo || 'Cobertura habitual del puesto.';
                datos.horario_afectado = datos.horario_afectado || obtenerHorarioPorTurnoRegistroDiario(datos.turno) || 'Horario habitual';
                datos.resultado = datos.resultado || 'Puesto cubierto con normalidad.';
            }

            if(!datos.motivo) return 'Ingresá el detalle del registro.';

            if(datos.estado_cobertura === 'CUBIERTO' && !datos.agente_cobertura_id) {
                if(datos.requiere_cobertura) {
                    return 'Si hubo novedad o relevo y el estado es CUBIERTO, seleccioná quién cubrió el puesto.';
                }
                datos.agente_cobertura_id = datos.agente_titular_id;
            }

            if(['FALTA CUBRIR', 'NO CUBIERTO', 'CUBIERTO PARCIAL'].includes(datos.estado_cobertura)) {
                datos.requiere_cobertura = true;
            }

            if(datos.estado_cobertura === 'NO REQUIERE COBERTURA') {
                datos.requiere_cobertura = false;
                datos.forma_cobertura = datos.forma_cobertura || 'No requería cobertura';
            }
            return '';
        }

        async function guardarCoberturaDiaria() {
            const datos = obtenerDatosFormularioCoberturaDiaria();
            const errorValidacion = validarDatosCoberturaDiaria(datos);
            if(errorValidacion) {
                mostrarToast(errorValidacion, 'warning');
                return;
            }

            const agente = agentesEnMemoria.find(a => a.id == datos.agente_titular_id);
            if(!agente || agente.activo === false) {
                mostrarToast('El agente titular no existe o está inactivo.', 'warning');
                return;
            }
            if(!esAgenteRegistroDiario(agente)) {
                mostrarToast('El registro diario solo admite agentes presenciales o híbridos.', 'warning');
                return;
            }

            const agenteCobertura = datos.agente_cobertura_id ? agentesEnMemoria.find(a => a.id == datos.agente_cobertura_id) : null;
            if(datos.agente_cobertura_id && (!agenteCobertura || agenteCobertura.activo === false)) {
                mostrarToast('El agente de cobertura no existe o está inactivo.', 'warning');
                return;
            }
            if(agenteCobertura && !esAgenteRegistroDiario(agenteCobertura)) {
                mostrarToast('El agente que cubre debe ser presencial o híbrido.', 'warning');
                return;
            }

            const btn = document.getElementById('btnGuardarCoberturaDiaria');
            const estaEditando = coberturaDiariaEditandoId !== null;
            btn.innerText = estaEditando ? 'Actualizando...' : 'Registrando...';
            btn.disabled = true;

            let resultado;
            if(estaEditando) {
                resultado = await supabaseClient
                    .from(TABLAS.COBERTURAS_DIARIAS)
                    .update(datos)
                    .eq('id', coberturaDiariaEditandoId);
            } else {
                resultado = await supabaseClient
                    .from(TABLAS.COBERTURAS_DIARIAS)
                    .insert([datos]);
            }

            btn.innerText = estaEditando ? 'Actualizar Registro Diario' : 'Registrar Cobertura del Día';
            btn.disabled = false;

            if(resultado.error) {
                mostrarToast('No se pudo guardar el registro diario: ' + resultado.error.message, 'error');
                return;
            }

            mostrarToast(estaEditando ? 'Registro diario actualizado con éxito.' : 'Registro diario guardado con éxito.', 'success');
            cancelarEdicionCoberturaDiaria(false);
            await listarCoberturasDiarias();
        }

        window.iniciarEdicionCoberturaDiaria = function(id) {
            const reg = coberturasDiariasEnMemoria.find(r => r.id == id);
            if(!reg) {
                mostrarToast('No se encontró el registro seleccionado.', 'error');
                return;
            }

            coberturaDiariaEditandoId = id;
            document.getElementById('tituloFormCoberturaDiaria').innerText = 'Editar Registro Diario';
            document.getElementById('btnGuardarCoberturaDiaria').innerText = 'Actualizar Registro Diario';
            document.getElementById('btnCancelarEdicionCoberturaDiaria').classList.remove('hidden');
            abrirModalCoberturaDiaria();

            document.getElementById('cobertura_fecha').value = reg.fecha || obtenerFechaActualISO();
            document.getElementById('cobertura_area').value = AREAS_REGISTRO_DIARIO.includes(reg.area) ? reg.area : 'Registro Civil';
            actualizarSelectoresRegistroDiario({ titular: reg.agente_titular_id || '', cobertura: reg.agente_cobertura_id || '' });
            document.getElementById('cobertura_turno').value = reg.turno || 'Mañana';
            document.getElementById('cobertura_agente_titular').value = reg.agente_titular_id || '';
            document.getElementById('cobertura_tipo_novedad').value = reg.tipo_novedad || 'Cobertura normal del titular';
            document.getElementById('cobertura_motivo').value = reg.motivo || '';
            document.getElementById('cobertura_requiere').value = reg.requiere_cobertura === false ? 'false' : 'true';
            document.getElementById('cobertura_estado').value = reg.estado_cobertura || 'FALTA CUBRIR';
            document.getElementById('cobertura_agente_cobertura').value = reg.agente_cobertura_id || '';
            document.getElementById('cobertura_forma').value = reg.forma_cobertura || '';
            document.getElementById('cobertura_horario_afectado').value = reg.horario_afectado || '';
            document.getElementById('cobertura_resultado').value = reg.resultado || '';
            document.getElementById('cobertura_observaciones').value = reg.observaciones || '';
            const detalles = document.getElementById('detallesCoberturaDiaria');
            if(detalles) detalles.open = true;

            activarPestaña('tab-diario');
            renderizarTablaCoberturasDiarias();
            mostrarToast('Modo edición activado para el registro diario.', 'info');
        }

        window.cancelarEdicionCoberturaDiaria = function(mostrarMensaje = true) {
            coberturaDiariaEditandoId = null;
            const form = document.getElementById('formCoberturaDiaria');
            if(form) form.reset();
            const fechaInput = document.getElementById('cobertura_fecha');
            if(fechaInput) fechaInput.value = obtenerFechaActualISO();
            const areaInput = document.getElementById('cobertura_area');
            if(areaInput) areaInput.value = 'Registro Civil';
            actualizarSelectoresRegistroDiario();
            prepararCoberturaNormalSiCorresponde(false);
            const detalles = document.getElementById('detallesCoberturaDiaria');
            if(detalles) detalles.open = false;
            cerrarModalCoberturaDiaria();
            const titulo = document.getElementById('tituloFormCoberturaDiaria');
            if(titulo) titulo.innerText = 'Cargar registro diario';
            const btn = document.getElementById('btnGuardarCoberturaDiaria');
            if(btn) btn.innerText = 'Registrar Cobertura del Día';
            const btnCancelar = document.getElementById('btnCancelarEdicionCoberturaDiaria');
            if(btnCancelar) btnCancelar.classList.add('hidden');
            renderizarTablaCoberturasDiarias();
            if(mostrarMensaje) mostrarToast('Edición cancelada.', 'info');
        }

        window.eliminarCoberturaDiaria = async function(id) {
            if(!await mostrarConfirmacionModerna({
                titulo: 'Eliminar registro diario',
                mensaje: '¿Seguro que querés eliminar este registro diario? Esta acción no afecta las ausencias ni los turnos guardados.',
                textoAceptar: 'Eliminar',
                tipo: 'danger'
            })) return;

            const { error } = await supabaseClient
                .from(TABLAS.COBERTURAS_DIARIAS)
                .delete()
                .eq('id', id);

            if(error) {
                mostrarToast('No se pudo eliminar el registro diario: ' + error.message, 'error');
                return;
            }

            if(coberturaDiariaEditandoId == id) cancelarEdicionCoberturaDiaria(false);
            await listarCoberturasDiarias();
            mostrarToast('Registro diario eliminado con éxito.', 'success');
        }

        function buscarAgentePorNombreReferencia(nombreReferencia) {
            const referencia = normalizarTextoBusqueda(nombreReferencia);
            if(!referencia) return null;

            const partesReferencia = referencia.split(' ').filter(Boolean);

            const candidatos = agentesEnMemoria
                .filter(agente => agente && agente.activo !== false)
                .map(agente => {
                    const nombreCorto = normalizarTextoBusqueda(agente.nombre_corto || '');
                    const nombreCompleto = normalizarTextoBusqueda(agente.nombre_completo || '');
                    const textoBusqueda = [nombreCorto, nombreCompleto].filter(Boolean).join(' ');

                    let puntaje = 0;

                    if(nombreCorto && nombreCorto === referencia) puntaje = Math.max(puntaje, 100);
                    if(nombreCompleto && nombreCompleto === referencia) puntaje = Math.max(puntaje, 100);

                    if(nombreCorto && referencia.includes(nombreCorto)) puntaje = Math.max(puntaje, 80);
                    if(nombreCompleto && referencia.includes(nombreCompleto)) puntaje = Math.max(puntaje, 80);

                    if(textoBusqueda && partesReferencia.every(parte => textoBusqueda.includes(parte))) {
                        puntaje = Math.max(puntaje, 70);
                    }

                    if(textoBusqueda && textoBusqueda.split(' ').filter(Boolean).every(parte => referencia.includes(parte))) {
                        puntaje = Math.max(puntaje, 60);
                    }

                    return { agente, puntaje };
                })
                .filter(item => item.puntaje > 0)
                .sort((a, b) => b.puntaje - a.puntaje || (a.agente.nombre_corto || '').localeCompare(b.agente.nombre_corto || '', 'es'));

            return candidatos.length > 0 ? candidatos[0].agente : null;
        }

        function existeCoberturaNormalGenerada(registrosExistentes, base, agenteId, fecha) {
            const objetivo = {
                fecha: fecha,
                area: base.area,
                turno: base.turno,
                agente_titular_id: agenteId,
                tipo_novedad: 'Cobertura normal del titular',
                horario_afectado: base.horario
            };
            return obtenerRegistrosDiariosExactos(registrosExistentes || [], objetivo).length > 0;
        }

        function crearRegistroNormalDiarioDesdeBase(item, fecha, conflictos = []) {
            const agente = item.agenteEncontrado;
            const requiereRevision = conflictos.length > 0;
            return {
                fecha: fecha,
                area: item.area,
                turno: item.turno,
                agente_titular_id: parseInt(agente.id),
                tipo_novedad: 'Cobertura normal del titular',
                motivo: requiereRevision ? `${item.detalle} Requiere revisión por conflicto detectado.` : item.detalle,
                requiere_cobertura: requiereRevision,
                estado_cobertura: requiereRevision ? 'FALTA CUBRIR' : 'CUBIERTO',
                agente_cobertura_id: requiereRevision ? null : parseInt(agente.id),
                forma_cobertura: requiereRevision ? 'No se consiguió cobertura' : 'Cobertura habitual',
                horario_afectado: item.horario,
                resultado: requiereRevision ? 'Requiere revisión antes de confirmar la cobertura del puesto.' : 'Puesto cubierto con normalidad.',
                observaciones: `Generado automáticamente como cobertura normal del día. ${MARCA_AUTO_COBERTURA_NORMAL_DIARIA}` +
                    (requiereRevision ? ` Revisión automática: ${conflictos.join(' ')}` : ''),
                novedad_id: null
            };
        }

        function armarMensajeVistaPreviaCoberturaNormal(fecha, registrosAInsertar, omitidos, conflictosDetectados) {
            const lineasNuevos = registrosAInsertar.map(reg =>
                `• ${reg.area} | ${obtenerNombreAgentePorId(reg.agente_titular_id)} | ${reg.horario_afectado} | ${reg.estado_cobertura}`
            );
            const lineasConflictos = conflictosDetectados.map(item =>
                `• ${item.area} | ${item.agente} | ${item.horario}: ${item.conflictos.join(' ')}`
            );

            return `Vista previa para generar el día normal:\n\n` +
                `Fecha: ${formatearFechaSimple(fecha)}\n` +
                `Registros nuevos a crear: ${registrosAInsertar.length}\n` +
                `Registros ya existentes que se omitirán: ${omitidos}\n` +
                `Posibles conflictos para revisar: ${conflictosDetectados.length}\n\n` +
                `Registros a crear:\n${resumirLineasVistaPrevia(lineasNuevos)}\n` +
                (lineasConflictos.length ? `\nConflictos detectados:\n${resumirLineasVistaPrevia(lineasConflictos, 6)}\n` : '') +
                `\nLos registros con conflicto se crearán como FALTA CUBRIR para que puedas revisarlos y corregirlos manualmente.\n\n¿Querés continuar?`;
        }

        window.generarCoberturaNormalDelDia = async function() {
            const fechaInput = document.getElementById('cobertura_fecha');
            const fecha = fechaInput?.value || obtenerFechaActualISO();

            if(fechaInput && !fechaInput.value) {
                fechaInput.value = fecha;
            }

            if(!fecha) {
                mostrarToast('Seleccioná la fecha para generar la cobertura normal.', 'warning');
                return;
            }

            if(esFinDeSemana(fecha)) {
                mostrarToast('La generación automática de cobertura normal es para lunes a viernes. Los sábados de Identificaciones se cargan desde el planificador.', 'warning');
                return;
            }

            const agentesFaltantes = [];
            const registrosBaseConAgente = HORARIOS_BASE_COBERTURA_NORMAL_DIARIA.map(base => {
                const agente = buscarAgentePorNombreReferencia(base.agente);
                if(!agente) agentesFaltantes.push(base.agente);
                return { ...base, agenteEncontrado: agente };
            });

            if(agentesFaltantes.length > 0) {
                mostrarToast(`No se encontraron estos agentes activos en el plantel: ${agentesFaltantes.join(', ')}. Revisá que estén cargados y activos.`, 'warning');
                return;
            }

            const btn = document.getElementById('btnGenerarCoberturaNormalDia');
            if(btn) {
                btn.disabled = true;
                btn.innerText = 'Analizando...';
            }

            try {
                const { data: existentes, error: errorLectura } = await supabaseClient
                    .from(TABLAS.COBERTURAS_DIARIAS)
                    .select('id, fecha, area, turno, agente_titular_id, tipo_novedad, horario_afectado, estado_cobertura, observaciones, created_at')
                    .eq('fecha', fecha);

                if(errorLectura) {
                    mostrarToast('No se pudo revisar si ya existen coberturas para esa fecha: ' + errorLectura.message, 'error');
                    return;
                }

                const registrosAInsertar = [];
                const conflictosDetectados = [];
                let omitidos = 0;

                registrosBaseConAgente.forEach(item => {
                    const agente = item.agenteEncontrado;

                    if(existeCoberturaNormalGenerada(existentes || [], item, agente.id, fecha)) {
                        omitidos++;
                        return;
                    }

                    const conflictos = obtenerConflictosOperativosRegistroDiario(fecha, agente.id, existentes || [], {
                        area: item.area,
                        turno: item.turno,
                        tipo_novedad: 'Cobertura normal del titular',
                        horario_afectado: item.horario,
                        ignorarAutoNormal: true
                    });

                    if(conflictos.length > 0) {
                        conflictosDetectados.push({
                            area: item.area,
                            agente: agente.nombre_corto || obtenerNombreAgentePorId(agente.id),
                            horario: item.horario,
                            conflictos
                        });
                    }

                    registrosAInsertar.push(crearRegistroNormalDiarioDesdeBase(item, fecha, conflictos));
                });

                if(registrosAInsertar.length === 0) {
                    mostrarToast(`La cobertura normal del ${formatearFechaSimple(fecha)} ya estaba generada. No se duplicaron registros.`, 'info');
                    return;
                }

                const confirmar = await mostrarConfirmacionModerna({
                    titulo: 'Vista previa del día normal',
                    mensaje: armarMensajeVistaPreviaCoberturaNormal(fecha, registrosAInsertar, omitidos, conflictosDetectados),
                    textoAceptar: 'Generar',
                    tipo: conflictosDetectados.length > 0 ? 'warning' : 'info'
                });
                if(!confirmar) return;

                if(btn) btn.innerText = 'Generando...';

                const { error } = await supabaseClient
                    .from(TABLAS.COBERTURAS_DIARIAS)
                    .insert(registrosAInsertar);

                if(error) {
                    mostrarToast('No se pudo generar la cobertura normal: ' + error.message, 'error');
                    return;
                }

                const filtroDesde = document.getElementById('filtroCoberturaDesde');
                const filtroHasta = document.getElementById('filtroCoberturaHasta');
                const filtroEstado = document.getElementById('filtroEstadoCoberturaDiaria');
                if(filtroDesde) filtroDesde.value = fecha;
                if(filtroHasta) filtroHasta.value = fecha;
                if(filtroEstado) filtroEstado.value = 'todos';

                await listarCoberturasDiarias();

                const extraConflictos = conflictosDetectados.length > 0 ? ` ${conflictosDetectados.length} registro(s) quedaron como FALTA CUBRIR para revisión.` : '';
                mostrarToast(`Cobertura normal del día generada con éxito. Se crearon ${registrosAInsertar.length} registro(s).${extraConflictos}`, conflictosDetectados.length > 0 ? 'warning' : 'success');
            } finally {
                if(btn) {
                    btn.disabled = false;
                    btn.innerText = '🧾 Normal';
                }
            }
        }

        function obtenerFechaBaseFiltroCobertura() {
            const desde = document.getElementById('filtroCoberturaDesde')?.value || '';
            const hasta = document.getElementById('filtroCoberturaHasta')?.value || '';
            return desde || hasta || obtenerFechaActualISO();
        }

        function fijarFiltroCoberturaEnFecha(fechaISO) {
            const desde = document.getElementById('filtroCoberturaDesde');
            const hasta = document.getElementById('filtroCoberturaHasta');
            const panelFiltros = document.getElementById('panelFiltrosDiario');
            if(desde) desde.value = fechaISO;
            if(hasta) hasta.value = fechaISO;
            if(panelFiltros) panelFiltros.open = true;
            renderizarTablaCoberturasDiarias();
        }

        window.moverFiltroCoberturaDia = function(diferenciaDias) {
            const fechaBase = diferenciaDias === 0 ? obtenerFechaActualISO() : obtenerFechaBaseFiltroCobertura();
            fijarFiltroCoberturaEnFecha(obtenerFechaRelativaISO(fechaBase, diferenciaDias));
        }
        window.limpiarFiltrosCoberturasDiarias = function() {
            const desde = document.getElementById('filtroCoberturaDesde');
            const hasta = document.getElementById('filtroCoberturaHasta');
            const area = document.getElementById('filtroAreaCoberturaDiaria');
            const estado = document.getElementById('filtroEstadoCoberturaDiaria');
            if(desde) desde.value = '';
            if(hasta) hasta.value = '';
            if(area) area.value = 'todas';
            if(estado) estado.value = 'todos';
            renderizarTablaCoberturasDiarias();
        }

        function aplicarEstiloCeldaExcel(cell, opciones = {}) {
            cell.font = { name: 'Segoe UI', size: opciones.size || 10, bold: !!opciones.bold, italic: !!opciones.italic, color: { argb: opciones.color || 'FF111827' } };
            cell.alignment = { vertical: 'middle', horizontal: opciones.align || 'center', wrapText: opciones.wrap !== false };
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
            };
            if(opciones.fill) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: opciones.fill } };
            }
        }

        function obtenerTextoFiltroDiarioExcel() {
            const desde = document.getElementById('filtroCoberturaDesde')?.value || '';
            const hasta = document.getElementById('filtroCoberturaHasta')?.value || '';
            const area = document.getElementById('filtroAreaCoberturaDiaria')?.value || 'todas';
            const estado = document.getElementById('filtroEstadoCoberturaDiaria')?.value || 'todos';
            const periodo = desde && hasta
                ? `${formatearFechaExcel(desde)} al ${formatearFechaExcel(hasta)}`
                : desde
                    ? `Desde ${formatearFechaExcel(desde)}`
                    : hasta
                        ? `Hasta ${formatearFechaExcel(hasta)}`
                        : 'Todos los registros cargados';

            return {
                periodo,
                area: area === 'todas' ? 'Todas las áreas' : area,
                estado: estado === 'todos' ? 'Todos los estados' : estado === 'pendientes' ? 'Pendientes / problemas' : estado
            };
        }

        function obtenerColorEstadoExcel(estado) {
            if(estado === 'CUBIERTO') return 'FFD1FAE5';
            if(estado === 'CUBIERTO PARCIAL') return 'FFFEF3C7';
            if(estado === 'NO REQUIERE COBERTURA') return 'FFDBEAFE';
            if(estado === 'NO CUBIERTO') return 'FFFEE2E2';
            if(estado === 'CANCELADO') return 'FFE5E7EB';
            if(estado === 'FALTA CUBRIR') return 'FFFFEDD5';
            return 'FFF9FAFB';
        }

        function esEstadoProblemaRegistroDiario(estado) {
            return ['FALTA CUBRIR', 'NO CUBIERTO', 'CUBIERTO PARCIAL'].includes(estado);
        }

        function esCoberturaNormalRegistroDiario(reg) {
            return reg.tipo_novedad === 'Cobertura normal del titular' || (reg.requiere_cobertura === false && reg.estado_cobertura === 'CUBIERTO');
        }

        function obtenerTextoLimpioExcel(valor) {
            const limpio = limpiarMarcasInternasRegistroDiario(valor);
            return limpio || '-';
        }

        function crearHojaConTitulo(workbook, nombre, titulo, columnasMerge = 'A:H') {
            const ws = workbook.addWorksheet(nombre);
            ws.views = [{ showGridLines: false }];
            ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
            const filaTitulo = ws.addRow([titulo]);
            ws.mergeCells(`${columnasMerge.split(':')[0]}${filaTitulo.number}:${columnasMerge.split(':')[1]}${filaTitulo.number}`);
            filaTitulo.height = 30;
            aplicarEstiloCeldaExcel(filaTitulo.getCell(1), { bold: true, size: 14, fill: 'FF10B981', color: 'FFFFFFFF' });
            return ws;
        }

        function agregarFilaCabeceraTablaExcel(row, fill = 'FFD1FAE5') {
            row.height = 24;
            row.eachCell(cell => aplicarEstiloCeldaExcel(cell, { bold: true, fill }));
        }

        function agregarFilaDatoTablaExcel(row, index, fill = null) {
            row.height = 23;
            row.eachCell(cell => aplicarEstiloCeldaExcel(cell, { fill: fill || (index % 2 === 0 ? 'FFFFFFFF' : 'FFF9FAFB') }));
        }

        function contarPorFiltro(registros, filtro) {
            return registros.filter(filtro).length;
        }

        function obtenerResumenPorAgenteExcel(registros) {
            const mapa = new Map();
            const crear = (id, nombre) => {
                const clave = id ? String(id) : nombre;
                if(!mapa.has(clave)) {
                    mapa.set(clave, {
                        nombre,
                        comoTitular: 0,
                        vecesCubrio: 0,
                        cubiertosTitular: 0,
                        problemasTitular: 0,
                        normalesTitular: 0,
                        novedadesTitular: 0,
                        ultimaFecha: ''
                    });
                }
                return mapa.get(clave);
            };

            registros.forEach(reg => {
                const titular = crear(reg.agente_titular_id, obtenerNombreAgentePorId(reg.agente_titular_id));
                titular.comoTitular += 1;
                if(reg.estado_cobertura === 'CUBIERTO') titular.cubiertosTitular += 1;
                if(esEstadoProblemaRegistroDiario(reg.estado_cobertura)) titular.problemasTitular += 1;
                if(esCoberturaNormalRegistroDiario(reg)) titular.normalesTitular += 1;
                else titular.novedadesTitular += 1;
                if(!titular.ultimaFecha || reg.fecha > titular.ultimaFecha) titular.ultimaFecha = reg.fecha;

                if(reg.agente_cobertura_id) {
                    const cobertura = crear(reg.agente_cobertura_id, obtenerNombreAgentePorId(reg.agente_cobertura_id));
                    cobertura.vecesCubrio += 1;
                    if(!cobertura.ultimaFecha || reg.fecha > cobertura.ultimaFecha) cobertura.ultimaFecha = reg.fecha;
                }
            });

            return [...mapa.values()].sort((a, b) => b.comoTitular - a.comoTitular || a.nombre.localeCompare(b.nombre));
        }

        function obtenerResumenAreaTurnoExcel(registros) {
            const mapa = new Map();
            registros.forEach(reg => {
                const area = reg.area || '-';
                const turno = reg.turno || '-';
                const clave = `${area}__${turno}`;
                if(!mapa.has(clave)) {
                    mapa.set(clave, { area, turno, total: 0, cubiertos: 0, problemas: 0, faltaCubrir: 0, noCubierto: 0, parcial: 0, cancelados: 0 });
                }
                const item = mapa.get(clave);
                item.total += 1;
                if(reg.estado_cobertura === 'CUBIERTO') item.cubiertos += 1;
                if(esEstadoProblemaRegistroDiario(reg.estado_cobertura)) item.problemas += 1;
                if(reg.estado_cobertura === 'FALTA CUBRIR') item.faltaCubrir += 1;
                if(reg.estado_cobertura === 'NO CUBIERTO') item.noCubierto += 1;
                if(reg.estado_cobertura === 'CUBIERTO PARCIAL') item.parcial += 1;
                if(reg.estado_cobertura === 'CANCELADO') item.cancelados += 1;
            });
            return [...mapa.values()].sort((a, b) => a.area.localeCompare(b.area) || a.turno.localeCompare(b.turno));
        }

        function obtenerResumenPorDiaExcel(registros) {
            const mapa = new Map();
            registros.forEach(reg => {
                if(!mapa.has(reg.fecha)) {
                    mapa.set(reg.fecha, { fecha: reg.fecha, total: 0, cubiertos: 0, problemas: 0, novedades: 0, normales: 0 });
                }
                const item = mapa.get(reg.fecha);
                item.total += 1;
                if(reg.estado_cobertura === 'CUBIERTO') item.cubiertos += 1;
                if(esEstadoProblemaRegistroDiario(reg.estado_cobertura)) item.problemas += 1;
                if(esCoberturaNormalRegistroDiario(reg)) item.normales += 1;
                else item.novedades += 1;
            });
            return [...mapa.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));
        }

        window.exportarCoberturasDiariasExcel = async function() {
            const registrosFiltrados = obtenerCoberturasDiariasFiltradas();
            if(registrosFiltrados.length === 0) {
                mostrarToast('No hay registros diarios para exportar con los filtros seleccionados.', 'warning');
                return;
            }

            const registros = [...registrosFiltrados].sort((a, b) => {
                if(a.fecha !== b.fecha) return a.fecha.localeCompare(b.fecha);
                if((a.area || '') !== (b.area || '')) return (a.area || '').localeCompare(b.area || '');
                return (a.turno || '').localeCompare(b.turno || '');
            });

            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'Gestor de Guardias MITIC';
            workbook.created = new Date();
            workbook.modified = new Date();

            const filtros = obtenerTextoFiltroDiarioExcel();
            const total = registros.length;
            const cubiertos = contarPorFiltro(registros, r => r.estado_cobertura === 'CUBIERTO');
            const problemas = contarPorFiltro(registros, r => esEstadoProblemaRegistroDiario(r.estado_cobertura));
            const normales = contarPorFiltro(registros, r => esCoberturaNormalRegistroDiario(r));
            const novedades = total - normales;
            const porcentajeCubierto = total ? cubiertos / total : 0;

            const wsResumen = crearHojaConTitulo(workbook, 'Resumen', 'REGISTRO DIARIO DE COBERTURAS - CAMPAÑA MITIC', 'A:H');
            wsResumen.addRow(['Generado:', new Date().toLocaleString('es-PY'), 'Período:', filtros.periodo, 'Área:', filtros.area, 'Estado:', filtros.estado])
                .eachCell(cell => aplicarEstiloCeldaExcel(cell, { fill: 'FFF9FAFB' }));
            wsResumen.addRow([]);

            const filaKpiTitulo = wsResumen.addRow(['Indicadores principales']);
            wsResumen.mergeCells(`A${filaKpiTitulo.number}:H${filaKpiTitulo.number}`);
            aplicarEstiloCeldaExcel(filaKpiTitulo.getCell(1), { bold: true, fill: 'FFECFDF5', align: 'left' });

            const filaKpi = wsResumen.addRow(['Total', total, 'Cubiertos', cubiertos, 'Problemas', problemas, '% cubierto', porcentajeCubierto]);
            filaKpi.eachCell((cell, colNumber) => aplicarEstiloCeldaExcel(cell, { bold: colNumber % 2 === 1, fill: colNumber % 2 === 1 ? 'FFD1FAE5' : 'FFFFFFFF' }));
            filaKpi.getCell(8).numFmt = '0%';
            const filaKpi2 = wsResumen.addRow(['Normales', normales, 'Novedades/Relevos', novedades, 'Días incluidos', new Set(registros.map(r => r.fecha)).size, 'Agentes titulares', new Set(registros.map(r => r.agente_titular_id).filter(Boolean)).size]);
            filaKpi2.eachCell((cell, colNumber) => aplicarEstiloCeldaExcel(cell, { bold: colNumber % 2 === 1, fill: colNumber % 2 === 1 ? 'FFD1FAE5' : 'FFFFFFFF' }));
            wsResumen.addRow([]);

            const estados = ['FALTA CUBRIR', 'CUBIERTO', 'CUBIERTO PARCIAL', 'NO REQUIERE COBERTURA', 'NO CUBIERTO', 'CANCELADO'];
            const headersResumen = wsResumen.addRow(['Estado', 'Cantidad', 'Porcentaje', 'Registro Civil', 'Identificaciones', 'Otros', 'Normal', 'Novedad/Relevo']);
            agregarFilaCabeceraTablaExcel(headersResumen);
            estados.forEach((estado, index) => {
                const registrosEstado = registros.filter(r => (r.estado_cobertura || 'FALTA CUBRIR') === estado);
                const row = wsResumen.addRow([
                    estado,
                    registrosEstado.length,
                    total ? registrosEstado.length / total : 0,
                    contarPorFiltro(registrosEstado, r => r.area === 'Registro Civil'),
                    contarPorFiltro(registrosEstado, r => r.area === 'Identificaciones'),
                    contarPorFiltro(registrosEstado, r => !['Registro Civil', 'Identificaciones'].includes(r.area)),
                    contarPorFiltro(registrosEstado, r => esCoberturaNormalRegistroDiario(r)),
                    contarPorFiltro(registrosEstado, r => !esCoberturaNormalRegistroDiario(r))
                ]);
                agregarFilaDatoTablaExcel(row, index, obtenerColorEstadoExcel(estado));
                row.getCell(3).numFmt = '0%';
            });
            wsResumen.addRow([]);

            const headersAreaTurno = wsResumen.addRow(['Área', 'Turno', 'Total', 'Cubiertos', 'Problemas', 'Falta cubrir', 'No cubierto', 'Parcial']);
            agregarFilaCabeceraTablaExcel(headersAreaTurno, 'FFE0F2FE');
            obtenerResumenAreaTurnoExcel(registros).forEach((item, index) => {
                const row = wsResumen.addRow([item.area, item.turno, item.total, item.cubiertos, item.problemas, item.faltaCubrir, item.noCubierto, item.parcial]);
                agregarFilaDatoTablaExcel(row, index);
            });
            wsResumen.columns = [
                { width: 24 }, { width: 14 }, { width: 14 }, { width: 18 }, { width: 18 }, { width: 14 }, { width: 18 }, { width: 18 }
            ];

            const wsAgentes = workbook.addWorksheet('Por Agente');
            wsAgentes.views = [{ showGridLines: false, state: 'frozen', ySplit: 1 }];
            wsAgentes.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
            const headersAgentes = wsAgentes.addRow(['Agente', 'Registros como titular', 'Veces que cubrió', 'Cubiertos como titular', 'Problemas como titular', 'Normales como titular', 'Novedades/Relevos', 'Última fecha']);
            agregarFilaCabeceraTablaExcel(headersAgentes, 'FFE0E7FF');
            obtenerResumenPorAgenteExcel(registros).forEach((agente, index) => {
                const row = wsAgentes.addRow([
                    agente.nombre,
                    agente.comoTitular,
                    agente.vecesCubrio,
                    agente.cubiertosTitular,
                    agente.problemasTitular,
                    agente.normalesTitular,
                    agente.novedadesTitular,
                    formatearFechaExcel(agente.ultimaFecha)
                ]);
                agregarFilaDatoTablaExcel(row, index, agente.problemasTitular > 0 ? 'FFFFEDD5' : null);
            });
            wsAgentes.columns = [
                { width: 28 }, { width: 20 }, { width: 16 }, { width: 20 }, { width: 20 }, { width: 20 }, { width: 20 }, { width: 14 }
            ];
            wsAgentes.autoFilter = { from: 'A1', to: 'H1' };

            const wsDias = workbook.addWorksheet('Por Día');
            wsDias.views = [{ showGridLines: false, state: 'frozen', ySplit: 1 }];
            const headersDias = wsDias.addRow(['Fecha', 'Día', 'Total', 'Cubiertos', 'Problemas', 'Normales', 'Novedades/Relevos']);
            agregarFilaCabeceraTablaExcel(headersDias, 'FFFEF3C7');
            obtenerResumenPorDiaExcel(registros).forEach((dia, index) => {
                const row = wsDias.addRow([
                    formatearFechaExcel(dia.fecha),
                    obtenerDiaSemana(dia.fecha),
                    dia.total,
                    dia.cubiertos,
                    dia.problemas,
                    dia.normales,
                    dia.novedades
                ]);
                agregarFilaDatoTablaExcel(row, index, dia.problemas > 0 ? 'FFFFEDD5' : null);
            });
            wsDias.columns = [
                { width: 13 }, { width: 14 }, { width: 10 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 20 }
            ];
            wsDias.autoFilter = { from: 'A1', to: 'G1' };

            const wsDetalle = workbook.addWorksheet('Detalle Diario');
            wsDetalle.views = [{ showGridLines: false, state: 'frozen', ySplit: 1 }];
            wsDetalle.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

            const headers = ['Fecha', 'Día', 'Área', 'Turno', 'Agente del puesto', 'Tipo de registro', 'Motivo', 'Horario afectado', '¿Hubo novedad/relevo?', 'Estado', 'Agente que cubrió', 'Forma de cobertura', 'Resultado', 'Observaciones'];
            const headerRow = wsDetalle.addRow(headers);
            agregarFilaCabeceraTablaExcel(headerRow);

            registros.forEach((reg, index) => {
                const row = wsDetalle.addRow([
                    formatearFechaExcel(reg.fecha),
                    obtenerDiaSemana(reg.fecha),
                    reg.area || '-',
                    reg.turno || '-',
                    obtenerNombreAgentePorId(reg.agente_titular_id),
                    obtenerTextoLimpioExcel(reg.tipo_novedad),
                    obtenerTextoLimpioExcel(reg.motivo),
                    reg.horario_afectado || obtenerHorarioPorTurnoRegistroDiario(reg.turno) || '-',
                    reg.requiere_cobertura === false ? 'No, cobertura normal' : 'Sí',
                    reg.estado_cobertura || 'FALTA CUBRIR',
                    reg.agente_cobertura_id ? obtenerNombreAgentePorId(reg.agente_cobertura_id) : '-',
                    obtenerTextoLimpioExcel(reg.forma_cobertura),
                    obtenerTextoLimpioExcel(reg.resultado),
                    obtenerTextoLimpioExcel(reg.observaciones)
                ]);
                row.height = 26;
                row.eachCell((cell, colNumber) => {
                    const fill = colNumber === 10 ? obtenerColorEstadoExcel(reg.estado_cobertura || 'FALTA CUBRIR') : (index % 2 === 0 ? 'FFFFFFFF' : 'FFF9FAFB');
                    aplicarEstiloCeldaExcel(cell, { fill });
                });
            });

            wsDetalle.columns = [
                { width: 13 }, { width: 12 }, { width: 18 }, { width: 14 }, { width: 24 }, { width: 28 },
                { width: 36 }, { width: 20 }, { width: 20 }, { width: 22 }, { width: 24 }, { width: 24 },
                { width: 34 }, { width: 38 }
            ];
            wsDetalle.autoFilter = { from: 'A1', to: 'N1' };

            const pendientes = registros.filter(r => esEstadoProblemaRegistroDiario(r.estado_cobertura));
            const wsPendientes = workbook.addWorksheet('Pendientes y Problemas');
            wsPendientes.views = [{ showGridLines: false, state: 'frozen', ySplit: 1 }];
            wsPendientes.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
            const headersPendientes = ['Fecha', 'Día', 'Área', 'Turno', 'Agente del puesto', 'Tipo de registro', 'Estado', 'Motivo', 'Resultado / Observaciones'];
            const headerPendientes = wsPendientes.addRow(headersPendientes);
            agregarFilaCabeceraTablaExcel(headerPendientes, 'FFFEE2E2');

            if(pendientes.length === 0) {
                const row = wsPendientes.addRow(['Sin pendientes o problemas con los filtros seleccionados']);
                wsPendientes.mergeCells(`A${row.number}:I${row.number}`);
                aplicarEstiloCeldaExcel(row.getCell(1), { italic: true, color: 'FF6B7280' });
            } else {
                pendientes.forEach((reg, index) => {
                    const row = wsPendientes.addRow([
                        formatearFechaExcel(reg.fecha),
                        obtenerDiaSemana(reg.fecha),
                        reg.area || '-',
                        reg.turno || '-',
                        obtenerNombreAgentePorId(reg.agente_titular_id),
                        obtenerTextoLimpioExcel(reg.tipo_novedad),
                        reg.estado_cobertura || 'FALTA CUBRIR',
                        obtenerTextoLimpioExcel(reg.motivo),
                        [obtenerTextoLimpioExcel(reg.resultado), obtenerTextoLimpioExcel(reg.observaciones)].filter(v => v && v !== '-').join(' / ') || '-'
                    ]);
                    agregarFilaDatoTablaExcel(row, index, obtenerColorEstadoExcel(reg.estado_cobertura || 'FALTA CUBRIR'));
                });
            }
            wsPendientes.columns = [
                { width: 13 }, { width: 12 }, { width: 18 }, { width: 14 }, { width: 24 }, { width: 28 }, { width: 20 }, { width: 36 }, { width: 44 }
            ];
            wsPendientes.autoFilter = { from: 'A1', to: 'I1' };

            workbook.eachSheet(ws => {
                ws.eachRow(row => {
                    row.eachCell(cell => {
                        if(typeof cell.value === 'string' && cell.value.length > 70) {
                            cell.alignment = { ...cell.alignment, wrapText: true, vertical: 'top' };
                        }
                    });
                });
            });

            const nombreArchivo = `Registro_Diario_Coberturas_MITIC_${new Date().toISOString().split('T')[0]}.xlsx`;
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = nombreArchivo;
            link.click();
            URL.revokeObjectURL(link.href);
        }

        // ============================================================

        // ============================================================
