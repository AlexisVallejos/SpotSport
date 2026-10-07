import { FunctionComponent } from 'react';
import { Icon, Label } from '../../atoms';
import styles from './KitItem.module.css';

export type KitItemProps = {
  name: string;
  category: string;
};

const KitItem: FunctionComponent<KitItemProps> = ({ name, category }) => {
  return (
    <div className={styles.kitItem}>
      <div className={styles.itemDetails}>
        <Label>{name}</Label>
        <div className={styles.category12}>{category}</div>
      </div>
      <Icon size={16} />
    </div>
  );
};

export default KitItem;
