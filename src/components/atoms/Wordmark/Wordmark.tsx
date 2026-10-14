import { FunctionComponent } from 'react';
import { images } from '../../../data/images';
import styles from './Wordmark.module.css';

export type WordmarkVariant = 'nav' | 'hero' | 'running' | 'kit' | 'closing' | 'footer';

export type WordmarkProps = {
  variant: WordmarkVariant;
  src?: string;
};

const variantClass: Record<WordmarkVariant, string> = {
  nav: styles.spotOrbitalWordmark,
  hero: styles.spotOrbitalWordmark2,
  running: styles.spotOrbitalWordmark3,
  kit: styles.spotOrbitalWordmark4,
  closing: styles.spotOrbitalWordmark5,
  footer: styles.spotOrbitalWordmark6,
};

// Sin src fijo, se dibujan las dos versiones del logo y el tema de la zona muestra la que corresponde.
const Wordmark: FunctionComponent<WordmarkProps> = ({ variant, src }) => {
  if (src) return <img className={variantClass[variant]} src={src} alt="SPOT" />;
  return (
    <>
      <img className={`${variantClass[variant]} ${styles.onDark}`} src={images.logoDarkBg} alt="SPOT" />
      <img className={`${variantClass[variant]} ${styles.onLight}`} src={images.logoLightBg} alt="" aria-hidden="true" />
    </>
  );
};

export default Wordmark;
