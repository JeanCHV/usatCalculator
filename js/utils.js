function parseCSVtoObjects(data) {
  var rows = data.split('\n');
  var headers = rows[0].split(',');
  // Limpiar filas vacías y posibles saltos de línea al final
  rows = rows.filter(function(row) { return row.trim() !== ''; });
  // Procesar correctamente los valores, eliminando comillas y espacios
  var result = [];
  for (var i = 1; i < rows.length; i++) {
    var obj = {};
    var row = rows[i].split(',');
    for (var j = 0; j < headers.length; j++) {
      var value = row[j] ? row[j].replace(/^\"|\"$/g, '').trim() : '';
      obj[headers[j].replace(/^\"|\"$/g, '').trim()] = value;
    }
    result.push(obj);
  }
  return result;
}