import { FunctionComponent, ReactNode } from 'react';
import styles from './LandingTemplate.module.css';

export type LandingTemplateProps = {
  intro?: ReactNode;
  cover: ReactNode;
  footer: ReactNode;
  children: ReactNode;
};

const LandingTemplate: FunctionComponent<LandingTemplateProps> = ({ intro, cover, footer, children }) => {
  return (
    <div className={styles.spotTodoElDeporte}>
      <a className="skip-to-content" href="#contenido">Saltar al contenido</a>
      <div className="reading-progress" aria-hidden="true" />
      {intro}
      {cover}
      <main id="contenido" className={styles.main}>{children}</main>
      {footer}
    </div>
  );
};

export default LandingTemplate;
