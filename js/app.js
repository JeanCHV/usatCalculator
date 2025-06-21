var nombreCurso = null;
var Semestre = null;
var data1 = null;
var data2 = null;
var urlApi = 'https://usatcommuniy.pythonanywhere.com/';
//var urlApi = 'http://127.0.0.1:5000/';

const analizarPDF = async () => {
    const archivo = $("#pdfFile")[0].files[0];
    if (!archivo) {
        Swal.fire('Error', '<span style="color:#900;font-weight:bold;"><i class="bi bi-bug"></i> Por favor selecciona un archivo PDF.<br>Puedes reportar esta incidencia usando el botón de <b>feedback</b> (esquina inferior derecha).</span>', 'error');
        return;
    }

    // Mostrar loading

    const loadingSwal = Swal.fire({
        title: 'Procesando PDF',
        html: 'Extrayendo información del Sílabo...',
        allowOutsideClick: false,
        showConfirmButton: false,  // Oculta el botón OK
        didOpen: () => {
            Swal.showLoading();  // Muestra el spinner de carga
        },
        color: swalColor,
        background: swalBg
    });

    try {
        const lector = new FileReader();

        lector.onload = async function () {
            try {
                const typedarray = new Uint8Array(this.result);
                const pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;
                let textoCompleto = "";

                // Obtener todo el texto del PDF
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const content = await page.getTextContent();
                    const textoPagina = content.items.map(item => item.str).join(" ");
                    textoCompleto += textoPagina + "\n";
                }

                // Extraer nombre del curso
                const curso = textoCompleto.indexOf("Asignatura:") + "Asignatura:".length;
                const cursoFin = textoCompleto.indexOf("1.2 Código:");
                nombreCurso = textoCompleto.substring(curso, cursoFin).trim();

                // Extraer semestre
                const semestreInicio = textoCompleto.indexOf("Semestre académico:") + "Semestre académico:".length;
                const semestreFin = textoCompleto.indexOf("1.10 Grupo Horario:");
                Semestre = textoCompleto.substring(semestreInicio, semestreFin).trim();

                // Validación de semestre actual
                const semestreActual = obtenerSemestreActual();
                if (Semestre !== semestreActual) {
                    await loadingSwal.close();
                    Swal.fire({
                        icon: 'warning',
                        title: 'Semestre incorrecto',
                        text: `El sílabo corresponde al semestre: ${Semestre}.\nSolo se permite procesar sílabos del semestre actual (${semestreActual}).`,
                        color: getThemeColor ? getThemeColor() : undefined,
                        background: getThemeBackground ? getThemeBackground() : undefined
                    });
                    return;
                }

                // Extraer secciones importantes
                const inicioUnidades = textoCompleto.indexOf("UNIDADES DIDÁCTICAS");
                const finUnidades = textoCompleto.indexOf("ESTRATEGIAS DIDÁCTICAS");
                const inicioCalificacion = textoCompleto.indexOf("Sistema de calificación");
                const finReferencias = textoCompleto.indexOf("REFERENCIAS");

                if (inicioUnidades === -1 || finUnidades === -1 || inicioCalificacion === -1 || finReferencias === -1) {
                    await loadingSwal.close();
                    Swal.fire('Error', '<span style="color:#900;font-weight:bold;"><i class="bi bi-bug"></i> No se encontraron todas las secciones requeridas en el documento.<br>Error: ' + (error && error.message ? error.message : error) + '<br>Puedes reportar esta incidencia usando el botón de <b>feedback</b> (esquina inferior derecha).</span>', 'error');
                    return;
                }

                const textoExtraidoUnidades = textoCompleto.substring(inicioUnidades, finUnidades).trim();
                const textoExtraidoCalificacion = textoCompleto.substring(inicioCalificacion, finReferencias).trim();

                const extraerEntreCorchetes = (texto, patron) => {
                    const regex = new RegExp(patron + "\\s*\\[([^\]]+)\\]", "i");
                    const match = texto.match(regex);
                    return match ? match[1].trim() : null;
                };
                const extraerPorPrefijo = (texto, prefijo) => {
                    const idx = texto.indexOf(prefijo);
                    if (idx === -1) return null;
                    const sub = texto.substring(idx + prefijo.length);
                    const corcheteIni = sub.indexOf("[");
                    const corcheteFin = sub.indexOf("]");
                    if (corcheteIni === -1 || corcheteFin === -1) return null;
                    return sub.substring(corcheteIni + 1, corcheteFin).trim();
                };
                // Extracción mejorada para delimitadores conocidos
                const extraerFacultad = (texto) => {
                    const ini = texto.indexOf("FACULTAD DE");
                    if (ini === -1) return null;
                    const sub = texto.substring(ini + "FACULTAD DE".length);
                    const fin = sub.indexOf("PROGRAMA DE ESTUDIOS DE");
                    return fin === -1 ? sub.trim() : sub.substring(0, fin).trim();
                };
                const extraerEscuela = (texto) => {
                    const ini = texto.indexOf("PROGRAMA DE ESTUDIOS DE");
                    if (ini === -1) return null;
                    const sub = texto.substring(ini + "PROGRAMA DE ESTUDIOS DE".length);
                    const fin = sub.indexOf("SÍLABO");
                    return fin === -1 ? sub.trim() : sub.substring(0, fin).trim();
                };
                const extraerPorPrefijoTextoPlano = (texto, prefijo) => {
                    const idx = texto.indexOf(prefijo);
                    if (idx === -1) return null;
                    let sub = texto.substring(idx + prefijo.length).trim();
                    // Tomar hasta salto de línea, punto y coma, o máximo 100 caracteres
                    let fin = sub.search(/[\n\r;\[]|\d+\./); // hasta salto de línea, punto y coma, corchete o inicio de sección tipo '1.2'
                    if (fin === -1) fin = sub.length;
                    return sub.substring(0, fin).trim();
                };
                const datosCapturados = {
                    facultad: extraerFacultad(textoCompleto),
                    escuela: extraerEscuela(textoCompleto),
                    codigo: extraerPorPrefijoTextoPlano(textoCompleto, "1.2 Código:"),
                    asignatura: extraerPorPrefijoTextoPlano(textoCompleto, "1.1 Asignatura:"),
                    plan_estudios: extraerPorPrefijoTextoPlano(textoCompleto, "1.3 Ciclo del plan de estudios:"),
                    semestre: extraerPorPrefijoTextoPlano(textoCompleto, "1.9 Semestre académico:")
                };

                // Extracción de datos estaticos 
                $.ajax({
                    url: urlApi + '/buscarOInsertarAsignatura',
                    method: 'POST',
                    contentType: 'application/json',
                    data: JSON.stringify(datosCapturados),
                    dataType: 'json',
                    success: async function (response) {

                        //Si existe, consultar en la BD MySQL
                        if (response.existed === true) {
                            try {
                                // Consultar unidades e indicadores
                                const data1Result = await $.ajax({
                                    url: urlApi + '/getUnidadesConIndicadores/' + response.id_asignatura,
                                    method: 'GET',
                                    contentType: 'application/json',
                                    dataType: 'json'
                                });
                                data1 = data1Result;
                                // Consultar sistema de calificación
                                const data2Result = await $.ajax({
                                    url: urlApi + '/getSistemaCalificacion/' + response.id_asignatura,
                                    method: 'GET',
                                    contentType: 'application/json',
                                    dataType: 'json'
                                });
                                data2 = data2Result;
                                await loadingSwal.close();
                                Swal.fire({
                                    toast: true,
                                    position: 'top-end',
                                    icon: 'success',
                                    title: 'Éxito',
                                    html: 'El sílabo ha sido procesado correctamente.<br><br>¿Tienes sugerencias o encontraste algún error? Haz clic en el botón de <b>feedback</b> (esquina inferior derecha) para comunicarte.',
                                    showConfirmButton: false,
                                    timer: 3500,
                                    timerProgressBar: true,
                                    color: getThemeColor(),
                                    background: getThemeBackground()
                                });
                                generarHTML();

                            } catch (err) {

                                Swal.fire('Error', '<span style="color:#900;font-weight:bold;"><i class="bi bi-bug"></i> No se pudieron obtener las unidades, indicadores o sistema de calificación.<br>Error: ' + (err && err.message ? err.message : (err && err.statusText ? err.statusText : err)) + '<br>Puedes reportar esta incidencia usando el botón de <b>feedback</b> (esquina inferior derecha).</span>', 'error');
                                loadingSwal.close();
                            }
                        }
                        // Si no existe , procesar normalmente con magic loops 
                        else {
                            try {
                                // Mostrar mensaje amigable pero mantener el loadingSwal abierto
                                Swal.fire({
                                    icon: 'info',
                                    title: '¡Vaya! Este syllabus es nuevo',
                                    html: 'No teníamos este curso registrado, pero lo estamos añadiendo a la base de datos.<br><br><b>¡Gracias por tu contribución!</b>',
                                    showConfirmButton: false,
                                    allowOutsideClick: false,
                                    didOpen: () => {
                                        Swal.showLoading();
                                    },
                                    color: getThemeColor(),
                                    background: getThemeBackground()
                                });
                                // 1. Obtener data1 (unidades)
                                const data1Result = await $.ajax({
                                    url: 'https://magicloops.dev/api/loop/20f6c53c-4298-46d7-b2da-e28a842da6ea/run',
                                    method: 'POST',
                                    contentType: 'application/json',
                                    data: JSON.stringify({ input: textoExtraidoUnidades }),
                                    dataType: 'json'
                                });
                                data1 = data1Result;
                                // 2. Obtener data2 (calificación)
                                const data2Result = await $.ajax({
                                    url: 'https://magicloops.dev/api/loop/f8974f3c-4bd6-4087-a2d6-6a7ea7979177/run',
                                    method: 'POST',
                                    contentType: 'application/json',
                                    data: JSON.stringify({ input: textoExtraidoCalificacion }),
                                    dataType: 'json'
                                });
                                data2 = data2Result;
                                // 3. Insertar unidades e indicadores
                                await $.ajax({
                                    url: urlApi + '/insertarUnidadesIndicadores/' + response.id_asignatura,
                                    method: 'POST',
                                    contentType: 'application/json',
                                    dataType: 'json',
                                    data: JSON.stringify(data1)
                                });
                                // 4. Insertar sistema de calificación
                                await $.ajax({
                                    url: urlApi + '/insertarSistemaCalificacion/' + response.id_asignatura,
                                    method: 'POST',
                                    contentType: 'application/json',
                                    dataType: 'json',
                                    data: JSON.stringify(data2)
                                });
                                await loadingSwal.close();
                                Swal.fire({
                                    icon: 'success',
                                    title: '¡Listo!',
                                    html: 'El syllabus ha sido procesado y añadido correctamente.<br><br>¿Tienes sugerencias o encontraste algún error? Haz clic en el botón de <b>feedback</b> (esquina inferior derecha) para comunicarte.',
                                    color: getThemeColor(),
                                    background: getThemeBackground()
                                });
                                generarHTML();
                            } catch (err) {

                                Swal.fire({
                                    icon: 'error',
                                    title: 'Error',
                                    html: 'Ocurrió un error en el procesamiento:<br><code>' + (err && err.message ? err.message : (err && err.statusText ? err.statusText : err)) + '</code><br><br><span style="color:#900;font-weight:bold;"><i class="bi bi-bug"></i> Puedes reportar esta incidencia usando el botón de <b>feedback</b> (esquina inferior derecha).</span>',
                                    color: getThemeColor(),
                                    background: getThemeBackground()
                                });
                                loadingSwal.close();
                            }
                        }
                    },
                    error: function (err) {

                        Swal.fire('Error', '<span style="color:#900;font-weight:bold;"><i class="bi bi-bug"></i> No se pudieron obtener los datos estáticos.<br>Error: ' + (err && err.message ? err.message : (err && err.statusText ? err.statusText : err)) + '<br>Puedes reportar esta incidencia usando el botón de <b>feedback</b> (esquina inferior derecha).</span>', 'error');
                        loadingSwal.close();
                    }
                });


            } catch (error) {

                await loadingSwal.close();
                Swal.fire('Error', '<span style="color:#900;font-weight:bold;"><i class="bi bi-bug"></i> Ocurrió un error al procesar el PDF.<br>Error: ' + (error && error.message ? error.message : error) + '<br>Puedes reportar esta incidencia usando el botón de <b>feedback</b> (esquina inferior derecha).</span>', 'error');
            }
        };

        lector.readAsArrayBuffer(archivo);
    } catch (error) {

        await loadingSwal.close();
        Swal.fire('Error', '<span style="color:#900;font-weight:bold;"><i class="bi bi-bug"></i> Ocurrió un error al cargar el PDF.<br>Error: ' + (error && error.message ? error.message : error) + '<br>Puedes reportar esta incidencia usando el botón de <b>feedback</b> (esquina inferior derecha).</span>', 'error');
    }
};

