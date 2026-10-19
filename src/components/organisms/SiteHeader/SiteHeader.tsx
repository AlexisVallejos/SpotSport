import { FunctionComponent } from 'react';
import MainNavigation from '../MainNavigation/MainNavigation';
import styles from './SiteHeader.module.css';

// El mismo navbar de la portada, fijo arriba en el resto de las páginas. Oscuro en los dos temas, como en el inicio.
const SiteHeader: FunctionComponent = () => (
  <header className={`${styles.header}`}>
    <MainNavigation />
  </header>
);

export default SiteHeader;
