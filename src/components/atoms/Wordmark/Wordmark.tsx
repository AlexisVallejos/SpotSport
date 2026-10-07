import { FunctionComponent } from 'react';
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

const Wordmark: FunctionComponent<WordmarkProps> = ({ variant, src }) => {
  return <img className={variantClass[variant]} src={src} alt="" />;
};

export default Wordmark;