const enviarTexto = async (texto, url) => {
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ input: texto })
        });

        if (!response.ok) {
            await Swal.fire('Error', '<span style="color:#900;font-weight:bold;"><i class="bi bi-bug"></i> Error al comunicarse con la API.<br>Error: ' + (response && response.statusText ? response.statusText : response.status) + '<br>Puedes reportar esta incidencia usando el botón de <b>feedback</b> (esquina inferior derecha).</span>', response.status);
        }

        return await response.json();
    } catch (error) {
        Swal.fire('Error', '<span style="color:#900;font-weight:bold;"><i class="bi bi-bug"></i> Ocurrió un error al enviar el texto a la API.<br>Error: ' + (error && error.message ? error.message : error) + '<br>Puedes reportar esta incidencia usando el botón de <b>feedback</b> (esquina inferior derecha).</span>', 'error');
        throw error;
    }
};

const generarHTML = () => {
    if (!data1 || !data1.unidades || data1.unidades.length === 0 || !data2) {
        $("#body-content").html(`
            <div class="alert alert-warning">No hay datos suficientes para generar la vista.<br>Puedes reportar esta incidencia usando el botón de feedback (esquina inferior derecha).</div>
        `);
        return;
    }

    const pesosUnidades = {};

    // Asociar los pesos de RA con cada unidad
    data2.learning_results.forEach(result => {
        const unidadNum = result.unit; // Unidad en formato romano (I, II, III)
        pesosUnidades[unidadNum] = (result.weight * 100).toFixed(2); // Calculamos el peso como porcentaje
    });

    let unidadesHTML = '';
    let pesoTotal = 0;

    // Generar HTML para cada unidad
    data1.unidades.forEach((unidad, index) => {
        // Convertir el índice a la unidad romana correspondiente
        const unidadNum = convertToRoman(index + 1); // Convertir 1, 2, 3... a I, II, III...

        const pesoUnidad = pesosUnidades[unidadNum] || "0.00"; // Si no encuentra el peso, pone 0.00
        pesoTotal += parseFloat(pesoUnidad);

        let subItemsHTML = '';

        unidad.indicadores_detalles.forEach((ind, idx) => {
            const pesoRelativo = (1 / unidad.indicadores_detalles.length).toFixed(2);

            let evidenciasHTML = ind.evidencia_detalle.map(ev =>
                `   
                    <li class="list-group-item d-flex justify-content-between align-items-center">
                         ${ev.evidencia}
                        <span class="badge text rounded-pill" style="background-color: red; color: white;">
                            <input style="background-color: red; border: none; color: white !important; text-align: center;" 
                                type="number" class="nota" data-unit="${unidadNum}" data-indicador="${ind.codigo}" data-peso="${ev.peso_evidencia == 'Prom.Simple' ? 100 : ev.peso_evidencia}" 
                                 min="0" max="20" placeholder="0.00" step="0.01"  />
                        </span>                         
                    </li>
                `
            ).join('');

            subItemsHTML += `
                <li class="list-group-item">
                    <i class="bi bi-chevron-down"></i> ${ind.descripcion}
                </li>
                ${evidenciasHTML}
            `;
        });

        unidadesHTML += `
            <div class="card">
                <div class="card-header" style="background-color: #d9534f; color: white; padding: 10px;">
                    <span>${unidad.unidad.replace("Unidad didáctica N°", "UNIDAD").toUpperCase()}</span>
                </div>
                <div class="card-body">          
                    <ul class="list-group">
                        <li class="list-group-item list-group-item-danger d-flex justify-content-between align-items-center">
                            <i class="bi bi-chevron-down"></i> ${unidad.resultado}
                            <span class="badge text rounded-pill" style="background-color: red; color: white;">Peso: ${pesoUnidad}% | <span id="promedioUnidad${index + 1}">0.00</span></span>
                        </li>
                        ${subItemsHTML}
                    </ul>
                </div>
            </div>
        `;
    });

    $("#body-content").html(`
        <button id="share-png" class="btn btn-success mb-3"><i class="bi bi-share"></i> Compartir</button>
        <div class="header">
            <span>Semestre: <span id="Semestre">${Semestre || 'No especificado'}</span></span>
            <span id="curso">${nombreCurso || 'Curso no especificado'}</span>
        </div>
        ${unidadesHTML}
        <div class="final-average" style="background-color: #900; color: white; padding: 10px; text-align: center; font-size: 1.2em; border-radius: 5px;">
            Avance del Promedio Final: <span id="promedio-final">0.00</span>
        </div>
    `);

    // Botón compartir PNG
    $("#share-png").on("click", async function () {
        Swal.fire({
            title: 'Generando imagen...',
            html: '<div class="spinner-border text-success" role="status"></div><br><small>Preparando la imagen para compartir o descargar...</small>',
            allowOutsideClick: false,
            showConfirmButton: false,
            background: getThemeBackground(),
            color: getThemeColor(),
            customClass: {
                title: 'swal2-title-custom',
                popup: 'swal2-popup-custom',
                htmlContainer: 'swal2-html-custom'
            },
            didOpen: () => { Swal.showLoading(); }
        });
        html2canvas(document.querySelector("#body-content"), { backgroundColor: null }).then(async function (canvas) {
            canvas.toBlob(async function (blob) {
                await Swal.close();
                // Opción de copiar al portapapeles (Clipboard API)
                let clipboardSupported = (navigator.clipboard && window.ClipboardItem);
                let showCopy = clipboardSupported;
                let showShare = (navigator.canShare && navigator.canShare({ files: [new File([blob], 'calculadora_usat.png', { type: blob.type })] }));
                let buttonsHtml = '';
                if (showCopy) {
                    buttonsHtml += '<button id="btn-copy-img" class="btn btn-primary m-2"><i class="bi bi-clipboard"></i> Copiar imagen</button>';
                }
                if (showShare) {
                    buttonsHtml += '<button id="btn-share-img" class="btn btn-success m-2"><i class="bi bi-share"></i> Compartir</button>';
                }
                buttonsHtml += '<button id="btn-download-img" class="btn btn-secondary m-2"><i class="bi bi-download"></i> Descargar</button>';
                Swal.fire({
                    icon: 'info',
                    title: 'Imagen generada',
                    html: '<b>¿Qué deseas hacer con la imagen?</b><br>' + buttonsHtml + '<br><small>Si quieres compartirla, búscala en tu carpeta de descargas o usa las opciones disponibles.</small>',
                    showConfirmButton: false,
                    background: getThemeBackground(),
                    color: getThemeColor(),
                    customClass: {
                        title: 'swal2-title-custom',
                        popup: 'swal2-popup-custom',
                        htmlContainer: 'swal2-html-custom'
                    },
                    didOpen: () => {
                        // Copiar imagen al portapapeles
                        if (showCopy) {
                            document.getElementById('btn-copy-img').onclick = async function () {
                                try {
                                    await navigator.clipboard.write([
                                        new window.ClipboardItem({ [blob.type]: blob })
                                    ]);
                                    Swal.fire({
                                        icon: 'success',
                                        title: '¡Copiado!',
                                        text: 'La imagen se copió al portapapeles. Puedes pegarla en cualquier chat o documento.',
                                        timer: 1800,
                                        showConfirmButton: false,
                                        background: getThemeBackground(),
                                        color: getThemeColor()
                                    });
                                } catch (err) {
                                    Swal.fire({
                                        icon: 'error',
                                        title: 'Error',
                                        html: '<span style="color:#900;font-weight:bold;"><i class="bi bi-bug"></i> No se pudo copiar la imagen.<br>Si el problema persiste, por favor repórtalo usando el botón de <b>feedback</b> (esquina inferior derecha).</span> \n Error: ' + (err && err.message ? err.message : err),
                                        timer: 2000,
                                        showConfirmButton: false,
                                        background: getThemeBackground(),
                                        color: getThemeColor()
                                    });
                                }
                            };
                        }
                        // Compartir imagen
                        if (showShare) {
                            document.getElementById('btn-share-img').onclick = async function () {
                                try {
                                    await navigator.share({
                                        files: [new File([blob], 'calculadora_usat.png', { type: blob.type })],
                                        title: 'Calculadora USAT',
                                        text: 'Te comparto el avance del promedio final generado con la Calculadora USAT.'
                                    });
                                    Swal.fire({
                                        icon: 'success',
                                        title: '¡Compartido!',
                                        text: 'La imagen fue compartida exitosamente.',
                                        timer: 2000,
                                        showConfirmButton: false,
                                        background: getThemeBackground(),
                                        color: getThemeColor()
                                    });
                                } catch (err) {
                                    Swal.fire({
                                        icon: 'info',
                                        title: 'Compartir cancelado',
                                        html: '<span style="color:#900;font-weight:bold;"><i class="bi bi-bug"></i> No se completó el proceso de compartir.<br>Si el problema persiste, por favor repórtalo usando el botón de <b>feedback</b> (esquina inferior derecha).</span> \n Error: ' + (err && err.message ? err.message : err),
                                        timer: 2000,
                                        showConfirmButton: false,
                                        background: getThemeBackground(),
                                        color: getThemeColor()
                                    });
                                }
                            };
                        }
                        // Descargar imagen
                        $("#btn-download-img").off("click").on("click", function () {
                            var $link = $("<a>")
                                .attr("download", "calculadora_usat.png")
                                .attr("href", canvas.toDataURL());
                            $("body").append($link); // Añadir temporalmente al DOM
                            $link[0].click();
                            $link.remove(); // Eliminar después de hacer click
                        });
                    }
                });
            }, 'image/png');
        });
    });

    // Eliminar el botón de calcular notas mínimas necesarias visualmente si existe
    $("#btn-minimas-necesarias").remove();
    // Mejoras visuales generales para la UI dinámica
    $("#body-content .card").addClass("shadow-lg border-0 mb-4");
    $("#body-content .card-header").css({
        'background': '#D9534F',
        'color': 'white',
        'fontWeight': 'bold',
        'fontSize': '1.1em',
        'letterSpacing': '1px',
        'borderTopLeftRadius': '10px',
        'borderTopRightRadius': '10px',
        'boxShadow': '0 2px 8px rgba(0,0,0,0.07)'
    });
    $("#body-content .card-body").css({

        'borderBottomLeftRadius': '10px',
        'borderBottomRightRadius': '10px',
        'padding': '1.5rem'
    });
    $("#body-content .list-group-item").css({
        'fontSize': '1em',
        'background': '#f8f9fa',
        'border': 'none',
        'marginBottom': '4px',
        'borderRadius': '6px'
    });
    $("#body-content .list-group-item-danger").css({
        'background': '#D9534F',
        'color': 'white',
        'fontWeight': 'bold'
    });
    $("#body-content .badge").css({
        'fontSize': '1em',
        'padding': '0.5em 1em',
        'boxShadow': '0 1px 4px rgba(0,0,0,0.08)'
    });
    $("#body-content input.nota").css({
        'borderRadius': '6px',
        'fontWeight': 'bold',
        'fontSize': '1em',
        'boxShadow': '0 1px 4px rgba(0,0,0,0.08)',
        'transition': 'background 0.3s'
    });
    $("#body-content .final-average").css({
        'background': 'linear-gradient(90deg, #900 60%, #f7b731 100%)',
        'color': 'white',
        'fontWeight': 'bold',
        'fontSize': '1.3em',
        'marginTop': '2rem',
        'boxShadow': '0 2px 8px rgba(0,0,0,0.10)'
    });
    $("#body-content .header").css({
        'background': '#f7b731',
        'color': '#900',
        'fontWeight': 'bold',
        'fontSize': '1.1em',
        'padding': '1em',
        'borderRadius': '10px',
        'marginBottom': '1.5em',
        'boxShadow': '0 2px 8px rgba(0,0,0,0.07)'
    });
    $("#body-content #share-png").css({
        'fontWeight': 'bold',
        'fontSize': '1.1em',
        'padding': '0.7em 1.5em',
        'borderRadius': '8px',
        'boxShadow': '0 2px 8px rgba(0,0,0,0.10)',
        'marginBottom': '1.5em',
        'background': 'linear-gradient(90deg, #28a745 60%, #f7b731 100%)',
        'border': 'none'
    });
    // Asignar eventos con jQuery a los inputs de nota
    $(".nota").on("input", function (e) {
        let val = $(this).val();
        console.log('val: ', val);
        let num = val === '' ? '' : parseFloat(val);
        console.log('num: ', num);
        if (!isNaN(num)) {
            if (num > 20) num = 20;
            if (num < 0) num = 0;
            // Actualizar el valor en el input si está fuera de rango
            if (num !== parseFloat(val)) {
                $(this).val(num);
                val = num;
            }
        }
        const unidadNum = $(this).data("unit");
        const unidadIndex = convertFromRoman(unidadNum) - 1;
        cambiarColorNota(this, unidadIndex);
    });

    $('#btn-area').show();
    $(".collapse").collapse('toggle');
    $('#ia-fab').show();
    // Asignar evento para autollenado IA
    $('#ia-fab').off('click').on('click', function () {
        calcularNotasMinimasNecesarias();
    });
};

