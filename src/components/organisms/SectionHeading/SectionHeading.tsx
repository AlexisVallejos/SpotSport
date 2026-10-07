import { FunctionComponent } from 'react';
import { CollectionLink, SectionMarker } from '../../molecules';
import styles from './SectionHeading.module.css';

export type SectionHeadingProps = {
  marker: string;
  title: string;
  linkLabel: string;
};

const SectionHeading: FunctionComponent<SectionHeadingProps> = ({ marker, title, linkLabel }) => {
  return (
    <div className={styles.sectionHeading}>
      <div className={styles.titleGroup}>
        <SectionMarker label={marker} />
        <b className={styles.title}>{title}</b>
      </div>
      <CollectionLink label={linkLabel} />
    </div>
  );
};

export default SectionHeading;
