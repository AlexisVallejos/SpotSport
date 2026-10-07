import { FunctionComponent, ReactNode } from 'react';
import styles from './Label.module.css';

export type LabelProps = {
  children: ReactNode;
};

const Label: FunctionComponent<LabelProps> = ({ children }) => {
  return <div className={styles.label}>{children}</div>;
};

export default Label;
