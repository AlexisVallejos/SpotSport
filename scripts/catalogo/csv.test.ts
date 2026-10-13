import { describe, expect, it } from 'vitest';
import { COLUMNAS, leerCSV } from './csv';

const datos = ['RUTA-01', 'Demo', 'running', 'RUTA-01', 'Zapatilla demo', '42', 'negro', '80000.00',
  'ARS', 'https://demo-a.invalid/productos/ruta-01', '2026-10-11T00:00:00Z', 'true', 'true'];
const csv = (fila = datos) => `${COLUMNAS.join(',')}\r\n${fila.join(',')}\r\n`;

describe('CSV de catálogo', () => {
  it('conserva dinero como texto y convierte solo booleanos', () => {
    expect(leerCSV('\uFEFF' + csv())[0]).toMatchObject({ precio: '80000.00', disponible: true, es_demo: true });
  });
  it('acepta comas, comillas escapadas y saltos dentro de un campo', () => {
    const fila = [...datos]; fila[4] = '"Zapatilla, modelo ""A""\nsegunda línea"';
    expect(leerCSV(csv(fila))[0].nombre).toBe('Zapatilla, modelo "A"\nsegunda línea');
  });
  it('rechaza encabezado cambiado, filas incompletas y booleanos ambiguos', () => {
    expect(() => leerCSV(csv().replace('precio,', 'precio_cents,'))).toThrow(/Cabecera/);
    expect(() => leerCSV(csv(datos.slice(0, -1)))).toThrow(/columnas/);
    expect(() => leerCSV(csv([...datos.slice(0, -1), 'sí']))).toThrow(/true o false/);
  });
  it('rechaza CSV vacío y comillas mal cerradas', () => {
    expect(() => leerCSV(COLUMNAS.join(','))).toThrow(/entre 1 y 1000/);
    const fila = [...datos]; fila[4] = '"abierto';
    expect(() => leerCSV(csv(fila))).toThrow(/sin cerrar/);
    fila[4] = '"cerrado"texto';
    expect(() => leerCSV(csv(fila))).toThrow(/después/);
  });
});
