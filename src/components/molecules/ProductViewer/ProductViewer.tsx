import { useId } from 'react';
import type { SwatchColor } from '../../atoms/ColorSwatch/ColorSwatch';
import { productColors } from '../../../data/productColors';
import styles from './ProductViewer.module.css';

type Props = { name: string; image?: string; featured?: boolean; color?: SwatchColor; baseColor?: SwatchColor };

/** Photographic color preview. The source photo is kept intact; SVG maps its
 * luminance to the selected concept color while preserving texture and alpha. */
export default function ProductViewer({ name, image, featured = false, color, baseColor }: Props) {
  const id = `product-color-${useId().replace(/:/g, '')}`;
  const tint = color && color !== baseColor ? productColors[color] : null;
  const darkSource = baseColor === 'black' || baseColor === 'onyx';
  const channels = tint ? tint.hex.match(/[a-f\d]{2}/gi)!.map(value => parseInt(value, 16) / 255) : [];
  const table = (channel: number) => [0, channel * .2, channel * .5, channel * .8, channel, Math.min(1, channel + .16)].join(' ');
  return <div className={`${styles.viewer} ${featured ? styles.featured : ''}`}>
    {!tint ? <img className={styles.photo} src={image} alt={`${name}${color ? `, color ${productColors[color].label.toLowerCase()}` : ''}`} loading="lazy" decoding="async" draggable={false} /> :
      <svg className={styles.photo} viewBox="0 0 1024 1024" role="img" aria-label={`${name}, color ${tint.label.toLowerCase()}`}>
        <defs><filter id={id} colorInterpolationFilters="sRGB" x="0" y="0" width="100%" height="100%">
          <feColorMatrix type="saturate" values="0" />
          <feComponentTransfer>
            <feFuncR type="gamma" amplitude="1" exponent={darkSource ? .4 : 1} offset="0" />
            <feFuncG type="gamma" amplitude="1" exponent={darkSource ? .4 : 1} offset="0" />
            <feFuncB type="gamma" amplitude="1" exponent={darkSource ? .4 : 1} offset="0" />
          </feComponentTransfer>
          <feComponentTransfer><feFuncR type="table" tableValues={table(channels[0])} /><feFuncG type="table" tableValues={table(channels[1])} /><feFuncB type="table" tableValues={table(channels[2])} /></feComponentTransfer>
        </filter></defs>
        <image href={image} width="1024" height="1024" filter={`url(#${id})`} />
      </svg>}
  </div>;
}
