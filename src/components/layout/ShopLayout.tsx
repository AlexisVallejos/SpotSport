import { Link, Outlet } from 'react-router-dom';
import SiteHeader from '../organisms/SiteHeader/SiteHeader';
import AnnouncementBar from './AnnouncementBar';
import styles from './ShopLayout.module.css';

/** Pantallas de compra y de cuenta: el mismo navbar de la landing y un pie corto. */
export default function ShopLayout() {
  return (
    // La tienda tiene su paleta oscura propia: queda oscura en los dos temas.
    <div className={`${styles.page}`}>
      <AnnouncementBar />
      <SiteHeader />
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
