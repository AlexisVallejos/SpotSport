import { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Play, X, Feather, Layers3, MoveUpRight } from 'lucide-react';
import { footwearProducts } from '../../../data/products';
import styles from './SculpturalHero.module.css';

const SculpturalHero = () => {
  const [active, setActive] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const product = footwearProducts[active];
  const change = (direction: number) => setActive(index => (index + direction + footwearProducts.length) % footwearProducts.length);
  const closeVideo = () => { video.current?.pause(); dialog.current?.close(); };
  return (
    <section className={styles.hero} aria-label="Portada">
      <div className={styles.atmosphere} />
      <div className={styles.metadata}><span>SPOT / EN MOVIMIENTO</span><span>DISEÑADO PARA TU PRÓXIMO PASO ↗</span></div>
      <div className={styles.backdrop} aria-hidden="true">EN ÓRBITA.</div>
      <div className={styles.orbit} />
      <div className={styles.copy}>
        <span className={styles.eyebrow}>TU MOVIMIENTO EMPIEZA ACÁ</span>
        <h1>TODO EL DEPORTE<br />EN UN SOLO LUGAR.</h1>
        <p>Diseño, energía y actitud.<br />Encontrá lo que te mueve y llevá tu próximo paso más lejos.</p>
        <div className={styles.actions}>
          <a href="#calzado" className={styles.primary}>Explorar productos <ArrowRight size={18} /></a>
          <button onClick={() => { dialog.current?.showModal(); video.current?.play().catch(() => undefined); }} className={styles.videoButton}><Play size={17} /> Ver video</button>
        </div>
      </div>
      <div className={styles.stage}>
        <img key={product.name} src={product.image} alt={product.name} className={styles.shoe} fetchPriority="high" />
      </div>
      <div className={styles.features}><span><Feather /> MALLA LIVIANA</span><span><Layers3 /> DISEÑO CON CARÁCTER</span><span><MoveUpRight /> ACTITUD EN CADA PASO</span></div>
      <div className={styles.selection}>
        <div className={styles.productInfo} aria-live="polite"><span>0{active + 1} / COLECCIÓN SPOT</span><h2>{product.name}</h2><p>{product.description}</p></div>
        <div className={styles.controls}>
          <button className={styles.arrow} onClick={() => change(-1)} aria-label="Zapatilla anterior"><ArrowLeft size={19} /></button>
          <div className={styles.thumbnails} aria-label="Elegí una zapatilla">
            {footwearProducts.map((item, index) => <button key={item.name} onClick={() => setActive(index)} className={`${styles.thumbnail} ${active === index ? styles.selected : ''}`} aria-label={`Mostrar ${item.name}`} aria-pressed={active === index}><img src={item.image} alt="" /><span>0{index + 1}</span></button>)}
          </div>
          <button className={styles.arrow} onClick={() => change(1)} aria-label="Siguiente zapatilla"><ArrowRight size={19} /></button>
        </div>
      </div>
      <dialog ref={dialog} className={styles.videoDialog} onClose={() => video.current?.pause()} onClick={event => { if (event.target === event.currentTarget) closeVideo(); }}><button onClick={closeVideo} aria-label="Cerrar video"><X /></button><video ref={video} src="/video/spot-intro.mp4" controls playsInline preload="none" /></dialog>
    </section>
  );
};
export default SculpturalHero;
