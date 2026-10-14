export const COLUMNAS = ['codigo_externo', 'marca', 'categoria', 'modelo', 'nombre', 'talle', 'color',
  'precio', 'moneda', 'url_producto', 'fecha_observacion', 'disponible', 'es_demo'] as const;

import type { FilaCatalogo } from '../../shared/catalogo';
export type { FilaCatalogo } from '../../shared/catalogo';

/** CSV separado por comas: acepta CRLF, BOM, comillas escapadas y campos multilínea. */
export function leerCSV(texto: string): FilaCatalogo[] {
  const matriz: string[][] = [];
  let fila: string[] = [], campo = '', enComillas = false, cerrado = false;
  texto = texto.replace(/^\uFEFF/, '');
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (enComillas) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') { enComillas = false; cerrado = true; }
      else campo += c;
    } else if (c === '"') {
      if (campo || cerrado) throw new Error('Comillas fuera del inicio de un campo CSV.');
      enComillas = true;
    } else if (c === ',' || c === '\n' || c === '\r') {
      fila.push(campo); campo = ''; cerrado = false;
      if (c !== ',') {
        if (fila.some((valor) => valor !== '')) matriz.push(fila);
        fila = [];
        if (c === '\r' && texto[i + 1] === '\n') i++;
      }
    } else {
      if (cerrado) throw new Error('Hay texto después de cerrar un campo entre comillas.');
      campo += c;
    }
  }
  if (enComillas) throw new Error('Campo CSV con comillas sin cerrar.');
  fila.push(campo);
  if (fila.some((valor) => valor !== '')) matriz.push(fila);
  const cabecera = matriz.shift();
  if (!cabecera || cabecera.length !== COLUMNAS.length || COLUMNAS.some((columna, i) => columna !== cabecera[i])) {
    throw new Error(`Cabecera inválida. Usar: ${COLUMNAS.join(',')}`);
  }
  if (!matriz.length || matriz.length > 1000) throw new Error('El CSV debe tener entre 1 y 1000 filas.');
  return matriz.map((valores, i) => {
    if (valores.length !== COLUMNAS.length) throw new Error(`Fila ${i + 2}: cantidad de columnas inválida.`);
    const datos = Object.fromEntries(COLUMNAS.map((columna, j) => [columna, valores[j].trim()]));
    for (const columna of ['disponible', 'es_demo']) {
      if (!['true', 'false'].includes(datos[columna])) throw new Error(`Fila ${i + 2}: ${columna} debe ser true o false.`);
    }
    return { ...datos, disponible: datos.disponible === 'true', es_demo: datos.es_demo === 'true' } as FilaCatalogo;
  });
}
