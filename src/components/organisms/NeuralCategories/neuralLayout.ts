import type { Category, SearchQuery, Sport } from '../../../lib/precios';

// Geometría del mapa de categorías: un núcleo, tres ramas y sus terminaciones,
// con curvas y dendritas "orgánicas" pero siempre iguales (azar con semilla).

export const VIEW = { width: 1200, height: 580 };
const ROOT = { x: 632, y: 285 };

export type NeuralNode = {
  id: string;
  label: string;
  count?: number;
  level: 0 | 1 | 2 | 3;
  x: number;
  y: number;
  /** Ángulo desde el núcleo, para ubicar la etiqueta hacia afuera. */
  angle: number;
  parent: string | null;
  patch: Partial<SearchQuery>;
};

export type NeuralEdge = { id: string; from: string; to: string; level: number; d: string; strands: string[]; duration: number; delay: number };

export type Dendrite = { d: string; level: number };

export type NeuralLayout = { nodes: NeuralNode[]; edges: NeuralEdge[]; dendrites: Dendrite[]; dust: { x: number; y: number; r: number; delay: number }[] };

export type Branch = { category: Category; label: string; count?: number; types: { value: string; count: number }[] };

/** Azar reproducible: el mismo mapa en cada visita y en el servidor y el navegador. */
function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rad = (deg: number) => (deg * Math.PI) / 180;
const at = (angle: number, rx: number, ry: number) => ({ x: ROOT.x + Math.cos(rad(angle)) * rx, y: ROOT.y + Math.sin(rad(angle)) * ry });
const r1 = (value: number) => Math.round(value * 10) / 10;

/** Un axón: curva cúbica con un doblez distinto en cada tramo, como una fibra real. */
function axon(a: { x: number; y: number }, b: { x: number; y: number }, bend: number) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy) || 1;
  const nx = -dy / length;
  const ny = dx / length;
  const c1 = { x: a.x + dx * 0.32 + nx * bend, y: a.y + dy * 0.32 + ny * bend };
  const c2 = { x: a.x + dx * 0.7 - nx * bend * 0.55, y: a.y + dy * 0.7 - ny * bend * 0.55 };
  return `M${r1(a.x)},${r1(a.y)} C${r1(c1.x)},${r1(c1.y)} ${r1(c2.x)},${r1(c2.y)} ${r1(b.x)},${r1(b.y)}`;
}

// Ángulos de cada rama (0° = derecha, 90° = abajo) y cuánto se abren sus terminaciones.
const BRANCH_ANGLE: Record<Category, number> = { calzado: 200, indumentaria: 335, accesorios: 92 };
const SHOE_SPORTS: Sport[] = ['Running', 'Urbana', 'Training', 'Básquet', 'Outdoor'];

