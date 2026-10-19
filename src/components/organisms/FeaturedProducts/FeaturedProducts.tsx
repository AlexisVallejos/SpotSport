import { FunctionComponent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listAnnouncements, listProducts } from '../../../lib/api/shop';
import { isConfigured } from '../../../lib/supabaseConfig';
import type { Announcement, Product } from '../../../lib/types';
import ProductCard from '../../shop/ProductCard';
import styles from './FeaturedProducts.module.css';

/**
 * Lo que el admin controla desde su panel: anuncios de portada y productos destacados de comercios.
 * Si no hay nada cargado (o no hay base conectada) no ocupa lugar y la landing queda como estaba.
 */
const FeaturedProducts: FunctionComponent = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [banners, setBanners] = useState<Announcement[]>([]);

  useEffect(() => {
    if (!isConfigured) return;
    let alive = true;
    Promise.all([listProducts({ featured: true, limit: 8 }), listAnnouncements()])
      .then(([featured, announcements]) => {
        if (!alive) return;
        setProducts(featured);
        setBanners(announcements.filter((item) => item.placement === 'hero' || item.placement === 'strip'));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (products.length === 0 && banners.length === 0) return null;

  return (
    <section className={styles.section} aria-labelledby="destacados-titulo">
      {banners.map((banner) => {
        const content = (
          <>
            {banner.image_url ? <img className={styles.bannerImage} src={banner.image_url} alt="" loading="lazy" /> : null}
            <span className={styles.bannerText}>
              <strong>{banner.title}</strong>
              {banner.body ? <span>{banner.body}</span> : null}
              {banner.link_url ? <span className={styles.bannerLink}>{banner.link_label || 'Ver más'} →</span> : null}
            </span>
          </>
        );
        const className = `${styles.banner} ${banner.placement === 'hero' ? styles.bannerHero : ''}`;
        if (!banner.link_url) return <div key={banner.id} className={className}>{content}</div>;
        return /^https?:\/\//.test(banner.link_url) ? (
          <a key={banner.id} className={className} href={banner.link_url} target="_blank" rel="noreferrer">
            {content}
          </a>
        ) : (
          <Link key={banner.id} className={className} to={banner.link_url}>
            {content}
          </Link>
        );
      })}

      {products.length > 0 ? (
        <>
          <div className={styles.head}>
            <h2 id="destacados-titulo" className={styles.title}>
              Destacados
            </h2>
            <Link to="/tienda" className={styles.all}>
              Ver toda la tienda →
            </Link>
          </div>
          <div className={styles.grid}>
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
};

export default FeaturedProducts;
