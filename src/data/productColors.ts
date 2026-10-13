import type { SwatchColor } from '../components/atoms/ColorSwatch/ColorSwatch';

export const productColors: Record<SwatchColor, { label: string; hex: string }> = {
  ivory: { label: 'Marfil', hex: '#e8e2d4' },
  orange: { label: 'Naranja', hex: '#ff7900' },
  charcoal: { label: 'Carbón', hex: '#343633' },
  black: { label: 'Negro', hex: '#242623' },
  grey: { label: 'Gris', hex: '#878a83' },
  white: { label: 'Blanco', hex: '#eeeee8' },
  sand: { label: 'Arena', hex: '#d6cbb7' },
  graphite: { label: 'Grafito', hex: '#454943' },
  steel: { label: 'Acero', hex: '#a7a9b2' },
  bone: { label: 'Hueso', hex: '#e7e6df' },
  onyx: { label: 'Ónix', hex: '#282a27' },
  ash: { label: 'Ceniza', hex: '#96998f' },
  stone: { label: 'Piedra', hex: '#c9ccc4' },
};
