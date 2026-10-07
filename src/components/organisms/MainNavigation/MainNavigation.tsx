import { FunctionComponent, useState } from 'react';
import { Icon, Text, Wordmark } from '../../atoms';
import { SearchBox } from '../../molecules';
import { bagCount, departments, searchPlaceholder } from '../../../data/navigation';
import styles from './MainNavigation.module.css';

const MainNavigation: FunctionComponent = () => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className={styles.mainNavigation} aria-label="Principal">
      <a href="#" className={styles.brand} aria-label="SPOT, ir al inicio">
        <Wordmark variant="nav" />
      </a>
      <div id="menu-principal" className={`${styles.menuPanel} ${menuOpen ? styles.menuPanelOpen : ''}`}>
        <div className={styles.departments}>
          {departments.map((department) => (
            <a key={department} href={department === 'Indumentaria' ? '#indumentaria' : department === 'Deportes' ? '#deportes' : '#calzado'} onClick={() => setMenuOpen(false)} className={styles.navigationLink}>
              {department}
            </a>
          ))}
        </div>
        <SearchBox placeholder={searchPlaceholder} />
      </div>
      <div className={styles.accountAndBag}>
        <button type="button" className={styles.iconButton} aria-label="Mi cuenta">
          <Icon name="userRound" />
        </button>
        <button type="button" className={`${styles.iconButton} ${styles.bag}`} aria-label={`Bolsa, ${bagCount} productos`}>
          <Icon name="shoppingBag" />
          <Text>{bagCount}</Text>
        </button>
        <button
          type="button"
          className={`${styles.iconButton} ${styles.menuToggle}`}
          aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={menuOpen}
          aria-controls="menu-principal"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <Icon name={menuOpen ? 'x' : 'menu'} size={24} />
        </button>
      </div>
    </nav>
  );
};

export default MainNavigation;
