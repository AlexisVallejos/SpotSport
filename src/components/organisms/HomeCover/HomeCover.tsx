import { FunctionComponent } from 'react';
import MainNavigation from '../MainNavigation/MainNavigation';
import LavaHero from '../LavaHero/LavaHero';
import SpotMarquee from '../SpotMarquee/SpotMarquee';
import styles from './HomeCover.module.css';

const HomeCover: FunctionComponent = () => {
  return (
    <header className={styles.portadaElDeporteEnPrimer}>
      <MainNavigation />
      <LavaHero />
      <SpotMarquee />
    </header>
  );
};

export default HomeCover;
