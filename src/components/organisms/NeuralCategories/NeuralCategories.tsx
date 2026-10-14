import { CSSProperties, FunctionComponent, useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { CATEGORIES, searchProducts, type CatalogStatus, type Category, type SearchQuery } from '../../../lib/precios';
import { VIEW, buildLayout, pathTo, selectedNode, type Branch, type NeuralNode } from './neuralLayout';
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

// Categorías como una red neuronal: núcleo → ramas → terminaciones. Tocar una neurona filtra.
const NeuralCategories: FunctionComponent<NeuralCategoriesProps> = ({ status, query, onSelect }) => {
  const reduce = !!useReducedMotion();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [types, setTypes] = useState<Record<Category, { value: string; count: number }[]> | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  // Los tipos de cada rama salen de la API (con su cantidad de productos).
  useEffect(() => {
    let alive = true;
    const categories = Object.keys(CATEGORIES) as Category[];
    Promise.all(categories.map((category) => searchProducts({ category, limit: 1 }).then((result) => result.types, () => [])))
      .then((lists) => {
        if (alive) setTypes(Object.fromEntries(categories.map((category, index) => [category, lists[index].filter((type) => !HIDDEN_TYPES.has(type.value))])) as Record<Category, { value: string; count: number }[]>);
      });
    return () => {
      alive = false;
    };
  }, [status?.total]);

  const layout = useMemo(() => {
    const branches: Branch[] = (Object.keys(CATEGORIES) as Category[]).map((category) => ({ category, label: CATEGORIES[category], count: status?.byCategory[category], types: types?.[category] ?? [] }));
    return buildLayout(branches, status?.total);
  }, [types, status]);

  const selected = selectedNode(layout.nodes, query);
  const lit = useMemo(() => new Set([...pathTo(layout.nodes, selected), ...pathTo(layout.nodes, hovered)]), [layout, selected, hovered]);
  const hoverPath = useMemo(() => pathTo(layout.nodes, hovered), [layout, hovered]);

  // En el teléfono el mapa es más ancho que la pantalla: arranca centrado y se recorre con el dedo.
  useEffect(() => {
    const element = scrollRef.current;
    if (element && element.scrollWidth > element.clientWidth) element.scrollLeft = (element.scrollWidth - element.clientWidth) / 2;
  }, [types]);

  return (
    <section className={styles.wrap} aria-labelledby="red-titulo">
      <div className={styles.head}>
        <h2 id="red-titulo" className={styles.title}>
          Explorá por ramas
        </h2>
        <p className={styles.hint}>
          Tocá una neurona para filtrar. <span className={styles.swipe}>Deslizá para recorrer la red.</span>
        </p>
      </div>
      <div ref={scrollRef} className={styles.scroller}>
        <div className={styles.map} data-hovering={hovered ? 'true' : undefined} data-ready={types ? 'true' : undefined}>
          <svg viewBox={`0 0 ${VIEW.width} ${VIEW.height}`} className={styles.svg} aria-hidden="true">
            <defs>
              <radialGradient id="soma" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#fff6ec" />
                <stop offset="35%" stopColor="#ffb066" />
                <stop offset="70%" stopColor="#ff7900" />
                <stop offset="100%" stopColor="#ff7900" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="halo" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#ff7900" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#ff7900" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="core-glow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#ff7900" stopOpacity="0.28" />
                <stop offset="60%" stopColor="#ff7900" stopOpacity="0.06" />
                <stop offset="100%" stopColor="#ff7900" stopOpacity="0" />
              </radialGradient>
              <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3.2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <circle cx={layout.nodes[0].x} cy={layout.nodes[0].y} r="260" fill="url(#core-glow)" />
            {layout.dust.map((dot, index) => (
              <circle key={index} className={styles.dust} cx={dot.x} cy={dot.y} r={dot.r} style={{ animationDelay: `${dot.delay}s` }} />
            ))}

            <g className={styles.dendrites}>
              {layout.dendrites.map((dendrite, index) => (
                <path key={index} d={dendrite.d} pathLength={1} className={styles.dendrite} style={{ '--level': dendrite.level } as CSSProperties} />
              ))}
            </g>

            {layout.edges.map((edge) => {
              const on = lit.has(edge.to);
              const related = hoverPath.has(edge.to);
              return (
                <g key={edge.id} className={on ? styles.edgeOn : styles.edge} data-related={related ? 'true' : undefined} style={{ '--level': edge.level } as CSSProperties}>
                  {edge.strands.map((strand, index) => (
                    <path key={index} d={strand} pathLength={1} className={styles.strand} />
                  ))}
                  <path id={edge.id} d={edge.d} pathLength={1} className={styles.axon} strokeWidth={edge.level === 1 ? 3 : edge.level === 2 ? 1.9 : 1.2} />
                  {on ? <path d={edge.d} pathLength={1} className={styles.signal} strokeWidth={edge.level === 1 ? 3 : 2} filter="url(#glow)" /> : null}
                  {/* Un impulso viaja del núcleo a la punta, como una señal nerviosa. */}
                  {!reduce ? (
                    <circle r={on ? 3.2 : 2} className={on ? styles.pulseOn : styles.pulse}>
                      <animateMotion dur={`${on ? edge.duration * 0.55 : edge.duration}s`} begin={`${edge.delay}s`} repeatCount="indefinite" keyPoints="0;1" keyTimes="0;1" calcMode="spline" keySplines="0.45 0 0.55 1">
                        <mpath href={`#${edge.id}`} />
                      </animateMotion>
                      <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.15;0.8;1" dur={`${on ? edge.duration * 0.55 : edge.duration}s`} begin={`${edge.delay}s`} repeatCount="indefinite" />
                    </circle>
                  ) : null}
                </g>
              );
            })}

            {layout.nodes.map((node, index) => {
              const on = lit.has(node.id);
              const radius = SOMA[node.level];
              return (
                <g
                  key={node.id}
                  className={on ? styles.neuronOn : styles.neuron}
                  style={{ '--delay': `${(index % 7) * -0.6}s`, '--level': node.level } as CSSProperties}
                  // El punto también se puede tocar; la etiqueta es el botón accesible.
                  onPointerEnter={() => setHovered(node.id)}
                  onPointerLeave={() => setHovered((current) => (current === node.id ? null : current))}
                  onClick={() => onSelect(node.patch)}
                >
                  <circle cx={node.x} cy={node.y} r={radius * 3.2} fill="url(#halo)" className={styles.halo} />
                  <circle cx={node.x} cy={node.y} r={radius} fill="url(#soma)" className={styles.soma} />
                  {node.id === selected ? <circle cx={node.x} cy={node.y} r={radius + 6} className={styles.ring} /> : null}
                </g>
              );
            })}
          </svg>

          {layout.nodes.map((node) => (
            <button
              key={node.id}
              type="button"
              className={styles.label}
              data-level={node.level}
              data-on={lit.has(node.id) ? 'true' : undefined}
              aria-pressed={node.id === selected}
              style={labelPlacement(node)}
              onPointerEnter={() => setHovered(node.id)}
              onPointerLeave={() => setHovered((current) => (current === node.id ? null : current))}
              onFocus={() => setHovered(node.id)}
              onBlur={() => setHovered(null)}
              onClick={() => onSelect(node.patch)}
            >
              <span>{node.label}</span>
              {node.count !== undefined ? <small>{node.count.toLocaleString('es-AR')}</small> : null}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};

export default NeuralCategories;
