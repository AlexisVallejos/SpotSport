import { FunctionComponent, ReactNode } from 'react';
import styles from './Text.module.css';

export type TextProps = {
  as?: 'div' | 'b';
  children: ReactNode;
};

const Text: FunctionComponent<TextProps> = ({ as: Tag = 'div', children }) => {
  return <Tag className={styles.searchPrompt}>{children}</Tag>;
};

export default Text;
