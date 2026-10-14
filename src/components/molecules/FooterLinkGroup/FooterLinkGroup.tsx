import { FunctionComponent } from 'react';
import { Link } from 'react-router-dom';
import styles from './FooterLinkGroup.module.css';

export type FooterLinkGroupProps = {
  title: string;
  links: { label: string; href: string }[];
};

const FooterLinkGroup: FunctionComponent<FooterLinkGroupProps> = ({ title, links }) => {
  return (
    <nav className={styles.footerLinkGroup} aria-label={title}>
      <h3 className={styles.groupTitle}>{title}</h3>
      {links.map(({ label, href }) =>
        href.startsWith('/') ? (
          <Link key={label} to={href} className={styles.link}>
            {label}
          </Link>
        ) : (
          <a key={label} href={href} className={styles.link}>
            {label}
          </a>
        ),
      )}
    </nav>
  );
};

export default FooterLinkGroup;
