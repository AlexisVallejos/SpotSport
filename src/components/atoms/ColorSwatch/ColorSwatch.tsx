import { CSSProperties, FunctionComponent } from 'react';
import { productColors } from '../../../data/productColors';
import styles from './ColorSwatch.module.css';

export type SwatchColor =
  | 'ivory'
  | 'orange'
  | 'charcoal'
  | 'black'
  | 'grey'
  | 'white'
  | 'sand'
  | 'graphite'
  | 'steel'
  | 'bone'
  | 'onyx'
  | 'ash'
  | 'stone';

export type ColorSwatchProps = {
  color: SwatchColor;
  selected?: boolean;
  onSelect?: () => void;
};

const ColorSwatch: FunctionComponent<ColorSwatchProps> = ({ color, selected, onSelect }) => {
  const { label, hex } = productColors[color];
  return <button type="button" className={styles.swatch} style={{ '--swatch-color': hex } as CSSProperties} aria-label={`Color ${label.toLowerCase()}`} title={label} aria-pressed={selected} onClick={onSelect}><span /></button>;
};

export default ColorSwatch;
