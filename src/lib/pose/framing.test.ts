import { describe, expect, it } from 'vitest';
import { CENTER, checkFraming, CLOSER, missingParts, NO_PERSON, STEP_BACK } from './framing';
import { JOINTS, type Landmarks } from './geometry';

const REQUIRED = [JOINTS.left.shoulder, JOINTS.left.hip, JOINTS.left.knee, JOINTS.left.ankle];

/** A standing body from `top` to `bottom`, centered on `x`. */
function body(top = 0.1, bottom = 0.9, x = 0.5): Landmarks {
  const h = bottom - top;
  return Array.from({ length: 33 }, (_, index) => {
    const y = index < 11 ? top : index < 23 ? top + h * 0.25 : index < 25 ? top + h * 0.5 : index < 27 ? top + h * 0.75 : bottom;
    return { x, y, visibility: 0.95 };
  });
}

describe('checkFraming', () => {
  it('is happy with the whole body in the picture', () => {
    expect(checkFraming(body(), REQUIRED, 0.6)).toEqual({ ok: true, message: '', missing: [] });
  });

  it('says it sees nobody when there is no body', () => {
    expect(checkFraming(null, REQUIRED, 0.6)).toMatchObject({ ok: false, message: NO_PERSON });
  });

  it('asks to step back when the feet are cut by the bottom edge', () => {
    const lm = body(0.2, 1.05);
    lm[JOINTS.left.ankle].visibility = 0.2;
    lm[JOINTS.right.ankle].visibility = 0.2;
    lm[JOINTS.left.knee].y = 0.99;
    expect(checkFraming(lm, REQUIRED, 0.6)).toMatchObject({ ok: false, message: STEP_BACK, missing: ['pies'] });
  });

  it('asks to move to the center when the body is cut by a side', () => {
    const lm = body(0.1, 0.9, 0.99);
    lm[JOINTS.left.knee].visibility = 0.3;
    expect(checkFraming(lm, REQUIRED, 0.6).message).toBe(CENTER);
  });

  it('asks to come closer when the body is tiny and blurry', () => {
    const lm = body(0.4, 0.62);
    lm[JOINTS.left.ankle].visibility = 0.4;
    expect(checkFraming(lm, REQUIRED, 0.6).message).toBe(CLOSER);
  });
});

describe('missingParts', () => {
  it('names the parts it cannot see, head to toe', () => {
    const lm = body();
    lm[JOINTS.left.ankle].visibility = 0.1;
    lm[JOINTS.left.shoulder].visibility = 0.1;
    expect(missingParts(lm, REQUIRED, 0.6)).toEqual(['hombros', 'pies']);
  });
});
