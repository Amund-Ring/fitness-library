import type { Exercise, Workspace, WorkoutId } from './model';

const rows: [string, string[], string, string][] = [
  ['Lat Pulldown Machine', ['Back / lats'], 'Vertical pull', 'Machine'],
  ['Abdominal Crunch Machine', ['Core / abs'], 'Trunk flexion', 'Machine'],
  ['Hip Abduction Machine', ['Hip abductors / glute medius'], 'Hip abduction', 'Machine'],
  ['Dumbbell Curl', ['Biceps'], 'Elbow flexion', 'Dumbbell'],
  ['Incline Bench Press', ['Chest / upper chest'], 'Horizontal push', ''],
  ['Pec Fly Machine', ['Chest'], 'Shoulder adduction', 'Machine'],
  ['Squat', ['Quads', 'Glutes'], 'Squat', ''],
  ['Lateral Raise', ['Side delts'], 'Shoulder abduction', ''],
  ['Seated Lever Row', ['Back / mid-back'], 'Horizontal pull', 'Machine'],
  ['Lying Hamstring Curl', ['Hamstrings'], 'Knee flexion', 'Machine'],
  ['Rear Delt Machine', ['Rear delts'], 'Shoulder horizontal abduction', 'Machine'],
  ['Back Extension', ['Spinal erectors / posterior chain'], 'Back extension', ''],
  ['Chest Press (Plate Loaded)', ['Chest'], 'Horizontal push', 'Plate-loaded machine'],
  ['Hip Thrust Machine', ['Glutes'], 'Hip extension', 'Machine'],
  ['Triceps Pushdown', ['Triceps'], 'Elbow extension', 'Cable'],
  ['Leg Extension', ['Quads'], 'Knee extension', 'Machine'],
  ['Overhead Press', ['Shoulders'], 'Vertical push', ''],
  ['Leg Press (Plate Loaded)', ['Quads', 'Glutes'], 'Leg press', 'Plate-loaded machine'],
  ['Biceps Curl Machine', ['Biceps'], 'Elbow flexion', 'Machine'],
  ['Seated Calf Raise', ['Calves'], 'Plantar flexion', ''],
  ['StairMaster', ['Cardio / lower body'], 'Cardio', 'StairMaster'],
  ['Rowing Machine', ['Cardio / full body'], 'Cardio', 'Rowing machine'],
];

export function createSeed(now = new Date().toISOString()): Workspace {
  const exercises: Exercise[] = rows.map(
    ([name, primaryMuscles, movementPattern, equipmentType], i) => ({
      id: `ex${String(i + 1).padStart(2, '0')}`,
      name,
      primaryMuscles,
      movementPattern,
      equipmentType,
      legacyNames: i === 1 ? ['Abdominal Extension'] : [],
      secondaryMuscles: [],
      type: i < 20 ? 'strength' : 'cardio',
      equipmentVariant: null,
      gymZone: null,
      notes: i === 20 ? 'Optional finisher. Occasional target: approximately 20 floors.' : '',
      availability: 'available',
      rotationPolicy: 'undecided',
      finisherEligible: i >= 20,
      createdAt: now,
      updatedAt: now,
    }),
  );
  const placements = exercises.slice(0, 20).map((e, i) => ({
    exerciseId: e.id,
    workoutId: ['A', 'B', 'C', 'D'][Math.floor(i / 5)] as WorkoutId,
    position: i % 5,
  }));
  return {
    schemaVersion: 1,
    revision: 0,
    updatedAt: now,
    exercises,
    placements,
    reviewWeeks: 14,
    episodes: placements.map((p) => ({
      id: `initial-${p.exerciseId}`,
      exerciseId: p.exerciseId,
      startedAt: null,
      observedActiveAt: '2026-11-07',
      endedAt: null,
    })),
    events: [
      {
        id: 'initial-import',
        at: now,
        kind: 'seed',
        description:
          'Original A–D rotation imported. Observed active on 7 November 2026; original start dates unknown.',
        exerciseIds: placements.map((p) => p.exerciseId),
        before: [],
        after: placements,
      },
    ],
  };
}
