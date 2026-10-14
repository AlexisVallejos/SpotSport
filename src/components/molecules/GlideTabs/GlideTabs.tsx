import { FunctionComponent, useId } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import styles from './GlideTabs.module.css';

export type GlideTabItem = { value: string | null; label: string; count?: number };

export type GlideTabsProps = {
  items: GlideTabItem[];
  value: string | null;
  onChange: (value: string | null) => void;
  label: string;
  /** "segment": control segmentado (categorías). "pills": fila deslizable (deportes). */
  variant?: 'segment' | 'pills';
};

// La selección es una píldora que se desliza de una opción a otra (resorte sin rebote, como en iOS).
const GlideTabs: FunctionComponent<GlideTabsProps> = ({ items, value, onChange, label, variant = 'segment' }) => {
  const id = useId();
  const reduce = useReducedMotion();
  return (
    <div className={variant === 'segment' ? styles.segment : styles.pills} role="group" aria-label={label}>
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button key={item.label} type="button" className={active ? styles.itemOn : styles.item} aria-pressed={active} onClick={() => onChange(item.value)}>
            {active ? (
              <motion.span layoutId={`glide-${id}`} className={styles.highlight} transition={reduce ? { duration: 0 } : { type: 'spring', bounce: 0, duration: 0.35 }} aria-hidden="true" />
            ) : null}
            <span className={styles.label}>
              {item.label}
              {item.count !== undefined ? <small>{item.count.toLocaleString('es-AR')}</small> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default GlideTabs;