export function buildLayout(branches: Branch[], total?: number): NeuralLayout {
  const random = seeded(20261014);
  const nodes: NeuralNode[] = [{ id: 'root', label: 'Todo', count: total, level: 0, x: ROOT.x, y: ROOT.y, angle: 90, parent: null, patch: { category: null, type: null, sport: null } }];

  for (const branch of branches) {
    const base = BRANCH_ANGLE[branch.category];
    const jitter = (amount: number) => (random() - 0.5) * amount;
    const category = at(base + jitter(6), 235 + jitter(20), 125 + jitter(14));
    const categoryId = `c-${branch.category}`;
    nodes.push({ id: categoryId, label: branch.label, count: branch.count, level: 1, ...category, angle: base, parent: 'root', patch: { category: branch.category, type: null, sport: null } });

    const types = branch.types.slice(0, branch.category === 'calzado' ? 2 : 7);
    const spread = Math.min(108, (branch.category === 'accesorios' ? 14 : 19) * Math.max(0, types.length - 1));
    types.forEach((type, index) => {
      const angle = types.length === 1 ? base : base - spread / 2 + (spread * index) / (types.length - 1);
      const radius = branch.category === 'calzado' ? 0.86 : 1;
      const point = at(angle + jitter(5), (432 + jitter(36)) * radius, (218 + jitter(18)) * radius);
      const typeId = `t-${branch.category}-${type.value}`;
      nodes.push({ id: typeId, label: type.value, count: type.count, level: 2, ...point, angle, parent: categoryId, patch: { category: branch.category, type: type.value, sport: null } });

      // Las zapatillas siguen ramificándose por deporte: la parte más "frondosa" del mapa.
      if (branch.category === 'calzado' && type.value === 'Zapatillas') {
        SHOE_SPORTS.forEach((sport, sportIndex) => {
          const sportAngle = angle - 34 + (68 * sportIndex) / (SHOE_SPORTS.length - 1);
          const leaf = at(sportAngle + jitter(4), 515 + jitter(14), 262 + jitter(10));
          nodes.push({ id: `s-${sport}`, label: sport, level: 3, ...leaf, angle: sportAngle, parent: typeId, patch: { category: 'calzado', type: 'Zapatillas', sport } });
        });
      }
    });
  }

  const byId = new Map(nodes.map((node) => [node.id, node]));
  const edges: NeuralEdge[] = [];
  const dendrites: Dendrite[] = [];

  for (const node of nodes) {
    const parent = node.parent ? byId.get(node.parent) : null;
    if (parent) {
      const length = Math.hypot(node.x - parent.x, node.y - parent.y);
      const bend = (random() - 0.5) * length * 0.34;
      edges.push({
        id: `e-${node.id}`,
        from: parent.id,
        to: node.id,
        level: node.level,
        d: axon(parent, node, bend),
        // Fibras finas que acompañan al axón principal: le dan cuerpo de haz nervioso.
        strands: [axon(parent, node, bend * 0.55 + (random() - 0.5) * 18), axon(parent, node, bend * 1.35 + (random() - 0.5) * 22)],
        duration: r1(2.2 + random() * 2.6 + node.level * 0.4),
        delay: r1(random() * -5),
      });
    }

    // Dendritas: ramitas cortas que salen hacia afuera y a veces se bifurcan.
    const away = parent ? Math.atan2(node.y - parent.y, node.x - parent.x) : random() * Math.PI * 2;
    const count = node.level === 0 ? 9 : node.level === 1 ? 6 : node.level === 2 ? 4 : 3;
    for (let index = 0; index < count; index++) {
      const angle = node.level === 0 ? (index / count) * Math.PI * 2 + random() * 0.5 : away + (random() - 0.5) * 2.4;
      const length = (node.level === 0 ? 34 : node.level === 1 ? 26 : 16) * (0.6 + random() * 0.8);
      const end = { x: node.x + Math.cos(angle) * length, y: node.y + Math.sin(angle) * length };
      const curve = { x: node.x + Math.cos(angle + 0.4) * length * 0.5, y: node.y + Math.sin(angle + 0.4) * length * 0.5 };
      dendrites.push({ d: `M${r1(node.x)},${r1(node.y)} Q${r1(curve.x)},${r1(curve.y)} ${r1(end.x)},${r1(end.y)}`, level: node.level });
      if (random() > 0.45) {
        const fork = angle + (random() > 0.5 ? 0.7 : -0.7);
        const mid = { x: node.x + Math.cos(angle) * length * 0.6, y: node.y + Math.sin(angle) * length * 0.6 };
        const tip = { x: mid.x + Math.cos(fork) * length * 0.45, y: mid.y + Math.sin(fork) * length * 0.45 };
        dendrites.push({ d: `M${r1(mid.x)},${r1(mid.y)} L${r1(tip.x)},${r1(tip.y)}`, level: node.level });
      }
    }
  }

  // Polvo de sinapsis: puntitos de fondo que titilan apenas.
  const dust = Array.from({ length: 70 }, () => ({ x: r1(random() * VIEW.width), y: r1(random() * VIEW.height), r: r1(0.4 + random() * 1.3), delay: r1(random() * -6) }));

  return { nodes, edges, dendrites, dust };
}

/** Ids del camino núcleo → nodo (para encenderlo). */
export function pathTo(nodes: NeuralNode[], id: string | null): Set<string> {
  const lit = new Set<string>();
  const byId = new Map(nodes.map((node) => [node.id, node]));
  let current = id ? byId.get(id) : undefined;
  while (current) {
    lit.add(current.id);
    current = current.parent ? byId.get(current.parent) : undefined;
  }
  return lit;
}

/** El nodo que representa los filtros actuales. */
export function selectedNode(nodes: NeuralNode[], query: SearchQuery): string {
  if (query.category === 'calzado' && query.type === 'Zapatillas' && query.sport && nodes.some((node) => node.id === `s-${query.sport}`)) return `s-${query.sport}`;
  if (query.category && query.type && nodes.some((node) => node.id === `t-${query.category}-${query.type}`)) return `t-${query.category}-${query.type}`;
  if (query.category) return `c-${query.category}`;
  return 'root';
}
