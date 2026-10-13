import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { Icon, Wordmark } from '../atoms';
import AnnouncementBar from './AnnouncementBar';
import styles from './ShopLayout.module.css';

/** Cabecera y pie de las pantallas de compra y de cuenta. La landing tiene su propia cabecera. */
export default function ShopLayout() {
  const { session, profile, isAdmin, merchant, isMerchant, signOut } = useAuth();
  const { itemCount } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const menu = useRef<HTMLDetailsElement>(null);
  const [query, setQuery] = useState('');

  // El menú de cuenta se cierra al navegar.
  useEffect(() => {
    menu.current?.removeAttribute('open');
  }, [location.pathname]);

  const search = (event: FormEvent) => {
    event.preventDefault();
    navigate(query.trim() ? `/tienda?q=${encodeURIComponent(query.trim())}` : '/tienda');
  };

  const name = profile?.full_name?.split(' ')[0] || profile?.email?.split('@')[0] || 'Mi cuenta';

  return (
    <div className={styles.page}>
      <AnnouncementBar />
      <header className={styles.header}>
        <Link to="/" className={styles.brand} aria-label="SPOT, ir al inicio">
          <Wordmark variant="nav" />
        </Link>
        <nav className={styles.links} aria-label="Principal">
          <NavLink to="/tienda">Tienda</NavLink>
          <NavLink to="/entrenar">Entrenar</NavLink>
        </nav>
        <form className={styles.search} role="search" onSubmit={search}>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="¿Qué estás buscando?" aria-label="Buscar productos" />
          <button type="submit" aria-label="Buscar">
            <Icon name="search" size={18} />
          </button>
        </form>
        <div className={styles.actions}>
          {session ? (
            <details ref={menu} className={styles.account}>
              <summary>
                <Icon name="userRound" /> <span>{name}</span>
              </summary>
              <div className={styles.menu}>
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
            <Link to="/login" className={styles.login}>
              <Icon name="userRound" /> <span>Ingresar</span>
            </Link>
          )}
          <Link to="/carrito" className={styles.cart} aria-label={`Carrito, ${itemCount} productos`}>
            <Icon name="shoppingBag" />
            <span>{itemCount}</span>
          </Link>
        </div>
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
      <footer className={styles.footer}>
        <span>© SPOT — Todo el deporte en un solo lugar</span>
        <span className={styles.footerLinks}>
          <Link to="/tienda">Tienda</Link>
          <Link to="/cuenta/afiliarse">Vendé en SPOT</Link>
          <Link to="/entrenar">Entrená con cámara</Link>
        </span>
      </footer>
    </div>
  );
}
