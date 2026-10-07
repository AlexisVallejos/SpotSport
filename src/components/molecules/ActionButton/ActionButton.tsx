import { FunctionComponent } from 'react';
import { Icon, Label } from '../../atoms';
import styles from './ActionButton.module.css';

export type ActionButtonVariant = 'hero' | 'campaign' | 'kit' | 'light';

export type ActionButtonProps = {
  label: string;
  variant: ActionButtonVariant;
};

const variantClass: Record<ActionButtonVariant, string> = {
  hero: styles.action,
  campaign: styles.action2,
  kit: styles.action4,
  light: styles.action5,
};

const ActionButton: FunctionComponent<ActionButtonProps> = ({ label, variant }) => {
  return (
    <button type="button" className={`${styles.base} ${variantClass[variant]}`}>
      <Label>{label}</Label>
      <Icon name="arrowRight" />
    </button>
  );
};

export default ActionButton;
