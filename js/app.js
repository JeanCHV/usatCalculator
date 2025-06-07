var nombreCurso = null;
var Semestre = null;
var data1 = null;
var data2 = null;
var urlApi = 'https://usatcommuniy.pythonanywhere.com/';
//var urlApi = 'http://127.0.0.1:5000/';


const analizarPDF = async () => {
    const archivo = $("#pdfFile")[0].files[0];
    if (!archivo) {
        Swal.fire('Error', 'Por favor selecciona un archivo PDF.', 'error');
        return;
    }

    // Mostrar loading

    const loadingSwal = Swal.fire({
        title: 'Procesando PDF',
        html: 'Extrayendo información del syllabus...',
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

                // Extraer secciones importantes
                const inicioUnidades = textoCompleto.indexOf("UNIDADES DIDÁCTICAS");
                const finUnidades = textoCompleto.indexOf("ESTRATEGIAS DIDÁCTICAS");
                const inicioCalificacion = textoCompleto.indexOf("Sistema de calificación");
                const finReferencias = textoCompleto.indexOf("REFERENCIAS");

                if (inicioUnidades === -1 || finUnidades === -1 || inicioCalificacion === -1 || finReferencias === -1) {
                    await loadingSwal.close();
                    Swal.fire('Error', 'No se encontraron todas las secciones requeridas en el documento.', 'error');
                    return;
                }

                const textoExtraidoUnidades = textoCompleto.substring(inicioUnidades, finUnidades).trim();
                const textoExtraidoCalificacion = textoCompleto.substring(inicioCalificacion, finReferencias).trim();

                // Extraer datos entre corchetes y mostrarlos en consola como JSON
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
                console.log("Datos extraídos:", JSON.stringify(datosCapturados, null, 2));
                // Extracción de datos estaticos 
                $.ajax({
                    url: urlApi+'/buscarOInsertarAsignatura',
                    method: 'POST',
                    contentType: 'application/json',
                    data: JSON.stringify(datosCapturados),
                    dataType: 'json',
                    success: async function (response) {
                        console.log('Datos estáticos obtenidos:', response);
                        //Si existe, consultar en la BD MySQL
                        if(response.existed === true) {
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
                                Swal.fire('Éxito', 'El syllabus ha sido procesado correctamente.', 'success');
                                generarHTML();
                            } catch (err) {
                                console.error('Error al consultar unidades, indicadores o sistema de calificación:', err);
                                Swal.fire('Error', 'No se pudieron obtener las unidades, indicadores o sistema de calificación. Revisa la consola para más detalles.', 'error');
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
                                    url: urlApi+'/insertarUnidadesIndicadores/' + response.id_asignatura,
                                    method: 'POST',
                                    contentType: 'application/json',
                                    dataType: 'json',
                                    data: JSON.stringify(data1)
                                });
                                // 4. Insertar sistema de calificación
                                await $.ajax({
                                    url: urlApi+'/insertarSistemaCalificacion/' + response.id_asignatura,
                                    method: 'POST',
                                    contentType: 'application/json',
                                    dataType: 'json',
                                    data: JSON.stringify(data2)
                                });
                                await loadingSwal.close();
                                Swal.fire({
                                    icon: 'success',
                                    title: '¡Listo!',
                                    text: 'El syllabus ha sido procesado y añadido correctamente. ¡Gracias por tu aporte a la comunidad!',
                                    color: getThemeColor(),
                                    background: getThemeBackground()
                                });
                                generarHTML();
                            } catch (err) {
                                console.error('Error en el flujo de Magic Loops o inserciones:', err);
                                Swal.fire({
                                    icon: 'error',
                                    title: 'Error',
                                    text: 'Ocurrió un error en el procesamiento. Revisa la consola para más detalles.',
                                    color: getThemeColor(),
                                    background: getThemeBackground()
                                });
                                loadingSwal.close();
                            }
                        }
                    },
                    error: function (err) {
                        console.error('Error al obtener datos estáticos:', err);
                        Swal.fire('Error', 'No se pudieron obtener los datos estáticos. Revisa la consola para más detalles.', 'error');
                        loadingSwal.close();
                    }
                });


            } catch (error) {
                console.error('Error al procesar PDF:', error);
                await loadingSwal.close();
                Swal.fire('Error', 'Ocurrió un error al procesar el PDF.', 'error');
            }
        };

        lector.readAsArrayBuffer(archivo);
    } catch (error) {
        console.error('Error inicial:', error);
        await loadingSwal.close();
        Swal.fire('Error', 'Ocurrió un error al cargar el PDF.', 'error');
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
            await Swal.fire('Error', 'Error al comunicarse con la API.', response.status);
        }

        return await response.json();
    } catch (error) {
        Swal.fire('Error', 'Ocurrió un error al enviar el texto a la API.', 'error');
        throw error;
    }
};