// Función para cambiar el color del input y calcular el promedio
function cambiarColorNota(input, unidadIndex) {
    let valor = input.value;
    valor = valor === '' ? '' : parseFloat(valor);
    const spanPadre = input.parentElement;
    // Si el valor es NaN, null, undefined o string vacío, color gray
    if (valor === '' || isNaN(valor) || valor === null || valor === undefined) {
        input.style.backgroundColor = "gray";
        spanPadre.style.backgroundColor = "gray";
    } else if (valor >= 0 && valor <= 13.4) {
        input.style.backgroundColor = "red";
        spanPadre.style.backgroundColor = "red";
    } else if (valor >= 13.5 && valor <= 20) {
        input.style.backgroundColor = "blue";
        spanPadre.style.backgroundColor = "blue";
    } else {
        input.style.backgroundColor = "gray";
        spanPadre.style.backgroundColor = "gray";
    }

    // Log para ver el valor ingresado en cada input


    // Calcular el promedio de la unidad
    actualizarPromedioUnidad(unidadIndex);
    // Actualizar promedio final
    actualizarPromedioFinal();
}

// Función para actualizar el promedio de la unidad
function actualizarPromedioUnidad(unidadIndex) {
    const unidad = data1.unidades[unidadIndex];
    let promedioUnidad = 0;

    unidad.indicadores_detalles.forEach(indicador => {
        // Peso del indicador en decimal
        var pesoUnidad = indicador.peso == 'Prom.Simple' ? 100 : parseFloat(indicador.peso);
        console.log('indicador.peso: ', indicador.peso);
        console.log('1.-pesoUnidad: ', pesoUnidad);
        const pesoIndicador = parseFloat(pesoUnidad) / 100;
        console.log('2.-pesoIndicador: ', pesoIndicador);

        // Inputs de evidencias que pertenecen a este indicador
        let sumaNotas = 0;
        let cantidadNotas = 0;

        indicador.evidencia_detalle.forEach(ev => {
            // Seleccionamos el input correspondiente con data-indicador y data-unit
            const selector = `.nota[data-unit="${convertToRoman(unidadIndex + 1)}"][data-indicador="${indicador.codigo}"]`;
            const input = $(selector)[cantidadNotas]; // Asumiendo 1 evidencia por indicador

            if (input) {
                const valor = parseFloat($(input).val()) || 0;
                sumaNotas += valor;
                cantidadNotas++;
                // Log para ver cada nota de evidencia

            }
        });

        const promedioIndicador = cantidadNotas > 0 ? (sumaNotas / cantidadNotas) : 0;
        console.log('3.-promedioIndicador: ', promedioIndicador);
        // Log para ver el promedio de cada indicador


        promedioUnidad += promedioIndicador * pesoIndicador;
        console.log('4.-promedioUnidad: ', promedioUnidad);
    });

    // Actualizar el promedio en el HTML
    const promedioElemento = $(`#promedioUnidad${unidadIndex + 1}`);
    promedioElemento.text(promedioUnidad.toFixed(2));

    // Log para ver el promedio de la unidad


    // Cambiar color según promedio
    if (promedioUnidad < 13.5) {
        promedioElemento.css('background-color', 'red');
        promedioElemento.parent().css('background-color', 'red');
    } else {
        promedioElemento.css('background-color', 'blue');
        promedioElemento.parent().css('background-color', 'blue');
    }
}

