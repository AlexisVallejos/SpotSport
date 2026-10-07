import { FunctionComponent } from 'react';
import styles from './FooterLinkGroup.module.css';

export type FooterLinkGroupProps = {
  title: string;
  links: string[];
};

const FooterLinkGroup: FunctionComponent<FooterLinkGroupProps> = ({ title, links }) => {
  return (
    <nav className={styles.footerLinkGroup} aria-label={title}>
      <h3 className={styles.groupTitle}>{title}</h3>
      {links.map((link) => (
        <a key={link} href="#" className={styles.link}>
          {link}
        </a>
      ))}
    </nav>
  );
};

export default FooterLinkGroup;
