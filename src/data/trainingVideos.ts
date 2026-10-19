import type { RuleId } from '../lib/pose/rules';

/**
 * Videos de técnica: el mismo maniquí 3D de la demo (mismos ángulos que acepta el analizador), renderizado cuadro a
 * cuadro con HyperFrames. 6,8 s en loop perfecto, sin texto: las indicaciones las pone la interfaz encima.
 */
export const videoFor = (id: RuleId) => ({ src: `/video/entrenar/${id}.mp4`, poster: `/video/entrenar/${id}.jpg` });