// Función para calcular y actualizar el promedio final
function actualizarPromedioFinal() {
    let totalPromedioFinal = 0;

    data2.learning_results.forEach(ra => {
        const raNombre = ra.name; // RA1, RA2, RA3, RA4...
        const raPeso = ra.weight;
        // Buscar el índice de la unidad correspondiente de forma dinámica
        const unidadIndex = convertFromRoman(ra.unit) - 1;
        const unidadPromedio = parseFloat($(`#promedioUnidad${unidadIndex + 1}`).text());

        // Calculamos el promedio ponderado de cada RA
        totalPromedioFinal += (unidadPromedio * raPeso);
        // Log para ver el aporte de cada RA al promedio final

    });

    const promedioFinal = totalPromedioFinal.toFixed(4); // Promedio final calculado
    // Log para ver el promedio final

    $("#promedio-final").text(promedioFinal);

    // Cambiar color dinámicamente según el promedio final
    const finalAverageDiv = $(".final-average");
    if (parseFloat(promedioFinal) < 13.5) {
        finalAverageDiv.css({
            'background': 'linear-gradient(90deg, #900 60%, #f7b731 100%)',
            'color': 'white',
            'boxShadow': '0 2px 8px rgba(144,0,0,0.15)'
        });
    } else {
        finalAverageDiv.css({
            'background': 'linear-gradient(90deg, #0074D9 60%, #f7b731 100%)',
            'color': 'white',
            'boxShadow': '0 2px 8px rgba(0,116,217,0.15)'
        });
    }
}

