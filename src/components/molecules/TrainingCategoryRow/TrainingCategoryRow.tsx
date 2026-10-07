import { FunctionComponent } from 'react';
import { Icon, Text } from '../../atoms';
import styles from './TrainingCategoryRow.module.css';

export type TrainingCategoryRowProps = {
  label: string;
};

const TrainingCategoryRow: FunctionComponent<TrainingCategoryRowProps> = ({ label }) => {
  return (
    <a href="#" className={styles.trainingCategory}>
      <Text>{label}</Text>
      <Icon name="plus" size={16} />
    </a>
  );
};

export default TrainingCategoryRow;
