import { FunctionComponent, KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Check, ChevronDown } from 'lucide-react';
import styles from './FilterMenu.module.css';

export type FilterOption = { value: string; label: string; count?: number };

export type FilterMenuProps = {
  label: string;
  value: string | null;
  options: FilterOption[];
  onChange: (value: string | null) => void;
  /** Texto de la opción "sin filtro". */
  allLabel?: string;
  /** Muestra un campo para filtrar opciones (útil con muchas marcas). */
  searchable?: boolean;
  align?: 'start' | 'end';
};

const fold = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Menú anclado a su botón: nace desde él (transform-origin) y vuelve a él al cerrarse.
const FilterMenu: FunctionComponent<FilterMenuProps> = ({ label, value, options, onChange, allLabel = 'Todos', searchable = false, align = 'start' }) => {
  const id = useId();
  const reduce = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const [active, setActive] = useState(0);

  const all: FilterOption[] = useMemo(() => [{ value: '', label: allLabel }, ...options], [allLabel, options]);
  const visible = useMemo(() => (filter ? all.filter((option) => option.value && fold(option.label).includes(fold(filter))) : all), [all, filter]);
  const current = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return;
    setFilter('');
    setActive(Math.max(0, all.findIndex((option) => option.value === (value ?? ''))));
    (searchable ? searchRef.current : listRef.current)?.focus({ preventScroll: true });
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const choose = (option: FilterOption | undefined) => {
    if (!option) return;
    onChange(option.value || null);
    setOpen(false);
    buttonRef.current?.focus();
  };

  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      setOpen(false);
      buttonRef.current?.focus();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((index) => Math.min(visible.length - 1, index + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => Math.max(0, index - 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      choose(visible[active]);
    }
  };

  return (
    <div ref={rootRef} className={styles.root}>
      <button
        ref={buttonRef}
        type="button"
        className={current ? styles.triggerOn : styles.trigger}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        onClick={() => setOpen((state) => !state)}
      >
        <span className={styles.triggerLabel}>{label}</span>
        {current ? <b>{current.label}</b> : null}
        <ChevronDown size={15} aria-hidden="true" className={open ? styles.chevronOpen : styles.chevron} />
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            className={align === 'end' ? `${styles.popover} ${styles.end}` : styles.popover}
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: -4 }}
            transition={{ type: 'spring', bounce: 0, duration: 0.28 }}
            onKeyDown={onKey}
          >
            {searchable ? (
              <input
                ref={searchRef}
                className={styles.search}
                value={filter}
                onChange={(event) => {
                  setFilter(event.target.value);
                  setActive(0);
                }}
                placeholder={`Buscar ${label.toLowerCase()}…`}
                aria-label={`Buscar ${label.toLowerCase()}`}
                aria-controls={`${id}-list`}
                aria-activedescendant={visible[active] ? `${id}-${active}` : undefined}
              />
            ) : null}
            <ul ref={listRef} id={`${id}-list`} role="listbox" aria-label={label} tabIndex={-1} className={styles.list} aria-activedescendant={visible[active] ? `${id}-${active}` : undefined}>
              {visible.length === 0 ? <li className={styles.empty}>Sin coincidencias</li> : null}
              {visible.map((option, index) => {
                const selected = (value ?? '') === option.value;
                return (
                  <li
                    key={option.value || 'all'}
                    id={`${id}-${index}`}
                    data-index={index}
                    role="option"
                    aria-selected={selected}
                    className={index === active ? styles.optionActive : styles.option}
                    onPointerMove={() => setActive(index)}
                    onClick={() => choose(option)}
                  >
                    <span>{option.label}</span>
                    {option.count !== undefined ? <small>{option.count.toLocaleString('es-AR')}</small> : null}
                    {selected ? <Check size={15} aria-hidden="true" className={styles.check} /> : null}
                  </li>
                );
              })}
            </ul>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};

export default FilterMenu;
