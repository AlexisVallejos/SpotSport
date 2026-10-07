import { FunctionComponent } from 'react';
import { Icon, Label } from '../../atoms';
import styles from './ActionButton.module.css';

export type ActionButtonVariant = 'hero' | 'campaign' | 'kit' | 'light';

export type ActionButtonProps = {
  label: string;
  variant: ActionButtonVariant;
  href?: string;
};

const variantClass: Record<ActionButtonVariant, string> = {
  hero: styles.action,
  campaign: styles.action2,
  kit: styles.action4,
  light: styles.action5,
};

const ActionButton: FunctionComponent<ActionButtonProps> = ({ label, variant, href }) => {
  return (
    <a href={href ?? (variant === 'hero' || variant === 'light' ? '#deportes' : '#calzado')} className={`${styles.base} ${variantClass[variant]}`}>
      <Label>{label}</Label>
      <Icon name="arrowRight" />
    </a>
  );
};

export default ActionButton;
