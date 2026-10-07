import { FunctionComponent } from 'react';
import { Label, Text } from '../../atoms';
import styles from './FilterTab.module.css';

export type FilterTabProps = {
  label: string;
  active?: boolean;
  onSelect?: () => void;
};

const FilterTab: FunctionComponent<FilterTabProps> = ({ label, active = false, onSelect }) => {
  return (
    <button
      type="button"
      className={active ? styles.filter : styles.filter2}
      aria-pressed={active}
      onClick={onSelect}
    >
      {active ? <Label>{label}</Label> : <Text>{label}</Text>}
      {active && <div className={styles.activeIndicator} />}
    </button>
  );
};

export default FilterTab;
