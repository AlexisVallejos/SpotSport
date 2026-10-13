import { FunctionComponent, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../../../context/CartContext';
import { Icon, Text, Wordmark } from '../../atoms';
import { SearchBox } from '../../molecules';
import { departments, searchPlaceholder } from '../../../data/navigation';
import styles from './MainNavigation.module.css';

const MainNavigation: FunctionComponent = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const { itemCount } = useCart();

  return (
    <nav className={styles.mainNavigation} aria-label="Principal">
      <a href="#" className={styles.brand} aria-label="SPOT, ir al inicio">
        <Wordmark variant="nav" />
      </a>
      <div id="menu-principal" className={`${styles.menuPanel} ${menuOpen ? styles.menuPanelOpen : ''}`}>
        <div className={styles.departments}>
          <Link to="/tienda" onClick={() => setMenuOpen(false)} className={styles.navigationLink}>
            Tienda
          </Link>
          {departments.map((department) => (
            <a key={department} href={department === 'Indumentaria' ? '#indumentaria' : department === 'Deportes' ? '#deportes' : '#calzado'} onClick={() => setMenuOpen(false)} className={styles.navigationLink}>
              {department}
            </a>
          ))}
        </div>
        <SearchBox placeholder={searchPlaceholder} />
      </div>
      <div className={styles.accountAndBag}>
        <Link to="/cuenta" className={styles.iconButton} aria-label="Mi cuenta">
          <Icon name="userRound" />
        </Link>
        <Link to="/carrito" className={`${styles.iconButton} ${styles.bag}`} aria-label={`Carrito, ${itemCount} productos`}>
          <Icon name="shoppingBag" />
          <Text>{String(itemCount)}</Text>
        </Link>
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
