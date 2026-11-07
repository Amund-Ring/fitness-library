import { describe, expect, it } from 'vitest';
import { createSeed } from './seed';
import { byWorkout, validateWorkspace } from './model';
import { applyAction } from './operations';
import { exportBackup, importBackup } from './backup';

const now = '2026-11-08T12:00:00.000Z';
describe('seed integrity', () => {
  it('seeds exactly 20 strength exercises, two cardio choices, and the screenshot order', () => {
    const s = validateWorkspace(createSeed(now));
    expect(s.exercises.filter((e) => e.type === 'strength')).toHaveLength(20);
    expect(s.exercises.filter((e) => e.type === 'cardio')).toHaveLength(2);
    expect(byWorkout(s, 'A').map((p) => p.exerciseId)).toEqual([
      'ex01',
      'ex02',
      'ex03',
      'ex04',
      'ex05',
    ]);
    expect(byWorkout(s, 'B').map((p) => p.exerciseId)).toEqual([
      'ex06',
      'ex07',
      'ex08',
      'ex09',
      'ex10',
    ]);
    expect(byWorkout(s, 'C').map((p) => p.exerciseId)).toEqual([
      'ex11',
      'ex12',
      'ex13',
      'ex14',
      'ex15',
    ]);
    expect(byWorkout(s, 'D').map((p) => p.exerciseId)).toEqual([
      'ex16',
      'ex17',
      'ex18',
      'ex19',
      'ex20',
    ]);
    expect(s.exercises[1].legacyNames).toEqual(['Abdominal Extension']);
    expect(
      s.episodes.every((e) => e.startedAt === null && e.observedActiveAt === '2026-11-07'),
    ).toBe(true);
    expect(
      ['ex05', 'ex07', 'ex08', 'ex17'].map(
        (id) => s.exercises.find((e) => e.id === id)?.equipmentVariant,
      ),
    ).toEqual([null, null, null, null]);
    expect(s.exercises.every((e) => e.rotationPolicy === 'undecided')).toBe(true);
  });
});
describe('rotation operations', () => {
  it('reorders without changing membership', () => {
    const s = createSeed(now);
    const next = applyAction(
      s,
      { type: 'place', exerciseId: 'ex01', workoutId: 'A', position: 3 },
      now,
    );
    expect(byWorkout(next, 'A').map((p) => p.exerciseId)).toEqual([
      'ex02',
      'ex03',
      'ex04',
      'ex01',
      'ex05',
    ]);
    expect(next.episodes).toEqual(s.episodes);
    expect(s.revision).toBe(0);
    expect(next.revision).toBe(1);
  });
  it('rejects a sixth entry and cardio in a strength slot', () => {
    const s = createSeed(now);
    expect(() =>
      applyAction(s, { type: 'place', exerciseId: 'ex01', workoutId: 'B' }, now),
    ).toThrow('full');
    expect(() =>
      applyAction(s, { type: 'place', exerciseId: 'ex21', workoutId: 'B', replaceId: 'ex06' }, now),
    ).toThrow('strength');
  });
  it('swaps cross-workout placements atomically and preserves membership episodes', () => {
    const s = createSeed(now);
    const next = applyAction(
      s,
      { type: 'place', exerciseId: 'ex01', workoutId: 'B', replaceId: 'ex07' },
      now,
    );
    expect(byWorkout(next, 'A')[0].exerciseId).toBe('ex07');
    expect(byWorkout(next, 'B')[1].exerciseId).toBe('ex01');
    expect(next.episodes).toEqual(s.episodes);
    expect(next.placements).toHaveLength(20);
    expect(next.events.at(-1)?.kind).toBe('swap');
  });
  it('moves to an open slot and closes only the removed exercise membership', () => {
    const s = applyAction(createSeed(now), { type: 'remove', exerciseId: 'ex06' }, now);
    const next = applyAction(s, { type: 'place', exerciseId: 'ex01', workoutId: 'B' }, now);
    expect(next.episodes.find((e) => e.exerciseId === 'ex01')?.endedAt).toBeNull();
    expect(next.episodes.find((e) => e.exerciseId === 'ex06')?.endedAt).toBe(now);
    expect(byWorkout(next, 'A')).toHaveLength(4);
    expect(byWorkout(next, 'B')).toHaveLength(5);
  });
  it('creates a new episode on reintroduction without fabricating the original start', () => {
    const original = createSeed(now);
    const removed = applyAction(original, { type: 'remove', exerciseId: 'ex01' }, now);
    const next = applyAction(
      removed,
      { type: 'place', exerciseId: 'ex01', workoutId: 'B', replaceId: 'ex06' },
      now,
    );
    const episodes = next.episodes.filter((e) => e.exerciseId === 'ex01');
    expect(episodes).toHaveLength(2);
    expect(episodes[0].startedAt).toBeNull();
    expect(episodes[1].startedAt).toBe(now);
    expect(next.episodes.find((e) => e.exerciseId === 'ex06')?.endedAt).toBe(now);
  });
  it('requires explicit confirmation for staple swaps and removal', () => {
    const s = createSeed(now);
    s.exercises[0].rotationPolicy = 'staple';
    expect(() => applyAction(s, { type: 'remove', exerciseId: 'ex01' }, now)).toThrow('staple');
    expect(() =>
      applyAction(s, { type: 'place', exerciseId: 'ex06', workoutId: 'A', replaceId: 'ex01' }, now),
    ).toThrow('staple');
    expect(
      applyAction(s, { type: 'remove', exerciseId: 'ex01', confirmedStaple: true }, now).placements,
    ).toHaveLength(19);
  });
  it('archives without breaking references and restores without automatic placement', () => {
    const s = createSeed(now);
    const next = applyAction(s, { type: 'archive', exerciseId: 'ex01' }, now);
    expect(next.exercises[0].availability).toBe('archived');
    expect(next.placements).toHaveLength(19);
    expect(next.episodes[0].endedAt).toBe(now);
    const restored = applyAction(next, { type: 'restore', exerciseId: 'ex01' }, now);
    expect(restored.exercises[0].availability).toBe('available');
    expect(restored.placements).toHaveLength(19);
  });
  it('undo restores placement and membership while recording the reversal', () => {
    const s = createSeed(now);
    const removed = applyAction(s, { type: 'remove', exerciseId: 'ex01' }, now);
    const undo = applyAction(removed, { type: 'undo', previous: s }, now);
    expect(undo.placements).toEqual(s.placements);
    expect(undo.episodes).toEqual(s.episodes);
    expect(undo.events.map((e) => e.kind)).toEqual(['seed', 'remove', 'undo']);
    expect(undo.revision).toBe(2);
  });
  it('undo of adding a new exercise retains identity needed by history', () => {
    const s = createSeed(now);
    const added = applyAction(
      s,
      { type: 'edit', exercise: { ...s.exercises[0], id: 'new-exercise', name: 'New exercise' } },
      now,
    );
    const undo = applyAction(added, { type: 'undo', previous: s }, now);
    expect(undo.exercises.find((e) => e.id === 'new-exercise')?.availability).toBe('archived');
    expect(undo.events).toHaveLength(3);
  });
  it('rejects inconsistent references and duplicate placements', () => {
    const s = createSeed(now);
    s.placements[1].exerciseId = 'ex01';
    expect(() => validateWorkspace(s)).toThrow();
    const bad = createSeed(now);
    bad.episodes.pop();
    expect(() => validateWorkspace(bad)).toThrow();
  });
});
describe('portable backups', () => {
  it('round trips all records including unknown dates and history', () => {
    const s = applyAction(createSeed(now), { type: 'remove', exerciseId: 'ex01' }, now);
    expect(importBackup(exportBackup(s))).toEqual(s);
  });
  it('rejects unsupported versions, malformed JSON, dangling history and oversized input', () => {
    expect(() =>
      importBackup(exportBackup(createSeed(now)).replace('"version": 1', '"version": 2')),
    ).toThrow();
    expect(() => importBackup('{')).toThrow();
    expect(() => importBackup(' '.repeat(2_000_001))).toThrow('large');
    const s = createSeed(now);
    s.events[0].exerciseIds.push('nonexistent');
    expect(() => exportBackup(s)).toThrow();
  });
  it('restores as a new revision and records the import', () => {
    const s = createSeed(now);
    const changed = applyAction(s, { type: 'remove', exerciseId: 'ex01' }, now);
    const imported = applyAction(changed, { type: 'import', imported: s }, now);
    expect(imported.revision).toBe(2);
    expect(imported.placements).toEqual(s.placements);
    expect(imported.events.at(-1)?.kind).toBe('import');
  });
});
