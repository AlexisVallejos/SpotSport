import { FunctionComponent } from 'react';
import MainNavigation from '../MainNavigation/MainNavigation';
import SculpturalHero from '../SculpturalHero/SculpturalHero';
import MovementManifesto from '../MovementManifesto/MovementManifesto';
import styles from './HomeCover.module.css';

const HomeCover: FunctionComponent = () => {
  return (
    <header className={styles.portadaElDeporteEnPrimer}>
      <MainNavigation />
      <SculpturalHero />
      <MovementManifesto />
    </header>
  );
};

export default HomeCover;
