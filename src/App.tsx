import { useRef, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { useRegisterSW } from 'virtual:pwa-register/react';
import {
  ArrowRight,
  BookOpen,
  CircleHelp,
  Cloud,
  CloudOff,
  Download,
  History,
  LayoutGrid,
  LogOut,
  MoreHorizontal,
  RefreshCw,
  Undo2,
  Upload,
  X,
} from 'lucide-react';
import { firebaseConfigured, login } from './firebase';
import { friendlyError, useLibrary } from './useLibrary';
import { type Exercise, type Workspace, type WorkoutId } from './domain/model';
import type { Action } from './domain/operations';
import { downloadBackup, importBackup } from './domain/backup';
import { WorkoutBoard } from './components/WorkoutBoard';
import { LibraryView } from './components/LibraryView';
import { RotationsView } from './components/RotationsView';
import { ExerciseEditor } from './components/ExerciseEditor';
import { ArrangeDialog } from './components/ArrangeDialog';
import { Dialog } from './components/Dialog';

type Modal =
  | { type: 'exercise'; exercise: Exercise; revision: number }
  | { type: 'arrange'; id: string; revision: number; workout?: WorkoutId; replace?: string }
  | { type: 'data' }
  | { type: 'import'; state: Workspace; revision: number };
export default function App() {
  const [preview] = useState(() => new URLSearchParams(location.search).get('preview') === '1');
  const lib = useLibrary(preview);
  const { state, user, error, setError, busy, canEdit } = lib;
  const [modal, setModal] = useState<Modal | null>(null);
  const [loginBusy, setLoginBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  const suffix = preview ? '?preview=1' : '';
  async function signIn() {
    setLoginBusy(true);
    setError('');
    try {
      await login();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setLoginBusy(false);
    }
  }
  async function commit(action: Action, expectedRevision?: number) {
    if (expectedRevision !== undefined && expectedRevision !== state?.revision) {
      setError(
        'The library changed while this dialog was open. Close and reopen it to use the latest version.',
      );
      return false;
    }
    const ok = await lib.commit(action);
    if (ok) {
      setNotice(preview ? 'Preview updated · changes are not saved' : 'Saved to your library');
      setTimeout(() => setNotice(''), 3500);
    }
    return ok;
  }
  const detail = (id: string) => {
    if (state)
      setModal({
        type: 'exercise',
        exercise: state.exercises.find((e) => e.id === id)!,
        revision: state.revision,
      });
  };
  const arrange = (id: string, workout?: WorkoutId, replace?: string) => {
    if (state) setModal({ type: 'arrange', id, workout, replace, revision: state.revision });
  };
  const addExercise = () => {
    if (!state) return;
    const now = new Date().toISOString();
    setModal({
      type: 'exercise',
      revision: state.revision,
      exercise: {
        id: crypto.randomUUID(),
        name: '',
        type: 'strength',
        primaryMuscles: [],
        secondaryMuscles: [],
        legacyNames: [],
        movementPattern: '',
        equipmentType: '',
        equipmentVariant: null,
        gymZone: null,
        notes: '',
        availability: 'available',
        rotationPolicy: 'undecided',
        finisherEligible: false,
        createdAt: now,
        updatedAt: now,
      },
    });
  };
  async function readImport(file?: File) {
    if (!file || !state) return;
    try {
      if (file.size > 2_000_000) throw new Error('Choose a JSON backup smaller than 2 MB.');
      const imported = importBackup(await file.text());
      setModal({ type: 'import', state: imported, revision: state.revision });
    } catch {
      setError(
        'This file is not a valid Fitness Library v1 backup, or it exceeds the size limit. Nothing was changed.',
      );
    }
    if (fileRef.current) fileRef.current.value = '';
  }
  const brand = <span>Fitness Library</span>;
  if (!lib.authReady)
    return (
      <main className="auth-page">
        <RefreshCw className="spinner" />
        <p>Opening your library…</p>
      </main>
    );
  if (!user && !preview)
    return (
      <main className="auth-page">
        <div className="auth-card">
          <div className="brand">{brand}</div>
          <p>Sign in to access your workouts and exercises.</p>
          <button
            className="button primary wide"
            disabled={loginBusy || !lib.online || !firebaseConfigured}
            onClick={signIn}
          >
            <GoogleMark />
            {loginBusy ? 'Opening Google…' : 'Continue with Google'}
            <ArrowRight size={17} />
          </button>
          {!firebaseConfigured && (
            <p className="detail-note">Sample mode. Configure Firebase to enable sign-in.</p>
          )}
          {!lib.online && <p className="error-text">Connect to the internet to sign in.</p>}
          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}
          <a className="preview-link" href="/workouts?preview=1">
            View sample library <ArrowRight size={15} />
          </a>
        </div>
      </main>
    );
  return (
    <div className="app-shell">
      {preview && (
        <div className="preview-banner">
          <span>Sample preview · changes stay in this tab and are not saved.</span>
          <a href="/workouts">
            Sign in to your library <ArrowRight size={13} />
          </a>
        </div>
      )}
      <header className="app-header">
        <Link className="brand" to={`/workouts${suffix}`}>
          {brand}
        </Link>
        <nav className="main-nav" aria-label="Main navigation">
          {[
            ['/workouts', 'Workouts', LayoutGrid],
            ['/library', 'Library', BookOpen],
            ['/rotations', 'Rotations', History],
          ].map(([path, label, Icon]) => (
            <NavLink
              key={String(path)}
              to={`${path}${suffix}`}
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              <Icon size={17} />
              <span>{String(label)}</span>
            </NavLink>
          ))}
        </nav>
        <div className="header-actions">
          <span
            className={`cloud-status ${!lib.online ? 'is-offline' : ''}`}
            title={
              preview
                ? 'Sample data'
                : !lib.online
                  ? 'Offline — viewing saved data'
                  : lib.verified
                    ? 'Cloud connected'
                    : 'Connecting to cloud'
            }
          >
            {lib.online ? <Cloud size={16} /> : <CloudOff size={16} />}
            <span>
              {preview
                ? 'Preview'
                : !lib.online
                  ? 'Offline'
                  : busy
                    ? 'Saving…'
                    : lib.verified
                      ? 'Cloud saved'
                      : 'Connecting…'}
            </span>
          </span>
          <button
            className="icon-button data-menu"
            aria-label="Data and account"
            onClick={() => setModal({ type: 'data' })}
          >
            <MoreHorizontal size={23} />
          </button>
        </div>
      </header>
      <main className="main-content">
        {error && (
          <div role="alert" className="error-banner">
            <CircleHelp size={19} />
            <span>{error}</span>
            <button className="icon-button" aria-label="Dismiss error" onClick={() => setError('')}>
              <X size={17} />
            </button>
          </div>
        )}
        {!lib.online && (
          <div className="offline-banner">
            <CloudOff size={17} /> Offline viewing · Editing will be available when you reconnect.
          </div>
        )}
        {state ? (
          <>
            <Routes>
              <Route
                path="/workouts"
                element={
                  <WorkoutBoard
                    state={state}
                    editable={canEdit}
                    busy={busy}
                    preview={preview}
                    onDetail={detail}
                    onMove={arrange}
                    commit={commit}
                  />
                }
              />
              <Route
                path="/library"
                element={
                  <LibraryView
                    state={state}
                    editable={canEdit && !busy}
                    onDetail={detail}
                    onNew={addExercise}
                  />
                }
              />
              <Route
                path="/rotations"
                element={<RotationsView state={state} onDetail={detail} />}
              />
              <Route path="*" element={<Navigate to={`/workouts${suffix}`} replace />} />
            </Routes>
          </>
        ) : (
          <section className="empty-state">
            <RefreshCw size={27} className={error ? '' : 'spinner'} />
            <h2>{error ? 'Could not load library' : 'Loading library…'}</h2>
            <p>
              {error
                ? 'Finish the Firebase rules setup, then reload. Your data will not be overwritten.'
                : !lib.online
                  ? 'Reconnect to load your library for the first time.'
                  : 'Loading cloud data and preparing your original workouts if this is your first visit.'}
            </p>
            <button className="button" onClick={() => location.reload()}>
              Reload
            </button>
          </section>
        )}
      </main>
      <input
        type="file"
        accept="application/json,.json"
        ref={fileRef}
        className="visually-hidden"
        aria-label="Import JSON backup"
        onChange={(e) => void readImport(e.target.files?.[0])}
      />
      {modal?.type === 'exercise' && state && (
        <ExerciseEditor
          key={modal.exercise.id}
          error={error}
          exercise={modal.exercise}
          state={state}
          editable={canEdit}
          busy={busy}
          onClose={() => setModal(null)}
          onSave={(a) => commit(a, modal.revision)}
          onArrange={() => arrange(modal.exercise.id)}
        />
      )}
      {modal?.type === 'arrange' && state && (
        <ArrangeDialog
          error={error}
          state={state}
          exerciseId={modal.id}
          initialWorkout={modal.workout}
          initialReplace={modal.replace}
          busy={busy || !canEdit}
          onClose={() => setModal(null)}
          onSave={(a) => commit(a, modal.revision)}
        />
      )}
      {modal?.type === 'data' && (
        <Dialog title="Data & account" error={error} onClose={() => setModal(null)}>
          <p className="detail-note">
            {preview
              ? 'You’re exploring sample data. Sign in to save a personal library.'
              : `Signed in as ${user?.email}`}
          </p>
          <div className="data-actions">
            <button
              className="button"
              disabled={!state}
              onClick={() => {
                if (state) downloadBackup(state);
              }}
            >
              <Download size={17} /> Export JSON backup
            </button>
            <button
              className="button"
              disabled={!canEdit || busy || !state}
              onClick={() => fileRef.current?.click()}
            >
              <Upload size={17} /> Restore from JSON
            </button>
          </div>
          {state && (
            <label className="settings-label">
              Rotation review interval
              <select
                aria-label="Rotation review interval"
                value={state.reviewWeeks}
                disabled={!canEdit || busy}
                onChange={(e) =>
                  void commit({ type: 'settings', reviewWeeks: Number(e.target.value) })
                }
              >
                {[...new Set([12, 14, 16, state.reviewWeeks])]
                  .sort((a, b) => a - b)
                  .map((w) => (
                    <option key={w} value={w}>
                      {w} weeks
                    </option>
                  ))}
              </select>
            </label>
          )}
          <div className="install-note">
            <strong>Install on iPhone</strong>
            <p>
              On iPhone, open this site in Safari, tap Share, then Add to Home Screen. Open it
              online once before using offline viewing.
            </p>
          </div>
          {preview ? (
            <a className="button primary wide" href="/workouts">
              Sign in to your library
            </a>
          ) : (
            <button
              className="text-button"
              disabled={busy}
              onClick={async () => {
                setModal(null);
                await lib.logout();
              }}
            >
              <LogOut size={16} /> Sign out & clear this device’s viewing copy
            </button>
          )}
        </Dialog>
      )}
      {modal?.type === 'import' && state && (
        <Dialog title="Restore this backup?" error={error} onClose={() => setModal(null)}>
          <p className="dialog-lead">
            {modal.state.exercises.length} exercises · {modal.state.placements.length} strength
            placements · {modal.state.events.length} history events
          </p>
          <p>
            This replaces your current library on every device. Export your current library before
            confirming.
          </p>
          <div className="data-actions">
            <button
              className="button"
              onClick={() => downloadBackup(state, 'fitness-library-before-restore')}
            >
              <Download size={16} /> Back up current library
            </button>
            <button
              className="button primary"
              disabled={busy || !canEdit}
              onClick={async () => {
                if (await commit({ type: 'import', imported: modal.state }, modal.revision))
                  setModal(null);
              }}
            >
              Confirm full restore
            </button>
          </div>
        </Dialog>
      )}
      {(notice || lib.undo) && (
        <div className="toast" role="status">
          <span>{notice || 'Your last change can be undone.'}</span>
          {lib.undo && (
            <button
              disabled={busy || !canEdit}
              onClick={() => void commit({ type: 'undo', previous: lib.undo!.previous })}
            >
              <Undo2 size={15} /> Undo
            </button>
          )}
        </div>
      )}
      {needRefresh && (
        <div className="update-prompt" role="status">
          <strong>Update available</strong>
          <p>Save or close any exercise edits before reloading.</p>
          <button
            className="button primary small"
            disabled={busy || !!modal}
            onClick={() => void updateServiceWorker(true)}
          >
            Update & reload
          </button>
          <button className="text-button" onClick={() => setNeedRefresh(false)}>
            Later
          </button>
        </div>
      )}
    </div>
  );
}
function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="currentColor"
        d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36ZM12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.04.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.07v2.59A10 10 0 0 0 12 22ZM6.41 13.92A6 6 0 0 1 6.1 12c0-.67.11-1.32.31-1.92V7.49H3.07A10 10 0 0 0 2 12c0 1.61.38 3.14 1.07 4.51l3.34-2.59ZM12 5.96c1.47 0 2.79.51 3.83 1.51l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.93 5.49l3.34 2.59C7.2 7.72 9.4 5.96 12 5.96Z"
      />
    </svg>
  );
}
