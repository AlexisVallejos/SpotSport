import { describe, expect, it } from 'vitest';
import { VIEW, buildLayout, pathTo, selectedNode, type Branch } from './neuralLayout';

const branches: Branch[] = [
  { category: 'calzado', label: 'Calzado', count: 5054, types: [{ value: 'Zapatillas', count: 4459 }, { value: 'Botines', count: 595 }] },
  { category: 'indumentaria', label: 'Indumentaria', count: 6429, types: ['Remera', 'Short', 'Pantalón', 'Campera', 'Buzo', 'Calza', 'Camiseta', 'Top'].map((value, index) => ({ value, count: 100 - index })) },
  { category: 'accesorios', label: 'Accesorios', count: 2760, types: ['Medias', 'Gorra', 'Mochila', 'Bolso', 'Pelota', 'Guantes', 'Anteojos'].map((value, index) => ({ value, count: 50 - index })) },
];

describe('mapa neuronal de categorías', () => {
  const layout = buildLayout(branches, 14243);

  it('arma núcleo, ramas, tipos y deportes de zapatillas dentro del dibujo', () => {
    expect(layout.nodes.filter((node) => node.level === 1)).toHaveLength(3);
    expect(layout.nodes.filter((node) => node.parent === 't-indumentaria-Remera')).toHaveLength(0);
    expect(layout.nodes.filter((node) => node.level === 2 && node.id.startsWith('t-indumentaria'))).toHaveLength(7); // como mucho 7 por rama
    expect(layout.nodes.filter((node) => node.level === 3).map((node) => node.label)).toEqual(['Running', 'Urbana', 'Training', 'Básquet', 'Outdoor']);
    expect(layout.edges).toHaveLength(layout.nodes.length - 1);
    for (const node of layout.nodes) {
      expect(node.x).toBeGreaterThan(20);
      expect(node.x).toBeLessThan(VIEW.width - 20);
      expect(node.y).toBeGreaterThan(20);
      expect(node.y).toBeLessThan(VIEW.height - 20);
    }
  });

  it('es siempre igual (azar con semilla)', () => {
    expect(buildLayout(branches, 14243).edges[4].d).toBe(layout.edges[4].d);
  });

  it('encuentra la neurona de los filtros y su camino al núcleo', () => {
    expect(selectedNode(layout.nodes, {})).toBe('root');
    expect(selectedNode(layout.nodes, { category: 'indumentaria' })).toBe('c-indumentaria');
    expect(selectedNode(layout.nodes, { category: 'accesorios', type: 'Mochila' })).toBe('t-accesorios-Mochila');
    expect(selectedNode(layout.nodes, { category: 'calzado', type: 'Zapatillas', sport: 'Running' })).toBe('s-Running');
    expect([...pathTo(layout.nodes, 's-Running')]).toEqual(['s-Running', 't-calzado-Zapatillas', 'c-calzado', 'root']);
  });
});