// Función para convertir un número entero a su equivalente en número romano
function convertToRoman(num) {
    const romanNumerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']; // Hasta 10
    return romanNumerals[num - 1] || ''; // Retorna el número romano correspondiente, con un máximo de 10 unidades
}

// Función para convertir un número romano a entero
function convertFromRoman(roman) {
    const romanNumerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
    return romanNumerals.indexOf(roman) + 1;
}

function debugNotasPorUnidad() {
    if (!data1 || !data1.unidades) {

        return;
    }
    const notasPorUnidad = data1.unidades.map((unidad, unidadIndex) => {
        const notasIndicadores = unidad.indicadores_detalles.map((indicador) => {
            const notasEvidencias = indicador.evidencia_detalle.map((ev, idx) => {
                const selector = `.nota[data-unit=\"${convertToRoman(unidadIndex + 1)}\"][data-indicador=\"${indicador.codigo}\"]`;
                const input = $(selector)[idx];
                return input ? parseFloat($(input).val()) || 0 : null;
            });
            return {
                indicador: indicador.codigo,
                notas: notasEvidencias
            };
        });
        return {
            unidad: unidad.unidad,
            indicadores: notasIndicadores
        };
    });

    return notasPorUnidad;
}

// Calcula y muestra las notas mínimas necesarias para aprobar considerando el promedio final ponderado
function calcularNotasMinimasNecesarias() {
    const NOTA_APROBATORIA = 13.5;
    if (!data1 || !data2) return;
    let unidadesPendientes = [];
    let pesosUnidades = {};
    data2.learning_results.forEach(result => {
        const unidadNum = result.unit;
        pesosUnidades[unidadNum] = result.weight;
    });
    // 1. Recolectar info de inputs y pesos
    data1.unidades.forEach((unidad, unidadIndex) => {
        let sumaNotas = 0;
        let faltanInputs = [];
        let totalInputs = 0;
        let detallesInputs = [];
        unidad.indicadores_detalles.forEach((indicador) => {
            indicador.evidencia_detalle.forEach((ev, idx) => {
                const selector = `.nota[data-unit=\"${convertToRoman(unidadIndex + 1)}\"][data-indicador=\"${indicador.codigo}\"]`;
                const input = $(selector)[idx];
                let valor = input ? parseFloat($(input).val()) : null;
                if (valor !== null && !isNaN(valor)) {
                    sumaNotas += valor;
                    detallesInputs.push({ input, idx, indicador: indicador.codigo, evidencia: ev.evidencia, valor, pendiente: false });
                } else {
                    faltanInputs.push({ input, idx, indicador: indicador.codigo, evidencia: ev.evidencia });
                    detallesInputs.push({ input, idx, indicador: indicador.codigo, evidencia: ev.evidencia, valor: null, pendiente: true });
                }
                totalInputs++;
            });
        });
        unidadesPendientes.push({
            unidadIndex,
            unidad,
            sumaNotas,
            totalInputs,
            faltanInputs,
            detallesInputs
        });
    });
    // 2. Calcular la nota mínima global para que el promedio final sea 13.5
    let totalFaltantes = 0;
    let faltantesGlobal = [];
    let promedioFinalActual = 0;
    unidadesPendientes.forEach((u, idx) => {
        const unidadNum = convertToRoman(idx + 1);
        const pesoUnidad = pesosUnidades[unidadNum] || 0;
        let cantidadLlenos = u.totalInputs - u.faltanInputs.length;
        let promedioUnidad = cantidadLlenos > 0 ? u.sumaNotas / cantidadLlenos : 0;
        if (u.faltanInputs.length === 0) {
            promedioFinalActual += promedioUnidad * pesoUnidad;
        } else {
            totalFaltantes += u.faltanInputs.length;
            faltantesGlobal.push({ unidadIndex: idx, pesoUnidad, faltanInputs: u.faltanInputs, totalInputs: u.totalInputs, sumaNotas: u.sumaNotas, cantidadLlenos });
        }
    });
    let notaMinimaGlobal = null;
    if (totalFaltantes > 0) {
        let sumPesosNotas = 0;
        let sumPesosFaltantes = 0;
        faltantesGlobal.forEach(fg => {
            sumPesosNotas += fg.pesoUnidad * (fg.sumaNotas / fg.totalInputs);
            sumPesosFaltantes += fg.pesoUnidad * (fg.faltanInputs.length / fg.totalInputs);
        });
        notaMinimaGlobal = (NOTA_APROBATORIA - promedioFinalActual - sumPesosNotas) / (sumPesosFaltantes || 1);
        notaMinimaGlobal = Math.max(0, Math.min(20, notaMinimaGlobal));
    }
    // 3. Ajustar para que cada unidad también tenga promedio 13.5
    // Si hay unidades con campos pendientes, recalcular para que su promedio sea 13.5
    let delay = 0;
    unidadesPendientes.forEach((u, idx) => {
        if (u.faltanInputs.length > 0) {
            let sumaActual = u.sumaNotas;
            let faltan = u.faltanInputs.length;
            let notaUnidad = (NOTA_APROBATORIA * u.totalInputs - sumaActual) / (faltan || 1);
            notaUnidad = Math.max(0, Math.min(20, notaUnidad));
            if (notaMinimaGlobal !== null) notaUnidad = Math.min(notaUnidad, notaMinimaGlobal);
            u.detallesInputs.forEach(d => {
                if (d.pendiente && d.input) {
                    const valorStr = notaUnidad.toFixed(2);
                    $(d.input).val("");
                    // Scroll al input antes de escribir
                    setTimeout(() => {
                        d.input.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, delay);
                    // Simular escritura número por número
                    for (let i = 0; i < valorStr.length; i++) {
                        setTimeout(() => {
                            let actual = $(d.input).val() + valorStr[i];
                            $(d.input).val(actual);
                            $(d.input)[0].dispatchEvent(new Event('input', { bubbles: true }));
                            $(d.input)[0].dispatchEvent(new Event('keyup', { bubbles: true }));
                        }, delay + 80 * i);
                    }
                    // Asegurar valor final
                    setTimeout(() => {
                        $(d.input).val(valorStr);
                        $(d.input)[0].dispatchEvent(new Event('input', { bubbles: true }));
                        $(d.input)[0].dispatchEvent(new Event('keyup', { bubbles: true }));
                    }, delay + 80 * valorStr.length + 60);
                    delay += 80 * valorStr.length + 120;
                }
            });
        }
    });
    // 4. Ajustar el promedio final a 13.5 si hay redondeos
    setTimeout(() => {
        for (let i = 0; i < data1.unidades.length; i++) {
            actualizarPromedioUnidad(i);
        }
        actualizarPromedioFinal();
        let promedioFinal = parseFloat($("#promedio-final").text());
        if (totalFaltantes > 0 && Math.abs(promedioFinal - NOTA_APROBATORIA) > 0.01) {
            let lastInput = null;
            for (let i = unidadesPendientes.length - 1; i >= 0; i--) {
                let u = unidadesPendientes[i];
                for (let j = u.detallesInputs.length - 1; j >= 0; j--) {
                    let d = u.detallesInputs[j];
                    if (d.pendiente && d.input) {
                        lastInput = d.input;
                        break;
                    }
                }
                if (lastInput) break;
            }
            if (lastInput) {
                let ajuste = NOTA_APROBATORIA - promedioFinal;
                let valorActual = parseFloat($(lastInput).val()) || 0;
                let nuevoValor = Math.max(0, Math.min(20, valorActual + ajuste));
                $(lastInput).val(nuevoValor.toFixed(2));
                $(lastInput)[0].dispatchEvent(new Event('input', { bubbles: true }));
                $(lastInput)[0].dispatchEvent(new Event('keyup', { bubbles: true }));
                lastInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                for (let i = 0; i < data1.unidades.length; i++) {
                    actualizarPromedioUnidad(i);
                }
                actualizarPromedioFinal();
            }
        }
    }, delay + 200);
}

// Drag & drop funcional y minimalista para PDF
$(function () {
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('pdfFile');
    const fileNameArea = document.getElementById('file-name-area');
    if (!uploadArea || !fileInput) return;

    uploadArea.addEventListener('click', () => fileInput.click());

    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });
    uploadArea.addEventListener('dragleave', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
    });
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        const files = e.dataTransfer.files;
        // Permitir sobreescribir el archivo anterior
        fileInput.value = '';
        if (files.length && files[0].type === 'application/pdf') {
            // Crear un nuevo DataTransfer para sobreescribir correctamente
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(files[0]);
            fileInput.files = dataTransfer.files;
            fileNameArea.textContent = files[0].name;
            fileNameArea.style.color = '#28a745';
        } else {
            fileNameArea.textContent = 'Archivo no válido. Sube un PDF.\n.' + ' (Error)' + (e ? ('\n' + e) : '') + '\nPuedes reportar esta incidencia usando el botón de feedback (esquina inferior derecha).';
            fileNameArea.style.color = '#dc3545';
        }
    });
    fileInput.addEventListener('change', () => {
        if (fileInput.files.length && fileInput.files[0].type === 'application/pdf') {
            fileNameArea.textContent = fileInput.files[0].name;
            fileNameArea.style.color = '#28a745';
        } else {
            fileNameArea.textContent = 'Archivo no válido. Sube un PDF.\n.' + ' (Error)' + (e ? ('\n' + e) : '') + '\nPuedes reportar esta incidencia usando el botón de feedback (esquina inferior derecha).';
            fileNameArea.style.color = '#dc3545';
        }
    });
});

