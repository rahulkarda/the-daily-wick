/**
 * Dry-run wrapper — re-invokes the main script with --dry-run so output
 * lands in tmp/ and state isn't touched.
 */
import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const target = resolve(__dirname, '../generate-daily-post.mjs');

const child = spawn(process.execPath, [target, '--dry-run'], {
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code) => process.exit(code ?? 1));
