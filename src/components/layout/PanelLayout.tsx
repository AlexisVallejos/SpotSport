import { NavLink, Outlet } from 'react-router-dom';
import styles from './PanelLayout.module.css';

export type PanelLink = { to: string; label: string; end?: boolean };

/** Estructura común de los paneles: menú lateral y contenido. */
export default function PanelLayout({ title, links }: { title: string; links: PanelLink[] }) {
  return (
    <div className={styles.layout}>
      <aside className={styles.side}>
        <p className={styles.title}>{title}</p>
        <nav className={styles.nav} aria-label={title}>
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end} className={({ isActive }) => (isActive ? `${styles.link} ${styles.active}` : styles.link)}>
              {link.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <section className={styles.content}>
        <Outlet />
      </section>
    </div>
  );
}