// Dropzone funcional para PDF
$(function () {
    // Desactivar autoDiscover de Dropzone (buena práctica)
    if (window.Dropzone) Dropzone.autoDiscover = false;
    const dropZoneElem = document.getElementById('drop-zone');
    const fileInput = document.getElementById('pdfFile');
    const fileNameArea = document.getElementById('file-name-area');
    if (!dropZoneElem || !fileInput) return;

    // Inicializar Dropzone manualmente
    const dz = new Dropzone(dropZoneElem, {
        url: '#', // No se sube a servidor
        autoProcessQueue: false,
        clickable: fileInput,
        acceptedFiles: '.pdf',
        maxFiles: 1,
        previewsContainer: false,
        dictDefaultMessage: '',
        init: function () {
            this.on('addedfile', function (file) {
                // Limpiar archivos previos si ya hay uno
                if (this.files.length > 1) {
                    this.removeAllFiles(true);
                }
                if (file.type === 'application/pdf') {
                    fileNameArea.textContent = file.name;
                    fileNameArea.style.color = '#28a745';
                    // Asignar archivo al input para compatibilidad
                    const dataTransfer = new DataTransfer();
                    dataTransfer.items.add(file);
                    fileInput.files = dataTransfer.files;
                } else {
                    fileNameArea.textContent = 'Archivo no válido. Sube un PDF.\n.' + ' (Error)' + (e ? ('\n' + e) : '') + '\nPuedes reportar esta incidencia usando el botón de feedback (esquina inferior derecha).';
                    fileNameArea.style.color = '#dc3545';
                    this.removeFile(file);
                }
            });
            this.on('error', function (file, e) {
                fileNameArea.textContent = 'Archivo no válido. Sube un PDF.\n.' + ' (Error)' + (e ? ('\n' + e) : '') + '\nPuedes reportar esta incidencia usando el botón de feedback (esquina inferior derecha).';
                fileNameArea.style.color = '#dc3545';
            });
            this.on('removedfile', function () {
                fileInput.value = '';
                fileNameArea.textContent = '';
            });
        }
    });

    // Si el usuario selecciona archivo por el input, mostrar nombre
    fileInput.addEventListener('change', function () {
        if (fileInput.files.length && fileInput.files[0].type === 'application/pdf') {
            fileNameArea.textContent = fileInput.files[0].name;
            fileNameArea.style.color = '#28a745';
        } else {
            fileNameArea.textContent = 'Archivo no válido. Sube un PDF.\n.' + ' (Error)' + (e ? ('\n' + e) : '') + '\nPuedes reportar esta incidencia usando el botón de feedback (esquina inferior derecha).';
            fileNameArea.style.color = '#dc3545';
        }
    });
});

// Asignar evento al botón de generar calculadora
$(document).on('click', '#btn-generar-calc', function (e) {
    e.preventDefault();
    analizarPDF();
});

// Devuelve el semestre actual en formato 'AÑO-0', 'AÑO-I' o 'AÑO-II' según la fecha
function obtenerSemestreActual() {
    const hoy = new Date();
    const mes = hoy.getMonth() + 1; // 1-12
    const anio = hoy.getFullYear();
    if (mes >= 1 && mes <= 3) {
        return `${anio}-0`;
    } else if (mes >= 4 && mes <= 7) {
        return `${anio}-I`;
    } else if (mes >= 8 && mes <= 12) {
        return `${anio}-II`;
    }
    // Fallback
    return `${anio}-I`;
}
