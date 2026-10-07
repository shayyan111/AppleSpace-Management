import { copyFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 12)) {
  console.error('AppleSpace requires Node.js 22.12 or newer. Install Node.js 24 LTS, then retry.');
  process.exit(1);
}

const root = fileURLToPath(new URL('../', import.meta.url));
const local = resolve(root, '.env.local');
if (!existsSync(local) && !existsSync(resolve(root, '.env'))) {
  copyFileSync(resolve(root, '.env.example'), local, 1);
  console.log('Created .env.local for the existing AppleSpace database.');
} else {
  console.log('Using existing local database configuration.');
}
