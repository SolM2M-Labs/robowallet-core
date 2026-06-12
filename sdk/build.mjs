// Build ESM + type declarations, then a CommonJS bundle, into dist/.
import { execSync } from 'node:child_process';
import { renameSync, rmSync, readdirSync, existsSync } from 'node:fs';

rmSync('dist', { recursive: true, force: true });
rmSync('dist-cjs', { recursive: true, force: true });

// ESM + .d.ts
execSync('npx tsc -p tsconfig.json', { stdio: 'inherit' });
// CommonJS
execSync('npx tsc -p tsconfig.cjs.json', { stdio: 'inherit' });

// Promote the CJS output to dist/index.cjs
renameSync('dist-cjs/index.js', 'dist/index.cjs');
rmSync('dist-cjs', { recursive: true, force: true });

const produced = existsSync('dist') ? readdirSync('dist') : [];
console.log('dist/:', produced.join(', '));
