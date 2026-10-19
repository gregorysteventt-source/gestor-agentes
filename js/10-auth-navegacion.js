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
                    // Si antes se había quitado con la ✕, volver a agregarlo lo muestra de nuevo.
                    mostrarFeriadoPlanificador(fechaFeriado);
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



        // Pestañas desactivadas a propósito en esta instalación.
        // Antes esto era un parche invisible al final de 80-exportaciones-alertas.js:
        // reasignaba activarPestaña y ocultaba los botones inyectando CSS. Ahora es
        // una lista explícita. Para recuperar Novedades y Diario, dejala vacía.
        const PESTANAS_OCULTAS = [];

        // Sistema dinámico de pestañas.
        function activarPestaña(tabId) {
            // Una pestaña oculta nunca se abre: se redirige al cuadrante.
            if (PESTANAS_OCULTAS.includes(tabId)) {
                tabId = 'tab-cuadrante';
            }

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

            retirarPestanasOcultas();
        }

        // Oculta del menú las pestañas listadas en PESTANAS_OCULTAS.
        function retirarPestanasOcultas() {
            const styleId = 'ocultar-pestanas-configuradas';
            if (!document.getElementById(styleId)) {
                const style = document.createElement('style');
                style.id = styleId;
                style.textContent = PESTANAS_OCULTAS.map(tabId => `
                    button[onclick*="${tabId}"],
                    #${tabId} {
                        display: none !important;
                    }
                `).join('\n');
                document.head.appendChild(style);
            }

            PESTANAS_OCULTAS.forEach(tabId => {
                document.querySelectorAll(`button[onclick*="${tabId}"]`).forEach(btn => {
                    btn.setAttribute('aria-hidden', 'true');
                    btn.tabIndex = -1;
                });

                const tab = document.getElementById(tabId);
                if (tab) {
                    tab.classList.add('hidden');
                    tab.dataset.retiradoTemporalmente = 'true';
                }
            });
        }

        // ============================================================

        function instalarIconoPestanaGestor() {
            const svg = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
                    <defs>
                        <linearGradient id="g" x1="10" y1="8" x2="54" y2="58" gradientUnits="userSpaceOnUse">
                            <stop offset="0" stop-color="#0f172a"/>
                            <stop offset="0.55" stop-color="#2563eb"/>
                            <stop offset="1" stop-color="#16a34a"/>
                        </linearGradient>
                    </defs>
                    <rect width="64" height="64" rx="16" fill="url(#g)"/>
                    <path d="M32 12l16 6v11c0 12-7 20-16 23-9-3-16-11-16-23V18l16-6z" fill="#ffffff" opacity="0.92"/>
                    <path d="M32 17l10 4v8c0 8-4 14-10 17V17z" fill="#dbeafe"/>
                    <rect x="22" y="25" width="20" height="16" rx="3" fill="#0f172a"/>
                    <path d="M26 22v6M38 22v6M25 31h14" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>
                    <circle cx="32" cy="36" r="3" fill="#22c55e"/>
                </svg>
            `.trim();
            const href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
            let icono = document.querySelector('link[rel="icon"]');
            if(!icono) {
                icono = document.createElement('link');
                icono.rel = 'icon';
                document.head.appendChild(icono);
            }
            icono.type = 'image/svg+xml';
            icono.href = href;
        }

