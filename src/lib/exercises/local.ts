import type { Exercise } from '../wger';

const ritmo = (id: number, name: string, category: number, muscles: string[], lines: string[], tip: string, easier: string): Exercise => ({ id, name, category, muscles, equipment: ['Sin equipo'], image: null, lines, tip, easier, source: 'ritmo' });

/** Rutinas de Ritmo-Vida con análisis de postura. Siempre disponibles, aunque wger no responda. */
export const LOCAL_EXERCISES: Exercise[] = [
  ritmo(-1, 'Sentadilla profunda', 9, ['Cuádriceps', 'Glúteos'], ['Pies al ancho de caderas, puntas apenas abiertas.', 'Llevá las caderas atrás y abajo.', 'Bajá manteniendo el pecho arriba.', 'Subí empujando con talones.'], 'Las rodillas acompañan la dirección de los pies.', 'Bajá hasta un rango cómodo.'),
  ritmo(-2, 'Estocadas', 9, ['Cuádriceps', 'Glúteos'], ['Da un paso largo hacia adelante.', 'Bajá la rodilla trasera cerca del piso.', 'Volvé y alterná piernas.'], 'Mantené el torso vertical.', 'Sujetate de una pared.'),
  ritmo(-3, 'Flexiones de brazos', 11, ['Pecho', 'Tríceps'], ['Manos al ancho de hombros.', 'Formá una línea recta de talones a cabeza.', 'Bajá el pecho hacia el piso con los codos cerca del cuerpo.', 'Empujá hasta extender los brazos.'], 'Priorizá técnica antes que velocidad.', 'Hacelas desde rodillas.'),
  ritmo(-4, 'Plancha abdominal', 10, ['Abdomen'], ['Apoyá antebrazos y puntas de los pies.', 'Mantené cabeza, caderas y talones en una línea.', 'Sostené 30 segundos sin dejar caer la cadera.'], 'Contraé el abdomen todo el tiempo.', 'Apoyá las rodillas.'),
  ritmo(-5, 'Plancha lateral', 10, ['Oblicuos', 'Abdomen'], ['Apoyá antebrazo y codo debajo del hombro.', 'Elevá caderas hasta formar una línea recta.', 'Sostené y repetí del otro lado.'], 'No dejes caer la cadera.', 'Apoyá las rodillas.'),
  ritmo(-6, 'Puente de glúteo', 9, ['Glúteos', 'Isquiotibiales'], ['Acostate boca arriba con las rodillas flexionadas.', 'Pies firmes en el piso.', 'Empujá con talones y elevá caderas.', 'Contraé glúteos arriba y bajá controlado.'], 'No hiperextiendas la espalda.', 'Reducí el rango de movimiento.'),
  ritmo(-7, 'Levantamiento de piernas', 10, ['Abdomen'], ['Acostate con las palmas apoyadas al costado.', 'Subí ambas piernas hasta 90 grados.', 'Bajá lento sin apoyar los pies.'], 'Mantené la espalda baja cerca del piso.', 'Flexioná ligeramente las rodillas.'),
  ritmo(-8, 'Patada de glúteo', 9, ['Glúteos'], ['En cuadrupedia, alineá manos y hombros.', 'Elevá una pierna doblada a 90 grados.', 'Contraé arriba y bajá sin tocar el piso.', 'Cambiá de pierna al terminar.'], 'El movimiento es pequeño y controlado.', 'Reducí el rango.'),
];