const generarHTML = () => {
    if (!data1 || !data1.unidades || data1.unidades.length === 0 || !data2) {
        $("#body-content").html(`
            <div class="alert alert-warning">No hay datos suficientes para generar la vista.</div>
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
                                        text: 'No se pudo copiar la imagen. Prueba en un navegador compatible.',
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
                                        text: 'No se completó el proceso de compartir.',
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

    // Botón para calcular notas mínimas necesarias
    if ($("#btn-minimas-necesarias").length === 0) {
        $("#body-content").prepend('<button id="btn-minimas-necesarias" class="btn btn-warning mb-3"><i class="bi bi-calculator"></i> ¿Qué nota necesito para aprobar?</button>');
    }
    $("#btn-minimas-necesarias").off("click").on("click", function () {
        calcularNotasMinimasNecesarias();
    });

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
        let num = val === '' ? '' : parseFloat(val);
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
    console.log(`Nota ingresada en unidad ${unidadIndex + 1}:`, valor);

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
        const pesoIndicador = parseFloat(pesoUnidad) / 100;

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
                console.log(`Unidad ${unidadIndex + 1} - Indicador ${indicador.codigo} - Evidencia:`, valor);
            }
        });

        const promedioIndicador = cantidadNotas > 0 ? (sumaNotas / cantidadNotas) : 0;
        // Log para ver el promedio de cada indicador
        console.log(`Unidad ${unidadIndex + 1} - Indicador ${indicador.codigo} - Promedio indicador:`, promedioIndicador, 'Peso:', pesoIndicador);

        promedioUnidad += promedioIndicador * pesoIndicador;
    });

    // Actualizar el promedio en el HTML
    const promedioElemento = $(`#promedioUnidad${unidadIndex + 1}`);
    promedioElemento.text(promedioUnidad.toFixed(2));

    // Log para ver el promedio de la unidad
    console.log(`Promedio calculado para unidad ${unidadIndex + 1}:`, promedioUnidad);

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
        console.log(`RA: ${raNombre} (Unidad ${ra.unit}) - Promedio unidad: ${unidadPromedio}, Peso: ${raPeso}, Parcial: ${unidadPromedio * raPeso}`);
    });

    const promedioFinal = totalPromedioFinal.toFixed(4); // Promedio final calculado
    // Log para ver el promedio final
    console.log('Promedio final calculado:', promedioFinal);
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

// Función para obtener las notas de cada unidad y mostrarlas en consola como array
function debugNotasPorUnidad() {
    if (!data1 || !data1.unidades) {
        console.log('No hay datos de unidades disponibles.');
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
    console.log('Notas por unidad:', notasPorUnidad);
    return notasPorUnidad;
}

// Calcula y muestra las notas mínimas necesarias para aprobar considerando el promedio final ponderado
function calcularNotasMinimasNecesarias() {
    const NOTA_APROBATORIA = 13.5;
    let detalles = [];
    let puedeAprobar = true;
    let unidadesPendientes = [];
    // 1. Recolectar info de inputs y pesos
    data1.unidades.forEach((unidad, unidadIndex) => {
        let sumaPesos = 0;
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
    // 2. Calcular las notas mínimas necesarias para aprobar el promedio final ponderado
    // a) Obtener pesos de cada unidad (RA)
    let pesosUnidades = {};
    data2.learning_results.forEach(result => {
        const unidadNum = result.unit; // I, II, III...
        pesosUnidades[unidadNum] = result.weight;
    });
    // b) Calcular el promedio final actual y cuántos campos faltan en total
    let promedioFinalActual = 0;
    let totalFaltantes = 0;
    let faltantesGlobal = [];
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
    // c) Calcular la nota mínima global que debe ir en cada campo pendiente para llegar a 13.5 en el promedio final
    let notaMinimaGlobal = null;
    if (totalFaltantes > 0) {
        // Sea x la nota a poner en cada campo pendiente
        // promedioFinal = promedioFinalActual + sum(pesoUnidad * promedioUnidadPendiente)
        // promedioUnidadPendiente = (sumaNotas + x * faltantes) / totalInputs
        // promedioFinal = ... >= 13.5
        // Resolvemos para x:
        // promedioFinal = promedioFinalActual + sum( pesoUnidad * (sumaNotas + x * faltantes) / totalInputs )
        // promedioFinal >= 13.5
        // x = (13.5 - promedioFinalActual - sum( pesoUnidad * sumaNotas / totalInputs )) / sum( pesoUnidad * faltantes / totalInputs )
        let sumPesosNotas = 0;
        let sumPesosFaltantes = 0;
        faltantesGlobal.forEach(fg => {
            sumPesosNotas += fg.pesoUnidad * (fg.sumaNotas / fg.totalInputs);
            sumPesosFaltantes += fg.pesoUnidad * (fg.faltanInputs.length / fg.totalInputs);
        });
        notaMinimaGlobal = (NOTA_APROBATORIA - promedioFinalActual - sumPesosNotas) / (sumPesosFaltantes || 1);
        notaMinimaGlobal = Math.max(0, Math.min(20, notaMinimaGlobal));
        if (notaMinimaGlobal > 20) puedeAprobar = false;
    }
    // 3. Mostrar detalle por campo
    let mensaje = '';
    if (totalFaltantes === 0) {
        mensaje = '<div class="alert alert-success text-center mb-0"><b>¡Ya tienes todas las notas ingresadas!</b></div>';
    } else {
        mensaje = '<div class="mb-2"><b>Notas mínimas necesarias para aprobar cada campo (considerando el promedio final 13.5):</b></div>';
        unidadesPendientes.forEach((u, idx) => {
            mensaje += `<div class='mb-2'><b>${u.unidad.unidad}</b><ul class='list-group mt-1'>`;
            u.detallesInputs.forEach(d => {
                mensaje += `<li class='list-group-item d-flex justify-content-between align-items-center ${d.pendiente ? 'list-group-item-warning' : 'list-group-item-success'}'>
                    <span><b>${d.indicador}</b> - ${d.evidencia}</span>
                    <span>${d.pendiente ? `<span class='badge bg-warning text-dark'>Necesitas ${notaMinimaGlobal !== null ? notaMinimaGlobal.toFixed(2) : '--'}</span>` : `<span class='badge bg-success'>${d.valor.toFixed(2)}</span>`}</span>
                </li>`;
            });
            mensaje += '</ul></div>';
        });
        if (!puedeAprobar) {
            mensaje += '<div class="alert alert-danger text-center">Con las notas actuales, <b>no es posible aprobar</b> aunque saques 20 en los campos pendientes.</div>';
        } else {
            mensaje += '<div class="alert alert-info text-center mb-0">El cálculo es estimado y supone que el resto de notas se mantienen igual. El promedio final debe ser al menos 13.5.</div>';
        }
        // Botón para llenar automáticamente los campos pendientes
        mensaje += `<div class='d-flex justify-content-center mt-3'><button id='btn-autollenar-minimas' class='btn btn-outline-primary'><i class='bi bi-magic'></i> Llenar campos con notas mínimas</button></div>`;
    }
    Swal.fire({
        icon: 'info',
        title: '<i class="bi bi-clipboard2-check"></i> Notas mínimas necesarias',
        html: mensaje,
        confirmButtonText: 'Cerrar',
        background: getThemeBackground(),
        color: getThemeColor(),
        customClass: {
            title: 'swal2-title-custom',
            popup: 'swal2-popup-custom',
            htmlContainer: 'swal2-html-custom'
        },
        didOpen: () => {
            // Llenar automáticamente los campos pendientes
            $("#btn-autollenar-minimas").on("click", function () {
                if (notaMinimaGlobal !== null && puedeAprobar) {
                    unidadesPendientes.forEach(u => {
                        u.detallesInputs.forEach(d => {
                            if (d.pendiente && d.input) {
                                $(d.input).val(notaMinimaGlobal.toFixed(2)).trigger('input');
                            }
                        });
                    });
                }
                Swal.close();
            });
        }
    });
}

// Asignar evento al botón de generar calculadora
$(document).on('click', '#btn-generar-calc', function (e) {
    e.preventDefault();
    analizarPDF();
});
