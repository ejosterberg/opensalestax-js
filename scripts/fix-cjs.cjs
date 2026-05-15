// SPDX-License-Identifier: Apache-2.0

/**
 * Post-build helper. Drops a `package.json` shim into each of
 * `dist/esm/` and `dist/cjs/` so Node's module resolver picks the
 * right format regardless of the parent `package.json`'s `"type"`
 * field.
 *
 * Without these shims, Node would interpret CJS files as ESM
 * (because the root package is `"type": "module"`) and ESM files
 * as CJS in dual consumers.
 */

const { writeFileSync, mkdirSync } = require('node:fs');
const { join } = require('node:path');

const dist = join(__dirname, '..', 'dist');

mkdirSync(join(dist, 'esm'), { recursive: true });
mkdirSync(join(dist, 'cjs'), { recursive: true });

writeFileSync(
  join(dist, 'esm', 'package.json'),
  JSON.stringify({ type: 'module' }) + '\n',
);
writeFileSync(
  join(dist, 'cjs', 'package.json'),
  JSON.stringify({ type: 'commonjs' }) + '\n',
);

console.log('fix-cjs: wrote dual-module shims');
