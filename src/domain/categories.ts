import type { Exercise, ExerciseCategory } from './model';

// Old workspaces and backups need no migration or write to gain category labels.
export function categoryOf(exercise: Exercise): ExerciseCategory {
  if (exercise.type === 'cardio') return 'Cardio';
  if (exercise.category) return exercise.category;
  const muscles = exercise.primaryMuscles.join(' ').toLowerCase();
  if (/chest|pec/.test(muscles)) return 'Chest';
  if (/delt|shoulder/.test(muscles)) return 'Shoulders';
  if (/back|lat\b|lats|erector|posterior chain/.test(muscles)) return 'Back';
  if (/biceps|triceps|arms|forearm/.test(muscles)) return 'Arms';
  if (/quad|glute|hip|hamstring|calf|calves|leg/.test(muscles)) return 'Legs';
  if (/core|abs|abdom/.test(muscles)) return 'Core';
  return 'Other';
}

export function equipmentKind(value: string): 'Machine' | 'Free weights' | '' {
  if (/machine|cable|plate.loaded|stairmaster/i.test(value)) return 'Machine';
  if (/dumbbell|barbell|free weights/i.test(value)) return 'Free weights';
  return '';
}
