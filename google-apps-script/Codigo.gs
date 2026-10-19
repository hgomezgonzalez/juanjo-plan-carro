/**
 * Plan Carro Juanjo: sincronización con esta hoja de Google.
 *
 * Guarda las líneas base, los carros añadidos y lo que cada uno está
 * probando, para verlos desde cualquier dispositivo.
 *
 * 1. Cambia CODIGO por un código familiar que solo ustedes sepan.
 * 2. Implementar > Nueva implementación > Aplicación web
 *    (Ejecutar como: Yo · Quién tiene acceso: Cualquier usuario).
 * 3. Copia la URL que termina en /exec.
 */
const CODIGO = "cambia-este-codigo";

const HOJA = "Datos";
const COLUMNAS = ["tipo", "id", "quien", "actualizado", "borrado", "resumen", "datos"];

function hoja_() {
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  let hoja = libro.getSheetByName(HOJA);
  if (!hoja) {
    hoja = libro.insertSheet(HOJA);
    hoja.appendRow(COLUMNAS);
    hoja.setFrozenRows(1);
    hoja.getRange("A:C").setNumberFormat("@"); // texto: que Sheets no convierta los ids
    hoja.getRange("F:G").setNumberFormat("@");
    hoja.setColumnWidth(6, 520);
  }
  return hoja;
}

function respuesta_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// Lee todo. GET ?codigo=...
function doGet(e) {
  if ((e.parameter.codigo || "") !== CODIGO) return respuesta_({ ok: false, error: "codigo" });
  const valores = hoja_().getDataRange().getValues();
  const filas = valores.slice(1).map(function (f) {
    return {
      tipo: String(f[0]), id: String(f[1]), quien: String(f[2]),
      actualizado: Number(f[3]) || 0, borrado: f[4] === true || f[4] === "TRUE",
      datos: f[6] ? String(f[6]) : null
    };
  });
  return respuesta_({ ok: true, filas: filas });
}

// Guarda o actualiza filas. POST {codigo, items:[{tipo, id, quien, actualizado, borrado, resumen, datos}]}
function doPost(e) {
  let cuerpo;
  try { cuerpo = JSON.parse(e.postData.contents); } catch (err) { return respuesta_({ ok: false, error: "json" }); }
  if (!cuerpo || cuerpo.codigo !== CODIGO) return respuesta_({ ok: false, error: "codigo" });
  const candado = LockService.getScriptLock();
  candado.waitLock(15000);
  try {
    const hoja = hoja_();
    const valores = hoja.getDataRange().getValues();
    (cuerpo.items || []).slice(0, 50).forEach(function (it) {
      const fila = [
        String(it.tipo || ""), String(it.id || ""), String(it.quien || ""),
        Number(it.actualizado) || Date.now(), !!it.borrado,
        String(it.resumen || "").slice(0, 500), JSON.stringify(it.datos === undefined ? null : it.datos).slice(0, 45000)
      ];
      if (!fila[0] || !fila[1]) return;
      let indice = -1;
      for (let i = 1; i < valores.length; i++) {
        if (String(valores[i][0]) === fila[0] && String(valores[i][1]) === fila[1]) { indice = i; break; }
      }
      if (indice < 0) {
        hoja.appendRow(fila);
        valores.push(fila);
      } else if (Number(valores[indice][3]) <= fila[3]) {
        hoja.getRange(indice + 1, 1, 1, fila.length).setValues([fila]);
        valores[indice] = fila;
      }
    });
    return respuesta_({ ok: true });
  } finally {
    candado.releaseLock();
  }
}
