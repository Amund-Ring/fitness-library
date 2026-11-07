import {
  byWorkout,
  normalize,
  placementOf,
  validateWorkspace,
  type Exercise,
  type Workspace,
  type WorkoutId,
  type RotationEvent,
} from './model';

export type Action =
  | {
      type: 'place';
      exerciseId: string;
      workoutId: WorkoutId;
      replaceId?: string;
      position?: number;
      confirmedStaple?: boolean;
      reason?: string;
    }
  | { type: 'remove'; exerciseId: string; confirmedStaple?: boolean; reason?: string }
  | { type: 'edit'; exercise: Exercise }
  | { type: 'archive'; exerciseId: string; confirmedStaple?: boolean }
  | { type: 'restore'; exerciseId: string }
  | { type: 'undo'; previous: Workspace }
  | { type: 'import'; imported: Workspace }
  | { type: 'settings'; reviewWeeks: number };

function protectStaple(s: Workspace, id: string, confirmed?: boolean) {
  if (s.exercises.find((e) => e.id === id)?.rotationPolicy === 'staple' && !confirmed)
    throw new Error('Confirm changing the placement of this staple exercise.');
}

export function applyAction(
  current: Workspace,
  action: Action,
  now = new Date().toISOString(),
): Workspace {
  let s = structuredClone(current);
  let kind: RotationEvent['kind'];
  let description = '';
  let ids: string[] = [];
  const exercise = (id: string) => {
    const e = s.exercises.find((e) => e.id === id);
    if (!e) throw new Error('Exercise not found.');
    return e;
  };
  switch (action.type) {
    case 'place': {
      const e = exercise(action.exerciseId);
      if (e.type !== 'strength' || e.availability !== 'available')
        throw new Error('Only available strength exercises can fill strength slots.');
      const source = placementOf(s, e.id);
      const target = byWorkout(s, action.workoutId);
      ids = [e.id];
      if (source?.workoutId === action.workoutId) {
        const ordered = target.filter((p) => p.exerciseId !== e.id);
        ordered.splice(
          Math.max(0, Math.min(action.position ?? target.length - 1, ordered.length)),
          0,
          source,
        );
        s.placements = s.placements
          .filter((p) => p.workoutId !== action.workoutId)
          .concat(ordered.map((p, position) => ({ ...p, position })));
        kind = 'reorder';
        description = `Reordered ${e.name} in Workout ${action.workoutId}.`;
      } else if (action.replaceId) {
        const replaced = exercise(action.replaceId);
        const destination = target.find((p) => p.exerciseId === replaced.id);
        if (!destination) throw new Error('Choose an exercise in the destination workout.');
        protectStaple(s, replaced.id, action.confirmedStaple);
        if (source) protectStaple(s, e.id, action.confirmedStaple);
        s.placements = s.placements.filter(
          (p) => p.exerciseId !== e.id && p.exerciseId !== replaced.id,
        );
        s.placements.push({ ...destination, exerciseId: e.id });
        if (source) s.placements.push({ ...source, exerciseId: replaced.id });
        ids.push(replaced.id);
        kind = 'swap';
        description = source
          ? `Swapped ${e.name} (${source.workoutId}) with ${replaced.name} (${action.workoutId}).`
          : `Replaced ${replaced.name} with ${e.name} in Workout ${action.workoutId}.`;
      } else {
        if (target.length >= 5)
          throw new Error('This workout is full. Choose an exercise to swap or replace.');
        if (source) protectStaple(s, e.id, action.confirmedStaple);
        s.placements = s.placements.filter((p) => p.exerciseId !== e.id);
        s.placements.push({
          exerciseId: e.id,
          workoutId: action.workoutId,
          position: target.length,
        });
        kind = source ? 'move' : 'add';
        description = `${source ? 'Moved' : 'Added'} ${e.name} ${source ? `from Workout ${source.workoutId} ` : ''}to Workout ${action.workoutId}.`;
      }
      if (action.reason?.trim()) description += ` Reason: ${action.reason.trim().slice(0, 300)}`;
      break;
    }
    case 'remove':
    case 'archive': {
      const e = exercise(action.exerciseId);
      if (placementOf(s, e.id)) protectStaple(s, e.id, action.confirmedStaple);
      s.placements = s.placements.filter((p) => p.exerciseId !== e.id);
      if (action.type === 'archive') {
        e.availability = 'archived';
        e.updatedAt = now;
      }
      ids = [e.id];
      kind = action.type;
      description =
        action.type === 'archive'
          ? `Archived ${e.name}; any active placement was removed.`
          : `Removed ${e.name} from the rotation.`;
      if (action.type === 'remove' && action.reason?.trim())
        description += ` Reason: ${action.reason.trim().slice(0, 300)}`;
      break;
    }
    case 'edit': {
      const old = s.exercises.find((e) => e.id === action.exercise.id);
      if (
        old &&
        placementOf(s, old.id) &&
        (action.exercise.type !== 'strength' || action.exercise.availability !== 'available')
      )
        throw new Error(
          'Remove this exercise from the rotation before changing its type or availability.',
        );
      const edited = { ...action.exercise, createdAt: old?.createdAt ?? now, updatedAt: now };
      s.exercises = old
        ? s.exercises.map((e) => (e.id === edited.id ? edited : e))
        : [...s.exercises, edited];
      ids = [edited.id];
      kind = 'edit';
      description = old
        ? `Updated ${edited.name}${old.rotationPolicy !== edited.rotationPolicy ? `; rotation policy: ${edited.rotationPolicy}` : ''}.`
        : `Added ${edited.name} to the library.`;
      break;
    }
    case 'restore': {
      const e = exercise(action.exerciseId);
      e.availability = 'available';
      e.updatedAt = now;
      ids = [e.id];
      kind = 'restore';
      description = `Restored ${e.name} to the library.`;
      break;
    }
    case 'undo': {
      // Keep the audit trail and any newly introduced identities referenced by it.
      const restored = structuredClone(action.previous);
      restored.exercises.push(
        ...s.exercises
          .filter((e) => !restored.exercises.some((x) => x.id === e.id))
          .map((e) => ({ ...e, availability: 'archived' as const })),
      );
      const pastEpisodes = s.episodes
        .filter((ep) => !restored.episodes.some((x) => x.id === ep.id))
        .map((ep) => ({ ...ep, endedAt: ep.endedAt ?? now }));
      restored.episodes.push(...pastEpisodes);
      restored.events = s.events;
      s = restored;
      kind = 'undo';
      description = 'Undid the previous change; retained its history.';
      break;
    }
    case 'import': {
      s = structuredClone(validateWorkspace(action.imported));
      kind = 'import';
      description =
        'Restored a versioned JSON backup. Previous state was offered as a backup before restore.';
      break;
    }
    case 'settings':
      s.reviewWeeks = action.reviewWeeks;
      kind = 'settings';
      description = `Set rotation review interval to ${action.reviewWeeks} weeks.`;
      break;
  }
  normalize(s);
  if (!['undo', 'import'].includes(action.type)) {
    const before = new Set(current.placements.map((p) => p.exerciseId));
    const after = new Set(s.placements.map((p) => p.exerciseId));
    s.episodes = s.episodes.map((ep) =>
      !ep.endedAt && !after.has(ep.exerciseId) ? { ...ep, endedAt: now } : ep,
    );
    for (const id of after)
      if (!before.has(id))
        s.episodes.push({
          id: crypto.randomUUID(),
          exerciseId: id,
          startedAt: now,
          observedActiveAt: null,
          endedAt: null,
        });
  }
  s.events.push({
    id: crypto.randomUUID(),
    at: now,
    kind,
    description,
    exerciseIds: ids,
    before: current.placements.filter((p) => s.exercises.some((e) => e.id === p.exerciseId)),
    after: structuredClone(s.placements),
  });
  s.revision = current.revision + 1;
  s.updatedAt = now;
  return validateWorkspace(s);
}
