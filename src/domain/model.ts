import { z } from 'zod';

export const workoutIds = ['A', 'B', 'C', 'D'] as const;
export type WorkoutId = (typeof workoutIds)[number];
export const exerciseCategories = [
  'Chest',
  'Back',
  'Shoulders',
  'Arms',
  'Legs',
  'Core',
  'Cardio',
  'Other',
] as const;
export type ExerciseCategory = (typeof exerciseCategories)[number];
const id = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-zA-Z0-9_-]+$/);
const date = z.iso.datetime();
const tags = z.array(z.string().trim().min(1).max(80)).max(20);
export const exerciseSchema = z.object({
  id,
  name: z.string().trim().min(1).max(120),
  legacyNames: tags,
  type: z.enum(['strength', 'cardio']),
  category: z.enum(exerciseCategories).optional(),
  primaryMuscles: tags,
  secondaryMuscles: tags,
  movementPattern: z.string().max(80),
  equipmentType: z.string().max(80),
  equipmentVariant: z.string().max(120).nullable(),
  gymZone: z.string().max(80).nullable(),
  notes: z.string().max(4000),
  availability: z.enum(['available', 'archived']),
  rotationPolicy: z.enum(['staple', 'rotatable', 'undecided']),
  finisherEligible: z.boolean(),
  createdAt: date,
  updatedAt: date,
});
export type Exercise = z.infer<typeof exerciseSchema>;
const placementSchema = z.object({
  exerciseId: id,
  workoutId: z.enum(workoutIds),
  position: z.number().int().min(0).max(4),
});
const episodeSchema = z.object({
  id,
  exerciseId: id,
  startedAt: date.nullable(),
  observedActiveAt: z.iso.date().nullable(),
  endedAt: date.nullable(),
});
const eventSchema = z.object({
  id,
  at: date,
  kind: z.enum([
    'seed',
    'reorder',
    'move',
    'swap',
    'add',
    'remove',
    'edit',
    'archive',
    'restore',
    'undo',
    'import',
    'settings',
  ]),
  description: z.string().min(1).max(1000),
  exerciseIds: z.array(id).max(500),
  before: z.array(placementSchema).max(20),
  after: z.array(placementSchema).max(20),
});
export type RotationEvent = z.infer<typeof eventSchema>;
export const workspaceSchema = z
  .object({
    schemaVersion: z.literal(1),
    revision: z.number().int().nonnegative(),
    updatedAt: date,
    exercises: z.array(exerciseSchema).min(1).max(500),
    placements: z.array(placementSchema).max(20),
    episodes: z.array(episodeSchema).max(5000),
    events: z.array(eventSchema).max(3000),
    reviewWeeks: z.number().int().min(8).max(52),
  })
  .superRefine((s, ctx) => {
    const issue = (message: string) => ctx.addIssue({ code: 'custom', message });
    const unique = (xs: string[]) => new Set(xs).size === xs.length;
    if (
      !unique(s.exercises.map((e) => e.id)) ||
      !unique(s.episodes.map((e) => e.id)) ||
      !unique(s.events.map((e) => e.id))
    )
      issue('Duplicate record IDs.');
    if (!unique(s.placements.map((p) => p.exerciseId)))
      issue('An exercise can appear only once in the rotation.');
    const exercises = new Map(s.exercises.map((e) => [e.id, e]));
    for (const p of s.placements) {
      const e = exercises.get(p.exerciseId);
      if (!e || e.type !== 'strength' || e.availability !== 'available')
        issue('Placements must reference available strength exercises.');
    }
    for (const w of workoutIds) {
      const ps = s.placements
        .filter((p) => p.workoutId === w)
        .sort((a, b) => a.position - b.position);
      if (ps.length > 5 || ps.some((p, i) => p.position !== i))
        issue('Workout positions must be consecutive with at most five exercises.');
    }
    const active = s.episodes.filter((e) => e.endedAt === null);
    if (
      !unique(active.map((e) => e.exerciseId)) ||
      active.length !== s.placements.length ||
      active.some((e) => !s.placements.some((p) => p.exerciseId === e.exerciseId))
    )
      issue('Active membership episodes must match current placements.');
    for (const ep of s.episodes) {
      if (!exercises.has(ep.exerciseId)) issue('History references an unknown exercise.');
      if (ep.startedAt && ep.endedAt && ep.endedAt < ep.startedAt)
        issue('Membership cannot end before it begins.');
      if (!ep.startedAt && !ep.observedActiveAt)
        issue('Unknown start dates need an observation date.');
    }
    for (const ev of s.events) {
      if (
        ev.exerciseIds.some((x) => !exercises.has(x)) ||
        [...ev.before, ...ev.after].some((p) => !exercises.has(p.exerciseId))
      )
        issue('Events reference unknown exercises.');
    }
  });
export type Workspace = z.infer<typeof workspaceSchema>;
export type Placement = Workspace['placements'][number];
export const MAX_WORKSPACE_BYTES = 750_000;
export function validateWorkspace(value: unknown): Workspace {
  const state = workspaceSchema.parse(value);
  if (new TextEncoder().encode(JSON.stringify(state)).length > MAX_WORKSPACE_BYTES)
    throw new Error(
      'The library is approaching its storage limit. Export a backup before continuing; history needs to be moved to a separate collection.',
    );
  return state;
}
export const byWorkout = (s: Workspace, id: WorkoutId) =>
  s.placements.filter((p) => p.workoutId === id).sort((a, b) => a.position - b.position);
export const placementOf = (s: Workspace, id: string) =>
  s.placements.find((p) => p.exerciseId === id);
export function normalize(s: Workspace) {
  s.placements = workoutIds.flatMap((w) =>
    byWorkout(s, w).map((p, position) => ({ ...p, position })),
  );
}
