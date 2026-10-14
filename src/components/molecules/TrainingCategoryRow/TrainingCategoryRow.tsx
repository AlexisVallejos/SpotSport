import { FunctionComponent } from 'react';
import { Link } from 'react-router-dom';
import { Icon, Text } from '../../atoms';
import styles from './TrainingCategoryRow.module.css';

export type TrainingCategoryRowProps = {
  label: string;
  href: string;
};

const TrainingCategoryRow: FunctionComponent<TrainingCategoryRowProps> = ({ label, href }) => {
  return (
    <Link to={href} className={styles.trainingCategory}>
      <Text>{label}</Text>
      <Icon name="plus" size={16} />
    </Link>
  );
};

export default TrainingCategoryRow;
