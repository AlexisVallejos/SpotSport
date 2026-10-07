import { FunctionComponent } from 'react';
import { Label, Text } from '../../atoms';
import styles from './FilterTab.module.css';

export type FilterTabProps = {
  label: string;
  active?: boolean;
};

const FilterTab: FunctionComponent<FilterTabProps> = ({ label, active = false }) => {
  if (active) {
    return (
      <div className={styles.filter}>
        <Label>{label}</Label>
        <div className={styles.activeIndicator} />
      </div>
    );
  }

  return (
    <div className={styles.filter2}>
      <Text>{label}</Text>
    </div>
  );
};

export default FilterTab;
