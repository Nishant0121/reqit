import React, { useState, useMemo, useCallback } from 'react';
import { Code2, Copy, Check, ToggleLeft, ToggleRight, Terminal, FileCode } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { CodeEditor, type EditorMode } from './editor/CodeEditor';
import {
  generateSnippet,
  getSnippetTargets,
  type SnippetTarget,
  type SnippetTargetInfo,
} from '@reqit/core/snippets';
import type { RequestFile } from '@reqit/core';

export interface SnippetModalProps {
  isOpen: boolean;
  onClose: () => void;
  requestFile: RequestFile;
  scopes?: Record<string, unknown>;
}

export function SnippetModal({
  isOpen,
  onClose,
  requestFile,
  scopes,
}: SnippetModalProps): React.JSX.Element | null {
  const [selectedTarget, setSelectedTarget] = useState<SnippetTarget>('curl');
  const [resolveVariables, setResolveVariables] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);

  const targets = useMemo(() => getSnippetTargets(), []);
  const currentTargetInfo: SnippetTargetInfo = useMemo(() => {
    return targets.find(t => t.id === selectedTarget) || (targets[0] as SnippetTargetInfo);
  }, [targets, selectedTarget]);

  // Generate code snippet reactively
  const snippetCode = useMemo(() => {
    try {
      return generateSnippet(requestFile, selectedTarget, {
        resolveVariables,
        scopes: scopes ? { environment: scopes } : undefined,
      });
    } catch (err) {
      return `// Error generating snippet: ${err instanceof Error ? err.message : String(err)}`;
    }
  }, [requestFile, selectedTarget, resolveVariables, scopes]);

  // Copy to clipboard
  const handleCopy = useCallback(() => {
    if (!snippetCode) return;
    navigator.clipboard.writeText(snippetCode);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 2000);
  }, [snippetCode]);

  // Map syntax mode to CodeEditor EditorMode
  const editorMode: EditorMode = useMemo(() => {
    switch (currentTargetInfo.syntaxMode) {
      case 'javascript':
        return 'javascript';
      case 'python':
        return 'python';
      case 'go':
        return 'go';
      case 'java':
        return 'java';
      default:
        return 'text';
    }
  }, [currentTargetInfo]);

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Code Snippets"
      size="xlarge"
      customFooter={
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-2 text-[12px] text-(--text-muted)">
            <FileCode className="h-4 w-4 opacity-70" />
            <span>{currentTargetInfo.description}</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="default"
              onClick={handleCopy}
              className="flex items-center gap-1.5"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy Snippet</span>
                </>
              )}
            </Button>
            <Button variant="primary" size="default" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col space-y-3">
        {/* Top Control Bar: Language selector & Variable toggle */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-(--border) pb-3">
          {/* Target Language Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            {targets.map(target => {
              const isSelected = target.id === selectedTarget;
              return (
                <button
                  key={target.id}
                  type="button"
                  onClick={() => setSelectedTarget(target.id)}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium transition-all ${
                    isSelected
                      ? 'bg-(--accent) text-white shadow-xs'
                      : 'bg-(--bg-elevated) text-(--text-secondary) hover:bg-(--bg-hover) hover:text-(--text-primary)'
                  }`}
                >
                  {target.id === 'curl' ? (
                    <Terminal className="h-3.5 w-3.5" />
                  ) : (
                    <Code2 className="h-3.5 w-3.5 opacity-80" />
                  )}
                  <span>{target.name}</span>
                </button>
              );
            })}
          </div>

          {/* Variables Toggle Button */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setResolveVariables(!resolveVariables)}
              className="flex items-center gap-1.5 rounded border border-(--border) bg-(--bg-elevated) px-2.5 py-1 text-[12px] font-medium text-(--text-primary) transition-colors hover:bg-(--bg-hover)"
              title="Toggle between inserting resolved variable values and keeping {{variable}} placeholders"
            >
              {resolveVariables ? (
                <ToggleRight className="h-4 w-4 text-(--accent)" />
              ) : (
                <ToggleLeft className="h-4 w-4 text-(--text-muted)" />
              )}
              <span>
                {resolveVariables ? (
                  <span className="text-(--accent)">Resolved</span>
                ) : (
                  <span className="text-(--text-muted)">Raw &#123;&#123;vars&#125;&#125;</span>
                )}
              </span>
            </button>
          </div>
        </div>

        {/* Code Snippet Viewer */}
        <div className="relative overflow-hidden rounded-md border border-(--border) bg-(--bg-base)">
          <div className="flex items-center justify-between border-b border-(--border) bg-(--bg-elevated) px-3 py-1.5 font-mono text-[11px] text-(--text-muted)">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-(--accent)" />
              <span>{currentTargetInfo.name}</span>
              <span className="opacity-50">({currentTargetInfo.extension})</span>
            </span>
            <span>Read-only snippet</span>
          </div>

          <CodeEditor
            value={snippetCode}
            mode={editorMode}
            readOnly={true}
            minHeight="320px"
            maxHeight="440px"
          />
        </div>
      </div>
    </Modal>
  );
}
