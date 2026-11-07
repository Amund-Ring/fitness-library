import { useState } from 'react';
import { Archive, ArrowRight, RotateCcw, Save } from 'lucide-react';
import {
  exerciseCategories,
  placementOf,
  type Exercise,
  type ExerciseCategory,
  type Workspace,
} from '../domain/model';
import { categoryOf, equipmentKind } from '../domain/categories';
import { CategoryBadge } from './CategoryBadge';
import { Dialog } from './Dialog';
import type { Action } from '../domain/operations';

export function ExerciseEditor({
  exercise,
  state,
  editable,
  busy,
  onClose,
  onSave,
  onArrange,
  error,
}: {
  exercise: Exercise;
  state: Workspace;
  editable: boolean;
  busy: boolean;
  onClose: () => void;
  onSave: (a: Action) => Promise<boolean>;
  onArrange: () => void;
  error?: string;
}) {
  const [form, setForm] = useState(exercise);
  const exists = state.exercises.some((e) => e.id === exercise.id);
  const [focus, setFocus] = useState<ExerciseCategory | ''>(exists ? categoryOf(exercise) : '');
  const [secondary, setSecondary] = useState(exercise.secondaryMuscles.join(', '));
  const [validation, setValidation] = useState('');
  const placement = placementOf(state, exercise.id);
  const field = <K extends keyof Exercise>(key: K, value: Exercise[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!form.name.trim() || !focus) {
      setValidation('Enter a name and choose a primary focus.');
      return;
    }
    const type = focus === 'Cardio' ? 'cardio' : 'strength';
    const focusChanged = !exists || focus !== categoryOf(exercise);
    if (
      await onSave({
        type: 'edit',
        exercise: {
          ...form,
          name: form.name.trim(),
          category: focus,
          type,
          primaryMuscles: focusChanged ? [focus] : exercise.primaryMuscles,
          secondaryMuscles: secondary
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          finisherEligible:
            type === 'cardio' ? (exercise.type === 'cardio' ? form.finisherEligible : true) : false,
        },
      })
    )
      onClose();
  }
  async function archive() {
    const warning = placement
      ? `Archive ${exercise.name} and remove it from Workout ${placement.workoutId}${exercise.rotationPolicy === 'staple' ? '? This is a staple exercise.' : '?'}`
      : `Archive ${exercise.name}? Its history will be kept.`;
    if (
      window.confirm(warning) &&
      (await onSave({ type: 'archive', exerciseId: exercise.id, confirmedStaple: true }))
    )
      onClose();
  }
  const currentEquipment = equipmentKind(form.equipmentType);
  return (
    <Dialog
      title={exists ? 'Exercise details' : 'Add exercise'}
      onClose={onClose}
      error={error}
      sheet
    >
      {exists && (
        <div className="detail-status">
          <CategoryBadge category={categoryOf(exercise)} />
          <span className="quiet">
            {exercise.availability === 'archived'
              ? 'Archived'
              : placement
                ? `Workout ${placement.workoutId}`
                : ''}
          </span>
        </div>
      )}
      <form onSubmit={save} className="detail-form">
        <fieldset disabled={!editable || busy}>
          <label>
            Exercise name
            <input
              required
              maxLength={120}
              value={form.name}
              onChange={(e) => field('name', e.target.value)}
            />
          </label>
          <label>
            Primary focus
            <select
              aria-label="Primary focus"
              required
              value={focus}
              onChange={(e) => setFocus(e.target.value as ExerciseCategory)}
            >
              <option value="" disabled>
                Choose a category
              </option>
              {exerciseCategories.map((c) => (
                <option key={c} disabled={!!placement && c === 'Cardio'}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label>
            Secondary muscles <small>Optional · separate with commas</small>
            <input
              maxLength={500}
              value={secondary}
              onChange={(e) => setSecondary(e.target.value)}
            />
          </label>
          <div className="equipment-field">
            <span>
              Equipment <small>Optional</small>
            </span>
            <div className="equipment-toggle" aria-label="Equipment">
              {(['Machine', 'Free weights'] as const).map((kind) => (
                <button
                  type="button"
                  key={kind}
                  aria-pressed={currentEquipment === kind}
                  onClick={() => field('equipmentType', currentEquipment === kind ? '' : kind)}
                >
                  {kind}
                </button>
              ))}
            </div>
          </div>
          <label>
            Personal notes <small>Optional</small>
            <textarea
              rows={3}
              maxLength={4000}
              value={form.notes}
              onChange={(e) => field('notes', e.target.value)}
            />
          </label>
          <details className="rotation-settings">
            <summary>Rotation settings</summary>
            <label>
              Rotation policy
              <select
                value={form.rotationPolicy}
                onChange={(e) =>
                  field('rotationPolicy', e.target.value as Exercise['rotationPolicy'])
                }
              >
                <option value="undecided">Undecided</option>
                <option value="staple">Staple — usually keep</option>
                <option value="rotatable">Rotatable — review occasionally</option>
              </select>
            </label>
          </details>
          {validation && (
            <p role="alert" className="error-text">
              {validation}
            </p>
          )}
          <button className="button primary wide" type="submit">
            <Save size={16} />
            {busy ? 'Saving…' : 'Save exercise'}
          </button>
        </fieldset>
      </form>
      {exists && exercise.primaryMuscles.length > 0 && (
        <p className="detail-note muscle-detail">
          Muscle detail: {exercise.primaryMuscles.join(' · ')}
        </p>
      )}
      {exercise.legacyNames.length > 0 && (
        <p className="detail-note">Previously named: {exercise.legacyNames.join(', ')}.</p>
      )}
      {exists && (
        <div className="detail-actions">
          {exercise.type === 'strength' && exercise.availability === 'available' && (
            <button className="button wide" disabled={!editable || busy} onClick={onArrange}>
              {placement ? 'Arrange in rotation' : 'Add to a workout'}
              <ArrowRight size={16} />
            </button>
          )}
          {exercise.availability === 'archived' ? (
            <button
              className="text-button"
              disabled={!editable || busy}
              onClick={async () => {
                if (await onSave({ type: 'restore', exerciseId: exercise.id })) onClose();
              }}
            >
              <RotateCcw size={15} /> Restore exercise
            </button>
          ) : (
            <button className="text-button danger" disabled={!editable || busy} onClick={archive}>
              <Archive size={15} /> Archive exercise
            </button>
          )}
        </div>
      )}
    </Dialog>
  );
}
