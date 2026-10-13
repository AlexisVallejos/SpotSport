import { CSSProperties, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { sportCategories } from '../../../data/sports';
import styles from './DisciplineDeck.module.css';

const disciplines = [
  { key: 'running', kicker: 'Salí a encontrar tu ritmo', cta: 'Calzado de running' },
  { key: 'training', kicker: 'Hacé lugar a tu mejor versión', cta: 'Calzado de entrenamiento' },
  { key: 'football', kicker: 'El juego empieza con vos', cta: 'Calzado de fútbol' },
  { key: 'sportstyle', kicker: 'Llevá tu actitud a la calle', cta: 'Calzado sportstyle' },
];

/**
 * Las cuatro disciplinas juntas, sin scroll: el panel que señalás (mouse, foco o
 * toque) se expande y muestra su texto; los demás se achican a una franja.
 */
export default function DisciplineDeck() {
  const [active, setActive] = useState(0);

  return (
    <section className={styles.section} id="deportes" aria-labelledby="deportes-titulo">
      <div className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Encontrá tu disciplina</span>
          <h2 id="deportes-titulo" className={styles.heading}>¿Qué te <span>mueve?</span></h2>
        </div>
        <p className={styles.intro}>No hay una sola forma de moverse. Hay una que es tuya.</p>
      </div>

      <div className={styles.panels}>
        {sportCategories.map((sport, index) => {
          const discipline = disciplines[index];
          const isActive = index === active;
          return (
            <a
              key={sport.title}
              href={`#calzado/${discipline.key}`}
              className={`${styles.panel} ${isActive ? styles.active : ''}`}
              onMouseEnter={() => setActive(index)}
              onFocus={() => setActive(index)}
              // En touch el primer toque expande el panel; el segundo abre el calzado.
              onClick={event => { if (!isActive) { event.preventDefault(); setActive(index); } }}
              aria-label={`${sport.title}: ${discipline.cta}`}
            >
              <img className={styles.photo} src={sport.image} alt="" loading="lazy" decoding="async" />
              <div className={styles.scrim} />
              <span className={styles.number} aria-hidden="true">0{index + 1}</span>
              <div className={styles.content}>
                <p className={styles.kicker}>{discipline.kicker}</p>
                <h3 className={styles.title}>
                  {[...sport.title].map((letter, i) => <span key={i} style={{ '--i': i } as CSSProperties}>{letter}</span>)}
                </h3>
                <p className={styles.description}>{sport.description}</p>
                <span className={styles.cta}>{discipline.cta} <ArrowUpRight size={15} /></span>
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
}
