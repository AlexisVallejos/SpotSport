import { FunctionComponent } from 'react';
import MainNavigation from '../MainNavigation/MainNavigation';
import SculpturalHero from '../SculpturalHero/SculpturalHero';
import MovementManifesto from '../MovementManifesto/MovementManifesto';
import styles from './HomeCover.module.css';

const HomeCover: FunctionComponent = () => {
  return (
    <div className={styles.portadaElDeporteEnPrimer}>
      <MainNavigation />
      <SculpturalHero />
      <MovementManifesto />
    </div>
  );
};

export default HomeCover;
