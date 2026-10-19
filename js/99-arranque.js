        // 17) ARRANQUE DE LA APLICACIÓN
        // ============================================================
        // Este archivo solo arranca la app.
        //
        // Antes, este archivo redefinía funciones de 30, 60 y 70 al cargarse: quien
        // editaba una función en su módulo no veía el cambio, porque aquí se volvía
        // a asignar otra versión. Cada ajuste vive ahora en su módulo:
        //
        //   horarios de cobertura y edición de turnos ...... 00-core / 30-planificador
        //   colores y orden del calendario ................ 70-calendario
        //   jornada diaria ................................ 60-diario
        //   opciones de ausencia .......................... 40-ausencias
        //   icono de la pestaña ........................... 10-auth-navegacion

        instalarOpcionesAusencia();
        instalarIconoPestanaGestor();

        // Arranca la autenticación. Con una sesión válida, init() carga los datos
        // y engancha el resto de los eventos de la aplicación.
        inicializarAutenticacion();
