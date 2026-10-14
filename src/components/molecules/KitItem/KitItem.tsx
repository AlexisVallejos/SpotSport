import { FunctionComponent } from 'react';
import { Icon, Label } from '../../atoms';
import styles from './KitItem.module.css';

export type KitItemProps = {
  name: string;
  category: string;
  /** Lo que pasa al tocarlo (abrir el panel de precios). */
  onSelect?: () => void;
};

const KitItem: FunctionComponent<KitItemProps> = ({ name, category, onSelect }) => {
  return (
    <button type="button" className={styles.kitItem} onClick={onSelect} disabled={!onSelect} aria-haspopup={onSelect ? 'dialog' : undefined}>
      <div className={styles.itemDetails}>
        <Label>{name}</Label>
        <div className={styles.category12}>{category}</div>
      </div>
      <Icon name="plus" size={16} />
    </button>
  );
};

export default KitItem;
