import { FunctionComponent } from 'react';
import MainNavigation from '../MainNavigation/MainNavigation';
import LavaHero from '../LavaHero/LavaHero';
import SpotMarquee from '../SpotMarquee/SpotMarquee';
import styles from './HomeCover.module.css';

const HomeCover: FunctionComponent = () => {
  return (
    // La portada es video: queda oscura en los dos temas.
    <header className={`${styles.portadaElDeporteEnPrimer} theme-dark`}>
      <MainNavigation />
      <LavaHero />
      <SpotMarquee />
    </header>
  );
};

export default HomeCover;
