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
      <div className="flex flex-col h-[520px] select-none text-[12px]">
        {/* Top Tab Bar: Environments vs Secrets */}
        <div
          className="flex items-center justify-between border-b pb-2 mb-3 shrink-0"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setActiveTab('environments');
                setStatusMessage(null);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] font-medium transition-fast"
              style={{
                backgroundColor:
                  activeTab === 'environments' ? 'var(--accent-subtle)' : 'transparent',
                color: activeTab === 'environments' ? 'var(--accent)' : 'var(--text-secondary)',
              }}
            >
              <Globe className="w-4 h-4" />
              <span>Environments</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('secrets');
                setStatusMessage(null);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] font-medium transition-fast"
              style={{
                backgroundColor: activeTab === 'secrets' ? 'var(--accent-subtle)' : 'transparent',
                color: activeTab === 'secrets' ? 'var(--accent)' : 'var(--text-secondary)',
              }}
            >
              <Lock className="w-4 h-4" />
              <span>Secrets</span>
            </button>
          </div>

          {/* Active Status Message */}
          {statusMessage && (
            <div
              className={`flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded ${
                statusMessage.isError
                  ? 'text-red-400 bg-red-950/40'
                  : 'text-emerald-400 bg-emerald-950/40'
              }`}
            >
              {statusMessage.isError ? (
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <Check className="w-3.5 h-3.5 shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}
        </div>

        {/* Content Layout: Left sidebar (environment list) + Right table */}
        <div className="flex flex-1 min-h-0 gap-4">
          {/* Environments Sidebar */}
          <div
            className="w-48 border-r pr-3 flex flex-col shrink-0 overflow-y-auto"
            style={{ borderColor: 'var(--border)' }}
          >
            <div className="flex items-center justify-between mb-2">
              <span
                className="text-[11px] font-semibold uppercase tracking-wider"
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
                className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                title="Add Environment"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Inline Add Environment Form */}
            {isAddingEnv && (
              <div
                className="mb-2 p-1.5 rounded border bg-[var(--bg-input)]"
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
                  className="w-full px-1.5 py-1 text-[11px] font-mono bg-transparent border-b outline-none mb-1 text-[var(--text-primary)]"
                  style={{ borderColor: 'var(--accent)' }}
                />
                <div className="flex items-center justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => setIsAddingEnv(false)}
                    className="px-1.5 py-0.5 text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAddEnv}
                    className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-[var(--accent)] text-[var(--accent-fg)]"
                  >
                    Create
                  </button>
                </div>
              </div>
            )}

            {/* List of Environments */}
            <div className="flex flex-col gap-1 flex-1">
              {envNames.length === 0 ? (
                <div
                  className="text-[11px] py-4 text-center italic"
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
                        className="p-1 rounded border bg-[var(--bg-input)]"
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
                          className="w-full px-1 py-0.5 text-[11px] font-mono bg-transparent outline-none border-b mb-1"
                          style={{ borderColor: 'var(--accent)' }}
                        />
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setRenamingEnv(null)}
                            className="px-1 text-[10px] text-[var(--text-muted)]"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRenameEnv(name)}
                            className="px-1 text-[10px] bg-[var(--accent)] text-[var(--accent-fg)] rounded"
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
                      className="group flex items-center justify-between px-2.5 py-1.5 rounded cursor-pointer transition-fast"
                      style={{
                        backgroundColor: isSelected ? 'var(--accent-subtle)' : 'transparent',
                        color: isSelected ? 'var(--accent)' : 'var(--text-primary)',
                      }}
                    >
                      <span className="font-mono text-[12px] truncate">{name}</span>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-fast">
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            setRenamingEnv(name);
                            setRenameValue(name);
                          }}
                          className="p-0.5 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                          title="Rename Environment"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            handleDeleteEnv(name);
                          }}
                          className="p-0.5 rounded hover:bg-red-950/40 text-[var(--text-muted)] hover:text-red-400"
                          title="Delete Environment"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Main Editor Area */}
          <div className="flex-1 flex flex-col min-w-0">
            {activeTab === 'environments' ? (
              <>
                {/* Environments Table Header */}
                <div className="flex items-center justify-between pb-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-[var(--text-primary)]">
                      Variables for:
                    </span>
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-[var(--accent-subtle)] text-[var(--accent)]">
                      {selectedEnv}
                    </span>
                  </div>
                  <Button
                    variant="secondary"
                    size="compact"
                    onClick={handleAddEnvVarRow}
                    icon={<Plus className="w-3.5 h-3.5" />}
                  >
                    Add Variable
                  </Button>
                </div>

                {/* Variables Table */}
                <div
                  className="flex-1 border rounded overflow-y-auto"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-input)' }}
                >
                  <table className="w-full text-left border-collapse font-mono text-[12px]">
                    <thead
                      className="sticky top-0 border-b select-none z-10"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        borderColor: 'var(--border)',
                      }}
                    >
                      <tr>
                        <th className="py-1.5 px-3 font-semibold text-[11px] uppercase tracking-wider text-[var(--text-muted)] w-1/3">
                          Variable Key
                        </th>
                        <th className="py-1.5 px-3 font-semibold text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
                          Value
                        </th>
                        <th className="py-1.5 px-2 w-10 text-center text-[var(--text-muted)]">#</th>
                      </tr>
                    </thead>
                    <tbody>
                      {envVars.length === 0 ? (
                        <tr>
                          <td
                            colSpan={3}
                            className="py-8 text-center text-[var(--text-muted)] italic font-sans"
                          >
                            No variables defined for this environment. Click "Add Variable" to
                            start.
                          </td>
                        </tr>
                      ) : (
                        envVars.map(row => (
                          <tr
                            key={row.id}
                            className="border-b transition-fast hover:bg-[var(--bg-hover)]"
                            style={{ borderColor: 'var(--border)' }}
                          >
                            <td className="p-1 px-3">
                              <input
                                type="text"
                                placeholder="KEY_NAME"
                                value={row.key}
                                onChange={e => handleUpdateEnvVar(row.id, 'key', e.target.value)}
                                className="w-full px-2 py-1 rounded text-[12px] bg-transparent outline-none focus:bg-[var(--bg-surface)] text-[var(--text-primary)]"
                              />
                            </td>
                            <td className="p-1 px-3">
                              <input
                                type="text"
                                placeholder="value"
                                value={row.value}
                                onChange={e => handleUpdateEnvVar(row.id, 'value', e.target.value)}
                                className="w-full px-2 py-1 rounded text-[12px] bg-transparent outline-none focus:bg-[var(--bg-surface)] text-[var(--text-primary)]"
                              />
                            </td>
                            <td className="p-1 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveEnvVar(row.id)}
                                className="p-1 rounded hover:bg-red-950/40 text-[var(--text-muted)] hover:text-red-400 transition-fast"
                                title="Remove row"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
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
                  className="mb-2 p-2 rounded flex items-center justify-between border"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border)',
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div>
                      <span className="font-semibold text-[12px] text-[var(--text-primary)]">
                        Sensitive Secrets
                      </span>
                      <p className="text-[11px] text-[var(--text-muted)]">
                        Stored in <code className="text-emerald-400">.reqit/secrets.yaml</code> and
                        gitignored. Never committed.
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    size="compact"
                    onClick={handleAddSecretVarRow}
                    icon={<Plus className="w-3.5 h-3.5" />}
                  >
                    Add Secret
                  </Button>
                </div>

                {/* Secrets Table Header */}
                <div className="flex items-center justify-between pb-1 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-[var(--text-primary)]">
                      Secrets for:
                    </span>
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-[var(--accent-subtle)] text-[var(--accent)]">
                      {selectedEnv}
                    </span>
                  </div>
                </div>

                {/* Secrets Table */}
                <div
                  className="flex-1 border rounded overflow-y-auto"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-input)' }}
                >
                  <table className="w-full text-left border-collapse font-mono text-[12px]">
                    <thead
                      className="sticky top-0 border-b select-none z-10"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        borderColor: 'var(--border)',
                      }}
                    >
                      <tr>
                        <th className="py-1.5 px-3 font-semibold text-[11px] uppercase tracking-wider text-[var(--text-muted)] w-1/3">
                          Secret Key
                        </th>
                        <th className="py-1.5 px-3 font-semibold text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
                          Secret Value (Masked)
                        </th>
                        <th className="py-1.5 px-2 w-16 text-center text-[var(--text-muted)]">#</th>
                      </tr>
                    </thead>
                    <tbody>
                      {secretVars.length === 0 ? (
                        <tr>
                          <td
                            colSpan={3}
                            className="py-8 text-center text-[var(--text-muted)] italic font-sans"
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
                              className="border-b transition-fast hover:bg-[var(--bg-hover)]"
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
                                  className="w-full px-2 py-1 rounded text-[12px] bg-transparent outline-none focus:bg-[var(--bg-surface)] text-[var(--text-primary)]"
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
                                  className="w-full px-2 py-1 rounded text-[12px] bg-transparent outline-none focus:bg-[var(--bg-surface)] text-[var(--text-primary)] tracking-wider"
                                />
                              </td>
                              <td className="p-1 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => toggleRevealSecret(row.id)}
                                    className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-fast"
                                    title={isRevealed ? 'Mask secret' : 'Reveal secret'}
                                  >
                                    {isRevealed ? (
                                      <EyeOff className="w-3.5 h-3.5" />
                                    ) : (
                                      <Eye className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveSecretVar(row.id)}
                                    className="p-1 rounded hover:bg-red-950/40 text-[var(--text-muted)] hover:text-red-400 transition-fast"
                                    title="Remove secret"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
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
