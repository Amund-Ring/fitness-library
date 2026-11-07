import { useState } from 'react';
import { ArrowDown, ArrowUp, ArrowRightLeft, Minus } from 'lucide-react';
import {
  byWorkout,
  placementOf,
  workoutIds,
  type Workspace,
  type WorkoutId,
} from '../domain/model';
import type { Action } from '../domain/operations';
import { Dialog } from './Dialog';

export function ArrangeDialog({
  state,
  exerciseId,
  initialWorkout,
  initialReplace,
  onClose,
  onSave,
  busy,
  error,
}: {
  state: Workspace;
  exerciseId: string;
  initialWorkout?: WorkoutId;
  initialReplace?: string;
  onClose: () => void;
  onSave: (a: Action) => Promise<boolean>;
  busy: boolean;
  error?: string;
}) {
  const exercise = state.exercises.find((e) => e.id === exerciseId)!;
  const source = placementOf(state, exerciseId);
  const [workout, setWorkout] = useState<WorkoutId>(
    initialWorkout ?? workoutIds.find((w) => w !== source?.workoutId) ?? 'A',
  );
  const [replace, setReplace] = useState(initialReplace ?? '');
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const targets = byWorkout(state, workout);
  const full = targets.length >= 5;
  const same = workout === source?.workoutId;
  const replaced = state.exercises.find((e) => e.id === replace);
  const needsConfirmation =
    exercise.rotationPolicy === 'staple' || replaced?.rotationPolicy === 'staple';
  async function run(action: Action) {
    if (await onSave(action)) onClose();
  }
  return (
    <Dialog title="Arrange your rotation" onClose={onClose} error={error}>
      <p className="dialog-lead">{exercise.name}</p>
      {source && (
        <div className="reorder-actions">
          <span className="quiet">
            Workout {source.workoutId} · position {source.position + 1}
          </span>
          <button
            className="button small"
            disabled={busy || source.position === 0}
            onClick={() =>
              run({
                type: 'place',
                exerciseId,
                workoutId: source.workoutId,
                position: source.position - 1,
              })
            }
          >
            <ArrowUp size={16} /> Move up
          </button>
          <button
            className="button small"
            disabled={busy || source.position === byWorkout(state, source.workoutId).length - 1}
            onClick={() =>
              run({
                type: 'place',
                exerciseId,
                workoutId: source.workoutId,
                position: source.position + 1,
              })
            }
          >
            <ArrowDown size={16} /> Move down
          </button>
        </div>
      )}
      <form
        className="detail-form"
        onSubmit={(e) => {
          e.preventDefault();
          void run({
            type: 'place',
            exerciseId,
            workoutId: workout,
            replaceId: replace || undefined,
            confirmedStaple: confirmed,
            reason,
          });
        }}
      >
        <fieldset disabled={busy}>
          <label>
            Destination workout
            <select
              value={workout}
              onChange={(e) => {
                setWorkout(e.target.value as WorkoutId);
                setReplace('');
                setConfirmed(false);
              }}
            >
              {workoutIds.map((w) => (
                <option key={w} value={w}>
                  Workout {w} · {byWorkout(state, w).length}/5
                  {w === source?.workoutId ? ' (current)' : ''}
                </option>
              ))}
            </select>
          </label>
          {!same && (
            <>
              <label>
                {source ? 'Swap with' : 'Replace'}{' '}
                {full ? '— required for a full workout' : '— optional'}
                <select
                  required={full}
                  value={replace}
                  onChange={(e) => {
                    setReplace(e.target.value);
                    setConfirmed(false);
                  }}
                >
                  <option value="">{full ? 'Choose an exercise…' : 'Use an open slot'}</option>
                  {targets.map((p) => (
                    <option key={p.exerciseId} value={p.exerciseId}>
                      {state.exercises.find((e) => e.id === p.exerciseId)!.name}
                    </option>
                  ))}
                </select>
              </label>
              <p className="detail-note">
                {replace
                  ? source
                    ? `The selected exercise will move to Workout ${source.workoutId}. Both workouts keep their slot counts.`
                    : 'The outgoing exercise stays available in your library. Its current membership ends.'
                  : 'Moving between workouts preserves the current membership start date.'}
              </p>
              <label>
                Reason <small>Optional, saved in history</small>
                <input
                  maxLength={300}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="A better fit, a different machine…"
                />
              </label>
              {needsConfirmation && (
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                  />{' '}
                  I want to change a staple exercise’s placement.
                </label>
              )}
              <button
                className="button primary wide"
                disabled={(!replace && full) || (needsConfirmation && !confirmed)}
              >
                <ArrowRightLeft size={16} />
                {replace
                  ? source
                    ? 'Confirm swap'
                    : 'Confirm replacement'
                  : source
                    ? 'Move exercise'
                    : 'Add exercise'}
              </button>
            </>
          )}
        </fieldset>
      </form>
      {source && (
        <button
          className="text-button danger remove-action"
          disabled={busy}
          onClick={() => {
            if (
              window.confirm(
                `Remove ${exercise.name}${exercise.rotationPolicy === 'staple' ? ' (a staple)' : ''} from Workout ${source.workoutId}? It will stay in your library.`,
              )
            )
              void run({ type: 'remove', exerciseId, confirmedStaple: true, reason });
          }}
        >
          <Minus size={16} /> Remove from rotation
        </button>
      )}
    </Dialog>
  );
}
