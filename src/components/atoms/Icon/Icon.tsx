import { FunctionComponent } from 'react';
import styles from './Icon.module.css';

export type IconSize = 16 | 18 | 20 | 24;

export type IconProps = {
  size?: IconSize;
  src?: string;
};

const sizeClass: Record<IconSize, string> = {
  16: styles.plusIcon,
  18: styles.searchIcon,
  20: styles.userRoundIcon,
  24: styles.arrowDownRightIcon,
};

const Icon: FunctionComponent<IconProps> = ({ size = 20, src }) => {
  return <img className={sizeClass[size]} src={src} alt="" />;
};

export default Icon;
