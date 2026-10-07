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
    <a href="#calzado" className={styles.sportCategory} aria-label={`${title}. ${description}`}>
      <img className={styles.sportPhotographIcon} src={image} alt="" loading="lazy" decoding="async" />
      <div className={styles.categoryScrim} />
      <div className={styles.categoryTitle}>
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
