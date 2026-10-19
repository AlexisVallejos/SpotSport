import type { Landmarks, Point } from './geometry';
import type { Triple } from './rules';

// What is drawn over the camera. The video is shown mirrored (like a mirror, so moving right moves right on
// screen); the canvas is not, so x is flipped here and the angle labels read the right way round.

/** Body only: the face points and the fingers add noise, not information. */
const BONES: [number, number][] = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [27, 31], [24, 26], [26, 28], [28, 32],
];
const JOINTS = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];

const OK = '#3ddc84';
const BAD = '#ff3b30';
const ACCENT = '#ff7900';
const SEEN = 0.5;

export type OverlayInput = {
  lm: Landmarks | null;
  /** Landmarks failing a check right now: red. */
  failing: number[];
  /** True while a rule is judging the body (green joints); false just shows it (orange). */
  judged: boolean;
  /** The angle being counted, its value, and whether it reached the depth of a repetition. */
  measured: Triple | null;
  degrees: number | null;
  reached: boolean;
  /** Draws where to stand while the person is not framed yet. */
  guide: boolean;
};

const seen = (lm: Landmarks, index: number) => !!lm[index] && (lm[index].visibility ?? 1) >= SEEN;

function guide(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const x0 = width * 0.24;
  const x1 = width * 0.76;
  const y0 = height * 0.05;
  const y1 = height * 0.95;
  const arm = Math.min(width, height) * 0.08;
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.lineWidth = Math.max(3, width / 320);
  ctx.lineCap = 'round';
  for (const [x, y, dx, dy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]]) {
    ctx.beginPath();
    ctx.moveTo(x, y + dy * arm);
    ctx.lineTo(x, y);
    ctx.lineTo(x + dx * arm, y);
    ctx.stroke();
  }
  ctx.restore();
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string) {
  ctx.save();
  ctx.font = `800 ${size}px "Barlow Condensed", Inter, sans-serif`;
  const w = ctx.measureText(text).width + size * 0.6;
  const h = size * 1.15;
  ctx.fillStyle = 'rgba(8, 8, 8, 0.78)';
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - h / 2, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + size * 0.04);
  ctx.restore();
}

export function drawOverlay(ctx: CanvasRenderingContext2D, width: number, height: number, input: OverlayInput) {
  ctx.clearRect(0, 0, width, height);
  const { lm } = input;
  if (input.guide) guide(ctx, width, height);
  if (!lm) return;

  const p = (index: number) => ({ x: (1 - lm[index].x) * width, y: lm[index].y * height });
  const bad = new Set(input.failing);
  const focus = new Set(input.measured ?? []);
  const line = Math.max(3, width / 240);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Bones: white; the ones of the counted angle in the accent color; red when a joint at either end fails.
  for (const [a, b] of BONES) {
    if (!seen(lm, a) || !seen(lm, b)) continue;
    const from = p(a);
    const to = p(b);
    const counted = focus.has(a) && focus.has(b);
    ctx.strokeStyle = bad.has(a) || bad.has(b) ? BAD : counted ? (input.reached ? OK : ACCENT) : 'rgba(255, 255, 255, 0.82)';
    ctx.lineWidth = counted ? line * 1.6 : line;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  }

  // Head: a circle the size of the shoulders, so the figure reads as a person and not a stick.
  if (seen(lm, 0) && seen(lm, 11) && seen(lm, 12)) {
    const nose = p(0);
    const radius = Math.max(width / 60, Math.hypot(p(11).x - p(12).x, p(11).y - p(12).y) * 0.32);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.82)';
    ctx.lineWidth = line;
    ctx.beginPath();
    ctx.arc(nose.x, nose.y, radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  for (const index of JOINTS) {
    if (!seen(lm, index)) continue;
    const { x, y } = p(index);
    const failing = bad.has(index);
    if (failing) {
      ctx.fillStyle = 'rgba(255, 59, 48, 0.28)';
      ctx.beginPath();
      ctx.arc(x, y, width / 40, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = failing ? BAD : input.judged ? OK : ACCENT;
    ctx.beginPath();
    ctx.arc(x, y, failing ? width / 90 : width / 150, 0, Math.PI * 2);
    ctx.fill();
  }

  // The counted angle: an arc at its vertex and its value in degrees.
  if (input.measured && input.degrees !== null && input.measured.every((index) => seen(lm, index))) {
    const [a, b, c] = input.measured.map(p) as [Point, Point, Point];
    const start = Math.atan2(a.y - b.y, a.x - b.x);
    let end = Math.atan2(c.y - b.y, c.x - b.x);
    let delta = end - start;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    end = start + delta;
    const radius = Math.max(width / 30, Math.min(Math.hypot(a.x - b.x, a.y - b.y), Math.hypot(c.x - b.x, c.y - b.y)) * 0.35);
    const color = input.reached ? OK : ACCENT;
    ctx.fillStyle = input.reached ? 'rgba(61, 220, 132, 0.22)' : 'rgba(255, 121, 0, 0.2)';
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.arc(b.x, b.y, radius, start, end, delta < 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = line;
    ctx.beginPath();
    ctx.arc(b.x, b.y, radius, start, end, delta < 0);
    ctx.stroke();
    // The label goes on the outside of the angle, opposite its opening.
    const middle = start + delta / 2 + Math.PI;
    const distance = radius + width / 28;
    label(ctx, `${Math.round(input.degrees)}°`, b.x + Math.cos(middle) * distance, b.y + Math.sin(middle) * distance, Math.max(18, width / 34), color);
  }
}
