import { Command } from 'commander';
import { runCollection } from './runner.js';
import { formatRequestResult, parseReporterList, processReporters } from './reporters/index.js';
import type { CliRunOptions } from './types.js';

export const CLI_VERSION = '0.3.0';

export * from './types.js';
export * from './env.js';
export * from './runner.js';
export * from './reporters/index.js';

export function createProgram(): Command {
  const program = new Command();

  program
    .name('reqit')
    .description('Git-native, local-first API client CLI runner')
    .version(CLI_VERSION);

  program
    .command('run <path>')
    .description('Execute an entire API collection, subfolder, or individual request file')
    .option('-e, --env <name>', 'Environment name to activate (from environments/<name>.yaml)')
    .option('-f, --folder <name>', 'Execute only requests within this folder')
    .option('-s, --secrets <file>', 'Custom path to secrets YAML file')
    .option('-b, --bail', 'Halt execution immediately on the first failed assertion or request')
    .option('-t, --timeout <ms>', 'Request timeout in milliseconds', (val: string) =>
      parseInt(val, 10),
    )
    .option('-d, --delay <ms>', 'Delay between requests in milliseconds', (val: string) =>
      parseInt(val, 10),
    )
    .option('-k, --insecure', 'Allow insecure SSL/TLS certificates (validateSsl: false)')
    .option(
      '-r, --reporter <reporters...>',
      'Reporters to use: console, json, junit (default: console)',
      ['console'],
    )
    .option('-o, --output <file>', 'Write report output (json or junit) to a file')
    .action(async (targetPath: string, options: CliRunOptions) => {
      try {
        const reporters = parseReporterList(options.reporter);
        const isConsoleEnabled = reporters.includes('console');

        if (isConsoleEnabled) {
          console.log(`\nReqit CLI v${CLI_VERSION}\nRunning target: ${targetPath}`);
          if (options.env) console.log(`Environment: ${options.env}`);
          if (options.folder) console.log(`Folder filter: ${options.folder}`);
          console.log('');
        }

        const summary = await runCollection(targetPath, options, result => {
          if (isConsoleEnabled) {
            console.log(formatRequestResult(result));
          }
        });

        await processReporters(summary, options);

        if (!summary.success) {
          process.exitCode = 1;
        } else {
          process.exitCode = 0;
        }
      } catch (err: unknown) {
        console.error(`\nError: ${err instanceof Error ? err.message : String(err)}\n`);
        process.exitCode = 1;
      }
    });

  return program;
}

// Auto-run if executed directly via Node / CLI
if (
  typeof process !== 'undefined' &&
  process.argv &&
  process.argv[1] &&
  (process.argv[1].endsWith('dist/index.js') ||
    process.argv[1].endsWith('dist\\index.js') ||
    process.argv[1].endsWith('reqit') ||
    process.argv[1].includes('cli'))
) {
  const prog = createProgram();
  prog.parse(process.argv);
}
