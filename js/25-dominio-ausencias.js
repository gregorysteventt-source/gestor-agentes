        // ============================================================
        // 6b) DOMINIO ÚNICO DE AUSENCIAS Y PEDIDOS
        // ============================================================
        // Antes, el mismo hecho estaba escrito tres veces con tres vocabularios:
        //   - Ausencias:      Vacaciones / Día Libre / Permiso / Reposo
        //   - Pedidos:        8 motivos, entre ellos "Día libre por horas extras"
        //   - Registro diario: 13 tipos, entre ellos "Día libre por horas extras"
        // Y había tres taxonomías de estado (4, 6 y 9 valores) que no coincidían.
        //
        // Este archivo es la única definición de esos vocabularios. Las pantallas ya no
        // tienen listas propias: piden los motivos acá.
        //
        // IMPORTANTE: el campo `valor` es el texto que se guarda en la base. Se respeta
        // el que ya usa cada tabla para no romper el historial. Las variantes viejas
        // ("Día libre por horas extras", "Permiso particular") quedan como alias, así
        // que un registro viejo y uno nuevo caen en el mismo motivo canónico.

        // categoria: 'dia'     -> el agente no viene todo el día
        //            'parcial' -> entra más tarde, sale antes o cambia de turno
        //            'cobertura' -> no es una ausencia, es un tipo de registro de cobertura
        const MOTIVOS = [
            {
                id: 'vacaciones',
                etiqueta: 'Vacaciones',
                valor: 'Vacaciones',
                categoria: 'dia',
                aplicaA: ['ausencias', 'pedidos', 'diario'],
                requiereCobertura: true,
                alias: ['vacaciones', 'vacacion']
            },
            {
                id: 'dia_libre',
                etiqueta: 'Día libre',
                valor: 'Día Libre',
                categoria: 'dia',
                aplicaA: ['ausencias', 'pedidos', 'diario'],
                requiereCobertura: true,
                alias: ['dia libre', 'dia libre por horas extras', 'libre', 'franco']
            },
            {
                id: 'permiso',
                etiqueta: 'Permiso',
                valor: 'Permiso',
                categoria: 'dia',
                aplicaA: ['ausencias', 'pedidos', 'diario'],
                requiereCobertura: true,
                alias: ['permiso', 'permiso particular']
            },
            {
                id: 'reposo',
                etiqueta: 'Reposo',
                valor: 'Reposo',
                categoria: 'dia',
                aplicaA: ['ausencias', 'pedidos', 'diario'],
                requiereCobertura: true,
                alias: ['reposo', 'reposo medico']
            },
            {
                id: 'consulta_medica',
                etiqueta: 'Consulta médica',
                valor: 'Consulta médica',
                categoria: 'parcial',
                aplicaA: ['ausencias', 'pedidos', 'diario'],
                requiereCobertura: true,
                alias: ['consulta medica', 'consulta', 'medico']
            },
            {
                id: 'cumpleanos',
                etiqueta: 'Cumpleaños',
                valor: 'Cumpleaños',
                categoria: 'dia',
                aplicaA: ['ausencias', 'pedidos', 'diario'],
                requiereCobertura: false,
                alias: ['cumpleanos', 'cumple']
            },
            {
                id: 'ausencia_imprevista',
                etiqueta: 'Ausencia imprevista',
                valor: 'Ausencia imprevista',
                categoria: 'dia',
                aplicaA: ['pedidos', 'diario'],
                requiereCobertura: true,
                alias: ['ausencia imprevista', 'imprevisto', 'no vino']
            },
            {
                id: 'entrada_tarde',
                etiqueta: 'Entrada más tarde',
                valor: 'Entrada más tarde',
                categoria: 'parcial',
                aplicaA: ['ausencias', 'pedidos', 'diario'],
                requiereCobertura: true,
                alias: ['entrada mas tarde', 'entrada mas tarde por horas extras', 'entrada tarde']
            },
            {
                id: 'salida_temprano',
                etiqueta: 'Salida más temprano',
                valor: 'Salida más temprano',
                categoria: 'parcial',
                aplicaA: ['ausencias', 'pedidos', 'diario'],
                requiereCobertura: true,
                alias: ['salida mas temprano', 'salida mas temprano por horas extras', 'salida temprano']
            },
            {
                id: 'cambio_turno',
                etiqueta: 'Cambio de turno',
                valor: 'Cambio de turno',
                categoria: 'parcial',
                aplicaA: ['pedidos', 'diario'],
                requiereCobertura: true,
                alias: ['cambio de turno', 'cambio turno']
            },
            {
                id: 'cobertura_normal',
                etiqueta: 'Cobertura normal',
                valor: 'Cobertura normal del titular',
                categoria: 'cobertura',
                aplicaA: ['diario'],
                requiereCobertura: false,
                alias: ['cobertura normal', 'cobertura normal del titular', 'normal']
            },
            {
                id: 'sabado_planificado',
                etiqueta: 'Sábado planificado',
                valor: 'Cobertura planificada de sábado',
                categoria: 'cobertura',
                aplicaA: ['diario'],
                requiereCobertura: false,
                alias: ['cobertura planificada de sabado', 'sabado planificado', 'guardia planificada de sabado']
            },
            {
                id: 'otro',
                etiqueta: 'Otro',
                valor: 'Otro',
                categoria: 'dia',
                aplicaA: ['ausencias', 'pedidos', 'diario'],
                requiereCobertura: false,
                alias: ['otro', 'otros', 'otra']
            }
        ];

        // Estados de cobertura: una sola taxonomía de 6 valores.
        // "novedad_estado" solo usaba 4; los otros dos se agregan al normalizar.
        const ESTADOS_COBERTURA = [
            { id: 'cubierto', valor: 'CUBIERTO', etiqueta: 'Cubierto', esProblema: false, requiereCobertura: false },
            { id: 'cubierto_parcial', valor: 'CUBIERTO PARCIAL', etiqueta: 'Cubierto parcial', esProblema: true, requiereCobertura: true },
            { id: 'falta_cubrir', valor: 'FALTA CUBRIR', etiqueta: 'Falta cubrir', esProblema: true, requiereCobertura: true },
            { id: 'no_cubierto', valor: 'NO CUBIERTO', etiqueta: 'No cubierto', esProblema: true, requiereCobertura: true },
            { id: 'no_requiere', valor: 'NO REQUIERE COBERTURA', etiqueta: 'No requiere cobertura', esProblema: false, requiereCobertura: false },
            { id: 'cancelado', valor: 'CANCELADO', etiqueta: 'Cancelado', esProblema: false, requiereCobertura: false }
        ];

        // Formas de cobertura: se mantienen como catálogo para poder validarlas,
        // pero no definen si un registro es un problema (eso lo hace el estado).
        const FORMAS_COBERTURA = [
            'Cobertura habitual',
            'Guardia planificada de sábado',
            'Relevo total',
            'Relevo parcial',
            'Cambio de turno',
            'Extensión de horario',
            'Cubierto por supervisor',
            'No se consiguió cobertura',
            'No requería cobertura'
        ];

        // Normaliza texto para comparar: sin acentos, minúsculas, espacios simples.
        function normalizarClaveDominio(valor = '') {
            return String(valor || '')
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toLowerCase()
                .replace(/\s+/g, ' ')
                .trim();
        }

        // Índice de alias -> motivo. Se arma una vez para no recorrer el array siempre.
        const INDICE_MOTIVOS = (() => {
            const indice = new Map();
            MOTIVOS.forEach(motivo => {
                indice.set(normalizarClaveDominio(motivo.id), motivo);
                indice.set(normalizarClaveDominio(motivo.valor), motivo);
                indice.set(normalizarClaveDominio(motivo.etiqueta), motivo);
                (motivo.alias || []).forEach(alias => {
                    indice.set(normalizarClaveDominio(alias), motivo);
                });
            });
            return indice;
        })();

        // Devuelve el motivo canónico para cualquier variante histórica.
        // Si no se reconoce, devuelve el motivo "otro" (nunca null).
        function obtenerMotivo(valor) {
            const clave = normalizarClaveDominio(valor);
            if (!clave) return null;
            return INDICE_MOTIVOS.get(clave) || MOTIVOS.find(m => m.id === 'otro');
        }

        function idMotivo(valor) {
            const motivo = obtenerMotivo(valor);
            return motivo ? motivo.id : 'otro';
        }

        function etiquetaMotivo(valor) {
            const motivo = obtenerMotivo(valor);
            return motivo ? motivo.etiqueta : String(valor || '');
        }

        // Motivos que corresponde ofrecer en cada pantalla.
        function motivosPara(pantalla) {
            return MOTIVOS.filter(motivo => motivo.aplicaA.includes(pantalla));
        }

        // ¿Este motivo implica que el agente no está disponible?
        function motivoRequiereCobertura(valor) {
            const motivo = obtenerMotivo(valor);
            return motivo ? motivo.requiereCobertura : true;
        }

        // ¿Dos motivos distintos son en realidad el mismo hecho?
        // Es lo que unifica "Día Libre" con "Día libre por horas extras".
        function mismoMotivo(valorA, valorB) {
            return idMotivo(valorA) === idMotivo(valorB);
        }

        // ---- Estados ----

        const INDICE_ESTADOS = (() => {
            const indice = new Map();
            ESTADOS_COBERTURA.forEach(estado => {
                indice.set(normalizarClaveDominio(estado.id), estado);
                indice.set(normalizarClaveDominio(estado.valor), estado);
                indice.set(normalizarClaveDominio(estado.etiqueta), estado);
            });
            // Variantes históricas de escritura.
            indice.set('pendiente', ESTADOS_COBERTURA.find(e => e.id === 'falta_cubrir'));
            indice.set('sin cubrir', ESTADOS_COBERTURA.find(e => e.id === 'falta_cubrir'));
            indice.set('parcial', ESTADOS_COBERTURA.find(e => e.id === 'cubierto_parcial'));
            return indice;
        })();

        function obtenerEstado(valor) {
            const clave = normalizarClaveDominio(valor);
            if (!clave) return null;
            return INDICE_ESTADOS.get(clave) || null;
        }

        // Un estado desconocido se considera problema: mejor revisarlo de más
        // que dar por cubierto algo que no lo está.
        function esEstadoProblema(valor) {
            const estado = obtenerEstado(valor);
            return estado ? estado.esProblema : true;
        }

        function estadoRequiereCobertura(valor) {
            const estado = obtenerEstado(valor);
            return estado ? estado.requiereCobertura : true;
        }

        function etiquetaEstado(valor) {
            const estado = obtenerEstado(valor);
            return estado ? estado.etiqueta : String(valor || '');
        }

        // Texto de los estados que cuentan como problema, para filtros y resúmenes.
        const ESTADOS_PROBLEMA = ESTADOS_COBERTURA.filter(e => e.esProblema).map(e => e.valor);

        // ---- Pintado de selects desde el catálogo ----

        // Rellena un <select> con los motivos de la pantalla, sin perder el valor
        // seleccionado. Si el valor actual no está en la lista, se agrega igual
        // marcado como histórico para no perderlo en silencio.
        function renderizarOpcionesMotivo(selectEl, pantalla, valorActual = null) {
            if (!selectEl) return;

            const valorPrevio = valorActual !== null ? valorActual : selectEl.value;
            const motivos = motivosPara(pantalla);
            const valores = new Set(motivos.map(m => m.valor));

            const opcionVacia = document.createElement('option');
            opcionVacia.value = '';
            opcionVacia.textContent = '-- Seleccionar --';

            const fragmento = document.createDocumentFragment();
            fragmento.appendChild(opcionVacia);

            motivos.forEach(motivo => {
                const opcion = document.createElement('option');
                opcion.value = motivo.valor;
                opcion.textContent = motivo.etiqueta;
                fragmento.appendChild(opcion);
            });

            // Conservar un valor viejo que ya no figure entre los motivos ofrecidos.
            if (valorPrevio && !valores.has(valorPrevio)) {
                const opcionHistorica = document.createElement('option');
                opcionHistorica.value = valorPrevio;
                opcionHistorica.textContent = `${etiquetaMotivo(valorPrevio)} (histórico)`;
                fragmento.appendChild(opcionHistorica);
            }

            selectEl.innerHTML = '';
            selectEl.appendChild(fragmento);

            // Solo se reasigna si hay un valor previo: si no, queda la primera opción.
            if (valorPrevio) selectEl.value = valorPrevio;
        }

        function renderizarOpcionesEstado(selectEl, valorActual = null, incluirVacio = true) {
            if (!selectEl) return;

            const valorPrevio = valorActual !== null ? valorActual : selectEl.value;
            const fragmento = document.createDocumentFragment();

            if (incluirVacio) {
                const opcionVacia = document.createElement('option');
                opcionVacia.value = '';
                opcionVacia.textContent = '-- Seleccionar --';
                fragmento.appendChild(opcionVacia);
            }

            ESTADOS_COBERTURA.forEach(estado => {
                const opcion = document.createElement('option');
                opcion.value = estado.valor;
                opcion.textContent = estado.valor;
                fragmento.appendChild(opcion);
            });

            selectEl.innerHTML = '';
            selectEl.appendChild(fragmento);
            if (valorPrevio) selectEl.value = valorPrevio;
        }

        // ---- Lectura unificada: una sola forma de ver "quién no está y por qué" ----
        //
        // No toca la base: toma las tres listas que ya están en memoria y las
        // presenta con la misma forma. Sirve para el calendario, los resúmenes y
        // cualquier reporte nuevo, sin consultar tres tablas con criterios distintos.

        function construirSolicitudUnificada({ origen, registro, desde, hasta, motivoValor, estadoValor, titulo, detalle }) {
            const motivo = obtenerMotivo(motivoValor);
            const estado = obtenerEstado(estadoValor);

            return {
                origen,                                  // 'ausencia' | 'pedido' | 'diario'
                id: registro?.id ?? null,
                agenteId: registro?.agente_id ?? registro?.agente_titular_id ?? null,
                desde: desde || registro?.fecha_inicio || registro?.desde || registro?.fecha || '',
                hasta: hasta || registro?.fecha_fin || registro?.hasta || registro?.fecha || '',
                motivoId: motivo ? motivo.id : 'otro',
                motivoEtiqueta: motivo ? motivo.etiqueta : (motivoValor || ''),
                categoria: motivo ? motivo.categoria : 'dia',
                estadoValor: estado ? estado.valor : (estadoValor || ''),
                estadoEtiqueta: estado ? estado.etiqueta : (estadoValor || ''),
                esProblema: estado ? estado.esProblema : false,
                titulo: titulo || (motivo ? motivo.etiqueta : ''),
                detalle: detalle || '',
                registroOriginal: registro ?? null
            };
        }

        // Une las tres fuentes en una lista ordenada por fecha de inicio.
        // Los registros del diario que solo son "cobertura normal" no son ausencias:
        // se excluyen para que la lectura signifique lo mismo que en el calendario.
        function obtenerSolicitudesUnificadas() {
            const solicitudes = [];

            (ausenciasEnMemoria || []).forEach(aus => {
                solicitudes.push(construirSolicitudUnificada({
                    origen: 'ausencia',
                    registro: aus,
                    motivoValor: aus.tipo,
                    titulo: aus.tipo,
                    detalle: aus.notas || ''
                }));
            });

            (novedadesEnMemoria || []).forEach(pedido => {
                solicitudes.push(construirSolicitudUnificada({
                    origen: 'pedido',
                    registro: pedido,
                    motivoValor: pedido.motivo_tipo || pedido.tipo,
                    estadoValor: pedido.estado,
                    titulo: pedido.motivo_tipo || pedido.tipo || 'Pedido',
                    detalle: pedido.detalle || ''
                }));
            });

            (coberturasDiariasEnMemoria || []).forEach(registro => {
                const motivo = obtenerMotivo(registro.tipo_novedad);
                if (motivo && motivo.categoria === 'cobertura') return;

                solicitudes.push(construirSolicitudUnificada({
                    origen: 'diario',
                    registro,
                    motivoValor: registro.tipo_novedad,
                    estadoValor: registro.estado_cobertura,
                    titulo: registro.tipo_novedad || 'Registro diario',
                    detalle: registro.observaciones || ''
                }));
            });

            return solicitudes.sort((a, b) => String(a.desde).localeCompare(String(b.desde)));
        }

        // Agrupa por motivo canónico: "Día Libre" y "Día libre por horas extras"
        // caen ahora en la misma fila de cualquier resumen.
        function contarSolicitudesPorMotivo(solicitudes = []) {
            const conteo = new Map();
            solicitudes.forEach(solicitud => {
                conteo.set(solicitud.motivoId, (conteo.get(solicitud.motivoId) || 0) + 1);
            });
            return [...conteo.entries()]
                .map(([motivoId, cantidad]) => ({
                    motivoId,
                    etiqueta: etiquetaMotivo(motivoId),
                    cantidad
                }))
                .sort((a, b) => b.cantidad - a.cantidad);
        }

        // ---- Selección tolerante a valores históricos ----
        // Al editar un registro viejo, el select puede no tener su valor exacto.
        // Estas funciones lo llevan al motivo canónico y, si aun así no existe,
        // agregan la opción para no perder el dato al guardar.

        function seleccionarMotivoEnSelect(selectEl, valor) {
            if (!selectEl) return;

            const motivo = obtenerMotivo(valor);
            const objetivo = motivo ? motivo.valor : (valor || '');
            const existe = Array.from(selectEl.options).some(opcion => opcion.value === objetivo);

            if (existe) {
                selectEl.value = objetivo;
                return;
            }

            const opcionHistorica = document.createElement('option');
            opcionHistorica.value = valor || '';
            opcionHistorica.textContent = `${etiquetaMotivo(valor)} (histórico)`;
            selectEl.appendChild(opcionHistorica);
            selectEl.value = opcionHistorica.value;
        }

        function seleccionarEstadoEnSelect(selectEl, valor) {
            if (!selectEl) return;

            const estado = obtenerEstado(valor);
            const objetivo = estado ? estado.valor : (valor || '');
            const existe = Array.from(selectEl.options).some(opcion => opcion.value === objetivo);

            if (existe) {
                selectEl.value = objetivo;
                return;
            }

            const opcionHistorica = document.createElement('option');
            opcionHistorica.value = valor || '';
            opcionHistorica.textContent = `${String(valor || '')} (histórico)`;
            selectEl.appendChild(opcionHistorica);
            selectEl.value = opcionHistorica.value;
        }
        // ============================================================
