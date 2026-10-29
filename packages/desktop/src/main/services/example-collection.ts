import * as fs from 'node:fs';
import * as path from 'node:path';
import { app } from 'electron';
import { fileService } from './file-service.js';
import type { CollectionTree } from '@reqit/core';

export function getExampleCollectionDir(): string {
  try {
    return path.join(app.getPath('userData'), 'example-collection');
  } catch {
    return path.join(process.cwd(), 'example-collection');
  }
}

export function createExampleCollectionFiles(targetDir: string): void {
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // 1. reqit.yaml
  fs.writeFileSync(
    path.join(targetDir, 'reqit.yaml'),
    `version: 1
name: Httpbin Example Collection
description: A complete sample collection testing various HTTP endpoints with Reqit
defaults:
  variables:
    baseUrl: https://httpbin.org
`,
    'utf-8',
  );

  // 2. environments/dev.yaml and environments/local.yaml
  const envDir = path.join(targetDir, 'environments');
  if (!fs.existsSync(envDir)) fs.mkdirSync(envDir, { recursive: true });

  fs.writeFileSync(
    path.join(envDir, 'dev.yaml'),
    `version: 1
name: dev
variables:
  baseUrl: https://httpbin.org
`,
    'utf-8',
  );

  fs.writeFileSync(
    path.join(envDir, 'local.yaml'),
    `version: 1
name: local
variables:
  baseUrl: http://localhost:8080
`,
    'utf-8',
  );

  // 3. .reqit/secrets.yaml
  const reqitDir = path.join(targetDir, '.reqit');
  if (!fs.existsSync(reqitDir)) fs.mkdirSync(reqitDir, { recursive: true });

  fs.writeFileSync(
    path.join(reqitDir, 'secrets.yaml'),
    `version: 1
environments:
  dev:
    apiKey: sample-masked-api-key-xyz
`,
    'utf-8',
  );

  // 4. HTTP Methods folder
  const httpMethodsDir = path.join(targetDir, 'HTTP Methods');
  if (!fs.existsSync(httpMethodsDir)) fs.mkdirSync(httpMethodsDir, { recursive: true });

  fs.writeFileSync(
    path.join(httpMethodsDir, 'GET Request.yaml'),
    `version: 1
name: GET Request
method: GET
url: "{{baseUrl}}/get"
params:
  - name: filter
    value: active
    enabled: true
  - name: limit
    value: "10"
    enabled: true
`,
    'utf-8',
  );

  fs.writeFileSync(
    path.join(httpMethodsDir, 'POST JSON.yaml'),
    `version: 1
name: POST JSON
method: POST
url: "{{baseUrl}}/post"
headers:
  - name: Content-Type
    value: application/json
    enabled: true
body:
  type: json
  content: |
    {
      "name": "Reqit User",
      "role": "engineer",
      "timestamp": 1700000000
    }
`,
    'utf-8',
  );

  fs.writeFileSync(
    path.join(httpMethodsDir, 'PUT Request.yaml'),
    `version: 1
name: PUT Request
method: PUT
url: "{{baseUrl}}/put"
headers:
  - name: Content-Type
    value: application/json
    enabled: true
body:
  type: json
  content: |
    {
      "status": "active",
      "updated": true
    }
`,
    'utf-8',
  );

  fs.writeFileSync(
    path.join(httpMethodsDir, 'DELETE Request.yaml'),
    `version: 1
name: DELETE Request
method: DELETE
url: "{{baseUrl}}/delete"
`,
    'utf-8',
  );

  // 5. Auth folder
  const authDir = path.join(targetDir, 'Auth');
  if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });

  fs.writeFileSync(
    path.join(authDir, 'Bearer Token.yaml'),
    `version: 1
name: Bearer Auth
method: GET
url: "{{baseUrl}}/bearer"
auth:
  type: bearer
  token: sample-auth-token-123
`,
    'utf-8',
  );

  fs.writeFileSync(
    path.join(authDir, 'Basic Auth.yaml'),
    `version: 1
name: Basic Auth
method: GET
url: "{{baseUrl}}/basic-auth/admin/password123"
auth:
  type: basic
  username: admin
  password: password123
`,
    'utf-8',
  );

  // 6. Status Codes folder
  const statusDir = path.join(targetDir, 'Status Codes');
  if (!fs.existsSync(statusDir)) fs.mkdirSync(statusDir, { recursive: true });

  fs.writeFileSync(
    path.join(statusDir, '200 OK.yaml'),
    `version: 1
name: 200 OK
method: GET
url: "{{baseUrl}}/status/200"
`,
    'utf-8',
  );

  fs.writeFileSync(
    path.join(statusDir, '404 Not Found.yaml'),
    `version: 1
name: 404 Not Found
method: GET
url: "{{baseUrl}}/status/404"
`,
    'utf-8',
  );

  fs.writeFileSync(
    path.join(statusDir, '500 Server Error.yaml'),
    `version: 1
name: 500 Server Error
method: GET
url: "{{baseUrl}}/status/500"
`,
    'utf-8',
  );

  // 7. Dynamic Data folder
  const dynamicDir = path.join(targetDir, 'Dynamic Data');
  if (!fs.existsSync(dynamicDir)) fs.mkdirSync(dynamicDir, { recursive: true });

  fs.writeFileSync(
    path.join(dynamicDir, 'Delay 1s.yaml'),
    `version: 1
name: Delay 1s (Timing Waterfall)
method: GET
url: "{{baseUrl}}/delay/1"
`,
    'utf-8',
  );
}

export async function openBundledExampleCollection(
  customDir?: string,
): Promise<CollectionTree | null> {
  const exampleDir = customDir || getExampleCollectionDir();
  // Generate files if directory is missing or empty
  if (!fs.existsSync(exampleDir) || !fs.existsSync(path.join(exampleDir, 'reqit.yaml'))) {
    createExampleCollectionFiles(exampleDir);
  }

  return fileService.openCollection(exampleDir);
}
