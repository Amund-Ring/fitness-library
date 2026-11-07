import { useState } from 'react';
import { ArrowRightLeft, Check, Copy, History } from 'lucide-react';
import { byWorkout, placementOf, workoutIds, type Workspace } from '../domain/model';

function age(start: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(start).getTime()) / (7 * 86400000)));
}
export function RotationsView({
  state,
  onDetail,
  editable,
  busy,
  onSetStarts,
}: {
  state: Workspace;
  onDetail: (id: string) => void;
  editable: boolean;
  busy: boolean;
  onSetStarts: () => Promise<boolean>;
}) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');
  const [count, setCount] = useState(30);
  const unknownCount = state.episodes.filter((ep) => !ep.endedAt && !ep.startedAt).length;
  const due = state.episodes.filter(
    (ep) =>
      !ep.endedAt &&
      ep.startedAt &&
      age(ep.startedAt) >= state.reviewWeeks &&
      state.exercises.find((e) => e.id === ep.exerciseId)?.rotationPolicy === 'rotatable',
  );
  async function copy() {
    const summary = {
      purpose:
        'Review selected substitutions. Suggest changes with reasons and tradeoffs; do not automatically modify the program.',
      philosophy:
        'Whole-body engagement, comfortable controlled range of motion, meaningful resistance and gradual progression. Four-workout rotation, not fixed weekdays. No sets or frequency data available.',
      workouts: Object.fromEntries(
        workoutIds.map((w) => [
          w,
          byWorkout(state, w).map((p) => {
            const e = state.exercises.find((e) => e.id === p.exerciseId)!;
            const ep = state.episodes.find((ep) => ep.exerciseId === e.id && !ep.endedAt);
            return {
              ...e,
              currentStint: ep?.startedAt ? `${age(ep.startedAt)} weeks` : 'Unknown start date',
            };
          }),
        ]),
      ),
      availableReplacements: state.exercises.filter(
        (e) => e.type === 'strength' && e.availability === 'available' && !placementOf(state, e.id),
      ),
      recentHistory: state.events.slice(-30),
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(summary, null, 2));
      setCopied(true);
      setCopyError('');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopyError(
        'Clipboard is unavailable. Use Data & account → Export backup to share your library.',
      );
    }
  }
  return (
    <>
      <div className="section-heading">
        <div>
          <h1>Rotations</h1>
        </div>
        <button className="button" onClick={copy}>
          {copied ? <Check size={16} /> : <Copy size={16} />}{' '}
          {copied ? 'Copied' : 'Copy AI review summary'}
        </button>
      </div>
      {copyError && (
        <p role="alert" className="error-text">
          {copyError}
        </p>
      )}
      {due.length > 0 && (
        <section className="review-banner">
          <span className="icon-tile">
            <ArrowRightLeft size={23} />
          </span>
          <div>
            <h3>
              {due.length} {due.length === 1 ? 'exercise' : 'exercises'} ready for review
            </h3>
            <p>Review interval: {state.reviewWeeks} weeks. Replacements are optional.</p>
          </div>
        </section>
      )}
      <div className="rotation-layout">
        <section className="history-panel">
          <div className="panel-title">
            <History size={18} />
            <h2>Change log</h2>
            <span className="pill">{state.events.length}</span>
          </div>
          <div className="timeline">
            {[...state.events]
              .reverse()
              .slice(0, count)
              .map((ev) => (
                <article key={ev.id} className="timeline-event">
                  <span className={`timeline-dot ${ev.kind === 'seed' ? 'seed' : ''}`} />
                  <div>
                    <time dateTime={ev.at}>
                      {new Date(ev.at).toLocaleString(undefined, {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </time>
                    <p>{ev.description}</p>
                    {ev.kind !== 'seed' && ev.before.length > 0 && (
                      <details>
                        <summary>Placement details</summary>
                        <div className="event-placements">
                          {workoutIds.map((w) => (
                            <p key={w}>
                              <strong>{w}</strong>{' '}
                              {ev.after
                                .filter((p) => p.workoutId === w)
                                .sort((a, b) => a.position - b.position)
                                .map(
                                  (p) =>
                                    state.exercises.find((e) => e.id === p.exerciseId)?.name ??
                                    p.exerciseId,
                                )
                                .join(' → ') || 'Empty'}
                            </p>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                </article>
              ))}
          </div>
          {state.events.length > count && (
            <button className="button" onClick={() => setCount((c) => c + 30)}>
              Show earlier changes
            </button>
          )}
        </section>
        <section className="membership-panel">
          <h2>Time in rotation</h2>
          <p className="detail-note">
            Time since each exercise was added to the rotation.
            {unknownCount > 0 && ` ${unknownCount} start dates are unknown.`}
          </p>
          {unknownCount > 0 && (
            <button
              className="text-button"
              disabled={!editable || busy}
              onClick={() => {
                const today = new Date().toLocaleDateString('en-GB', { dateStyle: 'long' });
                if (
                  window.confirm(
                    `Use today, ${today}, as the start date for ${unknownCount} current exercises with unknown starts? This sets a starting point for tracking; it does not change past membership records.`,
                  )
                )
                  void onSetStarts();
              }}
            >
              Set unknown starts to today
            </button>
          )}
          <div className="membership-list">
            {state.placements.map((p) => {
              const e = state.exercises.find((e) => e.id === p.exerciseId)!;
              const ep = state.episodes.find((ep) => ep.exerciseId === e.id && !ep.endedAt)!;
              const weeks = ep.startedAt ? age(ep.startedAt) : null;
              return (
                <button key={e.id} onClick={() => onDetail(e.id)}>
                  <span>
                    <strong>{e.name}</strong>
                    <small>
                      Workout {p.workoutId}
                      {ep.startedAt &&
                        ` · Started ${new Date(ep.startedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                    </small>
                  </span>
                  <span className={due.some((x) => x.exerciseId === e.id) ? 'review-due' : ''}>
                    {weeks === null
                      ? 'Start unknown'
                      : weeks === 0
                        ? 'Under a week'
                        : `${weeks} weeks`}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </>
  );
}
