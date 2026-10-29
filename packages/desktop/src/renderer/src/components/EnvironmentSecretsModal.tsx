import React, { useState, useEffect } from 'react';
import { Globe, Lock, Plus, Trash2, Eye, EyeOff, Check, AlertTriangle, Edit2 } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { useCollectionStore } from '../stores/collectionStore';
import type { EnvironmentFile, SecretsFile } from '@reqit/core/format';

export interface EnvironmentSecretsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'environments' | 'secrets';
  initialVariableName?: string;
}

interface VarRow {
  id: string;
  key: string;
  value: string;
}

export function EnvironmentSecretsModal({
  isOpen,
  onClose,
  initialTab = 'environments',
  initialVariableName,
}: EnvironmentSecretsModalProps): React.JSX.Element | null {
  const {
    environments,
    secrets,
    activeEnvironment,
    setActiveEnvironment,
    saveEnvironment,
    deleteEnvironment,
    saveSecrets,
  } = useCollectionStore();

  const [activeTab, setActiveTab] = useState<'environments' | 'secrets'>(initialTab);
  const [selectedEnv, setSelectedEnv] = useState<string>('dev');
  const [newEnvName, setNewEnvName] = useState<string>('');
  const [isAddingEnv, setIsAddingEnv] = useState<boolean>(false);
  const [renamingEnv, setRenamingEnv] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState<string>('');

  // Environment variables state
  const [envVars, setEnvVars] = useState<VarRow[]>([]);
  // Secrets variables state
  const [secretVars, setSecretVars] = useState<VarRow[]>([]);
  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, boolean>>({});

  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError?: boolean } | null>(
    null,
  );

  const envNames = Object.keys(environments);

  // Initialize selected env and tabs when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setStatusMessage(null);
      setRevealedSecrets({});
      setIsAddingEnv(false);
      setRenamingEnv(null);

      const targetEnv =
        activeEnvironment !== 'none' && environments[activeEnvironment]
          ? activeEnvironment
          : envNames[0] || 'dev';
      setSelectedEnv(targetEnv);
    }
  }, [isOpen, initialTab, activeEnvironment, environments]);

  // Load environment variables when selectedEnv changes
  useEffect(() => {
    const current = environments[selectedEnv];
    if (current?.variables) {
      const rows: VarRow[] = Object.entries(current.variables).map(([k, v], idx) => ({
        id: `env-${idx}-${k}`,
        key: k,
        value: String(v ?? ''),
      }));
      if (initialVariableName && !rows.some(r => r.key === initialVariableName)) {
        rows.push({
          id: `new-${Date.now()}`,
          key: initialVariableName,
          value: '',
        });
      }
      setEnvVars(rows);
    } else {
      const rows: VarRow[] = [];
      if (initialVariableName) {
        rows.push({
          id: `new-${Date.now()}`,
          key: initialVariableName,
          value: '',
        });
      }
      setEnvVars(rows);
    }

    // Load secrets for selectedEnv
    const secEnv = secrets?.environments?.[selectedEnv] || {};
    const sRows: VarRow[] = Object.entries(secEnv).map(([k, v], idx) => ({
      id: `sec-${idx}-${k}`,
      key: k,
      value: String(v ?? ''),
    }));
    setSecretVars(sRows);
  }, [selectedEnv, environments, secrets, initialVariableName]);

  if (!isOpen) return null;

  // Environment Actions
  const handleAddEnv = async () => {
    const trimmed = newEnvName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-');
    if (!trimmed) return;
    if (environments[trimmed]) {
      setStatusMessage({ text: `Environment "${trimmed}" already exists.`, isError: true });
      return;
    }

    const newEnv: EnvironmentFile = {
      version: 1,
      name: trimmed,
      variables: {},
    };

    setSaving(true);
    const ok = await saveEnvironment(trimmed, newEnv);
    setSaving(false);

    if (ok) {
      setSelectedEnv(trimmed);
      setNewEnvName('');
      setIsAddingEnv(false);
      setStatusMessage({ text: `Environment "${trimmed}" created.` });
    } else {
      setStatusMessage({ text: `Failed to create environment.`, isError: true });
    }
  };

  const handleDeleteEnv = async (envNameToDelete: string) => {
    if (!confirm(`Are you sure you want to delete environment "${envNameToDelete}"?`)) return;

    setSaving(true);
    const ok = await deleteEnvironment(envNameToDelete);
    setSaving(false);

    if (ok) {
      const remaining = Object.keys(environments).filter(k => k !== envNameToDelete);
      setSelectedEnv(remaining[0] || 'dev');
      setStatusMessage({ text: `Environment "${envNameToDelete}" deleted.` });
    } else {
      setStatusMessage({ text: `Failed to delete environment.`, isError: true });
    }
  };

  const handleRenameEnv = async (oldName: string) => {
    const trimmed = renameValue
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-');
    if (!trimmed || trimmed === oldName) {
      setRenamingEnv(null);
      return;
    }
    if (environments[trimmed]) {
      setStatusMessage({ text: `Environment "${trimmed}" already exists.`, isError: true });
      return;
    }

    const oldEnv = environments[oldName];
    const newEnv: EnvironmentFile = {
      version: 1,
      name: trimmed,
      variables: oldEnv?.variables || {},
    };

    setSaving(true);
    const saved = await saveEnvironment(trimmed, newEnv);
    if (saved) {
      await deleteEnvironment(oldName);
      if (activeEnvironment === oldName) {
        setActiveEnvironment(trimmed);
      }
      setSelectedEnv(trimmed);
      setStatusMessage({ text: `Renamed to "${trimmed}".` });
    }
    setSaving(false);
    setRenamingEnv(null);
  };

  // Variable row handlers
  const handleAddEnvVarRow = () => {
    setEnvVars(prev => [...prev, { id: `env-${Date.now()}`, key: '', value: '' }]);
  };

  const handleUpdateEnvVar = (id: string, field: 'key' | 'value', val: string) => {
    setEnvVars(prev => prev.map(row => (row.id === id ? { ...row, [field]: val } : row)));
  };

  const handleRemoveEnvVar = (id: string) => {
    setEnvVars(prev => prev.filter(row => row.id !== id));
  };

  // Secret row handlers
  const handleAddSecretVarRow = () => {
    setSecretVars(prev => [...prev, { id: `sec-${Date.now()}`, key: '', value: '' }]);
  };

  const handleUpdateSecretVar = (id: string, field: 'key' | 'value', val: string) => {
    setSecretVars(prev => prev.map(row => (row.id === id ? { ...row, [field]: val } : row)));
  };

  const handleRemoveSecretVar = (id: string) => {
    setSecretVars(prev => prev.filter(row => row.id !== id));
  };

  const toggleRevealSecret = (id: string) => {
    setRevealedSecrets(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Save changes
  const handleSaveAll = async () => {
    setSaving(true);
    setStatusMessage(null);

    try {
      if (activeTab === 'environments') {
        const varsObj: Record<string, string> = {};
        for (const row of envVars) {
          const k = row.key.trim();
          if (k) {
            varsObj[k] = row.value;
          }
        }

        const envData: EnvironmentFile = {
          version: 1,
          name: selectedEnv,
          variables: varsObj,
        };

        const ok = await saveEnvironment(selectedEnv, envData);
        if (ok) {
          setStatusMessage({ text: `Environment "${selectedEnv}" saved successfully.` });
        } else {
          setStatusMessage({ text: 'Failed to save environment.', isError: true });
        }
      } else {
        // Secrets tab
        const secObj: Record<string, string> = {};
        for (const row of secretVars) {
          const k = row.key.trim();
          if (k) {
            secObj[k] = row.value;
          }
        }

        const currentSec: SecretsFile = secrets ? { ...secrets } : { version: 1, environments: {} };
        currentSec.environments = {
          ...(currentSec.environments || {}),
          [selectedEnv]: secObj,
        };

        const ok = await saveSecrets(currentSec);
        if (ok) {
          setStatusMessage({ text: `Secrets for "${selectedEnv}" saved successfully.` });
        } else {
          setStatusMessage({ text: 'Failed to save secrets.', isError: true });
        }
      }
    } catch (err: unknown) {
      setStatusMessage({
        text: err instanceof Error ? err.message : String(err),
        isError: true,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Environments & Secrets"
      size="large"
      primaryAction={{
        label: saving ? 'Saving...' : 'Save Changes',
        onClick: handleSaveAll,
        disabled: saving || !selectedEnv,
      }}
      secondaryAction={{
        label: 'Close',
        onClick: onClose,
      }}
    >
      <div className="flex h-130 flex-col text-[12px] select-none">
        {/* Top Tab Bar: Environments vs Secrets */}
        <div
          className="mb-3 flex shrink-0 items-center justify-between border-b pb-2"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setActiveTab('environments');
                setStatusMessage(null);
              }}
              className="transition-fast flex items-center gap-1.5 rounded-sm px-3 py-1.5 font-medium"
              style={{
                backgroundColor:
                  activeTab === 'environments' ? 'var(--accent-subtle)' : 'transparent',
                color: activeTab === 'environments' ? 'var(--accent)' : 'var(--text-secondary)',
              }}
            >
              <Globe className="h-4 w-4" />
              <span>Environments</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('secrets');
                setStatusMessage(null);
              }}
              className="transition-fast flex items-center gap-1.5 rounded-sm px-3 py-1.5 font-medium"
              style={{
                backgroundColor: activeTab === 'secrets' ? 'var(--accent-subtle)' : 'transparent',
                color: activeTab === 'secrets' ? 'var(--accent)' : 'var(--text-secondary)',
              }}
            >
              <Lock className="h-4 w-4" />
              <span>Secrets</span>
            </button>
          </div>

          {/* Active Status Message */}
          {statusMessage && (
            <div
              className={`flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] font-medium ${
                statusMessage.isError
                  ? 'bg-red-950/40 text-red-400'
                  : 'bg-emerald-950/40 text-emerald-400'
              }`}
            >
              {statusMessage.isError ? (
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              ) : (
                <Check className="h-3.5 w-3.5 shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}
        </div>

        {/* Content Layout: Left sidebar (environment list) + Right table */}
        <div className="flex min-h-0 flex-1 gap-4">
          {/* Environments Sidebar */}
          <div
            className="flex w-48 shrink-0 flex-col overflow-y-auto border-r pr-3"
            style={{ borderColor: 'var(--border)' }}
          >
            <div className="mb-2 flex items-center justify-between">
              <span
                className="text-[11px] font-semibold tracking-wider uppercase"
                style={{ color: 'var(--text-muted)' }}
              >
                Environments
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsAddingEnv(true);
                  setNewEnvName('');
                }}
                className="rounded p-1 text-(--text-secondary) hover:bg-(--bg-hover) hover:text-(--text-primary)"
                title="Add Environment"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Inline Add Environment Form */}
            {isAddingEnv && (
              <div
                className="mb-2 rounded border bg-(--bg-input) p-1.5"
                style={{ borderColor: 'var(--border)' }}
              >
                <input
                  type="text"
                  placeholder="env-name (e.g. dev)"
                  value={newEnvName}
                  onChange={e => setNewEnvName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleAddEnv();
                    if (e.key === 'Escape') setIsAddingEnv(false);
                  }}
                  autoFocus
                  className="mb-1 w-full border-b bg-transparent px-1.5 py-1 font-mono text-[11px] text-(--text-primary) outline-none"
                  style={{ borderColor: 'var(--accent)' }}
                />
                <div className="flex items-center justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => setIsAddingEnv(false)}
                    className="px-1.5 py-0.5 text-[10px] text-(--text-muted) hover:text-(--text-primary)"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAddEnv}
                    className="rounded bg-(--accent) px-1.5 py-0.5 text-[10px] font-medium text-(--accent-fg)"
                  >
                    Create
                  </button>
                </div>
              </div>
            )}

            {/* List of Environments */}
            <div className="flex flex-1 flex-col gap-1">
              {envNames.length === 0 ? (
                <div
                  className="py-4 text-center text-[11px] italic"
                  style={{ color: 'var(--text-muted)' }}
                >
                  No environments yet.
                </div>
              ) : (
                envNames.map(name => {
                  const isSelected = selectedEnv === name;
                  const isRenaming = renamingEnv === name;

                  if (isRenaming) {
                    return (
                      <div
                        key={name}
                        className="rounded border bg-(--bg-input) p-1"
                        style={{ borderColor: 'var(--border)' }}
                      >
                        <input
                          type="text"
                          value={renameValue}
                          onChange={e => setRenameValue(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleRenameEnv(name);
                            if (e.key === 'Escape') setRenamingEnv(null);
                          }}
                          autoFocus
                          className="mb-1 w-full border-b bg-transparent px-1 py-0.5 font-mono text-[11px] outline-none"
                          style={{ borderColor: 'var(--accent)' }}
                        />
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setRenamingEnv(null)}
                            className="px-1 text-[10px] text-(--text-muted)"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRenameEnv(name)}
                            className="rounded bg-(--accent) px-1 text-[10px] text-(--accent-fg)"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={name}
                      onClick={() => setSelectedEnv(name)}
                      className="group transition-fast flex cursor-pointer items-center justify-between rounded px-2.5 py-1.5"
                      style={{
                        backgroundColor: isSelected ? 'var(--accent-subtle)' : 'transparent',
                        color: isSelected ? 'var(--accent)' : 'var(--text-primary)',
                      }}
                    >
                      <span className="truncate font-mono text-[12px]">{name}</span>
                      <div className="transition-fast flex items-center gap-1 opacity-0 group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            setRenamingEnv(name);
                            setRenameValue(name);
                          }}
                          className="rounded p-0.5 text-(--text-muted) hover:bg-(--bg-hover) hover:text-(--text-primary)"
                          title="Rename Environment"
                        >
                          <Edit2 className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            handleDeleteEnv(name);
                          }}
                          className="rounded p-0.5 text-(--text-muted) hover:bg-red-950/40 hover:text-red-400"
                          title="Delete Environment"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Main Editor Area */}
          <div className="flex min-w-0 flex-1 flex-col">
            {activeTab === 'environments' ? (
              <>
                {/* Environments Table Header */}
                <div className="mb-2 flex items-center justify-between pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-(--text-primary)">
                      Variables for:
                    </span>
                    <span className="rounded bg-(--accent-subtle) px-2 py-0.5 font-mono text-[11px] font-semibold text-(--accent)">
                      {selectedEnv}
                    </span>
                  </div>
                  <Button
                    variant="secondary"
                    size="compact"
                    onClick={handleAddEnvVarRow}
                    icon={<Plus className="h-3.5 w-3.5" />}
                  >
                    Add Variable
                  </Button>
                </div>

                {/* Variables Table */}
                <div
                  className="flex-1 overflow-y-auto rounded border"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-input)' }}
                >
                  <table className="w-full border-collapse text-left font-mono text-[12px]">
                    <thead
                      className="sticky top-0 z-10 border-b select-none"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        borderColor: 'var(--border)',
                      }}
                    >
                      <tr>
                        <th className="w-1/3 px-3 py-1.5 text-[11px] font-semibold tracking-wider text-(--text-muted) uppercase">
                          Variable Key
                        </th>
                        <th className="px-3 py-1.5 text-[11px] font-semibold tracking-wider text-(--text-muted) uppercase">
                          Value
                        </th>
                        <th className="w-10 px-2 py-1.5 text-center text-(--text-muted)">#</th>
                      </tr>
                    </thead>
                    <tbody>
                      {envVars.length === 0 ? (
                        <tr>
                          <td
                            colSpan={3}
                            className="py-8 text-center font-sans text-(--text-muted) italic"
                          >
                            No variables defined for this environment. Click "Add Variable" to
                            start.
                          </td>
                        </tr>
                      ) : (
                        envVars.map(row => (
                          <tr
                            key={row.id}
                            className="transition-fast border-b hover:bg-(--bg-hover)"
                            style={{ borderColor: 'var(--border)' }}
                          >
                            <td className="p-1 px-3">
                              <input
                                type="text"
                                placeholder="KEY_NAME"
                                value={row.key}
                                onChange={e => handleUpdateEnvVar(row.id, 'key', e.target.value)}
                                className="w-full rounded bg-transparent px-2 py-1 text-[12px] text-(--text-primary) outline-none focus:bg-(--bg-surface)"
                              />
                            </td>
                            <td className="p-1 px-3">
                              <input
                                type="text"
                                placeholder="value"
                                value={row.value}
                                onChange={e => handleUpdateEnvVar(row.id, 'value', e.target.value)}
                                className="w-full rounded bg-transparent px-2 py-1 text-[12px] text-(--text-primary) outline-none focus:bg-(--bg-surface)"
                              />
                            </td>
                            <td className="p-1 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveEnvVar(row.id)}
                                className="transition-fast rounded p-1 text-(--text-muted) hover:bg-red-950/40 hover:text-red-400"
                                title="Remove row"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <>
                {/* Secrets Banner */}
                <div
                  className="mb-2 flex items-center justify-between rounded border p-2"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border)',
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 shrink-0 text-emerald-400" />
                    <div>
                      <span className="text-[12px] font-semibold text-(--text-primary)">
                        Sensitive Secrets
                      </span>
                      <p className="text-[11px] text-(--text-muted)">
                        Stored in <code className="text-emerald-400">.reqit/secrets.yaml</code> and
                        gitignored. Never committed.
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    size="compact"
                    onClick={handleAddSecretVarRow}
                    icon={<Plus className="h-3.5 w-3.5" />}
                  >
                    Add Secret
                  </Button>
                </div>

                {/* Secrets Table Header */}
                <div className="mb-2 flex items-center justify-between pb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-(--text-primary)">
                      Secrets for:
                    </span>
                    <span className="rounded bg-(--accent-subtle) px-2 py-0.5 font-mono text-[11px] font-semibold text-(--accent)">
                      {selectedEnv}
                    </span>
                  </div>
                </div>

                {/* Secrets Table */}
                <div
                  className="flex-1 overflow-y-auto rounded border"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-input)' }}
                >
                  <table className="w-full border-collapse text-left font-mono text-[12px]">
                    <thead
                      className="sticky top-0 z-10 border-b select-none"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        borderColor: 'var(--border)',
                      }}
                    >
                      <tr>
                        <th className="w-1/3 px-3 py-1.5 text-[11px] font-semibold tracking-wider text-(--text-muted) uppercase">
                          Secret Key
                        </th>
                        <th className="px-3 py-1.5 text-[11px] font-semibold tracking-wider text-(--text-muted) uppercase">
                          Secret Value (Masked)
                        </th>
                        <th className="w-16 px-2 py-1.5 text-center text-(--text-muted)">#</th>
                      </tr>
                    </thead>
                    <tbody>
                      {secretVars.length === 0 ? (
                        <tr>
                          <td
                            colSpan={3}
                            className="py-8 text-center font-sans text-(--text-muted) italic"
                          >
                            No secrets configured for this environment. Click "Add Secret" to add
                            one.
                          </td>
                        </tr>
                      ) : (
                        secretVars.map(row => {
                          const isRevealed = !!revealedSecrets[row.id];
                          return (
                            <tr
                              key={row.id}
                              className="transition-fast border-b hover:bg-(--bg-hover)"
                              style={{ borderColor: 'var(--border)' }}
                            >
                              <td className="p-1 px-3">
                                <input
                                  type="text"
                                  placeholder="API_KEY"
                                  value={row.key}
                                  onChange={e =>
                                    handleUpdateSecretVar(row.id, 'key', e.target.value)
                                  }
                                  className="w-full rounded bg-transparent px-2 py-1 text-[12px] text-(--text-primary) outline-none focus:bg-(--bg-surface)"
                                />
                              </td>
                              <td className="p-1 px-3">
                                <input
                                  type={isRevealed ? 'text' : 'password'}
                                  placeholder="secret-token-value"
                                  value={row.value}
                                  onChange={e =>
                                    handleUpdateSecretVar(row.id, 'value', e.target.value)
                                  }
                                  className="w-full rounded bg-transparent px-2 py-1 text-[12px] tracking-wider text-(--text-primary) outline-none focus:bg-(--bg-surface)"
                                />
                              </td>
                              <td className="p-1 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => toggleRevealSecret(row.id)}
                                    className="transition-fast rounded p-1 text-(--text-muted) hover:bg-(--bg-hover) hover:text-(--text-primary)"
                                    title={isRevealed ? 'Mask secret' : 'Reveal secret'}
                                  >
                                    {isRevealed ? (
                                      <EyeOff className="h-3.5 w-3.5" />
                                    ) : (
                                      <Eye className="h-3.5 w-3.5" />
                                    )}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveSecretVar(row.id)}
                                    className="transition-fast rounded p-1 text-(--text-muted) hover:bg-red-950/40 hover:text-red-400"
                                    title="Remove secret"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
