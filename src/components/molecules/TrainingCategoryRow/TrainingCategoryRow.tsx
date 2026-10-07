import { FunctionComponent } from 'react';
import { Icon, Text } from '../../atoms';
import styles from './TrainingCategoryRow.module.css';

export type TrainingCategoryRowProps = {
  label: string;
};

const TrainingCategoryRow: FunctionComponent<TrainingCategoryRowProps> = ({ label }) => {
  return (
    <div className={styles.trainingCategory}>
      <Text>{label}</Text>
      <Icon size={16} />
    </div>
  );
};

export default TrainingCategoryRow;
