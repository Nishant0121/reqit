import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCollectionStore } from './collectionStore';
import type { EnvironmentFile, SecretsFile } from '@reqit/core/format';

describe('CollectionStore Environments & Secrets (Phase 11)', () => {
  const storage = new Map<string, string>();
  const mockLocalStorage = {
    getItem: (key: string) => storage.get(key) || null,
    setItem: (key: string, val: string) => storage.set(key, String(val)),
    removeItem: (key: string) => storage.delete(key),
    clear: () => storage.clear(),
  };

  beforeEach(() => {
    storage.clear();
    (globalThis as unknown as { localStorage: typeof mockLocalStorage }).localStorage =
      mockLocalStorage;
    (globalThis as unknown as { window: unknown }).window = globalThis;
    useCollectionStore.setState({
      currentTree: {
        rootPath: '/workspace/col',
        collection: {
          version: 1,
          name: 'Col',
          defaults: {
            variables: {
              baseUrl: 'https://api.default.example.com',
              apiKey: 'col-key',
              timeout: 5000,
            },
          },
        },
        tree: [
          {
            id: '/workspace/col/users',
            name: 'Users',
            path: '/workspace/col/users',
            relativePath: 'users',
            type: 'folder',
            folder: {
              version: 1,
              name: 'Users',
              variables: {
                folderVar: 'folder-val',
                apiKey: 'folder-key',
              },
            },
            children: [
              {
                id: '/workspace/col/users/get.yaml',
                name: 'Get User',
                path: '/workspace/col/users/get.yaml',
                relativePath: 'users/get.yaml',
                type: 'request',
                method: 'GET',
              },
            ],
          },
        ],
      },
      environments: {
        dev: {
          version: 1,
          name: 'dev',
          variables: {
            baseUrl: 'https://dev.api.example.com',
            envVar: 'dev-val',
            apiKey: 'dev-key',
          },
        },
        prod: {
          version: 1,
          name: 'prod',
          variables: {
            baseUrl: 'https://prod.api.example.com',
            envVar: 'prod-val',
          },
        },
      },
      secrets: {
        version: 1,
        environments: {
          dev: {
            apiKey: 'secret-dev-token-12345',
            secretOnly: 'dev-secret-xyz',
          },
        },
      },
      activeEnvironment: 'none',
      error: null,
    });
  });

  it('updates activeEnvironment and persists per-collection to localStorage', () => {
    const store = useCollectionStore.getState();
    expect(store.activeEnvironment).toBe('none');

    store.setActiveEnvironment('dev');
    expect(useCollectionStore.getState().activeEnvironment).toBe('dev');
    expect(localStorage.getItem('reqit:active-env:/workspace/col')).toBe('dev');

    store.setActiveEnvironment('prod');
    expect(useCollectionStore.getState().activeEnvironment).toBe('prod');
    expect(localStorage.getItem('reqit:active-env:/workspace/col')).toBe('prod');
  });

  it('resolves variables respecting scope priority: collection < folder < environment < secrets', () => {
    const store = useCollectionStore.getState();

    // 1. With activeEnvironment = 'none', only collection and folder scopes resolve
    const reqPath = '/workspace/col/users/get.yaml';
    let resolved = store.getResolvedVariables(reqPath);

    expect(resolved['baseUrl']?.value).toBe('https://api.default.example.com');
    expect(resolved['baseUrl']?.scope).toBe('collection');

    // Folder overrides collection
    expect(resolved['apiKey']?.value).toBe('folder-key');
    expect(resolved['apiKey']?.scope).toBe('folder');

    // 2. With activeEnvironment = 'dev', environment overrides folder, secrets override environment
    store.setActiveEnvironment('dev');
    resolved = useCollectionStore.getState().getResolvedVariables(reqPath);

    expect(resolved['baseUrl']?.value).toBe('https://dev.api.example.com');
    expect(resolved['baseUrl']?.scope).toBe('environment (dev)');

    expect(resolved['envVar']?.value).toBe('dev-val');
    expect(resolved['envVar']?.scope).toBe('environment (dev)');

    // Secret overrides environment for 'apiKey'
    expect(resolved['apiKey']?.value).toBe('secret-dev-token-12345');
    expect(resolved['apiKey']?.scope).toBe('secrets (dev)');

    expect(resolved['secretOnly']?.value).toBe('dev-secret-xyz');
    expect(resolved['secretOnly']?.scope).toBe('secrets (dev)');
  });

  it('saves environment via API and updates store state', async () => {
    window.reqitApi = {
      saveEnvironment: vi.fn().mockResolvedValue('/workspace/col/environments/staging.yaml'),
      openCollection: vi.fn().mockResolvedValue(null),
    } as unknown as typeof window.reqitApi;

    const newEnv: EnvironmentFile = {
      version: 1,
      name: 'staging',
      variables: { baseUrl: 'https://staging.api.example.com' },
    };

    const success = await useCollectionStore.getState().saveEnvironment('staging', newEnv);
    expect(success).toBe(true);
    expect(window.reqitApi?.saveEnvironment).toHaveBeenCalledWith({
      rootPath: '/workspace/col',
      name: 'staging',
      environment: newEnv,
    });
    expect(useCollectionStore.getState().environments['staging']?.variables.baseUrl).toBe(
      'https://staging.api.example.com',
    );
  });

  it('deletes environment via API and cleans up store state', async () => {
    window.reqitApi = {
      deleteEnvironment: vi.fn().mockResolvedValue(true),
      openCollection: vi.fn().mockResolvedValue(null),
    } as unknown as typeof window.reqitApi;

    useCollectionStore.setState({ activeEnvironment: 'dev' });

    const success = await useCollectionStore.getState().deleteEnvironment('dev');
    expect(success).toBe(true);
    expect(window.reqitApi?.deleteEnvironment).toHaveBeenCalledWith({
      rootPath: '/workspace/col',
      name: 'dev',
    });
    expect(useCollectionStore.getState().environments['dev']).toBeUndefined();
    expect(useCollectionStore.getState().activeEnvironment).toBe('none');
  });

  it('saves secrets via API and updates store state', async () => {
    window.reqitApi = {
      saveSecrets: vi.fn().mockResolvedValue('/workspace/col/.reqit/secrets.yaml'),
      openCollection: vi.fn().mockResolvedValue(null),
    } as unknown as typeof window.reqitApi;

    const newSecrets: SecretsFile = {
      version: 1,
      environments: {
        prod: { token: 'super-prod-secret' },
      },
    };

    const success = await useCollectionStore.getState().saveSecrets(newSecrets);
    expect(success).toBe(true);
    expect(window.reqitApi?.saveSecrets).toHaveBeenCalledWith({
      rootPath: '/workspace/col',
      secrets: newSecrets,
    });
    expect(useCollectionStore.getState().secrets?.environments.prod?.token).toBe(
      'super-prod-secret',
    );
  });
});
