import { FunctionComponent } from 'react';
import { Link } from 'react-router-dom';
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
  const target = href ?? (variant === 'hero' || variant === 'light' ? '#deportes' : '#calzado');
  const className = `${styles.base} ${variantClass[variant]}`;
  const content = (
    <>
      <Label>{label}</Label>
      <Icon name="arrowRight" />
    </>
  );
  // Las rutas internas navegan sin recargar; los anclajes de la landing siguen siendo enlaces comunes.
  return target.startsWith('/') ? (
    <Link to={target} className={className}>
      {content}
    </Link>
  ) : (
    <a href={target} className={className}>
      {content}
    </a>
  );
};

export default ActionButton;
