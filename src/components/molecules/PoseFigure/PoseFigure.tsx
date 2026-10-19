import { FunctionComponent, useMemo } from 'react';
import { figureAt, type Figure, type Limbs, type Pt } from '../../../lib/pose/demo';
import type { RuleId } from '../../../lib/pose/rules';
import styles from './PoseFigure.module.css';

const HEAD = 0.11;
const PAD = 0.14;

const bones = (side: Limbs): [Pt, Pt][] => [
  [side.shoulder, side.elbow],
  [side.elbow, side.wrist],
  [side.shoulder, side.hip],
  [side.hip, side.knee],
  [side.knee, side.ankle],
  [side.ankle, side.toe],
];

const points = (figure: Figure) => [figure.head, ...Object.values(figure.left), ...Object.values(figure.right)];

/** The exercise drawn with the same figures as the 3D demo: the start position faint, the hardest point solid. */
const PoseFigure: FunctionComponent<{ id: RuleId; className?: string }> = ({ id, className }) => {
  const { start, peak, box } = useMemo(() => {
    const start = figureAt(id, 0);
    const peak = figureAt(id, 1);
    const all = [...points(start), ...points(peak)];
    const xs = all.map((point) => point.x);
    const ys = all.map((point) => point.y);
    const minX = Math.min(...xs) - PAD;
    const maxX = Math.max(...xs) + PAD;
    const maxY = Math.max(...ys) + PAD;
    return { start, peak, box: { minX, maxY, width: maxX - minX, height: maxY + 0.04 } };
  }, [id]);

  // SVG y grows downward; the figures have y up from the floor.
  const x = (point: Pt) => point.x - box.minX;
  const y = (point: Pt) => box.maxY - point.y;
  const draw = (tone: 'ghost' | 'far' | 'near', side: Limbs) =>
    bones(side).map(([a, b], index) => <line key={`${tone}${index}`} className={styles[tone]} x1={x(a)} y1={y(a)} x2={x(b)} y2={y(b)} />);

  return (
    <svg className={`${styles.figure} ${className ?? ''}`} viewBox={`0 0 ${box.width} ${box.height}`} preserveAspectRatio="xMidYMax meet" aria-hidden="true">
      <line className={styles.floor} x1={0} y1={box.maxY} x2={box.width} y2={box.maxY} />
      {draw('ghost', start.right)}
      {draw('ghost', start.left)}
      <circle className={styles.ghost} cx={x(start.head)} cy={y(start.head)} r={HEAD} />
      {draw('far', peak.right)}
      {draw('near', peak.left)}
      <circle className={styles.head} cx={x(peak.head)} cy={y(peak.head)} r={HEAD} />
    </svg>
  );
};

export default PoseFigure;
