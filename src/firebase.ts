import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, type User } from 'firebase/auth';
import { doc, getFirestore, onSnapshot, runTransaction } from 'firebase/firestore';
import { createSeed } from './domain/seed';
import { validateWorkspace, type Workspace } from './domain/model';

export const OWNER_EMAIL = import.meta.env.VITE_OWNER_EMAIL || '';
export const firebaseConfigured = Boolean(
  import.meta.env.VITE_FIREBASE_API_KEY &&
  import.meta.env.VITE_FIREBASE_PROJECT_ID &&
  import.meta.env.VITE_FIREBASE_AUTH_DOMAIN &&
  import.meta.env.VITE_FIREBASE_APP_ID &&
  OWNER_EMAIL,
);
const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'demo-api-key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'demo-fitness-library.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'demo-fitness-library',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || 'demo-app',
});
export const auth = getAuth(app);
const db = getFirestore(app);
const workspaceRef = (uid: string) => doc(db, 'users', uid, 'workspaces', 'main');
export const isOwner = (user: User) => user.email === OWNER_EMAIL && user.emailVerified;
export async function login() {
  if (!firebaseConfigured)
    throw new Error('Configure .env.local to enable Google sign-in, or open the sample library.');
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account', login_hint: OWNER_EMAIL });
  const result = await signInWithPopup(auth, provider);
  if (!isOwner(result.user)) {
    await signOut(auth);
    throw new Error('This is a personal library. Please use the owner’s Google account.');
  }
}
export function subscribeWorkspace(
  uid: string,
  onData: (s: Workspace) => void,
  onError: (e: Error) => void,
  onMissing: () => void,
) {
  return onSnapshot(
    workspaceRef(uid),
    { includeMetadataChanges: true },
    (snap) => {
      if (snap.metadata.fromCache) return;
      try {
        if (snap.exists()) onData(validateWorkspace(snap.data()));
        else onMissing();
      } catch (e) {
        onError(e as Error);
      }
    },
    onError,
  );
}
export async function initializeWorkspace(uid: string) {
  await runTransaction(db, async (tx) => {
    const ref = workspaceRef(uid);
    const snap = await tx.get(ref);
    if (!snap.exists()) tx.set(ref, createSeed());
  });
}
export async function saveWorkspace(uid: string, expectedRevision: number, next: Workspace) {
  await runTransaction(db, async (tx) => {
    const ref = workspaceRef(uid);
    const snap = await tx.get(ref);
    if (!snap.exists() || snap.data().revision !== expectedRevision)
      throw new Error(
        'Your library changed on another device. The latest version will load automatically. Review it and try again.',
      );
    tx.set(ref, validateWorkspace(next));
  });
}
