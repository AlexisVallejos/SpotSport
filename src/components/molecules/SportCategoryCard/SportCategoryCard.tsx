import { FunctionComponent } from 'react';
import { Icon, Text } from '../../atoms';
import styles from './SportCategoryCard.module.css';

export type SportCategoryCardProps = {
  title: string;
  description: string;
  image?: string;
  index?: number;
};

const SportCategoryCard: FunctionComponent<SportCategoryCardProps> = ({ title, description, image, index }) => {
  return (
    <a href="#calzado" className={styles.sportCategory} aria-label={`${title}. ${description}`}>
      <img className={styles.sportPhotographIcon} src={image} alt="" loading="lazy" decoding="async" />
      <div className={styles.categoryScrim} />
      <div className={styles.categoryTitle}>
        <span className={styles.number} aria-hidden="true">{String((index ?? 0) + 1).padStart(2, '0')}</span>
        <Text as="b">{title}</Text>
        <div className={styles.description}>{description}</div>
      </div>
      <div className={styles.exploreSport}>
        <Icon name="arrowUpRight" />
      </div>
    </a>
  );
};

export default SportCategoryCard;
