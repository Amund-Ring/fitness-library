import { describe, expect, it } from 'vitest';
import { categoryOf, equipmentKind } from './categories';
import { createSeed } from './seed';
import { validateWorkspace } from './model';
import { exportBackup, importBackup } from './backup';

describe('broad categories and existing data', () => {
  it('classifies the existing library without rewriting names, tags or variants', () => {
    const state = createSeed();
    const before = structuredClone(state);
    expect(state.exercises.map(categoryOf)).toEqual([
      'Back',
      'Core',
      'Legs',
      'Arms',
      'Chest',
      'Chest',
      'Legs',
      'Shoulders',
      'Back',
      'Legs',
      'Shoulders',
      'Back',
      'Chest',
      'Legs',
      'Arms',
      'Legs',
      'Shoulders',
      'Legs',
      'Arms',
      'Legs',
      'Cardio',
      'Cardio',
    ]);
    expect(state).toEqual(before);
    expect(validateWorkspace(state)).toEqual(before);
  });
  it('accepts old backups and preserves chosen categories and older metadata in new backups', () => {
    const state = createSeed();
    expect(importBackup(exportBackup(state))).toEqual(state);
    state.exercises[0].category = 'Back';
    state.exercises[0].gymZone = 'Existing saved zone';
    state.exercises[0].equipmentVariant = 'Existing saved variant';
    expect(importBackup(exportBackup(state))).toEqual(state);
    const edited = { ...state.exercises[0], category: 'Arms' as const };
    expect(categoryOf(edited)).toBe('Arms');
  });
  it('groups equipment without guessing unspecified variants', () => {
    expect(equipmentKind('Cable')).toBe('Machine');
    expect(equipmentKind('Plate-loaded machine')).toBe('Machine');
    expect(equipmentKind('Dumbbell')).toBe('Free weights');
    expect(equipmentKind('')).toBe('');
  });
});
