import { z } from 'zod';
import type {
  CollectionFile,
  EnvironmentFile,
  FolderFile,
  HttpMethod,
  RequestFile,
  SecretsFile,
} from './types.js';

export interface ValidationIssue {
  path: string;
  message: string;
}

export class FormatValidationError extends Error {
  readonly filePath?: string;
  readonly issues: ValidationIssue[];

  constructor(message: string, issues: ValidationIssue[], filePath?: string) {
    const formattedIssues = issues
      .map(issue => `  - [${issue.path || 'root'}]: ${issue.message}`)
      .join('\n');
    const fullMessage = filePath
      ? `${message} in "${filePath}":\n${formattedIssues}`
      : `${message}:\n${formattedIssues}`;

    super(fullMessage);
    this.name = 'FormatValidationError';
    this.filePath = filePath;
    this.issues = issues;
  }
}

export const HTTP_METHODS: HttpMethod[] = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS',
];

export const httpMethodSchema = z.enum(HTTP_METHODS as [HttpMethod, ...HttpMethod[]], {
  message: 'Method must be one of: GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS',
});

export const keyValueSchema = z
  .object({
    name: z.string({
      message: 'Field "name" is required and must be a string',
    }),
    value: z
      .union([z.string(), z.number(), z.boolean()], {
        message: 'Field "value" must be a string, number, or boolean',
      })
      .transform(v => String(v)),
    enabled: z.boolean().optional(),
  })
  .passthrough();

export const authSchema = z
  .object({
    type: z.string({
      message: 'Auth field "type" is required',
    }),
  })
  .passthrough();

export const bodySchema = z
  .object({
    type: z.string({
      message: 'Body field "type" is required',
    }),
    content: z.string().optional(),
    form: z.array(keyValueSchema).optional(),
  })
  .passthrough();

export const scriptsSchema = z
  .object({
    pre: z.string().optional(),
    post: z.string().optional(),
  })
  .passthrough();

export const testAssertionSchema = z
  .object({
    name: z.string({
      message: 'Test assertion field "name" is required',
    }),
    assert: z.string({
      message: 'Test assertion field "assert" is required',
    }),
  })
  .passthrough();

export const requestFileSchema = z
  .object({
    version: z.number({
      message: 'Field "version" is required and must be a number',
    }),
    name: z
      .string({
        message: 'Field "name" is required and must be a string',
      })
      .min(1, 'Field "name" cannot be empty'),
    method: httpMethodSchema,
    url: z.string({
      message: 'Field "url" is required and must be a string',
    }),
    params: z.array(keyValueSchema).optional(),
    headers: z.array(keyValueSchema).optional(),
    auth: authSchema.optional(),
    body: bodySchema.optional(),
    scripts: scriptsSchema.optional(),
    tests: z.array(testAssertionSchema).optional(),
    docs: z.string().optional(),
  })
  .passthrough();

export const folderFileSchema = z
  .object({
    version: z.number({
      message: 'Field "version" is required and must be a number',
    }),
    name: z
      .string({
        message: 'Field "name" is required and must be a string',
      })
      .min(1, 'Field "name" cannot be empty'),
    order: z.array(z.string()).optional(),
    headers: z.array(keyValueSchema).optional(),
    auth: authSchema.optional(),
    docs: z.string().optional(),
  })
  .passthrough();

export const collectionDefaultsSchema = z
  .object({
    timeoutMs: z.number().optional(),
    followRedirects: z.boolean().optional(),
    validateSsl: z.boolean().optional(),
    headers: z.array(keyValueSchema).optional(),
    auth: authSchema.optional(),
  })
  .passthrough();

export const collectionFileSchema = z
  .object({
    version: z.number({
      message: 'Field "version" is required and must be a number',
    }),
    name: z
      .string({
        message: 'Field "name" is required and must be a string',
      })
      .min(1, 'Field "name" cannot be empty'),
    defaults: collectionDefaultsSchema.optional(),
    docs: z.string().optional(),
  })
  .passthrough();

export const environmentFileSchema = z
  .object({
    version: z.number({
      message: 'Field "version" is required and must be a number',
    }),
    name: z
      .string({
        message: 'Field "name" is required and must be a string',
      })
      .min(1, 'Field "name" cannot be empty'),
    variables: z.record(
      z.string(),
      z.union([z.string(), z.number(), z.boolean()]).transform(v => String(v)),
    ),
  })
  .passthrough();

export const secretsFileSchema = z
  .object({
    version: z.number({
      message: 'Field "version" is required and must be a number',
    }),
    environments: z.record(z.string(), z.record(z.string(), z.string())),
  })
  .passthrough();

export function validateSchema<T>(schema: z.ZodType<T>, data: unknown, filePath?: string): T {
  if (data === null || typeof data !== 'object') {
    throw new FormatValidationError(
      'Document must be a valid YAML object',
      [{ path: 'root', message: 'Expected an object, received null or primitive' }],
      filePath,
    );
  }

  const result = schema.safeParse(data);
  if (!result.success) {
    const issues: ValidationIssue[] = result.error.issues.map(issue => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    throw new FormatValidationError('Schema validation failed', issues, filePath);
  }
  return result.data;
}

export function validateRequestFile(data: unknown, filePath?: string): RequestFile {
  return validateSchema(requestFileSchema, data, filePath) as RequestFile;
}

export function validateFolderFile(data: unknown, filePath?: string): FolderFile {
  return validateSchema(folderFileSchema, data, filePath) as FolderFile;
}

export function validateCollectionFile(data: unknown, filePath?: string): CollectionFile {
  return validateSchema(collectionFileSchema, data, filePath) as CollectionFile;
}

export function validateEnvironmentFile(data: unknown, filePath?: string): EnvironmentFile {
  return validateSchema(environmentFileSchema, data, filePath) as EnvironmentFile;
}

export function validateSecretsFile(data: unknown, filePath?: string): SecretsFile {
  return validateSchema(secretsFileSchema, data, filePath) as SecretsFile;
}
