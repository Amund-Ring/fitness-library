import { readFile, writeFile } from 'node:fs/promises';

try {
  process.loadEnvFile('.env.local');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const projectId = process.env.VITE_FIREBASE_PROJECT_ID;
const owner = process.env.VITE_OWNER_EMAIL;
if (!projectId || !/^[a-z][a-z0-9-]{4,29}$/.test(projectId)) {
  throw new Error('Set a valid VITE_FIREBASE_PROJECT_ID in .env.local before deploying.');
}
if (!owner || !/^[a-zA-Z0-9.!#$%&*+\-/=?^_`{|}~]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(owner)) {
  throw new Error('Set VITE_OWNER_EMAIL in .env.local before deploying.');
}
// These generated files stay local. Never put Admin SDK keys in .env.local.
const rules = (await readFile('firestore.rules.template', 'utf8')).replaceAll(
  '__OWNER_EMAIL__',
  owner,
);
await writeFile('firestore.rules', rules);
await writeFile(
  '.firebaserc',
  JSON.stringify({ projects: { default: projectId } }, null, 2) + '\n',
);
console.log('Prepared local Firebase rules and project selection.');
