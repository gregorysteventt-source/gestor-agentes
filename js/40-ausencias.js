        // 10) GESTIÓN DE AUSENCIAS
        // ============================================================
        // Actualiza visualmente el formulario de ausencias según esté en modo creación o edición
        function actualizarEstadoFormularioAusencia() {
            const titulo = document.getElementById('tituloFormAusencia');
            const btnGuardar = document.getElementById('btnCargarAusencia');
            const btnCancelar = document.getElementById('btnCancelarEdicionAusencia');

            if(ausenciaEditandoId) {
                if(titulo) titulo.innerText = 'Editar Ausencia Registrada';
                if(btnGuardar) {
                    btnGuardar.innerText = 'Actualizar Ausencia';
                    btnGuardar.className = 'w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded text-sm shadow transition';
                }
                if(btnCancelar) btnCancelar.classList.remove('hidden');
            } else {
                if(titulo) titulo.innerText = 'Cargar Nueva Ausencia';
                if(btnGuardar) {
                    btnGuardar.innerText = 'Registrar Ausencia';
                    btnGuardar.className = 'w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 rounded text-sm shadow transition';
                }
                if(btnCancelar) btnCancelar.classList.add('hidden');
            }
        }

        function resetearFormularioAusencia() {
            ausenciaEditandoId = null;
            const form = document.getElementById('formAusencia');
            if(form) form.reset();
            actualizarEstadoFormularioAusencia();
        }

        function restaurarBotonAusencia() {
            const btn = document.getElementById('btnCargarAusencia');
            if(!btn) return;
            btn.disabled = false;
            btn.innerText = ausenciaEditandoId ? 'Actualizar Ausencia' : 'Registrar Ausencia';
        }

        // Registrar o actualizar una ausencia
        document.getElementById('formAusencia').addEventListener('submit', async (e) => {
            e.preventDefault();
            const agente_id = document.getElementById('ausencia_agente').value;
            const tipo = document.getElementById('ausencia_tipo').value;
            const fecha_inicio = document.getElementById('ausencia_inicio').value;
            const fecha_fin = document.getElementById('ausencia_fin').value;
            const notas = document.getElementById('ausencia_notas').value;
            const estaEditando = ausenciaEditandoId !== null;

            if(fecha_inicio > fecha_fin) {
                mostrarToast("La fecha 'Desde' no puede ser mayor que la fecha 'Hasta'.", "warning");
                return;
            }

            const btn = document.getElementById('btnCargarAusencia');
            btn.innerText = "Validando...";
            btn.disabled = true;

            const validacionAusencia = await validarAusenciaAntesDeRegistrar(
                agente_id,
                fecha_inicio,
                fecha_fin,
                estaEditando ? ausenciaEditandoId : null
            );

            if (!validacionAusencia.ok) {
                restaurarBotonAusencia();
                mostrarToast(validacionAusencia.mensaje, "warning");
                return;
            }

            if (validacionAusencia.requiereConfirmacion) {
                const continuar = await mostrarConfirmacionModerna({
                    titulo: estaEditando ? 'Actualizar ausencia' : 'Registrar ausencia',
                    mensaje: validacionAusencia.mensaje,
                    textoAceptar: estaEditando ? 'Actualizar igual' : 'Registrar igual',
                    tipo: 'warning'
                });
                if (!continuar) {
                    restaurarBotonAusencia();
                    mostrarToast(estaEditando ? "Actualización de ausencia cancelada." : "Registro de ausencia cancelado.", "info");
                    return;
                }
            }

            btn.innerText = estaEditando ? "Actualizando..." : "Registrando...";

            const payload = {
                agente_id: parseInt(agente_id),
                fecha_inicio,
                fecha_fin,
                tipo,
                notas
            };

            const { error } = estaEditando
                ? await supabaseClient
                    .from(TABLAS.AUSENCIAS)
                    .update(payload)
                    .eq('id', ausenciaEditandoId)
                : await supabaseClient
                    .from(TABLAS.AUSENCIAS)
                    .insert([payload]);

            restaurarBotonAusencia();

            if(error) {
                mostrarToast((estaEditando ? "No se pudo actualizar la ausencia: " : "No se pudo registrar la ausencia: ") + error.message, "error");
            } else {
                resetearFormularioAusencia();
                await listarAusencias();
                await listarNovedades();
                actualizarDropdownsGuardia();
                mostrarToast(estaEditando ? "Ausencia actualizada con éxito." : "Ausencia registrada con éxito.", "success");
            }
        });

        // Cargar una ausencia existente en el formulario para editarla
        window.iniciarEdicionAusencia = function(id) {
            const ausencia = ausenciasEnMemoria.find(aus => aus.id == id);
            if(!ausencia) {
                mostrarToast("No se encontró la ausencia seleccionada. Recargá la página e intentá nuevamente.", "warning");
                return;
            }

            const agente = agentesEnMemoria.find(a => a.id == ausencia.agente_id);
            const selectAgente = document.getElementById('ausencia_agente');

            if(selectAgente && agente && !Array.from(selectAgente.options).some(opt => opt.value == ausencia.agente_id)) {
                selectAgente.innerHTML += `<option value="${ausencia.agente_id}">${escaparHTML(agente.nombre_corto)}${agente.activo === false ? ' (Inactivo)' : ''}</option>`;
            }

            ausenciaEditandoId = id;
            document.getElementById('ausencia_agente').value = ausencia.agente_id || '';
            document.getElementById('ausencia_tipo').value = ausencia.tipo || 'Permiso';
            document.getElementById('ausencia_inicio').value = ausencia.fecha_inicio || '';
            document.getElementById('ausencia_fin').value = ausencia.fecha_fin || '';
            document.getElementById('ausencia_notas').value = ausencia.notas || '';

            actualizarEstadoFormularioAusencia();
            renderizarTablaAusencias();
            activarPestaña('tab-ausencias');
            document.getElementById('formAusencia')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            mostrarToast("Modo edición activado para la ausencia seleccionada.", "info");
        }

        window.cancelarEdicionAusencia = function() {
            resetearFormularioAusencia();
            renderizarTablaAusencias();
            mostrarToast("Edición de ausencia cancelada.", "info");
        }

        // Eliminar ausencia registrada
        window.eliminarAusencia = async function(id) {
            if(!await mostrarConfirmacionModerna({
                titulo: 'Eliminar ausencia',
                mensaje: '¿Seguro que querés eliminar este registro? El agente volverá a estar disponible.',
                textoAceptar: 'Eliminar',
                tipo: 'danger'
            })) return;

            const { error } = await supabaseClient
                .from(TABLAS.AUSENCIAS)
                .delete()
                .eq('id', id);

            if(error) {
                mostrarToast("No se pudo eliminar la ausencia.", "error");
            } else {
                if(ausenciaEditandoId == id) {
                    resetearFormularioAusencia();
                }
                await listarAusencias();
                await listarNovedades();
                actualizarDropdownsGuardia();
                mostrarToast("Ausencia eliminada con éxito.", "success");
            }
        }

        // ============================================================
