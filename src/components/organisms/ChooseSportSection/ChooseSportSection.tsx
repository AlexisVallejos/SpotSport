import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { sportCategories } from '../../../data/sports';
import styles from './ChooseSportSection.module.css';

const disciplines = ['running', 'training', 'football', 'sportstyle'];
const labels = ['SALÍ A ENCONTRAR TU RITMO', 'HACÉ LUGAR A TU MEJOR VERSIÓN', 'EL JUEGO EMPIEZA CON VOS', 'LLEVÁ TU ACTITUD A LA CALLE'];

export default function ChooseSportSection() {
  return (
    <section className={styles.section} id="deportes" aria-labelledby="deportes-titulo">
      <div className={styles.heading}>
        <div><span className={styles.eyebrow}>ENCONTRÁ TU DISCIPLINA</span><h2 id="deportes-titulo">¿QUÉ TE<br /><span>MUEVE?</span><ArrowDownRight aria-hidden="true" /></h2></div>
        <div className={styles.introduction}><p>No hay una sola forma de moverse.<br />Hay una que es tuya.</p><a href="#calzado">Encontrá tu equipo <ArrowUpRight size={18} /></a></div>
      </div>
      <div className={styles.sportsCategories}>
        {sportCategories.map((sport, index) => (
          <a key={sport.title} href={`#calzado/${disciplines[index]}`} className={styles.card} aria-label={`Explorar ${sport.title}`}>
            <div className={styles.imageFrame}><img src={sport.image} alt="" loading="lazy" decoding="async" /></div>
            <div className={styles.scrim} />
            <div className={styles.cardTop}><span className={styles.number}>0{index + 1}</span><span>{labels[index]}</span></div>
            <div className={styles.cardBottom}><div><h3>{sport.title}</h3><p>{sport.description}</p></div><span className={styles.arrow}><ArrowUpRight size={22} /></span></div>
          </a>
        ))}
      </div>
      <div className={styles.footnote}><span>CUATRO DISCIPLINAS. INFINITAS FORMAS DE SER VOS.</span><span>EL PRÓXIMO MOVIMIENTO ES TUYO <ArrowDownRight size={15} /></span></div>
    </section>
  );
}
