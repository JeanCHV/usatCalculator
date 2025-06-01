var nombreCurso = null;
var Semestre = null;
var data1 = null;
var data2 = null;

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
        }
    });

    try {
        const lector = new FileReader();
        
        lector.onload = async function() {
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

                // Actualizar mensaje de loading
                Swal.update({
                    title: 'Enviando datos a API',
                    allowOutsideClick: false,
                    html: 'Procesando información con inteligencia artificial...'
                });

                // Realizar ambas peticiones en paralelo
                const [response1, response2] = await Promise.all([
                    enviarTexto(textoExtraidoUnidades, 'https://magicloops.dev/api/loop/20f6c53c-4298-46d7-b2da-e28a842da6ea/run'),
                    enviarTexto(textoExtraidoCalificacion, 'https://magicloops.dev/api/loop/f8974f3c-4bd6-4087-a2d6-6a7ea7979177/run')
                ]);

                data1 = response1;
                data2 = response2;

                await loadingSwal.close();
                Swal.fire('Éxito', 'El syllabus ha sido procesado correctamente.', 'success');
                
                generarHTML();
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
                                type="number" class="nota" data-unit="${unidadNum}" data-indicador="${ind.codigo}" data-peso="${ev.peso_evidencia == 'Prom.Simple' ? 100 :ev.peso_evidencia}" 
                                value="0.00" min="0" max="20">
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
        <div class="header">
            <span>Semestre: <span id="Semestre">${Semestre || 'No especificado'}</span></span>
            <span id="curso">${nombreCurso || 'Curso no especificado'}</span>
        </div>
        ${unidadesHTML}
        <div class="final-average" style="background-color: #900; color: white; padding: 10px; text-align: center; font-size: 1.2em; border-radius: 5px;">
            Avance del Promedio Final: <span id="promedio-final">0.00</span>
        </div>
    `);

    // Asignar eventos con jQuery a los inputs de nota
    $(".nota").on("input", function() {
        // Buscar el índice de la unidad correspondiente
        const unidadNum = $(this).data("unit");
        const unidadIndex = convertFromRoman(unidadNum) - 1;
        cambiarColorNota(this, unidadIndex);
    });
};

// Función para cambiar el color del input y calcular el promedio
function cambiarColorNota(input, unidadIndex) {
    const valor = parseFloat(input.value);
    const spanPadre = input.parentElement; // Obtener el span más cercano al input
    const pesoRelativo = parseFloat(input.getAttribute('data-peso'));
    
    if (valor >= 0 && valor <= 13.4) {
        input.style.backgroundColor = "red";  // Rojo para valores de 0 a 13.4
        spanPadre.style.backgroundColor = "red";  // Cambiar el color de fondo del span
    } else if (valor >= 13.5 && valor <= 20) {
        input.style.backgroundColor = "blue";  // Azul para valores de 13.5 a 20
        spanPadre.style.backgroundColor = "blue";  // Cambiar el color de fondo del span
    } else {
        input.style.backgroundColor = "white";  // Fondo blanco si está fuera de rango
        spanPadre.style.backgroundColor = "white";  // Cambiar el color de fondo del span
    }

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
        var  pesoUnidad = indicador.peso== 'Prom.Simple' ? 100 : parseFloat(indicador.peso);
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
            }
        });

        const promedioIndicador = cantidadNotas > 0 ? (sumaNotas / cantidadNotas) : 0;

        promedioUnidad += promedioIndicador * pesoIndicador;
    });

    // Actualizar el promedio en el HTML
    const promedioElemento = $(`#promedioUnidad${unidadIndex + 1}`);
    promedioElemento.text(promedioUnidad.toFixed(2));

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
        const raNombre = ra.name; // RA1, RA2, RA3
        const raPeso = ra.weight;
        const unidadIndex = ra.unit === "I" ? 0 : ra.unit === "II" ? 1 : 2;

        const unidadPromedio = parseFloat($(`#promedioUnidad${unidadIndex + 1}`).text());

        // Calculamos el promedio ponderado de cada RA
        totalPromedioFinal += (unidadPromedio * raPeso);
    });

    const promedioFinal = totalPromedioFinal.toFixed(2); // Promedio final calculado
    $("#promedio-final").text(promedioFinal);
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
