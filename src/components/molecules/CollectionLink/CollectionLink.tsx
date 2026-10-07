import { FunctionComponent } from 'react';
import { Icon, Label } from '../../atoms';
import styles from './CollectionLink.module.css';

export type CollectionLinkProps = {
  label: string;
};

const CollectionLink: FunctionComponent<CollectionLinkProps> = ({ label }) => {
  return (
    <div className={styles.collectionLink}>
      <Label>{label}</Label>
      <Icon />
    </div>
  );
};

export default CollectionLink;
