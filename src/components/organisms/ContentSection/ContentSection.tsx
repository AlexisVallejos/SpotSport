import { FunctionComponent, ReactNode } from 'react';
import styles from './ContentSection.module.css';

export type ContentSectionTone = 'muted' | 'white';

export type ContentSectionProps = {
  tone: ContentSectionTone;
  children: ReactNode;
};

const toneClass: Record<ContentSectionTone, string> = {
  muted: styles.elegTuDeporte,
  white: styles.novedadesDeCalzado,
};

const ContentSection: FunctionComponent<ContentSectionProps> = ({ tone, children }) => {
  return <div className={toneClass[tone]}>{children}</div>;
};

export default ContentSection;
