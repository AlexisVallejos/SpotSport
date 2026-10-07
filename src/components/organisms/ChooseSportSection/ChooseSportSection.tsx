import { FunctionComponent } from 'react';
import { SportCategoryCard } from '../../molecules';
import ContentSection from '../ContentSection/ContentSection';
import SectionHeading from '../SectionHeading/SectionHeading';
import { sportCategories } from '../../../data/sports';
import styles from './ChooseSportSection.module.css';

const ChooseSportSection: FunctionComponent = () => {
  return (
    <ContentSection tone="muted" id="deportes" labelledBy="deportes-titulo">
      <SectionHeading id="deportes-titulo" marker="ENCONTRÁ TU ÓRBITA" title="¿QUÉ TE MUEVE?" linkLabel="Todos los deportes" />
      <div className={styles.sportsCategories}>
        {sportCategories.map((sport) => (
          <SportCategoryCard key={sport.title} {...sport} />
        ))}
      </div>
    </ContentSection>
  );
};

export default ChooseSportSection;
