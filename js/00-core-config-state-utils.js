        /*
         * ============================================================
         * GESTOR DE GUARDIAS — SCRIPT ORDENADO
         * ============================================================
         * Esta versión incorpora la edición de ausencias registradas,
         * manteniendo las validaciones existentes de duplicados, superposición
         * de fechas, novedades/coberturas y guardias ya asignadas.
         *
         * Índice:
         * 1. Constantes de base de datos
         * 2. Estado global en memoria
         * 3. Utilidades generales
         * 4. Inicialización y navegación
         * 5. Carga de datos desde Supabase
         * 6. Formateo y ayudantes de fecha
         * 7. Renderizado del planificador
         * 8. Recuperación de turnos guardados
         * 9. Eventos del planificador y guardado de cuadrante
         * 10. Gestión de ausencias
         * 11. Gestión de novedades y coberturas
         * 12. Registro diario de coberturas
         * 13. Exportación de imagen para WhatsApp
         * 14. Alertas operativas
         * 15. Exportación a Excel
         * 16. Gestión de personal
         * 17. Arranque de la aplicación
         */

        // Configuración de Supabase
        const SUPABASE_URL = "https://rdjddrxykbhflealuwex.supabase.co"; 
        const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkamRkcnh5a2JoZmxlYWx1d2V4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzNTgyOTMsImV4cCI6MjA5NzkzNDI5M30.y1map-I10wMmqfJDQ2jvvhv-e-MGIQV-OwxPw07jhgM"; 
        
        const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

        // ============================================================
        // 1) CONSTANTES DE BASE DE DATOS
        // ============================================================
        // Centralizamos los nombres de tablas para evitar errores de tipeo.
        const TABLAS = {
            AGENTES: 'agentes',
            TURNOS: 'turnos_fines_de_semana',
            AUSENCIAS: 'ausencias_agentes',
            NOVEDADES: 'novedades_coberturas',
            COBERTURAS_DIARIAS: 'coberturas_diarias',
            NOTAS_CALENDARIO: 'notas_calendario'
        };

        // Configuración operativa del Registro Diario presencial/híbrido.
        const AREAS_REGISTRO_DIARIO = ['Registro Civil', 'Identificaciones'];
        const TITULARES_REGISTRO_DIARIO = {
            'Registro Civil': ['Adolfo Aranda', 'Andrea Melgarejo'],
            'Identificaciones': ['Cesar Arzamendia', 'Daniel Cuevas']
        };
        const AGENTES_CLAVE_REGISTRO_DIARIO = ['Francis Amarilla'];
        const MARCA_RANGO_NOVEDAD = '[RANGO_HASTA:';
        const MARCA_AUTO_PLANIFICADOR_IDENTIFICACIONES = '[AUTO_PLANIFICADOR_IDENTIFICACIONES]';
        const MARCA_AUTO_COBERTURA_NORMAL_DIARIA = '[AUTO_COBERTURA_NORMAL_DIARIA]';

        // Horarios base de atención presencial/híbrida de lunes a viernes.
        // Se usan para generar automáticamente la cobertura normal del día.
        const HORARIOS_BASE_COBERTURA_NORMAL_DIARIA = [
            {
                area: 'Registro Civil',
                agente: 'Adolfo Aranda',
                turno: 'Mañana',
                horario: '07:00 a 13:00',
                detalle: 'Cobertura habitual de Registro Civil.'
            },
            {
                area: 'Registro Civil',
                agente: 'Andrea Melgarejo',
                turno: 'Mañana',
                horario: '10:00 a 15:00',
                detalle: 'Cobertura habitual de Registro Civil.'
            },
            {
                area: 'Identificaciones',
                agente: 'Cesar Arzamendia',
                turno: 'Mañana',
                horario: '07:00 a 12:00',
                detalle: 'Cobertura habitual del Dpto de Identificaciones.'
            },
            {
                area: 'Identificaciones',
                agente: 'Daniel Cuevas',
                turno: 'Tarde',
                horario: '12:00 a 17:00',
                detalle: 'Cobertura habitual del Dpto de Identificaciones.'
            }
        ];

        // Temas visuales del cuadrante de fin de semana.
        const TEMAS_CUADRANTE = {
            ambar: {
                nombre: 'Ámbar clásico',
                headerBg: '#f59e0b', headerText: '#111827', headerBorder: '#d97706',
                subBg: '#fef3c7', subText: '#111827',
                accentBg: '#f59e0b', accentHover: '#d97706', accentText: '#111827',
                ring: '#f59e0b', softBg: '#fff7ed', softBorder: '#fed7aa', softText: '#9a3412'
            },
            naranja: {
                nombre: 'Naranja',
                headerBg: '#f97316', headerText: '#ffffff', headerBorder: '#ea580c',
                subBg: '#ffedd5', subText: '#9a3412',
                accentBg: '#f97316', accentHover: '#ea580c', accentText: '#ffffff',
                ring: '#f97316', softBg: '#fff7ed', softBorder: '#fed7aa', softText: '#c2410c'
            },
            coral: {
                nombre: 'Coral',
                headerBg: '#fb7185', headerText: '#ffffff', headerBorder: '#e11d48',
                subBg: '#ffe4e6', subText: '#9f1239',
                accentBg: '#fb7185', accentHover: '#e11d48', accentText: '#ffffff',
                ring: '#fb7185', softBg: '#fff1f2', softBorder: '#fecdd3', softText: '#be123c'
            },
            rojo: {
                nombre: 'Rojo',
                headerBg: '#ef4444', headerText: '#ffffff', headerBorder: '#dc2626',
                subBg: '#fee2e2', subText: '#991b1b',
                accentBg: '#ef4444', accentHover: '#dc2626', accentText: '#ffffff',
                ring: '#ef4444', softBg: '#fef2f2', softBorder: '#fecaca', softText: '#b91c1c'
            },
            rosa: {
                nombre: 'Rosa',
                headerBg: '#ec4899', headerText: '#ffffff', headerBorder: '#db2777',
                subBg: '#fce7f3', subText: '#9d174d',
                accentBg: '#ec4899', accentHover: '#db2777', accentText: '#ffffff',
                ring: '#ec4899', softBg: '#fdf2f8', softBorder: '#fbcfe8', softText: '#be185d'
            },
            fucsia: {
                nombre: 'Fucsia',
                headerBg: '#d946ef', headerText: '#ffffff', headerBorder: '#c026d3',
                subBg: '#fae8ff', subText: '#86198f',
                accentBg: '#d946ef', accentHover: '#c026d3', accentText: '#ffffff',
                ring: '#d946ef', softBg: '#fdf4ff', softBorder: '#f5d0fe', softText: '#a21caf'
            },
            purpura: {
                nombre: 'Púrpura',
                headerBg: '#a855f7', headerText: '#ffffff', headerBorder: '#9333ea',
                subBg: '#f3e8ff', subText: '#6b21a8',
                accentBg: '#a855f7', accentHover: '#9333ea', accentText: '#ffffff',
                ring: '#a855f7', softBg: '#faf5ff', softBorder: '#e9d5ff', softText: '#7e22ce'
            },
            violeta: {
                nombre: 'Violeta',
                headerBg: '#8b5cf6', headerText: '#ffffff', headerBorder: '#7c3aed',
                subBg: '#ede9fe', subText: '#5b21b6',
                accentBg: '#8b5cf6', accentHover: '#7c3aed', accentText: '#ffffff',
                ring: '#8b5cf6', softBg: '#f5f3ff', softBorder: '#ddd6fe', softText: '#6d28d9'
            },
            indigo: {
                nombre: 'Índigo',
                headerBg: '#6366f1', headerText: '#ffffff', headerBorder: '#4f46e5',
                subBg: '#e0e7ff', subText: '#3730a3',
                accentBg: '#6366f1', accentHover: '#4f46e5', accentText: '#ffffff',
                ring: '#6366f1', softBg: '#eef2ff', softBorder: '#c7d2fe', softText: '#4338ca'
            },
            azul: {
                nombre: 'Azul',
                headerBg: '#3b82f6', headerText: '#ffffff', headerBorder: '#1d4ed8',
                subBg: '#dbeafe', subText: '#1e3a8a',
                accentBg: '#2563eb', accentHover: '#1d4ed8', accentText: '#ffffff',
                ring: '#3b82f6', softBg: '#eff6ff', softBorder: '#bfdbfe', softText: '#1d4ed8'
            },
            celeste: {
                nombre: 'Celeste',
                headerBg: '#0ea5e9', headerText: '#ffffff', headerBorder: '#0284c7',
                subBg: '#e0f2fe', subText: '#075985',
                accentBg: '#0ea5e9', accentHover: '#0284c7', accentText: '#ffffff',
                ring: '#0ea5e9', softBg: '#f0f9ff', softBorder: '#bae6fd', softText: '#0369a1'
            },
            cian: {
                nombre: 'Cian',
                headerBg: '#06b6d4', headerText: '#ffffff', headerBorder: '#0891b2',
                subBg: '#cffafe', subText: '#155e75',
                accentBg: '#06b6d4', accentHover: '#0891b2', accentText: '#ffffff',
                ring: '#06b6d4', softBg: '#ecfeff', softBorder: '#a5f3fc', softText: '#0e7490'
            },
            turquesa: {
                nombre: 'Turquesa',
                headerBg: '#14b8a6', headerText: '#ffffff', headerBorder: '#0d9488',
                subBg: '#ccfbf1', subText: '#134e4a',
                accentBg: '#14b8a6', accentHover: '#0d9488', accentText: '#ffffff',
                ring: '#14b8a6', softBg: '#f0fdfa', softBorder: '#99f6e4', softText: '#0f766e'
            },
            verde: {
                nombre: 'Verde',
                headerBg: '#10b981', headerText: '#ffffff', headerBorder: '#059669',
                subBg: '#d1fae5', subText: '#065f46',
                accentBg: '#10b981', accentHover: '#059669', accentText: '#ffffff',
                ring: '#10b981', softBg: '#ecfdf5', softBorder: '#a7f3d0', softText: '#047857'
            },
            lima: {
                nombre: 'Lima',
                headerBg: '#84cc16', headerText: '#1f2937', headerBorder: '#65a30d',
                subBg: '#ecfccb', subText: '#365314',
                accentBg: '#84cc16', accentHover: '#65a30d', accentText: '#1f2937',
                ring: '#84cc16', softBg: '#f7fee7', softBorder: '#d9f99d', softText: '#4d7c0f'
            },
            amarillo: {
                nombre: 'Amarillo',
                headerBg: '#eab308', headerText: '#111827', headerBorder: '#ca8a04',
                subBg: '#fef9c3', subText: '#713f12',
                accentBg: '#eab308', accentHover: '#ca8a04', accentText: '#111827',
                ring: '#eab308', softBg: '#fefce8', softBorder: '#fde68a', softText: '#a16207'
            },
            cafe: {
                nombre: 'Café',
                headerBg: '#92400e', headerText: '#ffffff', headerBorder: '#78350f',
                subBg: '#fef3c7', subText: '#78350f',
                accentBg: '#92400e', accentHover: '#78350f', accentText: '#ffffff',
                ring: '#92400e', softBg: '#fffbeb', softBorder: '#fcd34d', softText: '#92400e'
            },
            oliva: {
                nombre: 'Oliva',
                headerBg: '#4d7c0f', headerText: '#ffffff', headerBorder: '#3f6212',
                subBg: '#ecfccb', subText: '#365314',
                accentBg: '#4d7c0f', accentHover: '#3f6212', accentText: '#ffffff',
                ring: '#4d7c0f', softBg: '#f7fee7', softBorder: '#bef264', softText: '#4d7c0f'
            },
            gris: {
                nombre: 'Gris elegante',
                headerBg: '#64748b', headerText: '#ffffff', headerBorder: '#475569',
                subBg: '#e2e8f0', subText: '#334155',
                accentBg: '#64748b', accentHover: '#475569', accentText: '#ffffff',
                ring: '#64748b', softBg: '#f8fafc', softBorder: '#cbd5e1', softText: '#475569'
            },
            pizarra: {
                nombre: 'Pizarra',
                headerBg: '#334155', headerText: '#ffffff', headerBorder: '#1e293b',
                subBg: '#e2e8f0', subText: '#1e293b',
                accentBg: '#334155', accentHover: '#1e293b', accentText: '#ffffff',
                ring: '#334155', softBg: '#f8fafc', softBorder: '#cbd5e1', softText: '#334155'
            },
            negro: {
                nombre: 'Negro',
                headerBg: '#111827', headerText: '#ffffff', headerBorder: '#030712',
                subBg: '#e5e7eb', subText: '#111827',
                accentBg: '#111827', accentHover: '#030712', accentText: '#ffffff',
                ring: '#111827', softBg: '#f9fafb', softBorder: '#d1d5db', softText: '#111827'
            }
        };

        // ============================================================
        // 2) ESTADO GLOBAL EN MEMORIA
        // ============================================================
        // Estructura en memoria para la lista de días activos en el planificador
        // Estructura por defecto: Sábado y Domingo
        let diasPlanificados = [];
        
        let agentesEnMemoria = [];
        let ausenciasEnMemoria = [];
        let novedadesEnMemoria = [];
        let coberturasDiariasEnMemoria = [];
        let notasCalendarioEnMemoria = [];
        let turnosCalendarioEnMemoria = [];
        let fechaCalendarioActual = new Date();
        fechaCalendarioActual.setDate(1);
        let fechaCalendarioSeleccionada = null;
        let filtroDiarioInicialAplicado = false;
        
        // Memoria para guardar las selecciones de los dropdowns en tiempo real y evitar que se borren al añadir filas
        let seleccionesTemporales = {};

        // Estado del formulario de personal. Si tiene un ID, el formulario está en modo edición.
        let agenteEditandoId = null;

        // Estado del formulario de ausencias. Si tiene un ID, el formulario está en modo edición.
        let ausenciaEditandoId = null;

        // Orden visual actual de la tabla de ausencias.
        let ordenAusenciasActual = 'operativo';

        // Estado del formulario de registro diario. Si tiene un ID, el formulario está en modo edición.
        let coberturaDiariaEditandoId = null;

        // Tema visual actual del planificador de fin de semana.
        let temaCuadranteActual = 'ambar';
        let usuarioActual = null;
        let appInicializada = false;
        let inicializacionEnCurso = null;

        // ============================================================
        // 3) UTILIDADES GENERALES
        // ============================================================
        // Sistema de notificaciones flotantes premium (Reemplazo de alert())
        function mostrarToast(mensaje, tipo = 'info') {
            const container = document.getElementById('toast-container');
            if(!container) return;
            
            const toast = document.createElement('div');
            toast.className = `transform translate-y-2 opacity-0 transition-all duration-300 pointer-events-auto flex items-center p-4 rounded-lg shadow-lg text-white text-sm font-semibold min-w-[280px] max-w-sm border`;
            
            let bgClass = "bg-blue-600 border-blue-700";
            let icon = "ℹ️";
            
            if(tipo === 'success') {
                bgClass = "bg-green-600 border-green-700";
                icon = "✅";
            } else if(tipo === 'error') {
                bgClass = "bg-red-600 border-red-700";
                icon = "❌";
            } else if(tipo === 'warning') {
                bgClass = "bg-yellow-500 border-yellow-600 text-gray-900";
                icon = "⚠️";
            }
            
            toast.className += ` ${bgClass}`;

            const iconoToast = document.createElement('span');
            iconoToast.className = 'mr-2 text-base';
            iconoToast.textContent = icon;

            const textoToast = document.createElement('span');
            textoToast.className = 'flex-1';
            textoToast.textContent = mensaje;

            toast.appendChild(iconoToast);
            toast.appendChild(textoToast);
            
            container.appendChild(toast);
            
            setTimeout(() => {
                toast.classList.remove('translate-y-2', 'opacity-0');
            }, 10);
            
            setTimeout(() => {
                toast.classList.add('translate-y-2', 'opacity-0');
                setTimeout(() => {
                    toast.remove();
                }, 300);
            }, 4000);
        }

        function mostrarConfirmacionModerna({
            titulo = 'Confirmar acción',
            mensaje = '',
            textoAceptar = 'Aceptar',
            textoCancelar = 'Cancelar',
            tipo = 'info'
        } = {}) {
            return new Promise(resolve => {
                const modal = document.getElementById('modalConfirmacion');
                const tituloEl = document.getElementById('modalConfirmacionTitulo');
                const mensajeEl = document.getElementById('modalConfirmacionMensaje');
                const iconoEl = document.getElementById('modalConfirmacionIcono');
                const btnAceptar = document.getElementById('btnModalAceptar');
                const btnCancelar = document.getElementById('btnModalCancelar');

                if(!modal || !tituloEl || !mensajeEl || !iconoEl || !btnAceptar || !btnCancelar) {
                    resolve(false);
                    return;
                }

                const estilos = {
                    info: { icono: 'ℹ️', iconClass: 'bg-blue-50 text-blue-700', btnClass: 'bg-blue-600 hover:bg-blue-700 text-white' },
                    warning: { icono: '⚠️', iconClass: 'bg-yellow-50 text-yellow-700', btnClass: 'bg-yellow-500 hover:bg-yellow-600 text-gray-900' },
                    danger: { icono: '🗑️', iconClass: 'bg-red-50 text-red-700', btnClass: 'bg-red-600 hover:bg-red-700 text-white' },
                    success: { icono: '✅', iconClass: 'bg-green-50 text-green-700', btnClass: 'bg-green-600 hover:bg-green-700 text-white' }
                };
                const estilo = estilos[tipo] || estilos.info;

                tituloEl.textContent = titulo;
                mensajeEl.textContent = mensaje;
                iconoEl.textContent = estilo.icono;
                iconoEl.className = `w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-lg ${estilo.iconClass}`;
                btnAceptar.textContent = textoAceptar;
                btnCancelar.textContent = textoCancelar;
                btnAceptar.className = `${estilo.btnClass} font-bold py-2 px-4 rounded-lg text-sm transition`;
                btnCancelar.className = 'bg-white hover:bg-gray-100 text-gray-700 border font-bold py-2 px-4 rounded-lg text-sm transition';

                modal.classList.remove('hidden');

                const cerrar = (respuesta) => {
                    modal.classList.add('hidden');
                    btnAceptar.onclick = null;
                    btnCancelar.onclick = null;
                    modal.onclick = null;
                    resolve(respuesta);
                };

                btnAceptar.onclick = () => cerrar(true);
                btnCancelar.onclick = () => cerrar(false);
                modal.onclick = (e) => { if(e.target === modal) cerrar(false); };
            });
        }

        function mostrarModalTexto({
            titulo = 'Editar texto',
            subtitulo = 'Actualizá la información y guardá los cambios.',
            valorInicial = '',
            placeholder = 'Escribí la nota...',
            textoAceptar = 'Guardar'
        } = {}) {
            return new Promise(resolve => {
                const modal = document.getElementById('modalTexto');
                const tituloEl = document.getElementById('modalTextoTitulo');
                const subtituloEl = document.getElementById('modalTextoSubtitulo');
                const input = document.getElementById('modalTextoInput');
                const btnAceptar = document.getElementById('btnModalTextoAceptar');
                const btnCancelar = document.getElementById('btnModalTextoCancelar');

                if(!modal || !input || !btnAceptar || !btnCancelar) {
                    resolve(null);
                    return;
                }

                tituloEl.textContent = titulo;
                subtituloEl.textContent = subtitulo;
                input.placeholder = placeholder;
                input.value = valorInicial || '';
                btnAceptar.textContent = textoAceptar;

                modal.classList.remove('hidden');
                setTimeout(() => input.focus(), 30);

                const cerrar = (valor) => {
                    modal.classList.add('hidden');
                    btnAceptar.onclick = null;
                    btnCancelar.onclick = null;
                    modal.onclick = null;
                    resolve(valor);
                };

                btnAceptar.onclick = () => cerrar(input.value);
                btnCancelar.onclick = () => cerrar(null);
                modal.onclick = (e) => { if(e.target === modal) cerrar(null); };
            });
        }


        function estaModalVisible(id) {
            const modal = document.getElementById(id);
            return !!modal && !modal.classList.contains('hidden');
        }

        function manejarEscapeModales(e) {
            if(e.key !== 'Escape') return;

            if(estaModalVisible('modalTexto')) {
                e.preventDefault();
                document.getElementById('btnModalTextoCancelar')?.click();
                return;
            }

            if(estaModalVisible('modalConfirmacion')) {
                e.preventDefault();
                document.getElementById('btnModalCancelar')?.click();
                return;
            }

            if(estaModalVisible('modalNovedad')) {
                e.preventDefault();
                cerrarModalNovedad();
                return;
            }

            if(estaModalVisible('modalCoberturaDiaria')) {
                e.preventDefault();
                cancelarEdicionCoberturaDiaria(false);
                return;
            }

            if(estaModalVisible('modalCalendario')) {
                e.preventDefault();
                cerrarDetalleCalendario();
            }
        }

        function setupCierreModalesConEscape() {
            if(window.__gestorEscapeModalesConfigurado) return;
            document.addEventListener('keydown', manejarEscapeModales);
            window.__gestorEscapeModalesConfigurado = true;
        }
        // Escapar texto antes de insertarlo en HTML dinámico.
        function escaparHTML(valor) {
            return (valor || "")
                .toString()
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        }

        function obtenerFechaActualISO() {
            const hoy = new Date();
            const yyyy = hoy.getFullYear();
            const mm = String(hoy.getMonth() + 1).padStart(2, '0');
            const dd = String(hoy.getDate()).padStart(2, '0');
            return `${yyyy}-${mm}-${dd}`;
        }

        function aplicarTemaCuadrante(claveTema = 'ambar', guardarEnMemoria = true) {
            const tema = TEMAS_CUADRANTE[claveTema] || TEMAS_CUADRANTE.ambar;
            const root = document.documentElement;

            root.style.setProperty('--planner-header-bg', tema.headerBg);
            root.style.setProperty('--planner-header-text', tema.headerText);
            root.style.setProperty('--planner-header-border', tema.headerBorder);
            root.style.setProperty('--planner-sub-bg', tema.subBg);
            root.style.setProperty('--planner-sub-text', tema.subText);
            root.style.setProperty('--planner-accent-bg', tema.accentBg);
            root.style.setProperty('--planner-accent-hover', tema.accentHover);
            root.style.setProperty('--planner-accent-text', tema.accentText);
            root.style.setProperty('--planner-ring', tema.ring);
            root.style.setProperty('--planner-soft-bg', tema.softBg);
            root.style.setProperty('--planner-soft-border', tema.softBorder);
            root.style.setProperty('--planner-soft-text', tema.softText);

            temaCuadranteActual = claveTema;

            document.querySelectorAll('.planner-color-swatch').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.tema === claveTema);
            });

            if (guardarEnMemoria) {
                localStorage.setItem('tema_cuadrante_fin_de_semana', claveTema);
            }
        }

        function renderizarPaletaTemasCuadrante() {
            const contenedor = document.getElementById('paletaTemasCuadrante');
            if (!contenedor) return;

            contenedor.innerHTML = Object.entries(TEMAS_CUADRANTE).map(([clave, tema]) => `
                <button
                    type="button"
                    class="planner-color-swatch"
                    data-tema="${clave}"
                    title="${escaparHTML(tema.nombre)}"
                    aria-label="${escaparHTML(tema.nombre)}"
                    style="background-color: ${tema.headerBg};"
                ></button>
            `).join('');
        }

        function setupTemaCuadrante() {
            renderizarPaletaTemasCuadrante();

            const temaGuardado = localStorage.getItem('tema_cuadrante_fin_de_semana') || 'ambar';
            aplicarTemaCuadrante(temaGuardado, false);

            const contenedor = document.getElementById('paletaTemasCuadrante');
            if (contenedor) {
                contenedor.addEventListener('click', (e) => {
                    const btn = e.target.closest('.planner-color-swatch');
                    if (!btn) return;

                    aplicarTemaCuadrante(btn.dataset.tema, true);

                    const panel = document.getElementById('panelTemaCuadrante');
                    if (panel) panel.open = false;
                });
            }
        }

        // ============================================================
