import { CSSProperties, FunctionComponent, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { CATEGORIES, searchProducts, type CatalogStatus, type Category, type SearchQuery } from '../../../lib/precios';
import { VIEW, buildLayout, pathTo, selectedNode, type Branch, type NeuralLayout, type NeuralNode } from './neuralLayout';
import styles from './NeuralCategories.module.css';

export type NeuralCategoriesProps = {
  status: CatalogStatus | null;
  /** Filtros actuales: marcan qué neurona está encendida. */
  query: SearchQuery;
  onSelect: (patch: Partial<SearchQuery>) => void;
};

// Tipos genéricos que no aportan como rama.
const HIDDEN_TYPES = new Set(['Otras prendas', 'Otros accesorios']);
const SOMA: Record<NeuralNode['level'], number> = { 0: 16, 1: 10, 2: 6.5, 3: 4.5 };
const STROKE: Record<number, number> = { 1: 3, 2: 1.9, 3: 1.2 };

/** Dónde va la etiqueta de cada neurona: siempre hacia afuera del núcleo. */
function labelPlacement(node: NeuralNode): CSSProperties {
  const left = `${(node.x / VIEW.width) * 100}%`;
  const top = `${(node.y / VIEW.height) * 100}%`;
  const gap = SOMA[node.level] + 8;
  if (node.level === 0) return { left, top, transform: `translate(-50%, ${gap + 6}px)` };
  const cos = Math.cos((node.angle * Math.PI) / 180);
  const sin = Math.sin((node.angle * Math.PI) / 180);
  if (cos > 0.35) return { left, top, transform: `translate(${gap}px, -50%)` };
  if (cos < -0.35) return { left, top, transform: `translate(calc(-100% - ${gap}px), -50%)` };
  return { left, top, transform: sin > 0 ? `translate(-50%, ${gap}px)` : `translate(-50%, calc(-100% - ${gap}px))` };
}

const describe = (node: NeuralNode) => `${node.label}${node.count !== undefined ? ` · ${node.count.toLocaleString('es-AR')} productos` : ''}`;

/**
 * Capa fija: fibras, dendritas y neuronas. Se dibuja una vez por mapa y no vuelve a
 * renderizarse al pasar el mouse (eso es lo que hacía lento al mapa anterior).
 */
const StaticNetwork = memo(function StaticNetwork({ layout }: { layout: NeuralLayout }) {
  return (
    <g>
      <circle cx={layout.nodes[0].x} cy={layout.nodes[0].y} r="260" fill="url(#core-glow)" />
      {layout.dust.map((dot, index) => (
        <circle key={index} className={styles.dust} cx={dot.x} cy={dot.y} r={dot.r} />
      ))}
      {layout.dendrites.map((dendrite, index) => (
        <path key={index} d={dendrite.d} pathLength={1} className={styles.dendrite} style={{ '--level': dendrite.level } as CSSProperties} />
      ))}
      {layout.edges.map((edge) => (
        <g key={edge.id} style={{ '--level': edge.level } as CSSProperties}>
          {edge.strands.map((strand, index) => (
            <path key={index} d={strand} pathLength={1} className={styles.strand} />
          ))}
          <path id={edge.id} d={edge.d} pathLength={1} className={styles.axon} strokeWidth={STROKE[edge.level]} />
        </g>
      ))}
      {layout.nodes.map((node) => (
        <circle key={node.id} cx={node.x} cy={node.y} r={SOMA[node.level]} fill="url(#soma)" className={styles.soma} />
      ))}
    </g>
  );
});

/** Capa de luz: sólo el camino encendido (selección o puntero). Pocos elementos, se actualiza barato. */
function LitNetwork({ layout, lit, selected, idle }: { layout: NeuralLayout; lit: Set<string>; selected: string; idle: boolean }) {
  const edges = layout.edges.filter((edge) => lit.has(edge.to) || (idle && edge.level === 1));
  return (
    <g className={styles.lit}>
      {edges.map((edge) => {
        const on = lit.has(edge.to);
        return (
          <g key={edge.id} className={on ? styles.edgeOn : styles.edgeIdle} style={{ '--level': edge.level, '--speed': `${on ? 1.2 + edge.level * 0.15 : edge.duration}s`, '--delay': `${edge.delay}s` } as CSSProperties}>
            {on ? <path d={edge.d} pathLength={1} className={styles.glowLine} strokeWidth={STROKE[edge.level] + 5} /> : null}
            {on ? <path d={edge.d} pathLength={1} className={styles.axonOn} strokeWidth={STROKE[edge.level]} /> : null}
            {/* La señal: un tramo brillante que recorre el axón del núcleo hacia afuera. */}
            <path d={edge.d} pathLength={1} className={styles.signal} strokeWidth={on ? STROKE[edge.level] + 0.6 : 1.6} />
          </g>
        );
      })}
      {layout.nodes
        .filter((node) => lit.has(node.id))
        .map((node) => (
          <g key={node.id}>
            <circle cx={node.x} cy={node.y} r={SOMA[node.level] * 3} fill="url(#halo)" className={styles.halo} />
            <circle cx={node.x} cy={node.y} r={SOMA[node.level] * 1.25} fill="url(#soma-lit)" />
            {node.id === selected ? <circle cx={node.x} cy={node.y} r={SOMA[node.level] + 6} className={styles.ring} /> : null}
          </g>
        ))}
    </g>
  );
}

type LabelProps = { node: NeuralNode; on: boolean; pressed: boolean; onHover: (id: string | null) => void; onChoose: (node: NeuralNode) => void };

/** Etiqueta (el botón accesible de cada neurona). Memo: al mover el mouse sólo cambian las que se encienden o apagan. */
const NeuronLabel = memo(function NeuronLabel({ node, on, pressed, onHover, onChoose }: LabelProps) {
  return (
    <button
      type="button"
      className={styles.label}
      data-level={node.level}
      data-on={on ? 'true' : undefined}
      aria-pressed={pressed}
      aria-label={describe(node)}
      style={labelPlacement(node)}
      onPointerEnter={() => onHover(node.id)}
      onFocus={() => onHover(node.id)}
      onBlur={() => onHover(null)}
      onClick={() => onChoose(node)}
    >
      <span>{node.label}</span>
      {node.count !== undefined ? <small>{node.count.toLocaleString('es-AR')}</small> : null}
    </button>
  );
});

// Categorías como una red neuronal: núcleo → ramas → terminaciones. Tocar una neurona filtra.
const NeuralCategories: FunctionComponent<NeuralCategoriesProps> = ({ status, query, onSelect }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const [types, setTypes] = useState<Record<Category, { value: string; count: number }[]> | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [visible, setVisible] = useState(true);

  // Los tipos de cada rama salen de la API (con su cantidad de productos).
  useEffect(() => {
    let alive = true;
    const categories = Object.keys(CATEGORIES) as Category[];
    Promise.all(categories.map((category) => searchProducts({ category, limit: 1 }).then((result) => result.types, () => []))).then((lists) => {
      if (alive) setTypes(Object.fromEntries(categories.map((category, index) => [category, lists[index].filter((type) => !HIDDEN_TYPES.has(type.value))])) as Record<Category, { value: string; count: number }[]>);
    });
    return () => {
      alive = false;
    };
  }, [status?.total]);

  // Fuera de pantalla, las animaciones se pausan: no gastan batería ni procesador.
  useEffect(() => {
    const element = mapRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: '80px' });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const total = status?.total;
  const counts = status ? JSON.stringify(status.byCategory) : '';
  const layout = useMemo(() => {
    const branches: Branch[] = (Object.keys(CATEGORIES) as Category[]).map((category) => ({ category, label: CATEGORIES[category], count: status?.byCategory[category], types: types?.[category] ?? [] }));
    return buildLayout(branches, total);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [types, total, counts]);

  const byId = useMemo(() => new Map(layout.nodes.map((node) => [node.id, node])), [layout]);
  // Respuesta inmediata: la neurona tocada se enciende ya, sin esperar a que la página traiga los productos.
  const [pending, setPending] = useState<string | null>(null);
  const fromQuery = selectedNode(layout.nodes, query);
  useEffect(() => setPending(null), [fromQuery]);
  const selected = pending ?? fromQuery;
  const choose = useCallback(
    (node: NeuralNode) => {
      setPending(node.id);
      onSelect(node.patch);
    },
    [onSelect],
  );
  const selectedPath = useMemo(() => pathTo(layout.nodes, selected), [layout, selected]);
  const hoverPath = useMemo(() => pathTo(layout.nodes, hovered), [layout, hovered]);
  const lit = useMemo(() => new Set([...selectedPath, ...hoverPath]), [selectedPath, hoverPath]);
  const crumbs = [...selectedPath].reverse().map((id) => byId.get(id)!).filter(Boolean);
  const focus = hovered ? byId.get(hovered) : null;

  // En el teléfono el mapa es más ancho que la pantalla: arranca centrado y se recorre con el dedo.
  useEffect(() => {
    const element = scrollRef.current;
    if (element && element.scrollWidth > element.clientWidth) element.scrollLeft = (element.scrollWidth - element.clientWidth) / 2;
  }, [types]);

  const hover = useCallback((id: string | null) => setHovered((current) => (current === id ? current : id)), []);

  return (
    <section className={styles.wrap} aria-labelledby="red-titulo">
      <div className={styles.head}>
        <h2 id="red-titulo" className={styles.title}>
          Explorá por ramas
        </h2>
        <nav className={styles.crumbs} aria-label="Rama elegida">
          {crumbs.map((node, index) => (
            <span key={node.id} className={styles.crumb}>
              {index > 0 ? <ChevronRight size={14} aria-hidden="true" className={styles.crumbArrow} /> : null}
              <button type="button" className={index === crumbs.length - 1 ? styles.crumbOn : styles.crumbLink} onClick={() => choose(node)} aria-current={index === crumbs.length - 1 ? 'true' : undefined}>
                {node.label}
              </button>
            </span>
          ))}
        </nav>
      </div>

      <div ref={scrollRef} className={styles.scroller}>
        <div ref={mapRef} className={styles.map} data-hovering={hovered ? 'true' : undefined} data-ready={types ? 'true' : undefined} data-paused={visible ? undefined : 'true'} onPointerLeave={() => hover(null)}>
          {/* Dos lienzos: el fijo vive en su propia capa (atenuarlo no lo redibuja) y el de luz es chico. */}
          <svg viewBox={`0 0 ${VIEW.width} ${VIEW.height}`} className={`${styles.svg} ${styles.staticLayer}`} aria-hidden="true">
            <defs>
              <radialGradient id="soma" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#fff6ec" />
                <stop offset="35%" stopColor="#ffb066" />
                <stop offset="70%" stopColor="#ff7900" />
                <stop offset="100%" stopColor="#ff7900" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="core-glow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#ff7900" stopOpacity="0.26" />
                <stop offset="60%" stopColor="#ff7900" stopOpacity="0.05" />
                <stop offset="100%" stopColor="#ff7900" stopOpacity="0" />
              </radialGradient>
            </defs>
            <StaticNetwork layout={layout} />
          </svg>
          <svg viewBox={`0 0 ${VIEW.width} ${VIEW.height}`} className={styles.svg} aria-hidden="true">
            <defs>
              <radialGradient id="soma-lit" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#fff6ec" />
                <stop offset="35%" stopColor="#ffb066" />
                <stop offset="70%" stopColor="#ff7900" />
                <stop offset="100%" stopColor="#ff7900" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="halo" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#ff7900" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#ff7900" stopOpacity="0" />
              </radialGradient>
            </defs>
            <LitNetwork layout={layout} lit={lit} selected={selected} idle={!hovered} />
            {/* Zonas de toque generosas alrededor de cada neurona (la etiqueta es el botón accesible). */}
            {layout.nodes.map((node) => (
              <circle key={node.id} cx={node.x} cy={node.y} r={node.level === 0 ? 30 : 22} className={styles.hit} onPointerEnter={() => hover(node.id)} onClick={() => choose(node)} />
            ))}
          </svg>

          {layout.nodes.map((node) => (
            <NeuronLabel key={node.id} node={node} on={lit.has(node.id)} pressed={node.id === selected} onHover={hover} onChoose={choose} />
          ))}
        </div>
      </div>

      <p className={styles.status} aria-live="polite">
        {focus && focus.id !== selected ? (
          <>
            <b>{describe(focus)}</b> · tocá para filtrar
          </>
        ) : (
          <>
            Mostrando <b>{crumbs.map((node) => node.label).join(' › ')}</b>. Tocá una neurona para ir a esa rama.
            <span className={styles.swipe}> Deslizá para recorrer la red.</span>
          </>
        )}
      </p>
    </section>
  );
};

export default NeuralCategories;
