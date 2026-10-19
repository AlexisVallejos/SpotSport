import { FunctionComponent, useEffect, useMemo, useState } from 'react';
import { ArrowRight, Camera, Flame, Mic, ShieldCheck, Target } from 'lucide-react';
import { Icon } from '../../atoms';
import { ExerciseCard } from '../../molecules';
// Directo y no desde el barrel: así las figuras quedan fuera del bundle de la landing.
import ExerciseVideo from '../../molecules/ExerciseVideo/ExerciseVideo';
import PoseFigure from '../../molecules/PoseFigure/PoseFigure';
import { TRAINING_PHOTOS } from '../../../data/trainingPhotos';
import { LOCAL_EXERCISES } from '../../../lib/exercises/local';
import { ruleFor } from '../../../lib/exercises/match';
import { activity, readConfig, readHistory, type SessionRecord } from '../../../lib/pose/session';
import { loadCatalog, searchExercises, subtitle, type Exercise } from '../../../lib/wger';
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

const LIMIT = 48;
const DAY_MS = 86_400_000;
/** Sesiones por semana que propone la meta: tres es lo que recomiendan para empezar. */
const WEEK_GOAL = 3;

function when(at: number, now: number): string {
  const today = new Date(now).setHours(0, 0, 0, 0);
  const days = Math.ceil((today - new Date(at).setHours(0, 0, 0, 0)) / DAY_MS);
  return days <= 0 ? 'hoy' : days === 1 ? 'ayer' : `hace ${days} días`;
}

function result(record: SessionRecord): string {
  if (record.reps + record.badReps > 0) return `${record.reps} ${record.reps === 1 ? 'repetición' : 'repeticiones'}`;
  return `${Math.round(record.holdMs / 1000)} s`;
}

/** Anillo de progreso de la meta semanal. */
const GoalRing: FunctionComponent<{ done: number; goal: number }> = ({ done, goal }) => {
  const share = Math.min(1, done / goal);
  const radius = 42;
  const length = 2 * Math.PI * radius;
  return (
    <svg className={styles.ring} viewBox="0 0 100 100" role="img" aria-label={`${done} de ${goal} sesiones esta semana`}>
      <circle className={styles.ringTrack} cx="50" cy="50" r={radius} />
      <circle className={styles.ringFill} cx="50" cy="50" r={radius} strokeDasharray={length} strokeDashoffset={length * (1 - share)} />
      <text x="50" y="50" className={styles.ringValue}>
        {done}/{goal}
      </text>
    </svg>
  );
};

