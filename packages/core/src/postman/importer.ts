import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  serializeCollection,
  serializeFolder,
  serializeRequest,
  serializeEnvironment,
  serializeSecrets,
} from '../format/serializer.js';
import { parsePostmanCollection } from './parse-collection.js';
import { parsePostmanEnvironment } from './parse-environment.js';
import type {
  ConvertedFolderItem,
  ConvertedRequestItem,
  ImportPostmanOptions,
  PostmanImportReport,
} from './types.js';

/**
 * Ensures that `.reqit/` is listed in the collection's `.gitignore` file.
 */
async function ensureGitignoreForSecrets(targetDir: string): Promise<void> {
  const gitignorePath = path.join(targetDir, '.gitignore');
  const secretPattern = '.reqit/';

  try {
    if (fs.existsSync(gitignorePath)) {
      const content = await fs.promises.readFile(gitignorePath, 'utf-8');
      if (!content.includes(secretPattern)) {
        const separator = content.endsWith('\n') ? '' : '\n';
        await fs.promises.writeFile(
          gitignorePath,
          `${content}${separator}# Reqit local secrets\n${secretPattern}\n`,
          'utf-8',
        );
      }
    } else {
      await fs.promises.writeFile(
        gitignorePath,
        `# Reqit local secrets\n${secretPattern}\n`,
        'utf-8',
      );
    }
  } catch (err) {
    console.error('Failed to update .gitignore during Postman import:', err);
  }
}

/**
 * Recursively writes converted folders and requests to disk.
 */
async function writeItemsToDisk(
  currentDir: string,
  items: Array<ConvertedRequestItem | ConvertedFolderItem>,
): Promise<void> {
  for (const item of items) {
    if (item.type === 'folder') {
      const folderPath = path.join(currentDir, item.relativePath);
      await fs.promises.mkdir(folderPath, { recursive: true });

      // Write folder.yaml
      const folderFilePath = path.join(folderPath, 'folder.yaml');
      const folderYaml = serializeFolder(item.folder);
      await fs.promises.writeFile(folderFilePath, folderYaml, 'utf-8');

      // Recursively write child folders and requests
      await writeItemsToDisk(folderPath, item.children);
    } else if (item.type === 'request') {
      const requestFilePath = path.join(currentDir, `${item.relativePath}.yaml`);
      const requestYaml = serializeRequest(item.request);
      await fs.promises.writeFile(requestFilePath, requestYaml, 'utf-8');
    }
  }
}

/**
 * Imports a Postman Collection v2.1 (and optional Postman Environment) directly
 * to a target directory on disk, producing standard Reqit YAML files.
 */
export async function importPostmanCollectionToDirectory(
  options: ImportPostmanOptions,
): Promise<PostmanImportReport> {
  const { collectionJson, environmentJson, targetDir, collectionNameOverride } = options;
  const resolvedTarget = path.resolve(targetDir);

  // 1. Parse collection
  const parseResult = parsePostmanCollection(collectionJson, collectionNameOverride);
  const { collection, items, report } = parseResult;

  // 2. Prepare target directory
  await fs.promises.mkdir(resolvedTarget, { recursive: true });

  // 3. Write reqit.yaml
  const reqitPath = path.join(resolvedTarget, 'reqit.yaml');
  const collectionYaml = serializeCollection(collection);
  await fs.promises.writeFile(reqitPath, collectionYaml, 'utf-8');

  // 4. Write folder hierarchy and requests
  await writeItemsToDisk(resolvedTarget, items);

  // 5. Handle optional Postman Environment
  let totalEnvironments = 0;
  let totalSecrets = 0;

  if (environmentJson) {
    try {
      const envResult = parsePostmanEnvironment(environmentJson);
      const envDir = path.join(resolvedTarget, 'environments');
      await fs.promises.mkdir(envDir, { recursive: true });

      const envName = envResult.environment.name;
      const envFilePath = path.join(envDir, `${envName}.yaml`);
      await fs.promises.writeFile(
        envFilePath,
        serializeEnvironment(envResult.environment),
        'utf-8',
      );
      totalEnvironments++;

      report.convertedItems.push({
        type: 'environment',
        name: envName,
        path: path.relative(resolvedTarget, envFilePath),
        details: `${Object.keys(envResult.environment.variables).length} variable(s)`,
      });

      if (envResult.reportNotes.warnings.length > 0) {
        report.warnings.push(...envResult.reportNotes.warnings);
      }

      // Handle secrets if any were detected / isolated
      if (envResult.secrets && envResult.reportNotes.secretCount > 0) {
        const reqitDir = path.join(resolvedTarget, '.reqit');
        await fs.promises.mkdir(reqitDir, { recursive: true });

        const secretsPath = path.join(reqitDir, 'secrets.yaml');
        await fs.promises.writeFile(secretsPath, serializeSecrets(envResult.secrets), 'utf-8');
        totalSecrets = envResult.reportNotes.secretCount;

        await ensureGitignoreForSecrets(resolvedTarget);

        report.convertedItems.push({
          type: 'secret',
          name: `${envName} secrets`,
          path: '.reqit/secrets.yaml',
          details: `${totalSecrets} secret variable(s) securely isolated`,
        });
      }
    } catch (envErr) {
      report.warnings.push(
        `Failed to import Postman environment: ${envErr instanceof Error ? envErr.message : String(envErr)}`,
      );
    }
  } else if (parseResult.environments && parseResult.environments.length > 0) {
    // Write out embedded environment(s) found in collection JSON
    for (const embEnv of parseResult.environments) {
      const envDir = path.join(resolvedTarget, 'environments');
      await fs.promises.mkdir(envDir, { recursive: true });

      const envName = embEnv.name;
      const envFilePath = path.join(envDir, `${envName}.yaml`);
      await fs.promises.writeFile(envFilePath, serializeEnvironment(embEnv.environment), 'utf-8');
      totalEnvironments++;

      report.convertedItems.push({
        type: 'environment',
        name: envName,
        path: path.relative(resolvedTarget, envFilePath),
        details: `${Object.keys(embEnv.environment.variables).length} variable(s)`,
      });

      if (parseResult.secrets && embEnv.secretCount > 0) {
        const reqitDir = path.join(resolvedTarget, '.reqit');
        await fs.promises.mkdir(reqitDir, { recursive: true });

        const secretsPath = path.join(reqitDir, 'secrets.yaml');
        await fs.promises.writeFile(secretsPath, serializeSecrets(parseResult.secrets), 'utf-8');
        totalSecrets += embEnv.secretCount;

        await ensureGitignoreForSecrets(resolvedTarget);

        report.convertedItems.push({
          type: 'secret',
          name: `${envName} secrets`,
          path: '.reqit/secrets.yaml',
          details: `${embEnv.secretCount} secret variable(s) securely isolated`,
        });
      }
    }
  }

  // 6. Finalize report
  report.targetDirectory = resolvedTarget;
  report.totalEnvironments = totalEnvironments;
  report.totalSecrets = totalSecrets;

  const warningCount = report.warnings.length;
  report.summaryText = `Successfully imported "${report.collectionName}" to ${resolvedTarget}: ${report.totalRequests} request(s), ${report.totalFolders} folder(s), ${totalEnvironments} environment(s), ${totalSecrets} secret(s) isolated.${warningCount > 0 ? ` (${warningCount} notice/warning item(s))` : ''}`;

  return report;
}
