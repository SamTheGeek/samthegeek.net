import { existsSync } from 'node:fs';
import path from 'node:path';

const distDir = path.resolve('dist');
const forbiddenEntries = [
  'README.md',
  'DOWNLOAD_IMAGES_README.md',
  'CLAUDE.md',
  'STATUS.md',
  'scripts',
];

const found = forbiddenEntries.filter((entry) => existsSync(path.join(distDir, entry)));

if (found.length > 0) {
  throw new Error(
    `Build output contains forbidden entries: ${found.join(', ')}. ` +
      'Ensure documentation and scripts are not published.'
  );
}
