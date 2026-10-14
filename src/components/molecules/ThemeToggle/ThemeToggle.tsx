import { FunctionComponent, MouseEvent, useId } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { setThemePref, useThemePref, type ThemePref } from '../../../lib/theme';
import styles from './ThemeToggle.module.css';

const OPTIONS: { value: ThemePref; label: string; Icon: typeof Sun }[] = [
  { value: 'system', label: 'Automático (como tu sistema)', Icon: Monitor },
  { value: 'light', label: 'Modo claro', Icon: Sun },
  { value: 'dark', label: 'Modo oscuro', Icon: Moon },
];

// Selector de tema: tres opciones con una píldora que se desliza a la elegida.
const ThemeToggle: FunctionComponent<{ className?: string }> = ({ className }) => {
  const id = useId();
  const pref = useThemePref();
  const reduce = useReducedMotion();

  const choose = (value: ThemePref, event: MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setThemePref(value, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
  };

  return (
    <div className={`${styles.toggle} ${className ?? ''}`} role="radiogroup" aria-label="Tema">
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = pref === value;
        return (
          <button key={value} type="button" role="radio" aria-checked={active} aria-label={label} title={label} className={active ? styles.optionOn : styles.option} onClick={(event) => choose(value, event)}>
            {active ? <motion.span layoutId={`theme-${id}`} className={styles.thumb} transition={reduce ? { duration: 0 } : { type: 'spring', bounce: 0, duration: 0.32 }} aria-hidden="true" /> : null}
            <Icon size={15} aria-hidden="true" className={styles.icon} />
          </button>
        );
      })}
    </div>
  );
};

export default ThemeToggle;
