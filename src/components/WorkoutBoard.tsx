import { useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowRight, GripVertical, MoreHorizontal, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  byWorkout,
  placementOf,
  workoutIds,
  type Exercise,
  type Workspace,
  type WorkoutId,
} from '../domain/model';
import type { Action } from '../domain/operations';
import { categoryOf } from '../domain/categories';
import { CategoryBadge } from './CategoryBadge';

type Props = {
  state: Workspace;
  editable: boolean;
  busy: boolean;
  preview: boolean;
  onDetail: (id: string) => void;
  onMove: (id: string, workout?: WorkoutId, replaceId?: string) => void;
  commit: (action: Action) => Promise<boolean>;
};
export function WorkoutBoard(props: Props) {
  const { state, editable, busy, onMove, commit } = props;
  const [mobileWorkout, setMobileWorkout] = useState<WorkoutId>('A');
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id || !editable || busy) return;
    const exerciseId = String(active.id).replace(/^library:/, '');
    const source = placementOf(state, exerciseId);
    const target = placementOf(state, String(over.id));
    const workout =
      target?.workoutId ??
      (workoutIds.includes(over.id as WorkoutId) ? (over.id as WorkoutId) : undefined);
    if (!workout) return;
    if (source?.workoutId === workout)
      void commit({
        type: 'place',
        exerciseId,
        workoutId: workout,
        position: target?.position ?? byWorkout(state, workout).length - 1,
      });
    else onMove(exerciseId, workout, target?.exerciseId);
  }
  const inactive = state.exercises.filter(
    (e) => e.type === 'strength' && e.availability === 'available' && !placementOf(state, e.id),
  );
  return (
    <>
      <div className="section-heading">
        <div>
          <h1>Workouts</h1>
        </div>
        <span className="quiet desktop-only">Drag cards to reorder or swap</span>
      </div>
      <div className="workout-tabs" role="tablist" aria-label="Choose workout">
        {workoutIds.map((id) => (
          <button
            key={id}
            id={`tab-${id}`}
            role="tab"
            aria-selected={mobileWorkout === id}
            aria-controls={`workout-${id}`}
            tabIndex={mobileWorkout === id ? 0 : -1}
            onClick={() => setMobileWorkout(id)}
            onKeyDown={(event) => {
              const index = workoutIds.indexOf(id);
              const next =
                event.key === 'ArrowRight'
                  ? (index + 1) % 4
                  : event.key === 'ArrowLeft'
                    ? (index + 3) % 4
                    : event.key === 'Home'
                      ? 0
                      : event.key === 'End'
                        ? 3
                        : null;
              if (next === null) return;
              event.preventDefault();
              setMobileWorkout(workoutIds[next]);
              document.getElementById(`tab-${workoutIds[next]}`)?.focus();
            }}
          >
            Workout {id}
          </button>
        ))}
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <div className="workout-grid">
          {workoutIds.map((id) => (
            <WorkoutColumn key={id} {...props} workoutId={id} mobileActive={mobileWorkout === id} />
          ))}
        </div>
        {inactive.length > 0 && (
          <section className="available-panel">
            <div className="section-heading">
              <div>
                <h3>Available to add</h3>
              </div>
              <span className="quiet">Drag into a workout, or use Add</span>
            </div>
            <div className="available-list">
              {inactive.map((e) => (
                <AvailableCard
                  key={e.id}
                  exercise={e}
                  disabled={!editable || busy}
                  onAdd={() => onMove(e.id)}
                  onDetail={() => props.onDetail(e.id)}
                />
              ))}
            </div>
          </section>
        )}
      </DndContext>
      <section className="finishers">
        <h2>Optional finishers</h2>
        <div className="finisher-options">
          {state.exercises
            .filter(
              (e) => e.type === 'cardio' && e.finisherEligible && e.availability === 'available',
            )
            .map((e) => (
              <button key={e.id} onClick={() => props.onDetail(e.id)}>
                <span>
                  <strong>{e.name}</strong>
                  {e.id === 'ex21' && <small>~20 floors</small>}
                </span>
                <ArrowRight size={18} />
              </button>
            ))}
        </div>
      </section>
    </>
  );
}
function WorkoutColumn({
  state,
  workoutId,
  mobileActive,
  editable,
  busy,
  onDetail,
  onMove,
  preview,
}: Props & { workoutId: WorkoutId; mobileActive: boolean }) {
  const placements = byWorkout(state, workoutId);
  const { setNodeRef, isOver } = useDroppable({ id: workoutId, disabled: !editable || busy });
  return (
    <section
      id={`workout-${workoutId}`}
      aria-label={`Workout ${workoutId}`}
      ref={setNodeRef}
      className={`workout-column ${mobileActive ? 'mobile-active' : ''} ${isOver ? 'drop-over' : ''}`}
    >
      <header className="workout-header">
        <div className={`workout-letter letter-${workoutId}`}>{workoutId}</div>
        <div>
          <h3>Workout {workoutId}</h3>
        </div>
        <span className={`count ${placements.length !== 5 ? 'warning' : ''}`}>
          {placements.length}
          <span>/5</span>
        </span>
      </header>
      <SortableContext
        items={placements.map((p) => p.exerciseId)}
        strategy={verticalListSortingStrategy}
      >
        <div className="exercise-stack">
          {placements.map((p) => {
            const e = state.exercises.find((e) => e.id === p.exerciseId)!;
            return (
              <ExerciseCard
                key={e.id}
                exercise={e}
                disabled={!editable || busy}
                onDetail={() => onDetail(e.id)}
                onMove={() => onMove(e.id)}
              />
            );
          })}
        </div>
      </SortableContext>
      {placements.length < 5 && (
        <p className="slot-warning">
          {5 - placements.length} open {placements.length === 4 ? 'slot' : 'slots'} · choose an
          exercise below or in the library.
        </p>
      )}
      <Link className="column-footer" to={`/library${preview ? '?preview=1' : ''}`}>
        <Plus size={15} /> Add / swap exercises
      </Link>
    </section>
  );
}
function ExerciseCard({
  exercise: e,
  disabled,
  onDetail,
  onMove,
}: {
  exercise: Exercise;
  disabled: boolean;
  onDetail: () => void;
  onMove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: e.id,
    disabled,
  });
  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`exercise-card ${isDragging ? 'dragging' : ''}`}
    >
      <div className="card-top">
        <CategoryBadge category={categoryOf(e)} />
        <div className="card-tools">
          {e.rotationPolicy === 'staple' && (
            <span className="staple-dot" title="Staple exercise">
              ◆
            </span>
          )}
          <button
            className="icon-button more-button"
            disabled={disabled}
            aria-label={`Arrange ${e.name}`}
            onClick={onMove}
          >
            <MoreHorizontal size={18} />
          </button>
          <button
            className="drag-handle"
            disabled={disabled}
            {...attributes}
            {...listeners}
            aria-label={`Drag ${e.name}`}
          >
            <GripVertical size={16} />
          </button>
        </div>
      </div>
      <button className="exercise-open" onClick={onDetail} aria-label={e.name}>
        <h4>{e.name}</h4>
      </button>
    </article>
  );
}
function AvailableCard({
  exercise: e,
  disabled,
  onAdd,
  onDetail,
}: {
  exercise: Exercise;
  disabled: boolean;
  onAdd: () => void;
  onDetail: () => void;
}) {
  const { setNodeRef, attributes, listeners, transform } = useDraggable({
    id: `library:${e.id}`,
    disabled,
  });
  return (
    <div
      className="available-card"
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
    >
      <button
        className="drag-handle"
        disabled={disabled}
        {...attributes}
        {...listeners}
        aria-label={`Drag ${e.name}`}
      >
        <GripVertical size={18} />
      </button>
      <CategoryBadge category={categoryOf(e)} />
      <button className="text-button" onClick={onDetail}>
        {e.name}
      </button>
      <button className="button small" onClick={onAdd} disabled={disabled}>
        <Plus size={14} /> Add
      </button>
    </div>
  );
}
