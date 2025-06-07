function getSheetData(url, mapFn) {
    return $.ajax({
        url: url,
        type: 'GET',
        dataType: 'text',
    }).then(function (data) {
        var result = parseCSVtoObjects(data);
        if (typeof mapFn === 'function') {
            result = result.map(mapFn);
        }
        return result;
    });
}

//getFacultad
const facultadPromise = getSheetData(
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vSjK5jk5zr2fq9jP20p_U-xGu7nrfaP72_yPRjmvxZ8fxyDcEeLkA0h1-pvvZ4L8rskEnxOhZ8slOAm/pub?output=csv',
    function (facultad) {
        return {
            id_facultad: parseInt(facultad.id_facultad),
            nombre: facultad.nombre
        };
    }
);
//getEscuela
const escuelaPromise = getSheetData(
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vSjK5jk5zr2fq9jP20p_U-xGu7nrfaP72_yPRjmvxZ8fxyDcEeLkA0h1-pvvZ4L8rskEnxOhZ8slOAm/pub?gid=471174593&single=true&output=csv',
    function (escuela) {
        return {
            id_escuela: parseInt(escuela.id_escuela),
            nombre: escuela.nombre,
            id_facultad: parseInt(escuela.id_facultad)
        };
    }
);
//getAsignatura
const asignaturaPromise = getSheetData(
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vSjK5jk5zr2fq9jP20p_U-xGu7nrfaP72_yPRjmvxZ8fxyDcEeLkA0h1-pvvZ4L8rskEnxOhZ8slOAm/pub?gid=435897269&single=true&output=csv',
    function (asignatura) {
        return {
            id_asignatura: parseInt(asignatura.id_asignatura),
            codigo: asignatura.codigo,
            plan_estudios: asignatura.plan_estudios,
            nombre: asignatura.nombre,
            semestre_academico: asignatura.semestre_academico,
            id_escuela: parseInt(asignatura.id_escuela),
        };
    }
);
//getAsignaturaSistemaCalificacion
const asignaturaSistemaCalificacionPromise = getSheetData(
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vSjK5jk5zr2fq9jP20p_U-xGu7nrfaP72_yPRjmvxZ8fxyDcEeLkA0h1-pvvZ4L8rskEnxOhZ8slOAm/pub?gid=1672617368&single=true&output=csv',
    function (asignatura) {
        return {
            id_asignatura: parseInt(asignatura.id_asignatura),
            grading_system_name: asignatura.grading_system_name,
            ra_formula: asignatura.ra_formula,
            id_resultado_aprendizaje: parseInt(asignatura.id_resultado_aprendizaje),
            total_planned_evaluations: parseInt(asignatura.total_planned_evaluations),
            final_grade_formula: asignatura.final_grade_formula,
        };
    }
);
//getResultadosAprendizaje
const resultadosAprendizajePromise = getSheetData(
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vSjK5jk5zr2fq9jP20p_U-xGu7nrfaP72_yPRjmvxZ8fxyDcEeLkA0h1-pvvZ4L8rskEnxOhZ8slOAm/pub?gid=547049024&single=true&output=csv',
    function (resultado) {
        return {
            id_resultado_aprendizaje: parseInt(resultado.id_resultado_aprendizaje),
            name: resultado.name,
            unit: resultado.unit,
            weight: parseFloat(resultado.weight),
            number_of_evaluations: parseInt(resultado.number_of_evaluations),
        };
    }
);
//getAsignaturaIndicadores
const asignaturaIndicadoresPromise = getSheetData(
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vSjK5jk5zr2fq9jP20p_U-xGu7nrfaP72_yPRjmvxZ8fxyDcEeLkA0h1-pvvZ4L8rskEnxOhZ8slOAm/pub?gid=2013847135&single=true&output=csv',
    function (asignatura) {
        return {
            id_asignatura: parseInt(asignatura.id_asignatura),
            unidad: asignatura.unidad,
            resultado: asignatura.resultado,
            indicadores: asignatura.indicadores,
            evaluacion: asignatura.evaluacion,
            id_indicadores_detalles: parseInt(asignatura.id_indicadores_detalles),
        };
    }
);
//getAsignaturaIndicadoresDetalle
const asignaturaIndicadoresDetallePromise = getSheetData(
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vSjK5jk5zr2fq9jP20p_U-xGu7nrfaP72_yPRjmvxZ8fxyDcEeLkA0h1-pvvZ4L8rskEnxOhZ8slOAm/pub?gid=209826250&single=true&output=csv',
    function (detalle) {
        return {
            id_indicadores_detalles: parseInt(detalle.id_indicadores_detalles),
            codigo: detalle.codigo,
            descripcion: detalle.descripcion,
            peso: parseFloat(detalle.peso),
            id_evidencia_detalle: parseInt(detalle.id_evidencia_detalle),
        };
    }
);
//getEvidenciaDetalle
const evidenciaDetallePromise = getSheetData(
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vSjK5jk5zr2fq9jP20p_U-xGu7nrfaP72_yPRjmvxZ8fxyDcEeLkA0h1-pvvZ4L8rskEnxOhZ8slOAm/pub?gid=1789850036&single=true&output=csv',
    function (detalle) {
        return {
            id_evidencia_detalle: parseInt(detalle.id_evidencia_detalle),
            evidencia: detalle.evidencia,
            peso_evidencia: parseFloat(detalle.peso_evidencia),
            instrumento: detalle.instrumento,
            id_evidencia: parseInt(detalle.id_evidencia),
        };
    }
);
// Mostrar modal de carga con SweetAlert2
// Swal.fire({
//     title: 'Cargando datos...',
//     text: 'Por favor espera mientras se actualizan los datos.',
//     allowOutsideClick: false,
//     didOpen: () => {
//         Swal.showLoading();
//     }
// });

