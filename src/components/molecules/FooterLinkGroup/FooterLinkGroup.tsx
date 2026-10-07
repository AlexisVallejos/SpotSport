import { FunctionComponent } from 'react';
import { Text } from '../../atoms';
import styles from './FooterLinkGroup.module.css';

export type FooterLinkGroupProps = {
  title: string;
  links: string[];
};

const FooterLinkGroup: FunctionComponent<FooterLinkGroupProps> = ({ title, links }) => {
  return (
    <div className={styles.footerLinkGroup}>
      <div className={styles.groupTitle}>{title}</div>
      {links.map((link) => (
        <Text key={link}>{link}</Text>
      ))}
    </div>
  );
};

export default FooterLinkGroup;
