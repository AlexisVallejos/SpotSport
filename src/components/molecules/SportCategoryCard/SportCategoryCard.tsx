import { FunctionComponent } from 'react';
import { Icon, Text } from '../../atoms';
import styles from './SportCategoryCard.module.css';

export type SportCategoryCardProps = {
  title: string;
  description: string;
  image?: string;
};

const SportCategoryCard: FunctionComponent<SportCategoryCardProps> = ({ title, description, image }) => {
  return (
    <div className={styles.sportCategory}>
      <img className={styles.sportPhotographIcon} src={image} alt="" />
      <div className={styles.categoryScrim} />
      <div className={styles.categoryTitle}>
        <Text as="b">{title}</Text>
        <div className={styles.description}>{description}</div>
      </div>
      <div className={styles.exploreSport}>
        <Icon />
      </div>
    </div>
  );
};

export default SportCategoryCard;
