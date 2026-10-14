import { FunctionComponent } from 'react';
import { CollectionLink, SectionMarker } from '../../molecules';
import styles from './SectionHeading.module.css';

export type SectionHeadingProps = {
  id?: string;
  marker: string;
  title: string;
  linkLabel: string;
  linkHref?: string;
};

const SectionHeading: FunctionComponent<SectionHeadingProps> = ({ id, marker, title, linkLabel, linkHref }) => {
  return (
    <div className={styles.sectionHeading}>
      <div className={styles.titleGroup}>
        <SectionMarker label={marker} />
        <h2 id={id} className={styles.title}>{title}</h2>
      </div>
      <CollectionLink label={linkLabel} href={linkHref} />
    </div>
  );
};

export default SectionHeading;
