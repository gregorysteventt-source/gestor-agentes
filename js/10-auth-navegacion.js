        // 4) INICIALIZACIÓN Y NAVEGACIÓN
        // ============================================================
        function mostrarMensajeLogin(mensaje, tipo = 'info') {
            const el = document.getElementById('loginMensaje');
            if(!el) return;
            el.textContent = mensaje;
            el.className = tipo === 'error'
                ? 'text-sm rounded-lg p-3 bg-red-50 text-red-700 border border-red-200'
                : 'text-sm rounded-lg p-3 bg-slate-50 text-slate-600 border border-slate-200';
        }

        function alternarPantallaAutenticacion(mostrarLogin) {
            const authLoading = document.getElementById('authLoading');
            const authScreen = document.getElementById('authScreen');
            document.body.classList.toggle('auth-login', mostrarLogin);
            document.body.classList.toggle('auth-app', !mostrarLogin);
            if(authLoading) authLoading.classList.add('hidden');
            if(authScreen) authScreen.classList.toggle('hidden', !mostrarLogin);

            document.querySelectorAll('.auth-protected').forEach(el => {
                el.classList.toggle('hidden', mostrarLogin);
            });

            if(!mostrarLogin) {
                activarPestaña(obtenerPestanaInicial());
            }
        }
        async function manejarLogin(e) {
            e.preventDefault();
            const email = document.getElementById('loginEmail')?.value.trim();
            const password = document.getElementById('loginPassword')?.value || '';
            const btn = document.getElementById('btnLogin');
            if(!email || !password) {
                mostrarMensajeLogin('Completa email y contrasena.', 'error');
                return;
            }

            if(btn) {
                btn.disabled = true;
                btn.textContent = 'Entrando...';
            }
            mostrarMensajeLogin('Validando usuario...');

            const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

            if(btn) {
                btn.disabled = false;
                btn.textContent = 'Entrar';
            }

            if(error) {
                mostrarMensajeLogin('No se pudo iniciar sesion: ' + error.message, 'error');
                return;
            }

            const passwordInput = document.getElementById('loginPassword');
            if(passwordInput) passwordInput.value = '';
        }

        async function cerrarSesionActual() {
            await supabaseClient.auth.signOut();
            usuarioActual = null;
            alternarPantallaAutenticacion(true);
            mostrarMensajeLogin('Sesion cerrada.');
        }

        async function iniciarAplicacionConSesion(session, opciones = {}) {
            if(!session || !session.user) {
                alternarPantallaAutenticacion(true);
                return;
            }

            const refrescoSilencioso = opciones.refrescoSilencioso === true;
            usuarioActual = session.user;
            const emailEl = document.getElementById('authUserEmail');
            if(emailEl) emailEl.textContent = usuarioActual.email || 'Sesion activa';

            if(!refrescoSilencioso || !appInicializada) {
                alternarPantallaAutenticacion(false);
            }

            if(appInicializada && !inicializacionEnCurso) return;

            if(!inicializacionEnCurso) {
                inicializacionEnCurso = init().finally(() => {
                    inicializacionEnCurso = null;
                });
            }
            await inicializacionEnCurso;
        }

        async function inicializarAutenticacion() {
            document.getElementById('formLogin')?.addEventListener('submit', manejarLogin);
            document.getElementById('btnCerrarSesion')?.addEventListener('click', cerrarSesionActual);

            const { data: { session } } = await supabaseClient.auth.getSession();
            if(session) {
                await iniciarAplicacionConSesion(session);
            } else {
                alternarPantallaAutenticacion(true);
            }

            supabaseClient.auth.onAuthStateChange(async (event, session) => {
                if(event === 'SIGNED_IN') {
                    await iniciarAplicacionConSesion(session);
                }
                if(event === 'TOKEN_REFRESHED') {
                    await iniciarAplicacionConSesion(session, { refrescoSilencioso: true });
                }
                if(event === 'SIGNED_OUT') {
                    usuarioActual = null;
                    alternarPantallaAutenticacion(true);
                    mostrarMensajeLogin('Sesion cerrada.');
                }
            });
        }

        // Inicializacion de la App
        async function init() {
            await cargarAgentes();
            await listarAusencias();
            await listarNovedades();
            await listarCoberturasDiarias();

            if(!appInicializada) {
                setupEventosFeriados();
                setupFiltroNovedades();
                setupFiltrosCoberturasDiarias();
                setupFormularioCoberturaDiaria();
                setupCambioDirectoDiario();
                setupBuscadorPersonal();
                setupOrdenAusencias();
                setupTemaCuadrante();
                setupCalendarioInteractivo();
                setupCierreModalesConEscape();
                appInicializada = true;
            }

            await inicializarPlanificadorFinDeSemana();
            await cargarDatosCalendario();
        }

        // Configuración de los eventos asociados a la gestión de días de Feriados especiales
        function setupEventosFeriados() {
            const btnAbrir = document.getElementById('btnAbrirPanelFeriado');
            const panel = document.getElementById('panelNuevoFeriado');
            const btnConfirmar = document.getElementById('btnConfirmarFeriado');
            const inputFecha = document.getElementById('inputFechaFeriado');

            if(btnAbrir && panel) {
                btnAbrir.addEventListener('click', () => {
                    panel.classList.toggle('hidden');
                });
            }

            if(btnConfirmar && inputFecha) {
                btnConfirmar.addEventListener('click', async () => {
                    const fechaFeriado = inputFecha.value;
                    if(!fechaFeriado) {
                        mostrarToast("Seleccioná la fecha del feriado antes de agregar.", "warning");
                        return;
                    }

                    // Evitar duplicados
                    if (diasPlanificados.some(d => d.fecha === fechaFeriado)) {
                        mostrarToast("Esa fecha ya está agregada al planificador.", "warning");
                        return;
                    }

                    // Guardar las asignaciones actuales de Sábado/Domingo hechas en la pantalla
                    guardarSeleccionesTemporales();

                    // Agregar y ordenar cronológicamente
                    diasPlanificados.push({ fecha: fechaFeriado, tipo: 'feriado' });
                    diasPlanificados.sort((a, b) => a.fecha.localeCompare(b.fecha));

                    renderizarTablasPlanificacion();
                    // Buscar en Supabase únicamente si ya hay datos históricos guardados para el feriado agregado
                    await cargarTurnosGuardadosParaPlanificacion([fechaFeriado]);
                    panel.classList.add('hidden');
                    inputFecha.value = "";
                    mostrarToast("Fila de Feriado añadida con éxito.", "success");
                });
            }
        }
        function obtenerPestanaInicial() {
            const tabGuardada = localStorage.getItem('gestor_tab_activa');
            return tabGuardada && document.getElementById(tabGuardada) ? tabGuardada : 'tab-cuadrante';
        }



        // Sistema dinámico de pestañas.
        function activarPestaña(tabId) {
            const coloresPorTab = {
                'tab-cuadrante': 'active-blue',
                'tab-ausencias': 'active-red',
                'tab-novedades': 'active-sky',
                'tab-diario': 'active-emerald',
                'tab-personal': 'active-indigo'
            };

            document.querySelectorAll('.tab-content').forEach(element => {
                element.classList.add('hidden');
            });

            document.querySelectorAll('[id^="btn-tab-"]').forEach(btn => {
                btn.className = 'app-tab';
            });

            const tabActual = document.getElementById(tabId);
            if (tabActual) {
                tabActual.classList.remove('hidden');
            }

            const btnActivo = document.getElementById(`btn-${tabId}`);
            if (btnActivo) {
                btnActivo.className = `app-tab ${coloresPorTab[tabId] || 'active-blue'}`;
            }

            if (tabActual) {
                localStorage.setItem('gestor_tab_activa', tabId);
            }
        }

        // ============================================================
