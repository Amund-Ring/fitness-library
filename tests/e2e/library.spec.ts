import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('chosen rotation starts are displayed, recorded and undoable', async ({ page }) => {
  await page.goto('/rotations?preview=1');
  await expect(page.locator('.membership-list')).toContainText('Start unknown');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Set unknown starts to today', exact: true }).click();
  await expect(page.locator('.membership-list button')).toHaveCount(20);
  await expect(page.locator('.membership-list')).not.toContainText('Start unknown');
  await expect(page.locator('.membership-list button').first()).toContainText('Started');
  await expect(page.locator('.timeline-event').first()).toContainText(
    'start date for 20 current exercises',
  );
  await expect(
    page.getByRole('button', { name: 'Set unknown starts to today', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('.membership-list')).toContainText('Start unknown');
});

test('desktop drag handles support keyboard reorder and cross-workout swap', async ({
  page,
}, info) => {
  test.skip(info.project.name === 'mobile', 'Mobile uses explicit arrangement controls.');
  await page.goto('/workouts?preview=1');
  const handle = page.getByLabel('Drag Lat Pulldown Machine', { exact: true });
  await handle.press('Space');
  await expect(page.locator('.dragging')).toBeVisible();
  await handle.press('ArrowDown');
  await expect(
    page.locator('[role="status"]').filter({ hasText: 'was moved over droppable area ex02' }),
  ).toHaveCount(1);
  await handle.press('Space');
  await expect(page.locator('#workout-A h4').nth(1)).toHaveText('Lat Pulldown Machine');
  const from = (await handle.boundingBox())!;
  const to = (await page.getByLabel('Drag Pec Fly Machine', { exact: true }).boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 12, from.y + from.height / 2);
  await expect(page.locator('.dragging')).toBeVisible();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
  await page.mouse.up();
  await expect(page.getByRole('dialog')).toContainText('Arrange your rotation');
  await page.getByLabel('Swap with — required for a full workout').selectOption('ex06');
  await page.getByRole('button', { name: 'Confirm swap', exact: true }).click();
  await expect(page.locator('#workout-B h4').first()).toHaveText('Lat Pulldown Machine');
  await expect(page.locator('#workout-A .count')).toHaveText('5/5');
});

test('workout layout and explicit swap preserve five slots and support undo', async ({
  page,
}, info) => {
  await page.goto('/workouts?preview=1');
  await expect(page.getByRole('heading', { name: 'Workouts', exact: true })).toBeVisible();
  await expect(
    page.locator('.app-header').getByRole('button', { name: 'Undo', exact: true }),
  ).toBeDisabled();
  if (info.project.name === 'mobile') {
    await expect(page.locator('#workout-A')).toBeVisible();
    await expect(page.locator('#workout-B')).toBeHidden();
    await page.getByRole('tab', { name: 'Workout B' }).click();
    await expect(page.locator('#workout-B')).toBeVisible();
    await page.getByRole('tab', { name: 'Workout A' }).click();
  } else await expect(page.locator('.workout-column:visible')).toHaveCount(4);
  await page.screenshot({
    path: info.outputPath('workouts.png'),
    fullPage: info.project.name === 'desktop',
  });
  await page.getByRole('button', { name: 'Arrange Lat Pulldown Machine', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Move exercise', exact: true })).toBeDisabled();
  await page.getByLabel('Swap with — required for a full workout').selectOption('ex07');
  await page.getByRole('button', { name: 'Confirm swap', exact: true }).click();
  await expect(page.locator('#workout-A h4').first()).toHaveText('Squat');
  await expect(page.locator('#workout-A .count')).toHaveText('5/5');
  await expect(
    page.locator('.app-header').getByRole('button', { name: 'Undo', exact: true }),
  ).toBeEnabled();
  await expect(page.locator('.toast')).toHaveCount(0);
  await expect(page.locator('.cloud-status')).toHaveAttribute('aria-label', 'Preview', {
    timeout: 5000,
  });
  await expect(
    page.locator('.app-header').getByRole('button', { name: 'Undo', exact: true }),
  ).toBeEnabled();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('#workout-A h4').first()).toHaveText('Lat Pulldown Machine');
  await expect(
    page.locator('.app-header').getByRole('button', { name: 'Undo', exact: true }),
  ).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('library search finds legacy labels, edits notes, and records history', async ({ page }) => {
  await page.goto('/library?preview=1');
  await page.getByRole('textbox', { name: 'Search exercises' }).fill('Abdominal Extension');
  await expect(page.locator('.library-row')).toHaveCount(1);
  await page.locator('.library-row').click();
  await expect(page.getByRole('dialog')).toContainText('Previously named: Abdominal Extension');
  await expect(page.getByLabel('Primary focus', { exact: true })).toHaveValue('Core');
  await expect(page.getByRole('textbox', { name: 'Movement pattern' })).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Gym zone' })).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Personal notes' }).fill('Comfortable range of motion.');
  await page.getByRole('button', { name: 'Save exercise', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: 'Data and account' }).click();
  const backupDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export JSON backup' }).click();
  const backupPath = await (await backupDownload).path();
  const backup = JSON.parse(await readFile(backupPath!, 'utf8'));
  const saved = backup.workspace.exercises.find((e: { id: string }) => e.id === 'ex02');
  expect(saved.category).toBe('Core');
  expect(saved.primaryMuscles).toEqual(['Core / abs']);
  expect(saved.movementPattern).toBe('Trunk flexion');
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('link', { name: 'Rotations', exact: true }).click();
  await expect(page.locator('.timeline-event').first()).toContainText(
    'Updated Abdominal Crunch Machine.',
  );
  await expect(page.locator('.membership-list')).toContainText('Start unknown');
});

test('create, place, archive and restore an exercise without losing history', async ({ page }) => {
  await page.goto('/library?preview=1');
  await page.getByRole('button', { name: 'Add exercise', exact: true }).click();
  await page.getByRole('textbox', { name: 'Exercise name', exact: true }).fill('Test cable row');
  await page.getByLabel('Primary focus', { exact: true }).selectOption('Back');
  await page.getByRole('button', { name: 'Save exercise', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search exercises' }).fill('Test cable row');
  await page.locator('.library-row').click();
  await page.getByRole('button', { name: 'Add to a workout', exact: true }).click();
  await page.getByLabel('Replace — required for a full workout').selectOption('ex01');
  await page.getByRole('button', { name: 'Confirm replacement', exact: true }).click();
  await page.locator('.library-row').click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Archive exercise', exact: true }).click();
  await expect(page.locator('.library-row')).toHaveCount(0);
  await page.getByLabel('Show archived').check();
  await page.locator('.library-row').click();
  await page.getByRole('button', { name: 'Restore exercise', exact: true }).click();
  await page.getByLabel('Show archived').uncheck();
  await expect(page.locator('.library-row')).toContainText('Test cable row');
  await expect(page.locator('.library-row .placement-cell')).toHaveText('—');
});

test('versioned backup is downloadable and invalid import leaves data untouched', async ({
  page,
}) => {
  await page.goto('/workouts?preview=1');
  await page.getByRole('button', { name: 'Data and account' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export JSON backup' }).click();
  expect((await download).suggestedFilename()).toMatch(/^fitness-library-.*\.json$/);
  await page.getByLabel('Import JSON backup').setInputFiles({
    name: 'invalid.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{}'),
  });
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('not a valid');
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await expect(page.getByRole('alert')).toContainText('not a valid');
  await expect(page.locator('#workout-A h4')).toHaveCount(5);
});

test('PWA manifest, icons and offline deep-link app shell work', async ({
  page,
  context,
  request,
}) => {
  await page.goto('/workouts?preview=1');
  const manifest = await (await request.get('/manifest.webmanifest')).json();
  expect(manifest.display).toBe('standalone');
  expect(manifest.start_url).toBe('/workouts');
  for (const icon of manifest.icons) expect((await request.get(icon.src)).ok()).toBe(true);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);
  await page.goto('/library?preview=1');
  await expect(page.getByRole('heading', { name: /^Exercise library/ })).toBeVisible();
  await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);
  await expect(
    page.getByText('Offline viewing · Editing will be available when you reconnect.'),
  ).toBeVisible();
});

test('category groups, colors and flat-list controls share the same classifications', async ({
  page,
}) => {
  await page.goto('/library?preview=1');
  await expect(page.locator('.library-group')).toHaveCount(7);
  await page.getByLabel('Filter by category').selectOption('Shoulders');
  await expect(page.locator('.library-row')).toHaveCount(3);
  await expect(page.locator('.library-row')).toContainText([
    'Lateral Raise',
    'Overhead Press',
    'Rear Delt Machine',
  ]);
  await page.getByLabel('Group exercises').selectOption('none');
  await expect(page.locator('.group-heading')).toHaveCount(0);
  await expect(page.locator('.library-row .category-shoulders')).toHaveCount(3);
  await page.getByRole('link', { name: 'Workouts', exact: true }).click();
  await expect(page.locator('#workout-A .category-back')).toHaveCount(1);
  await expect(page.locator('#workout-A .category-core')).toHaveCount(1);
});

test('workout checks, inclusion grouping and visible filter toggles match actual placements', async ({
  page,
}, info) => {
  await page.goto('/library?preview=1');
  await expect(page.locator('.membership-check')).toHaveCount(20);
  for (const workout of ['A', 'B', 'C', 'D']) {
    await expect(page.locator(`.workout-badge.workout-${workout}`)).toHaveCount(5);
    await expect(page.locator(`.workout-badge.workout-${workout}`).first()).toHaveText(
      `Workout ${workout}`,
    );
  }
  await expect(page.getByRole('button', { name: 'Filters', exact: true })).toHaveCount(0);
  await expect(page.getByRole('group', { name: 'Workout inclusion' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Equipment filter' })).toBeVisible();
  await page.screenshot({ path: info.outputPath('library.png'), fullPage: false });
  await page.getByLabel('Group exercises').selectOption('usage');
  await expect(
    page.getByRole('region', { name: 'In workout program', exact: true }).locator('.library-row'),
  ).toHaveCount(20);
  await expect(
    page
      .getByRole('region', { name: 'Not in workout program', exact: true })
      .locator('.library-row'),
  ).toHaveCount(2);
  await page.getByRole('button', { name: 'In workouts', exact: true }).click();
  await expect(page.locator('.library-row')).toHaveCount(20);
  await page.getByRole('button', { name: 'Free weights', exact: true }).click();
  await expect(page.locator('.library-row')).toHaveCount(1);
  await expect(page.locator('.library-row')).toContainText('Dumbbell Curl');
  await page.getByRole('button', { name: 'All equipment', exact: true }).click();
  await page.getByRole('button', { name: 'Not in workouts', exact: true }).click();
  await expect(page.locator('.library-row')).toHaveCount(2);
  await expect(page.locator('.membership-check')).toHaveCount(0);
  await expect(page.locator('.library-row .placement-cell')).toHaveText(['Finisher', 'Finisher']);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
