import { FunctionComponent, useEffect, useMemo, useState } from 'react';
import { Icon } from '../../atoms';
import { ExerciseCard } from '../../molecules';
import { LOCAL_EXERCISES } from '../../../lib/exercises/local';
import { ruleFor } from '../../../lib/exercises/match';
import { CATEGORY, loadCatalog, searchExercises, type Exercise } from '../../../lib/wger';
import styles from './ExerciseCatalog.module.css';

export type ExerciseCatalogProps = {
  onStart: (exercise: Exercise) => void;
};

const CHIPS: { label: string; category: number | null }[] = [
  { label: 'Todos', category: null },
  { label: 'Piernas', category: 9 },
  { label: 'Pecho', category: 11 },
  { label: 'Espalda', category: 12 },
  { label: 'Abdomen', category: 10 },
  { label: 'Hombros', category: 13 },
  { label: 'Brazos', category: 8 },
  { label: 'Cardio', category: 15 },
];

const LIMIT = 60;

const ExerciseCatalog: FunctionComponent<ExerciseCatalogProps> = ({ onStart }) => {
  const [catalog, setCatalog] = useState<Exercise[]>(LOCAL_EXERCISES);
  const [status, setStatus] = useState<'loading' | 'ready' | 'offline'>('loading');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<number | null>(null);
  const [onlyPose, setOnlyPose] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    loadCatalog()
      .then((list) => {
        if (!alive) return;
        setCatalog([...LOCAL_EXERCISES, ...list]);
        setStatus('ready');
      })
      .catch(() => {
        if (alive) setStatus('offline');
      });
    return () => {
      alive = false;
    };
  }, []);

  const results = useMemo(() => searchExercises(catalog, query, category).filter((exercise) => !onlyPose || ruleFor(exercise.name)), [catalog, query, category, onlyPose]);
  const shown = results.slice(0, LIMIT);
  const selected = catalog.find((exercise) => exercise.id === selectedId) ?? null;
  const selectedRule = selected ? ruleFor(selected.name) : null;

  return (
    <section className={styles.catalog} aria-labelledby="catalogo-titulo">
      <header className={styles.head}>
        <p className={styles.kicker}>RITMO-VIDA × SPOT</p>
        <h1 id="catalogo-titulo" className={styles.title}>
          ENTRENÁ
          <br />
          CON CÁMARA.
        </h1>
        <p className={styles.lead}>Elegí un ejercicio, activá la cámara y te corregimos la postura en vivo. El video se analiza en tu compu: no se sube a ningún lado.</p>
      </header>

      <div className={styles.controls}>
        <label className={styles.search}>
          <Icon name="search" size={18} />
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Músculo o ejercicio: sentadilla, espalda…" aria-label="Buscar ejercicios" />
        </label>
        <div className={styles.chips} role="group" aria-label="Filtrar por músculo">
          {CHIPS.map((chip) => (
            <button key={chip.label} type="button" className={`${styles.chip} ${chip.category === category ? styles.chipOn : ''}`} aria-pressed={chip.category === category} onClick={() => setCategory(chip.category)}>
              {chip.label}
            </button>
          ))}
        </div>
        <label className={styles.toggle}>
          <input type="checkbox" checked={onlyPose} onChange={(event) => setOnlyPose(event.target.checked)} />
          Solo con análisis de postura
        </label>
      </div>

      {status === 'loading' ? (
        <p className={styles.note} role="status">
          Cargando ejercicios de wger…
        </p>
      ) : null}
      {status === 'offline' ? (
        <p className={styles.note} role="status">
          Sin conexión con wger: mostramos los ejercicios de Ritmo-Vida.
        </p>
      ) : null}

      <div className={`${styles.layout} ${selected ? styles.withDetail : ''}`}>
        {shown.length === 0 ? (
          <p className={styles.empty}>Sin resultados. Probá con otro músculo{onlyPose ? ' o desactivá «Solo con análisis de postura»' : ''}.</p>
        ) : (
          <div className={styles.grid}>
            {shown.map((exercise) => (
              <ExerciseCard key={exercise.id} exercise={exercise} hasPose={!!ruleFor(exercise.name)} selected={exercise.id === selectedId} onSelect={() => setSelectedId(exercise.id === selectedId ? null : exercise.id)} />
            ))}
          </div>
        )}

        {selected ? (
          <aside className={styles.detail} aria-label={`Detalle: ${selected.name}`}>
            <button type="button" className={styles.close} onClick={() => setSelectedId(null)} aria-label="Cerrar detalle">
              <Icon name="x" size={18} />
            </button>
            {selected.image ? <img className={styles.detailImage} src={selected.image} alt="" /> : null}
            <h2 className={styles.detailTitle}>{selected.name}</h2>
            <p className={styles.meta}>{[CATEGORY[selected.category], ...selected.muscles, ...selected.equipment].filter(Boolean).join(' · ')}</p>
            {selected.lines.length > 0 ? (
              <ol className={styles.steps}>
                {selected.lines.map((line, index) => (
                  <li key={index}>{line}</li>
                ))}
              </ol>
            ) : (
              <p className={styles.meta}>Sin descripción en español.</p>
            )}
            {selected.tip ? (
              <p className={styles.tip}>
                <strong>Tip:</strong> {selected.tip}
              </p>
            ) : null}
            {selected.easier ? (
              <p className={styles.tip}>
                <strong>Más fácil:</strong> {selected.easier}
              </p>
            ) : null}
            <p className={styles.poseNote}>
              {selectedRule
                ? `Análisis de postura: ${selectedRule.mode === 'hold' ? 'cronómetro' : 'contador de repeticiones'} con corrección en vivo.`
                : 'Este ejercicio todavía no tiene análisis de postura: vas a ver tu esqueleto, sin corrección.'}
            </p>
            <button type="button" className={styles.start} onClick={() => onStart(selected)}>
              <Icon name="camera" /> Empezar con cámara
            </button>
          </aside>
        ) : null}
      </div>

      {results.length > LIMIT ? (
        <p className={styles.note}>
          Mostrando {LIMIT} de {results.length}. Buscá para encontrar más.
        </p>
      ) : null}
      <p className={styles.credit}>Ejercicios de wger.de (licencia Creative Commons; imágenes y textos de sus autores) y rutinas de Ritmo-Vida.</p>
    </section>
  );
};

export default ExerciseCatalog;
