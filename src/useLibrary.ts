import { useCallback, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { auth, initializeWorkspace, isOwner, saveWorkspace, subscribeWorkspace } from './firebase';
import { createSeed } from './domain/seed';
import { validateWorkspace, type Workspace } from './domain/model';
import { applyAction, type Action } from './domain/operations';

const cacheKey = (uid: string) => `fitness-library-cache-v1:${uid}`;
export function useLibrary(preview: boolean) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(preview);
  const [state, setState] = useState<Workspace | null>(() => (preview ? createSeed() : null));
  const [error, setError] = useState('');
  const [online, setOnline] = useState(navigator.onLine);
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [undo, setUndo] = useState<{ previous: Workspace; revision: number } | null>(null);

  useEffect(() => {
    const on = () => setOnline(true),
      off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    setOnline(navigator.onLine);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  useEffect(() => {
    if (preview) return;
    return onAuthStateChanged(auth, (next) => {
      setUser(next && isOwner(next) ? next : null);
      setAuthReady(true);
      setState(null);
      setVerified(false);
      setUndo(null);
      if (next && !isOwner(next)) {
        void signOut(auth);
        setError('Please sign in with the owner’s Google account.');
      }
    });
  }, [preview]);
  useEffect(() => {
    if (!user || preview) return;
    try {
      const raw = localStorage.getItem(cacheKey(user.uid));
      if (raw) setState(validateWorkspace(JSON.parse(raw)));
    } catch {
      /* Cache is optional; fetch a fresh cloud copy. */
    }
    let mounted = true,
      seeding = false;
    const unsubscribe = subscribeWorkspace(
      user.uid,
      (next) => {
        if (!mounted) return;
        setState(next);
        setVerified(true);
        setError('');
        try {
          localStorage.setItem(cacheKey(user.uid), JSON.stringify(next));
        } catch {
          /* Cloud save remains authoritative if local storage is full. */
        }
      },
      (e) => {
        if (mounted) {
          setError(friendlyError(e));
          setVerified(false);
        }
      },
      () => {
        if (seeding) return;
        seeding = true;
        void initializeWorkspace(user.uid).catch((e) => {
          if (mounted) {
            setError(friendlyError(e));
            seeding = false;
          }
        });
      },
    );
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [user, preview]);

  const canEdit = preview || (!!user && online && verified);
  const commit = useCallback(
    async (action: Action) => {
      if (!state || !canEdit || lock.current) return false;
      lock.current = true;
      setBusy(true);
      setError('');
      try {
        const next = applyAction(state, action);
        if (!preview) await saveWorkspace(user!.uid, state.revision, next);
        setState(next);
        if (!preview)
          try {
            localStorage.setItem(cacheKey(user!.uid), JSON.stringify(next));
          } catch {
            /* optional cache */
          }
        setUndo(action.type === 'undo' ? null : { previous: state, revision: next.revision });
        return true;
      } catch (e) {
        setError(friendlyError(e));
        return false;
      } finally {
        lock.current = false;
        setBusy(false);
      }
    },
    [state, canEdit, preview, user],
  );
  const logout = async () => {
    if (user) {
      try {
        localStorage.removeItem(cacheKey(user.uid));
      } catch {
        /* storage may be unavailable */
      }
    }
    const uid = user?.uid;
    setState(null);
    setUndo(null);
    await signOut(auth);
    if (uid)
      try {
        localStorage.removeItem(cacheKey(uid));
      } catch {
        /* storage may be unavailable */
      }
  };
  return {
    user,
    authReady,
    state,
    error,
    setError,
    online,
    verified,
    busy,
    canEdit,
    commit,
    logout,
    undo: undo?.revision === state?.revision ? undo : null,
  };
}
export function friendlyError(error: unknown): string {
  const e = error as { code?: string; message?: string };
  if (e.code === 'permission-denied')
    return 'Database access is not enabled yet. Publish this project’s firestore.rules in Firebase Console → Firestore → Rules, then reload.';
  if (e.code === 'auth/popup-closed-by-user')
    return 'Sign-in was closed. You can try again when you’re ready.';
  if (e.code === 'auth/unauthorized-domain')
    return 'This website’s domain must be added under Firebase Authentication → Settings → Authorized domains.';
  if (e.code === 'unavailable' || e.code === 'auth/network-request-failed')
    return 'Cannot reach Firebase. Check your connection; previously loaded data remains available to view.';
  return e.message ?? 'Something went wrong. Please try again.';
}
