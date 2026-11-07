import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';

let env;
const path = 'users/owner-uid/workspaces/main';
const state = { schemaVersion: 1, revision: 0 };
before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-fitness-library',
    firestore: {
      rules: readFileSync('firestore.rules.template', 'utf8').replaceAll(
        '__OWNER_EMAIL__',
        'owner@example.com',
      ),
    },
  });
  await env.clearFirestore();
});
after(async () => env?.cleanup());
test('anonymous users cannot read or write', async () => {
  const db = env.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(db, path)));
  await assertFails(setDoc(doc(db, path), state));
});
test('another Google account cannot read or write owner data', async () => {
  const db = env
    .authenticatedContext('owner-uid', { email: 'someone@example.com', email_verified: true })
    .firestore();
  await assertFails(getDoc(doc(db, path)));
  await assertFails(setDoc(doc(db, path), state));
});
test('an unverified owner email cannot access the database', async () => {
  const db = env
    .authenticatedContext('owner-uid', { email: 'owner@example.com', email_verified: false })
    .firestore();
  await assertFails(getDoc(doc(db, path)));
});
test('the verified owner can initialize, read and save only incremented revisions', async () => {
  const db = env
    .authenticatedContext('owner-uid', { email: 'owner@example.com', email_verified: true })
    .firestore();
  await assertSucceeds(setDoc(doc(db, path), state));
  await assertSucceeds(getDoc(doc(db, path)));
  await assertFails(setDoc(doc(db, path), { ...state, revision: 0 }));
  await assertSucceeds(setDoc(doc(db, path), { ...state, revision: 1 }));
  await assertFails(setDoc(doc(db, path), { ...state, revision: 3 }));
  await assertFails(deleteDoc(doc(db, path)));
});
test('owner access is limited to their own UID and the intended document', async () => {
  const db = env
    .authenticatedContext('another-uid', { email: 'owner@example.com', email_verified: true })
    .firestore();
  await assertFails(getDoc(doc(db, path)));
  await assertFails(setDoc(doc(db, 'unexpected/path'), state));
});
