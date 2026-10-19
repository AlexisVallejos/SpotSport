import { FunctionComponent, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { useCart } from '../../../context/CartContext';
import { Icon, Text, Wordmark } from '../../atoms';
import { SearchBox } from '../../molecules';
import ThemeToggle from '../../molecules/ThemeToggle/ThemeToggle';
import { navLinks, searchPlaceholder } from '../../../data/navigation';
import styles from './MainNavigation.module.css';

// "Tienda" queda marcada en todo el recorrido de compra, comparador incluido.
const SHOP_PATHS = ['/tienda', '/precios', '/producto', '/carrito', '/checkout'];

function isCurrent(href: string, pathname: string, search: string): boolean {
  if (href === '/tienda') return SHOP_PATHS.some((path) => pathname.startsWith(path)) && !search.includes('orden=descuento');
  if (href.startsWith('/precios')) return pathname === '/precios' && search.includes('orden=descuento');
  return !href.includes('#') && pathname.startsWith(href);
}

const MainNavigation: FunctionComponent = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const { itemCount } = useCart();
  const { session, profile, isAdmin, merchant, isMerchant, signOut } = useAuth();
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const account = useRef<HTMLDetailsElement>(null);

  // Los menús se cierran al navegar.
  useEffect(() => {
    setMenuOpen(false);
    account.current?.removeAttribute('open');
  }, [pathname, search]);

  const name = profile?.full_name?.split(' ')[0] || profile?.email?.split('@')[0] || 'Mi cuenta';

  return (
    <nav className={styles.mainNavigation} aria-label="Principal">
      <Link to="/" className={styles.brand} aria-label="SPOT, ir al inicio">
        <Wordmark variant="nav" />
      </Link>
      <div id="menu-principal" className={`${styles.menuPanel} ${menuOpen ? styles.menuPanelOpen : ''}`}>
        <div className={styles.departments}>
          {navLinks.map(({ label, href }) => (
            <Link
              key={label}
              to={href}
              onClick={() => setMenuOpen(false)}
              className={styles.navigationLink}
              aria-current={isCurrent(href, pathname, search) ? 'page' : undefined}
            >
              {label}
            </Link>
          ))}
        </div>
        <SearchBox placeholder={searchPlaceholder} />
        <div className={styles.menuTheme}>
          <span>Tema</span>
          <ThemeToggle />
        </div>
      </div>
      <div className={styles.accountAndBag}>
        <ThemeToggle className={styles.theme} />
        {session ? (
          <details ref={account} className={styles.account}>
            <summary className={styles.iconButton} aria-label={`Cuenta de ${name}`}>
              <Icon name="userRound" />
            </summary>
            <div className={styles.accountMenu}>
              <span className={styles.accountName}>{name}</span>
              <Link to="/cuenta">Mi cuenta</Link>
              <Link to="/cuenta/pedidos">Mis compras</Link>
              {isMerchant ? <Link to="/comercio">Mi comercio</Link> : <Link to="/cuenta/afiliarse">{merchant ? 'Mi solicitud de comercio' : 'Vender en SPOT'}</Link>}
              {isAdmin ? <Link to="/admin">Administración</Link> : null}
              <button type="button" onClick={() => void signOut().then(() => navigate('/'))}>
                Salir
              </button>
            </div>
          </details>
        ) : (
          <Link to="/login" className={styles.iconButton} aria-label="Ingresar">
            <Icon name="userRound" />
          </Link>
        )}
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
