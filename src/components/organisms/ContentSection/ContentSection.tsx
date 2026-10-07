import { FunctionComponent, ReactNode } from 'react';
import styles from './ContentSection.module.css';

export type ContentSectionTone = 'muted' | 'white';

export type ContentSectionProps = {
  tone: ContentSectionTone;
  id?: string;
  labelledBy?: string;
  children: ReactNode;
};

const toneClass: Record<ContentSectionTone, string> = {
  muted: styles.elegTuDeporte,
  white: styles.novedadesDeCalzado,
};

const ContentSection: FunctionComponent<ContentSectionProps> = ({ tone, id, labelledBy, children }) => {
  return (
    <section id={id} className={toneClass[tone]} aria-labelledby={labelledBy}>
      {children}
    </section>
  );
};

export default ContentSection;
