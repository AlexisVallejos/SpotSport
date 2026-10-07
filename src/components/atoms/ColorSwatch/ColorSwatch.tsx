import { FunctionComponent } from 'react';
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
};

const colorClass: Record<SwatchColor, string> = {
  ivory: styles.colorOption,
  orange: styles.colorOption2,
  charcoal: styles.colorOption3,
  black: styles.colorOption4,
  grey: styles.colorOption5,
  white: styles.colorOption7,
  sand: styles.colorOption8,
  graphite: styles.colorOption9,
  steel: styles.colorOption10,
  bone: styles.colorOption11,
  onyx: styles.colorOption12,
  ash: styles.colorOption15,
  stone: styles.colorOption18,
};

const ColorSwatch: FunctionComponent<ColorSwatchProps> = ({ color }) => {
  return <div className={colorClass[color]} />;
};

export default ColorSwatch;
