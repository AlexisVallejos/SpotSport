import type { Landmarks, Point } from './geometry';

// MediaPipe's points shake a few pixels even when the person stands still: the skeleton trembles and angles jump.
// The One Euro filter (Casiez et al., 2012) smooths a lot when a point is still and almost nothing when it moves
// fast, so it removes the jitter without lagging behind the real movement.

/** Hz: lower is smoother at rest. */
const MIN_CUTOFF = 1.2;
/** How much the filter opens up with speed (image units per second). */
const BETA = 4;
const D_CUTOFF = 1;
/** Visibility is a moving average, so one doubtful frame does not switch a joint off. */
const VISIBILITY_ALPHA = 0.35;
/** Without a body for longer than this, start over: it is probably another person or another position. */
const RESET_AFTER_MS = 500;
/** A jump this big in one frame is not movement but a new detection: take it as is. */
const TELEPORT = 0.25;

const alpha = (cutoff: number, dt: number) => 1 / (1 + 1 / (2 * Math.PI * cutoff * dt));

type Channel = { value: number; speed: number };

function step(channel: Channel, raw: number, dt: number): number {
  const speed = (raw - channel.value) / dt;
  channel.speed += alpha(D_CUTOFF, dt) * (speed - channel.speed);
  channel.value += alpha(MIN_CUTOFF + BETA * Math.abs(channel.speed), dt) * (raw - channel.value);
  return channel.value;
}

type Track = { x: Channel; y: Channel; z: Channel; visibility: number };

const fresh = (point: Point): Track => ({
  x: { value: point.x, speed: 0 },
  y: { value: point.y, speed: 0 },
  z: { value: point.z ?? 0, speed: 0 },
  visibility: point.visibility ?? 1,
});

const read = (track: Track): Point => ({ x: track.x.value, y: track.y.value, z: track.z.value, visibility: track.visibility });

export type LandmarkSmoother = { smooth: (lm: Landmarks | null, now: number) => Landmarks | null; reset: () => void };

/** Smooths the pose frame by frame. `now` in milliseconds. */
export function createSmoother(): LandmarkSmoother {
  let tracks: Track[] = [];
  let last: number | null = null;

  function reset() {
    tracks = [];
    last = null;
  }

  function smooth(lm: Landmarks | null, now: number): Landmarks | null {
    if (!lm) {
      if (last !== null && now - last > RESET_AFTER_MS) reset();
      return null;
    }
    if (last === null || now - last > RESET_AFTER_MS || tracks.length !== lm.length) {
      tracks = lm.map(fresh);
      last = now;
      return tracks.map(read);
    }
    const dt = Math.max(1, now - last) / 1000;
    last = now;
    tracks = tracks.map((track, index) => {
      const point = lm[index];
      if (Math.hypot(point.x - track.x.value, point.y - track.y.value) > TELEPORT) return fresh(point);
      step(track.x, point.x, dt);
      step(track.y, point.y, dt);
      step(track.z, point.z ?? 0, dt);
      track.visibility += VISIBILITY_ALPHA * ((point.visibility ?? 1) - track.visibility);
      return track;
    });
    return tracks.map(read);
  }

  return { smooth, reset };
}