const ExerciseCatalog: FunctionComponent<ExerciseCatalogProps> = ({ onStart }) => {
  const [catalog, setCatalog] = useState<Exercise[]>(LOCAL_EXERCISES);
  const [status, setStatus] = useState<'loading' | 'ready' | 'offline'>('loading');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<number | null>(null);
  const [onlyPose, setOnlyPose] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  // Se lee al montar: al volver de una sesión, el catálogo se vuelve a montar con lo nuevo.
  const [history] = useState(readHistory);
  const [now] = useState(() => Date.now());
  const stats = useMemo(() => activity(history, now), [history, now]);

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
  const squat = LOCAL_EXERCISES[0];

  return (
    <div className={styles.catalog}>
      <section className={styles.hero} aria-labelledby="catalogo-titulo">
        <div className={styles.heroText}>
          <p className={styles.kicker}>RITMO-VIDA × SPOT · GRATIS</p>
          <h1 id="catalogo-titulo" className={styles.title}>
            TU COACH,
            <br />
            <span>EN LA CÁMARA.</span>
          </h1>
          <p className={styles.lead}>Elegí un ejercicio, ponete frente a la compu o el celular y te contamos las repeticiones bien hechas, te corregimos la postura y te alentamos en voz alta.</p>
          <div className={styles.heroActions}>
            <button type="button" className={styles.primary} onClick={() => onStart(squat)}>
              <Camera size={20} aria-hidden="true" /> Empezar con sentadillas
            </button>
            <a href="#con-camara" className={styles.secondary}>
              Ver los ejercicios <ArrowRight size={18} aria-hidden="true" />
            </a>
          </div>
          <ul className={styles.trust}>
            <li>
              <ShieldCheck size={16} aria-hidden="true" /> El video no sale de tu compu
            </li>
            <li>
              <Mic size={16} aria-hidden="true" /> Coach con voz en español
            </li>
            <li>
              <Target size={16} aria-hidden="true" /> Las mal hechas no cuentan
            </li>
          </ul>
        </div>
        <div className={styles.heroArt} aria-hidden="true">
          <ExerciseVideo id="squat" />
          <div className={styles.heroFigure}>
            <img src={TRAINING_PHOTOS.squat.src} alt="" style={{ objectPosition: TRAINING_PHOTOS.squat.position }} />
          </div>
          <span className={`${styles.floating} ${styles.floatingAngle}`}>92° · profundidad ✓</span>
          <span className={`${styles.floating} ${styles.floatingCount}`}>
            7<small>/10</small>
          </span>
        </div>
      </section>

      <section className={styles.activity} aria-label="Tu semana">
        <GoalRing done={stats.week} goal={WEEK_GOAL} />
        <div className={styles.activityText}>
          <p className={styles.activityTitle}>{stats.week >= WEEK_GOAL ? '¡Meta de la semana cumplida!' : stats.week === 0 ? 'Tu meta: 3 sesiones por semana' : `Te faltan ${WEEK_GOAL - stats.week} para la meta de la semana`}</p>
          <dl className={styles.activityStats}>
            <div>
              <dt>
                <Flame size={14} aria-hidden="true" /> {stats.streak === 1 ? 'día seguido' : 'días seguidos'}
              </dt>
              <dd>{stats.streak}</dd>
            </div>
            <div>
              <dt>repeticiones en 7 días</dt>
              <dd>{stats.weekReps}</dd>
            </div>
            <div>
              <dt>en plancha en 7 días</dt>
              <dd>{Math.round(stats.weekHoldMs / 1000)} s</dd>
            </div>
          </dl>
        </div>
        {history.length > 0 ? (
          <ul className={styles.recent} aria-label="Últimas sesiones">
            {history.slice(0, 3).map((record) => (
              <li key={record.at}>
                <strong>{record.exercise}</strong>
                <span>
                  {result(record)} · {when(record.at, now)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.recentEmpty}>Tus sesiones van a aparecer acá. Se guardan sólo en este navegador.</p>
        )}
      </section>

      <section id="con-camara" className={styles.section} aria-labelledby="con-camara-titulo">
        <div className={styles.sectionHead}>
          <p className={styles.kicker}>CON CORRECCIÓN EN VIVO</p>
          <h2 id="con-camara-titulo" className={styles.sectionTitle}>
            ELEGÍ Y ARRANCÁ
          </h2>
          <p className={styles.sectionLead}>Ocho ejercicios sin equipo que la cámara entiende: cuenta, corrige y te dice qué mejorar.</p>
        </div>
        <ul className={styles.featured}>
          {LOCAL_EXERCISES.map((exercise) => {
            const rule = ruleFor(exercise.name);
            if (!rule) return null;
            const photo = TRAINING_PHOTOS[rule.id];
            const config = readConfig(rule);
            return (
              <li key={exercise.id}>
                <button type="button" className={styles.feature} onClick={() => onStart(exercise)}>
                  <span className={styles.featurePhoto}>
                    <ExerciseVideo id={rule.id} />
                  </span>
                  <span className={styles.featureFigure} aria-hidden="true">
                    <img src={photo.src} alt="" loading="lazy" decoding="async" style={{ objectPosition: photo.position }} />
                  </span>
                  <span className={styles.featureTag}>{rule.mode === 'reps' ? `${config.sets} × ${config.target} reps` : `${config.sets} × ${config.target} s`}</span>
                  <span className={styles.featureBody}>
                    <span className={styles.featureName}>{exercise.name}</span>
                    <span className={styles.featureMeta}>{exercise.muscles.join(' · ')}</span>
                    <span className={styles.featureGo}>
                      <Camera size={16} aria-hidden="true" /> Empezar
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className={styles.how} aria-labelledby="como-titulo">
        <h2 id="como-titulo" className={styles.sectionTitle}>
          ASÍ FUNCIONA
        </h2>
        <ol>
          <li>
            <span className={styles.howNumber}>1</span>
            <strong>Elegí</strong>
            <span>Un ejercicio y cuántas series querés hacer.</span>
          </li>
          <li>
            <span className={styles.howNumber}>2</span>
            <strong>Ubicate</strong>
            <span>A 2–3 metros de la cámara, que se te vea entero. Te avisamos si falta algo.</span>
          </li>
          <li>
            <span className={styles.howNumber}>3</span>
            <strong>Entrená</strong>
            <span>Seguí el contador y la voz. Al final, tu resumen con lo que tenés que mejorar.</span>
          </li>
        </ol>
      </section>

      <section className={styles.section} aria-labelledby="biblioteca-titulo">
        <div className={styles.sectionHead}>
          <p className={styles.kicker}>BIBLIOTECA</p>
          <h2 id="biblioteca-titulo" className={styles.sectionTitle}>
            TODOS LOS EJERCICIOS
          </h2>
          <p className={styles.sectionLead}>Cientos de ejercicios de wger, con su técnica paso a paso. Los que tienen el sello «Postura» se corrigen en vivo.</p>
        </div>

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
            Sólo con análisis de postura
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
            <p className={styles.empty}>Sin resultados. Probá con otro músculo{onlyPose ? ' o desactivá «Sólo con análisis de postura»' : ''}.</p>
          ) : (
            <div className={styles.grid}>
              {shown.map((exercise) => {
                const rule = ruleFor(exercise.name);
                return (
                  <ExerciseCard
                    key={exercise.id}
                    exercise={exercise}
                    hasPose={!!rule}
                    art={rule ? <PoseFigure id={rule.id} /> : undefined}
                    selected={exercise.id === selectedId}
                    onSelect={() => setSelectedId(exercise.id === selectedId ? null : exercise.id)}
                  />
                );
              })}
            </div>
          )}

          {selected ? (
            <aside className={styles.detail} aria-label={`Detalle: ${selected.name}`}>
              <button type="button" className={styles.close} onClick={() => setSelectedId(null)} aria-label="Cerrar detalle">
                <Icon name="x" size={18} />
              </button>
              {selected.image ? (
                <img className={styles.detailImage} src={selected.image} alt="" />
              ) : selectedRule ? (
                <div className={styles.detailArt}>
                  <PoseFigure id={selectedRule.id} />
                </div>
              ) : null}
              <h2 className={styles.detailTitle}>{selected.name}</h2>
              <p className={styles.meta}>{subtitle(selected, selected.equipment)}</p>
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
                  ? `Análisis de postura: ${selectedRule.mode === 'hold' ? 'cronómetro' : 'contador de repeticiones'} con corrección en vivo. Elegís las series antes de empezar.`
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
      </section>

      <footer className={styles.credits}>
        <p>Ejercicios de wger.de (licencia Creative Commons; imágenes y textos de sus autores) y rutinas de Ritmo-Vida.</p>
        <p>
          Fotos de Wikimedia Commons:{' '}
          {Object.values(TRAINING_PHOTOS).map((photo, index, all) => (
            <span key={photo.src}>
              <a href={photo.source} target="_blank" rel="noreferrer">
                {photo.author}
              </a>{' '}
              ({photo.license}){index < all.length - 1 ? ', ' : '.'}
            </span>
          ))}
        </p>
      </footer>
    </div>
  );
};

export default ExerciseCatalog;
