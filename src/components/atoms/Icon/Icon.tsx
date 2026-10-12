import { FunctionComponent, ReactElement } from 'react';
import {
  ArrowDown,
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Camera,
  LucideIcon,
  Menu,
  Plus,
  Search,
  ShoppingBag,
  UserRound,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import styles from './Icon.module.css';

export type IconName =
  | 'arrowDown'
  | 'arrowDownRight'
  | 'arrowLeft'
  | 'arrowRight'
  | 'arrowUpRight'
  | 'camera'
  | 'menu'
  | 'plus'
  | 'search'
  | 'shoppingBag'
  | 'userRound'
  | 'volume'
  | 'volumeOff'
  | 'x'
  | 'instagram'
  | 'youtube';

export type IconSize = 16 | 18 | 20 | 24;

export type IconProps = {
  name: IconName;
  size?: IconSize;
};

const sizeClass: Record<IconSize, string> = {
  16: styles.plusIcon,
  18: styles.searchIcon,
  20: styles.userRoundIcon,
  24: styles.arrowDownRightIcon,
};

const lucideIcons: Record<Exclude<IconName, 'instagram' | 'youtube'>, LucideIcon> = {
  arrowDown: ArrowDown,
  arrowDownRight: ArrowDownRight,
  arrowLeft: ArrowLeft,
  arrowRight: ArrowRight,
  arrowUpRight: ArrowUpRight,
  camera: Camera,
  menu: Menu,
  plus: Plus,
  search: Search,
  shoppingBag: ShoppingBag,
  userRound: UserRound,
  volume: Volume2,
  volumeOff: VolumeX,
  x: X,
};

// lucide-react ya no incluye íconos de marcas; estos replican el trazo de lucide.
const brandPaths: Record<'instagram' | 'youtube', ReactElement> = {
  instagram: (
    <>
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </>
  ),
  youtube: (
    <>
      <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
      <path d="m10 15 5-3-5-3z" />
    </>
  ),
};

const Icon: FunctionComponent<IconProps> = ({ name, size = 20 }) => {
  const className = sizeClass[size];

  if (name === 'instagram' || name === 'youtube') {
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {brandPaths[name]}
      </svg>
    );
  }

  const LucideComponent = lucideIcons[name];
  return <LucideComponent className={className} size={size} aria-hidden="true" />;
};

export default Icon;
