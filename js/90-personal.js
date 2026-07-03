        // 16) GESTIÓN DE PERSONAL
        // ============================================================
        // Renderizar dinámicamente el plantel de personal administrativo cargado
        function obtenerAgentesFiltradosPersonal() {
            const inputBuscador = document.getElementById('buscadorPersonal');
            const filtro = normalizarTextoBusqueda(inputBuscador ? inputBuscador.value : "");

            if(!filtro) {
                return agentesEnMemoria;
            }

            return agentesEnMemoria.filter(agente => {
                const textoComparable = [
                    agente.nombre_corto,
                    agente.modalidad,
                    agente.sucursal,
                    agente.activo === false ? 'inactivo baja desactivado' : 'activo habilitado'
                ]
                .map(valor => normalizarTextoBusqueda(valor))
                .join(' ');

                return textoComparable.includes(filtro);
            });
        }
        function actualizarContadorPersonal(totalFiltrado, totalGeneral) {
            const contador = document.getElementById('contadorPersonal');
            const inputBuscador = document.getElementById('buscadorPersonal');
            if(!contador) return;

            const filtro = inputBuscador ? inputBuscador.value.trim() : "";

            if(!filtro) {
                contador.innerText = `Mostrando todos los agentes registrados: ${totalGeneral}.`;
            } else {
                contador.innerText = `Resultado de búsqueda: ${totalFiltrado} de ${totalGeneral} agente(s).`;
            }
        }

        function setupBuscadorPersonal() {
            const inputBuscador = document.getElementById('buscadorPersonal');
            const btnLimpiar = document.getElementById('btnLimpiarBuscadorPersonal');

            if(inputBuscador) {
                inputBuscador.addEventListener('input', () => {
                    renderizarTablaPersonal();
                });
            }

            if(btnLimpiar) {
                btnLimpiar.addEventListener('click', () => {
                    if(inputBuscador) {
                        inputBuscador.value = "";
                        inputBuscador.focus();
                    }
                    renderizarTablaPersonal();
                });
            }
        }

        // Renderizar dinámicamente el plantel de personal administrativo cargado
        function renderizarTablaPersonal() {
            const tbody = document.getElementById('listaPersonalAdmin');
            if(!tbody) return;

            const agentesFiltrados = obtenerAgentesFiltradosPersonal();
            actualizarContadorPersonal(agentesFiltrados.length, agentesEnMemoria.length);

            if(agentesEnMemoria.length === 0) {
                tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-gray-400">No hay agentes registrados.</td></tr>`;
                return;
            }

            if(agentesFiltrados.length === 0) {
                tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-gray-400">No se encontraron agentes con ese criterio de búsqueda.</td></tr>`;
                return;
            }

            tbody.innerHTML = "";
            agentesFiltrados.forEach(agente => {
                const esActivo = agente.activo !== false;
                const modalidadSegura = escaparHTML(agente.modalidad || '-');
                const badgeModalidad = esActivo 
                    ? `<span class="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[10px] font-bold uppercase">${modalidadSegura}</span>`
                    : `<span class="px-2 py-0.5 rounded bg-gray-100 text-gray-400 text-[10px] font-bold uppercase">${modalidadSegura}</span>`;
                
                const claseFila = esActivo ? "text-gray-700" : "text-gray-400 bg-gray-50 italic";
                const nombreMostrar = esActivo ? agente.nombre_corto : `${agente.nombre_corto} (Inactivo)`;
                
                const botonEstado = esActivo
                    ? `<button onclick="eliminarAgente(${agente.id})" class="text-red-600 hover:text-red-900 font-bold px-2 py-1" title="Dar de baja">✕</button>`
                    : `<button onclick="reactivarAgente(${agente.id})" class="text-green-600 hover:text-green-900 font-bold px-2 py-1" title="Reactivar">🔄</button>`;

                const botonEditar = `<button onclick="editarAgente(${agente.id})" class="text-indigo-600 hover:text-indigo-900 font-bold px-2 py-1" title="Editar datos del agente">✏️</button>`;

                tbody.innerHTML += `
                    <tr class="border-b hover:bg-gray-50 ${claseFila}">
                        <td class="p-3 font-medium">${escaparHTML(nombreMostrar)}</td>
                        <td class="p-3">${badgeModalidad}</td>
                        <td class="p-3 text-gray-500">${escaparHTML(agente.sucursal || '-')}</td>
                        <td class="p-3 text-center whitespace-nowrap">${botonEditar}${botonEstado}</td>
                    </tr>
                `;
            });
        }

        // Dar de baja lógica a un agente (Se oculta del planificador pero se preservan los registros históricos)
        window.eliminarAgente = async function(id) {
            if(agenteEditandoId === id) {
                mostrarToast("Ese agente está abierto en modo edición. Cancelá la edición antes de darlo de baja.", "warning");
                return;
            }
            if(!await mostrarConfirmacionModerna({
                titulo: 'Dar de baja agente',                mensaje: `¿Seguro que querés dar de baja a este agente?

Esto lo ocultará de los selectores de turnos y ausencias, pero mantendrá de forma segura su nombre en los reportes de Excel históricos.`,
                textoAceptar: 'Dar de baja',
                tipo: 'warning'
            })) return;

            const { error } = await supabaseClient
                .from(TABLAS.AGENTES)
                .update({ activo: false })
                .eq('id', id);

            if(error) {
                mostrarToast("No se pudo dar de baja al agente: " + error.message, "error");
            } else {
                mostrarToast("¡Agente dado de baja con éxito!", "success");
                await cargarAgentes(); 
            }
        }

        // Reactivar agente inactivo
        window.reactivarAgente = async function(id) {
            if(!await mostrarConfirmacionModerna({
                titulo: 'Reactivar agente',
                mensaje: '¿Querés volver a activar a este agente para asignarle turnos?',
                textoAceptar: 'Reactivar',
                tipo: 'success'
            })) return;

            const { error } = await supabaseClient
                .from(TABLAS.AGENTES)
                .update({ activo: true })
                .eq('id', id);

            if(error) {
                mostrarToast("No se pudo reactivar al agente: " + error.message, "error");
            } else {
                mostrarToast("¡Agente reactivado con éxito!", "success");
                await cargarAgentes(); 
            }
        }

        // Utilitarios para comparar datos de agentes y evitar duplicados accidentales
        function normalizarTextoBusqueda(valor) {
            return (valor || "")
                .toString()
                .trim()
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/\s+/g, ' ');
        }


        // Cambia el formulario de personal a modo alta o edición.
        function configurarFormularioAgente(modo, agente = null) {
            const titulo = document.getElementById('tituloFormAgente');
            const btnGuardar = document.getElementById('btnCargarAgente');
            const btnCancelar = document.getElementById('btnCancelarEdicionAgente');
            const form = document.getElementById('formAgente');

            if(!titulo || !btnGuardar || !btnCancelar || !form) return;

            if(modo === 'editar' && agente) {
                agenteEditandoId = agente.id;
                titulo.innerText = `Editando agente: ${agente.nombre_corto}`;
                btnGuardar.innerText = "Actualizar Agente";
                btnGuardar.className = "w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 rounded text-sm shadow transition";
                btnCancelar.classList.remove('hidden');

                document.getElementById('agente_nombre_corto').value = agente.nombre_corto || "";
                document.getElementById('agente_modalidad').value = agente.modalidad || "Contact Center";
                document.getElementById('agente_sucursal').value = agente.sucursal || "";
            } else {
                agenteEditandoId = null;
                form.reset();
                titulo.innerText = "Ingresar Nuevo Agente";
                btnGuardar.innerText = "Guardar Agente";
                btnGuardar.className = "w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded text-sm shadow transition";
                btnGuardar.disabled = false;
                btnCancelar.classList.add('hidden');
            }
        }

        // Abrir un agente ya cargado en el formulario para corregir sus datos.
        window.editarAgente = function(id) {
            const agente = agentesEnMemoria.find(a => a.id == id);

            if(!agente) {
                mostrarToast("No se encontró el agente seleccionado.", "error");
                return;
            }

            configurarFormularioAgente('editar', agente);
            activarPestaña('tab-personal');
            document.getElementById('agente_nombre_corto')?.focus();
            mostrarToast("Modo edición activado. Modificá los datos y presioná Actualizar Agente.", "info");
        }

        // Cancelar edición y volver al modo de alta normal.
        window.cancelarEdicionAgente = function() {
            configurarFormularioAgente('crear');
            mostrarToast("Edición cancelada.", "info");
        }

        // Formulario de creación / actualización de agentes
        if (document.getElementById('formAgente')) {
            document.getElementById('formAgente').addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const nombreCorto = document.getElementById('agente_nombre_corto').value.trim();
                const modalidad = document.getElementById('agente_modalidad').value;
                const sucursal = document.getElementById('agente_sucursal').value.trim() || null;
                const estaEditando = agenteEditandoId !== null;

                if(!nombreCorto) {
                    mostrarToast("Ingresá el nombre corto del agente.", "warning");
                    return;
                }

                const btn = document.getElementById('btnCargarAgente');
                btn.innerText = "Validando...";
                btn.disabled = true;

                // Consultar la base antes de guardar para evitar duplicados incluso si otro usuario cargó cambios recientemente.
                const { data: agentesActuales, error: errorConsulta } = await supabaseClient
                    .from(TABLAS.AGENTES)
                    .select('id, nombre_corto, activo');

                if(errorConsulta) {
                    btn.innerText = estaEditando ? "Actualizar Agente" : "Guardar Agente";
                    btn.disabled = false;
                    mostrarToast("No se pudo validar si el agente ya existe: " + errorConsulta.message, "error");
                    return;
                }

                const agentesComparables = (agentesActuales || []).filter(agente => 
                    !estaEditando || agente.id != agenteEditandoId
                );

                const nombreNormalizado = normalizarTextoBusqueda(nombreCorto);
                const duplicadoPorNombre = agentesComparables.find(agente =>
                    normalizarTextoBusqueda(agente.nombre_corto) === nombreNormalizado
                );
                if(duplicadoPorNombre) {
                    const estado = duplicadoPorNombre.activo === false ? "inactivo" : "activo";
                    btn.innerText = estaEditando ? "Actualizar Agente" : "Guardar Agente";
                    btn.disabled = false;
                    mostrarToast(`Ya existe otro agente ${estado} con ese nombre corto: ${duplicadoPorNombre.nombre_corto}.`, "warning");
                    return;
                }

                btn.innerText = estaEditando ? "Actualizando..." : "Guardando...";

                let resultado;

                if(estaEditando) {
                    resultado = await supabaseClient
                        .from(TABLAS.AGENTES)
                        .update({ 
                            nombre_corto: nombreCorto,
                            modalidad: modalidad,
                            sucursal: sucursal,
                            cedula: null
                        })
                        .eq('id', agenteEditandoId);
                } else {
                    resultado = await supabaseClient
                        .from(TABLAS.AGENTES)
                        .insert([{ 
                            nombre_corto: nombreCorto, 
                            modalidad: modalidad, 
                            sucursal: sucursal,
                            cedula: null,
                            activo: true
                        }]);
                }

                btn.innerText = estaEditando ? "Actualizar Agente" : "Guardar Agente";
                btn.disabled = false;

                if(resultado.error) {
                    const accion = estaEditando ? "actualizar" : "guardar";
                    mostrarToast(`Error al ${accion}: ${resultado.error.message}`, "error");
                } else {
                    mostrarToast(estaEditando ? "¡Agente actualizado con éxito!" : "¡Agente guardado con éxito!", "success");
                    configurarFormularioAgente('crear');
                    await cargarAgentes(); 
                }
            });
        }

        // ============================================================