// Eliminar la base de datos si existe antes de crearla para asegurar datos actualizados
indexedDB.deleteDatabase('USAT_CALCULATOR_DB');

const deleteRequest = indexedDB.deleteDatabase('USAT_CALCULATOR_DB');
deleteRequest.onsuccess = deleteRequest.onerror = deleteRequest.onblocked = function() {
    Promise.all([
        facultadPromise,
        escuelaPromise,
        asignaturaPromise,
        asignaturaSistemaCalificacionPromise,
        resultadosAprendizajePromise,
        asignaturaIndicadoresPromise,
        asignaturaIndicadoresDetallePromise,
        evidenciaDetallePromise
    ]).then(function ([facultades, escuelas, asignaturas, sistemas, resultados, indicadores, indicadoresDetalle, evidenciaDetalle]) {
        const request = indexedDB.open('USAT_CALCULATOR_DB', 1);
        request.onupgradeneeded = function(event) {
            const db = event.target.result;
            db.createObjectStore('FACULTAD', { keyPath: 'id_facultad' });
            db.createObjectStore('ESCUELA', { keyPath: 'id_escuela' });
            db.createObjectStore('ASIGNATURA', { keyPath: 'id_asignatura' });
            db.createObjectStore('ASIGNATURA_SISTEMA_cALIFICACIÓN', { keyPath: 'id_asignatura' });
            db.createObjectStore('RESULTADOS_APRENDIZAJE', { keyPath: 'id_resultado_aprendizaje' });
            db.createObjectStore('ASIGNATURA_INDICADORES', { keyPath: 'id_indicadores_detalles' });
            db.createObjectStore('ASIGNATURA_INDICADORES_DETALLES', { keyPath: 'id_indicadores_detalles' });
            db.createObjectStore('EVIDENCIA_dETALLES', { keyPath: 'id_evidencia_detalle' });
        };
        request.onsuccess = function(event) {
            const db = event.target.result;
            function saveArray(storeName, dataArray) {
                const tx = db.transaction(storeName, 'readwrite');
                const store = tx.objectStore(storeName);
                dataArray.forEach(obj => store.put(obj));
            }
            saveArray('FACULTAD', facultades);
            saveArray('ESCUELA', escuelas);
            saveArray('ASIGNATURA', asignaturas);
            saveArray('ASIGNATURA_SISTEMA_cALIFICACIÓN', sistemas);
            saveArray('RESULTADOS_APRENDIZAJE', resultados);
            saveArray('ASIGNATURA_INDICADORES', indicadores);
            saveArray('ASIGNATURA_INDICADORES_DETALLES', indicadoresDetalle);
            saveArray('EVIDENCIA_dETALLES', evidenciaDetalle);
            //Swal.close();
            console.log('Datos guardados en IndexedDB');
        };
        request.onerror = function(event) {
            //Swal.close();
            console.error('Error al abrir IndexedDB', event);
        };
    });
};




