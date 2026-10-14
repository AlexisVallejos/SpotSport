import { FunctionComponent } from 'react';
import { Link } from 'react-router-dom';
import { Icon, Label } from '../../atoms';
import styles from './CollectionLink.module.css';

export type CollectionLinkProps = {
  label: string;
  /** Ruta interna (/precios?…) o anclaje de la landing. Sin href, se deduce del texto. */
  href?: string;
};

const CollectionLink: FunctionComponent<CollectionLinkProps> = ({ label, href }) => {
  const target = href ?? (label.toLowerCase().includes('indumentaria') ? '#indumentaria' : label.toLowerCase().includes('calzado') ? '#calzado' : '#deportes');
  const content = (
    <>
      <Label>{label}</Label>
      <Icon name="arrowRight" />
    </>
  );
  return target.startsWith('/') ? (
    <Link to={target} className={styles.collectionLink}>
      {content}
    </Link>
  ) : (
    <a href={target} className={styles.collectionLink}>
      {content}
    </a>
  );
};

export default CollectionLink;
