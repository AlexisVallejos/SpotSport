import type { RuleId } from '../lib/pose/rules';

/** Fotos de Wikimedia Commons para los ejercicios con análisis de postura. Licencias libres: se acredita a cada autor. */
export type TrainingPhoto = { src: string; author: string; license: string; source: string; position?: string };

export const TRAINING_PHOTOS: Record<RuleId, TrainingPhoto> = {
  squat: { src: '/images/entrenar/squat.jpg', author: 'Taco Fleur', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:Racked_Overhead_Kettlebell_Squat_4_Side-on_Full.jpg', position: '62% 60%' },
  lunge: { src: '/images/entrenar/lunge.jpg', author: 'Tyler Read', license: 'CC BY 2.0', source: 'https://commons.wikimedia.org/wiki/File:Dumbbell_lunges.jpg', position: '50% 35%' },
  pushup: { src: '/images/entrenar/pushup.jpg', author: 'Jaykayfit', license: 'CC BY-SA 3.0', source: 'https://commons.wikimedia.org/wiki/File:Plank.jpg', position: '60% 70%' },
  plank: { src: '/images/entrenar/plank.jpg', author: 'PTPioneer', license: 'CC BY 2.0', source: 'https://commons.wikimedia.org/wiki/File:Personal_training_plank_exercise_instruction.jpg', position: '40% 70%' },
  sidePlank: { src: '/images/entrenar/sidePlank.jpg', author: 'Jaykayfit', license: 'CC BY-SA 3.0', source: 'https://commons.wikimedia.org/wiki/File:Side_Plank.jpg', position: '50% 12%' },
  bridge: { src: '/images/entrenar/bridge.png', author: 'Marianne Gilbak', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:Glute-bridge.png', position: '60% 18%' },
  legRaise: { src: '/images/entrenar/legRaise.jpg', author: 'Shixart1985', license: 'CC BY 2.0', source: 'https://commons.wikimedia.org/wiki/File:Woman_performing_leg_raises_in_a_bright_workout_studio.jpg', position: '55% 45%' },
  kick: { src: '/images/entrenar/kick.jpg', author: 'PTPioneer', license: 'CC BY 2.0', source: 'https://commons.wikimedia.org/wiki/File:Bird_dog_exercise.jpg', position: '55% 55%' },
};
