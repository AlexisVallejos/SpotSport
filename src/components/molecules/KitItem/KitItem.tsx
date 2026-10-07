import { FunctionComponent } from 'react';
import { Icon, Label } from '../../atoms';
import styles from './KitItem.module.css';

export type KitItemProps = {
  name: string;
  category: string;
};

const KitItem: FunctionComponent<KitItemProps> = ({ name, category }) => {
  return (
    <a href="#" className={styles.kitItem}>
      <div className={styles.itemDetails}>
        <Label>{name}</Label>
        <div className={styles.category12}>{category}</div>
      </div>
      <Icon name="plus" size={16} />
    </a>
  );
};

export default KitItem;
