import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  serializeCollection,
  serializeFolder,
  serializeRequest,
  serializeEnvironment,
} from '../format/serializer.js';
import { parseOpenApiSpec } from './parse-openapi.js';
import { mergeOrPreserveRequest } from './merger.js';
import type {
  ImportOpenApiOptions,
  OpenApiImportReport,
  OpenApiImportReportItem,
  OpenApiSkippedItem,
} from './types.js';

/**
 * Ensures that `.reqit/` is listed in the collection's `.gitignore` file.
 */
async function ensureGitignore(targetDir: string): Promise<void> {
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
    console.error('Failed to update .gitignore during OpenAPI import:', err);
  }
}

/**
 * Imports an OpenAPI 3.x or Swagger 2.0 specification directly to a target directory on disk.
 */
export async function importOpenApiToDirectory(
  options: ImportOpenApiOptions,
): Promise<OpenApiImportReport> {
  const { spec, targetDir, collectionNameOverride, mode = 'add-new', defaultBaseUrl } = options;
  const resolvedTarget = path.resolve(targetDir);

  // 1. Parse specification
  const parseResult = parseOpenApiSpec(spec, {
    collectionNameOverride,
    defaultBaseUrl,
  });

  const { collection, folders, rootRequests, environments, warnings, specFormat } = parseResult;

  // 2. Prepare target directories
  await fs.promises.mkdir(resolvedTarget, { recursive: true });
  await ensureGitignore(resolvedTarget);

  // 3. Write reqit.yaml
  const reqitPath = path.join(resolvedTarget, 'reqit.yaml');
  if (mode === 'clean' || !fs.existsSync(reqitPath)) {
    const collectionYaml = serializeCollection(collection);
    await fs.promises.writeFile(reqitPath, collectionYaml, 'utf-8');
  }

  // 4. Write environments
  if (environments && environments.length > 0) {
    const envsDir = path.join(resolvedTarget, 'environments');
    await fs.promises.mkdir(envsDir, { recursive: true });
    for (const env of environments) {
      const envPath = path.join(envsDir, `${env.name}.yaml`);
      if (mode === 'clean' || !fs.existsSync(envPath)) {
        const envYaml = serializeEnvironment(env);
        await fs.promises.writeFile(envPath, envYaml, 'utf-8');
      }
    }
  }

  // 5. Track results
  const reportItems: OpenApiImportReportItem[] = [];
  const skippedItems: OpenApiSkippedItem[] = [];
  let createdCount = 0;
  let mergedCount = 0;
  let skippedCount = 0;

  // 6. Write Root Requests
  for (const reqItem of rootRequests) {
    const requestFileName = `${reqItem.name}.yaml`;
    const targetFilePath = path.join(resolvedTarget, requestFileName);

    const mergeResult = await mergeOrPreserveRequest(targetFilePath, reqItem.request, mode);

    if (mergeResult.status === 'created') {
      const yaml = serializeRequest(mergeResult.request);
      await fs.promises.writeFile(targetFilePath, yaml, 'utf-8');
      createdCount++;
    } else if (mergeResult.status === 'merged') {
      const yaml = serializeRequest(mergeResult.request);
      await fs.promises.writeFile(targetFilePath, yaml, 'utf-8');
      mergedCount++;
    } else {
      skippedCount++;
      skippedItems.push({
        name: reqItem.name,
        reason: mergeResult.details || 'Existing file preserved',
      });
    }

    reportItems.push({
      type: 'request',
      name: reqItem.name,
      path: requestFileName,
      status: mergeResult.status,
      details: mergeResult.details,
    });
  }

  // 7. Write Folders and Folder Requests
  for (const folderItem of folders) {
    const folderDirPath = path.join(resolvedTarget, folderItem.relativePath);
    await fs.promises.mkdir(folderDirPath, { recursive: true });

    // folder.yaml
    const folderYamlPath = path.join(folderDirPath, 'folder.yaml');
    if (mode === 'clean' || !fs.existsSync(folderYamlPath)) {
      const folderYaml = serializeFolder(folderItem.folder);
      await fs.promises.writeFile(folderYamlPath, folderYaml, 'utf-8');
    }

    reportItems.push({
      type: 'folder',
      name: folderItem.name,
      path: folderItem.relativePath,
      status: 'created',
      details: `Folder with ${folderItem.children.length} operations`,
    });

    for (const childReq of folderItem.children) {
      const childFileName = `${childReq.name}.yaml`;
      const targetFilePath = path.join(folderDirPath, childFileName);

      const mergeResult = await mergeOrPreserveRequest(targetFilePath, childReq.request, mode);

      if (mergeResult.status === 'created') {
        const yaml = serializeRequest(mergeResult.request);
        await fs.promises.writeFile(targetFilePath, yaml, 'utf-8');
        createdCount++;
      } else if (mergeResult.status === 'merged') {
        const yaml = serializeRequest(mergeResult.request);
        await fs.promises.writeFile(targetFilePath, yaml, 'utf-8');
        mergedCount++;
      } else {
        skippedCount++;
        skippedItems.push({
          name: childReq.name,
          reason: mergeResult.details || 'Existing file preserved',
        });
      }

      reportItems.push({
        type: 'request',
        name: childReq.name,
        path: `${folderItem.relativePath}/${childFileName}`,
        status: mergeResult.status,
        details: mergeResult.details,
      });
    }
  }

  const totalRequests = createdCount + mergedCount + skippedCount;
  const totalFolders = folders.length;

  return {
    collectionName: collection.name,
    targetDirectory: resolvedTarget,
    specFormat,
    totalRequests,
    totalFolders,
    createdRequests: createdCount,
    mergedRequests: mergedCount,
    skippedRequests: skippedCount,
    warnings,
    convertedItems: reportItems,
    skippedItems,
    summaryText: `Import completed: ${createdCount} created, ${mergedCount} merged, ${skippedCount} preserved across ${totalFolders} folders into "${resolvedTarget}".`,
  };
}
