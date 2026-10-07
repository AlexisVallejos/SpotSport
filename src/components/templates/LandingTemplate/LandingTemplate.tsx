import { FunctionComponent, ReactNode } from 'react';
import styles from './LandingTemplate.module.css';

export type LandingTemplateProps = {
  children: ReactNode;
};

const LandingTemplate: FunctionComponent<LandingTemplateProps> = ({ children }) => {
  return <div className={styles.spotTodoElDeporte}>{children}</div>;
};

export default LandingTemplate;
