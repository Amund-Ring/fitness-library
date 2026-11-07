import { z } from 'zod';
import { validateWorkspace, workspaceSchema, type Workspace } from './model';

const backupSchema = z.object({
  format: z.literal('fitness-library'),
  version: z.literal(1),
  exportedAt: z.iso.datetime(),
  workspace: workspaceSchema,
});
export function exportBackup(workspace: Workspace) {
  return JSON.stringify(
    {
      format: 'fitness-library',
      version: 1,
      exportedAt: new Date().toISOString(),
      workspace: validateWorkspace(workspace),
    },
    null,
    2,
  );
}
export function importBackup(text: string): Workspace {
  if (new TextEncoder().encode(text).length > 2_000_000)
    throw new Error('Backup is too large (maximum 2 MB).');
  const backup = backupSchema.parse(JSON.parse(text));
  return validateWorkspace(backup.workspace);
}
export function downloadBackup(state: Workspace, prefix = 'fitness-library') {
  const url = URL.createObjectURL(new Blob([exportBackup(state)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${prefix}-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
