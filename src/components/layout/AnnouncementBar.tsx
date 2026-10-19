import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listAnnouncements } from '../../lib/api/shop';
import { isConfigured } from '../../lib/supabaseConfig';
import type { Announcement } from '../../lib/types';
import styles from './AnnouncementBar.module.css';

const DISMISSED_KEY = 'spot:announcements:dismissed';

function dismissed(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(DISMISSED_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}

/** Barra superior con los anuncios que carga el admin. No ocupa lugar si no hay ninguno. */
export default function AnnouncementBar() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!isConfigured) return;
    let alive = true;
    listAnnouncements()
      .then((all) => {
        if (!alive) return;
        const hidden = dismissed();
        setItems(all.filter((item) => item.placement === 'topbar' && !hidden.includes(item.id)));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (items.length < 2) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % items.length), 6000);
    return () => window.clearInterval(timer);
  }, [items.length]);

  const current = items[index % Math.max(items.length, 1)];
  if (!current) return null;

  const close = () => {
    try {
      sessionStorage.setItem(DISMISSED_KEY, JSON.stringify([...dismissed(), current.id]));
    } catch {
      // Sin storage: se cierra solo hasta recargar.
    }
    setItems((all) => all.filter((item) => item.id !== current.id));
  };

  const external = /^https?:\/\//.test(current.link_url);
  return (
    <div className={styles.bar} role="region" aria-label="Anuncios">
      <p className={styles.text}>
        <strong>{current.title}</strong>
        {current.body ? <span> {current.body}</span> : null}
        {current.link_url ? (
          external ? (
            <a className={styles.link} href={current.link_url} target="_blank" rel="noreferrer">
              {current.link_label || 'Ver más'}
            </a>
          ) : (
            <Link className={styles.link} to={current.link_url}>
              {current.link_label || 'Ver más'}
            </Link>
          )
        ) : null}
      </p>
      <button type="button" className={styles.close} onClick={close} aria-label="Cerrar anuncio">
        ×
      </button>
    </div>
  );
}