// Buscar asignaturas por nombre en IndexedDB
function getAsignaturas(nombre) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('USAT_CALCULATOR_DB', 1);
        request.onsuccess = function(event) {
            const db = event.target.result;
            const tx = db.transaction('ASIGNATURA', 'readonly');
            const store = tx.objectStore('ASIGNATURA');
            const results = [];
            const cursorRequest = store.openCursor();
            cursorRequest.onsuccess = function(e) {
                const cursor = e.target.result;
                if (cursor) {
                    if (cursor.value.nombre && cursor.value.nombre.toLowerCase().includes(nombre.toLowerCase())) {
                        results.push(cursor.value);
                    }
                    cursor.continue();
                } else {
                    resolve(results);
                }
            };
            cursorRequest.onerror = function(e) {
                reject(e);
            };
        };
        request.onerror = function(e) {
            reject(e);
        };
    });
}

// Buscar id_facultad por nombre en IndexedDB
function getIDFacultad(nombre) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('USAT_CALCULATOR_DB', 1);
        request.onsuccess = function(event) {
            const db = event.target.result;
            const tx = db.transaction('FACULTAD', 'readonly');
            const store = tx.objectStore('FACULTAD');
            const cursorRequest = store.openCursor();
            cursorRequest.onsuccess = function(e) {
                const cursor = e.target.result;
                if (cursor) {
                    if (cursor.value.nombre && cursor.value.nombre.toLowerCase() === nombre.toLowerCase()) {
                        resolve(cursor.value.id_facultad);
                        return;
                    }
                    cursor.continue();
                } else {
                    resolve(null); // No encontrado
                }
            };
            cursorRequest.onerror = function(e) {
                reject(e);
            };
        };
        request.onerror = function(e) {
            reject(e);
        };
    });
}

// Buscar id_escuela por nombre en IndexedDB
function getIDEscuela(nombre) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('USAT_CALCULATOR_DB', 1);
        request.onsuccess = function(event) {
            const db = event.target.result;
            const tx = db.transaction('ESCUELA', 'readonly');
            const store = tx.objectStore('ESCUELA');
            const cursorRequest = store.openCursor();
            cursorRequest.onsuccess = function(e) {
                const cursor = e.target.result;
                if (cursor) {
                    if (cursor.value.nombre && cursor.value.nombre.toLowerCase() === nombre.toLowerCase()) {
                        resolve(cursor.value.id_escuela);
                        return;
                    }
                    cursor.continue();
                } else {
                    resolve(null); // No encontrado
                }
            };
            cursorRequest.onerror = function(e) {
                reject(e);
            };
        };
        request.onerror = function(e) {
            reject(e);
        };
    });
}

// Buscar sistema de calificación por id_asignatura en IndexedDB
function getAsignaturaSistemaCalificacion(id_asignatura) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('USAT_CALCULATOR_DB', 1);
        request.onsuccess = function(event) {
            const db = event.target.result;
            const tx = db.transaction('ASIGNATURA_SISTEMA_cALIFICACIÓN', 'readonly');
            const store = tx.objectStore('ASIGNATURA_SISTEMA_cALIFICACIÓN');
            const getRequest = store.get(id_asignatura);
            getRequest.onsuccess = function(e) {
                resolve(getRequest.result || null);
            };
            getRequest.onerror = function(e) {
                reject(e);
            };
        };
        request.onerror = function(e) {
            reject(e);
        };
    });
}


// ¡ADVERTENCIA! Esto expone tus credenciales
// Solo para desarrollo/testing

function insertRowFromFrontend() {
  const { private_key, client_email } = '/json/usatcalculator-461921-d75b95f6a886.json';
  
  gapi.load('client:auth2', () => {
    gapi.client.init({
      apiKey: 'd75b95f6a8865f09028c10d51c0b10215fd9f97c',
      clientId: client_email,
      discoveryDocs: ['https://sheets.googleapis.com/$discovery/rest?version=v4'],
      scope: 'https://www.googleapis.com/auth/spreadsheets'
    }).then(() => {
      // Lógica para insertar fila
    });
  });
}