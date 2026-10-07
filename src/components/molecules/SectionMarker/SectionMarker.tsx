import { FunctionComponent } from 'react';
import { Label, Marker } from '../../atoms';
import styles from './SectionMarker.module.css';

export type SectionMarkerVariant = 'default' | 'light' | 'kit';

export type SectionMarkerProps = {
  label: string;
  variant?: SectionMarkerVariant;
};

const variantClass: Record<SectionMarkerVariant, string> = {
  default: styles.sectionMarker,
  light: styles.sectionMarker3,
  kit: styles.sectionMarker6,
};

const SectionMarker: FunctionComponent<SectionMarkerProps> = ({ label, variant = 'default' }) => {
  return (
    <div className={variantClass[variant]}>
      <Marker />
      <Label>{label}</Label>
    </div>
  );
};

export default SectionMarker;
