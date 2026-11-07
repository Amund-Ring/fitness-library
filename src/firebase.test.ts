import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), snapshot: vi.fn() }));
vi.mock('firebase/app', () => ({ initializeApp: vi.fn() }));
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(),
  GoogleAuthProvider: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(),
  doc: vi.fn(() => ({ path: 'owner-workspace' })),
  onSnapshot: vi.fn(),
  runTransaction: vi.fn(async (_db, cb) => cb({ get: mocks.get, set: mocks.set })),
}));
import { initializeWorkspace, saveWorkspace } from './firebase';
import { createSeed } from './domain/seed';
import { applyAction } from './domain/operations';
beforeEach(() => vi.clearAllMocks());
describe('cloud integrity', () => {
  it('does not seed over existing user data', async () => {
    mocks.get.mockResolvedValue({ exists: () => true });
    await initializeWorkspace('owner');
    expect(mocks.set).not.toHaveBeenCalled();
  });
  it('initializes only a missing workspace', async () => {
    mocks.get.mockResolvedValue({ exists: () => false });
    await initializeWorkspace('owner');
    expect(mocks.set).toHaveBeenCalledOnce();
    expect(mocks.set.mock.calls[0][1].exercises).toHaveLength(22);
  });
  it('rejects stale edits without writing', async () => {
    const s = createSeed();
    mocks.get.mockResolvedValue({ exists: () => true, data: () => ({ ...s, revision: 1 }) });
    await expect(
      saveWorkspace('owner', 0, applyAction(s, { type: 'remove', exerciseId: 'ex01' })),
    ).rejects.toThrow('another device');
    expect(mocks.set).not.toHaveBeenCalled();
  });
  it('writes the complete valid change in the transaction', async () => {
    const s = createSeed();
    mocks.get.mockResolvedValue({ exists: () => true, data: () => s });
    const next = applyAction(s, {
      type: 'place',
      exerciseId: 'ex01',
      workoutId: 'B',
      replaceId: 'ex06',
    });
    await saveWorkspace('owner', 0, next);
    expect(mocks.set.mock.calls[0][1]).toEqual(next);
  });
});
