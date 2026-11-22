import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';

const cliDir = path.dirname(fileURLToPath(import.meta.url));

await esbuild.build({
  entryPoints: [path.join(cliDir, 'src/index.ts')],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: path.join(cliDir, 'dist/index.js'),
  banner: {
    js: `#!/usr/bin/env node
import { createRequire as __createRequire } from 'node:module';
const require = __createRequire(import.meta.url);`,
  },
});

console.log('Build complete: packages/cli/dist/index.js');
