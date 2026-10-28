import React, { useRef } from 'react';
import { Trash2, FolderOpen, X } from 'lucide-react';
import { VariableInput } from './ui/VariableInput';
import type { MultipartRow } from '../stores/requestStore';

export interface MultipartTableProps {
  rows: MultipartRow[];
  onChange: (rows: MultipartRow[]) => void;
  knownVariables?: string[];
}

export function MultipartTable({
  rows,
  onChange,
  knownVariables,
}: MultipartTableProps): React.JSX.Element {
  const hiddenFileInputRef = useRef<HTMLInputElement | null>(null);
  const activeFileRowIndex = useRef<number | null>(null);

  // Always ensure one empty row exists at the end
  const displayRows = [...rows];
  const lastRow = displayRows[displayRows.length - 1];
  if (!lastRow || lastRow.key !== '' || lastRow.value !== '') {
    displayRows.push({
      id: 'blank-tail-multipart',
      enabled: true,
      key: '',
      type: 'text',
      value: '',
      description: '',
    });
  }

  const handleUpdate = (index: number, updates: Partial<MultipartRow>) => {
    const isTail =
      index === displayRows.length - 1 && displayRows[index]?.id === 'blank-tail-multipart';
    const newRows = rows.map((r, i) => (i === index ? { ...r, ...updates } : r));

    if (isTail) {
      newRows.push({
        id: `mp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        enabled: true,
        key: '',
        type: 'text',
        value: '',
        ...updates,
      });
    }

    onChange(newRows);
  };

  const handleDelete = (index: number) => {
    const newRows = rows.filter((_, i) => i !== index);
    onChange(newRows);
  };

  const handlePickFile = async (index: number) => {
    // If running in Electron with IPC bridge
    if (window.reqitApi?.openFileDialog) {
      const filePath = await window.reqitApi.openFileDialog();
      if (filePath) {
        handleUpdate(index, { value: filePath, fileName: filePath.split(/[/\\]/).pop() });
      }
      return;
    }

    // Web fallback using hidden HTML input
    activeFileRowIndex.current = index;
    if (hiddenFileInputRef.current) {
      hiddenFileInputRef.current.value = '';
      hiddenFileInputRef.current.click();
    }
  };

  const handleHiddenFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const idx = activeFileRowIndex.current;
    if (file && idx !== null) {
      // In Electron environment, File object often has path
      const filePath = (file as unknown as { path?: string }).path || file.name;
      handleUpdate(idx, { value: filePath, fileName: file.name });
    }
    activeFileRowIndex.current = null;
  };

  return (
    <div
      className="w-full border rounded-[4px] relative"
      style={{
        borderColor: 'var(--border)',
        backgroundColor: 'var(--bg-base)',
      }}
    >
      <input
        type="file"
        ref={hiddenFileInputRef}
        onChange={handleHiddenFileChange}
        className="hidden"
        aria-hidden="true"
      />

      <table className="w-full border-collapse text-left text-[12px]">
        <thead>
          <tr
            className="border-b"
            style={{
              borderColor: 'var(--border)',
              backgroundColor: 'var(--bg-surface)',
              color: 'var(--text-secondary)',
            }}
          >
            <th className="w-[32px] px-2 py-1.5 text-center font-medium"></th>
            <th className="px-3 py-1.5 font-medium w-[28%]">Field Name</th>
            <th className="px-3 py-1.5 font-medium w-[90px]">Type</th>
            <th className="px-3 py-1.5 font-medium">Value / File</th>
            <th className="w-[32px] px-2 py-1.5 text-center font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {displayRows.map((row, idx) => {
            const isTail = row.id === 'blank-tail-multipart';
            const isDimmed = !row.enabled && !isTail;

            return (
              <tr
                key={row.id}
                className="border-b last:border-b-0 transition-fast"
                style={{
                  borderColor: 'var(--border)',
                  backgroundColor: 'var(--bg-base)',
                  opacity: isDimmed ? 0.5 : 1,
                }}
              >
                {/* Enabled checkbox */}
                <td className="px-2 py-1 text-center align-middle">
                  <input
                    type="checkbox"
                    checked={row.enabled}
                    disabled={isTail}
                    onChange={e => handleUpdate(idx, { enabled: e.target.checked })}
                    className="w-3.5 h-3.5 rounded-[2px] cursor-pointer app-focus-ring"
                    aria-label="Toggle multipart row"
                  />
                </td>

                {/* Key cell */}
                <td className="px-2 py-1 align-middle">
                  <input
                    type="text"
                    value={row.key}
                    placeholder="Field name"
                    onChange={e => handleUpdate(idx, { key: e.target.value })}
                    className="w-full bg-transparent px-1.5 py-0.5 text-[12px] font-mono outline-none app-focus-ring"
                    style={{
                      color: isDimmed ? 'var(--text-muted)' : 'var(--text-primary)',
                    }}
                  />
                </td>

                {/* Type selector (Text / File) */}
                <td className="px-2 py-1 align-middle">
                  <select
                    value={row.type}
                    onChange={e =>
                      handleUpdate(idx, {
                        type: e.target.value as 'text' | 'file',
                        value: '',
                        fileName: undefined,
                      })
                    }
                    className="h-[24px] px-1 text-[11px] bg-transparent border rounded-[2px] outline-none cursor-pointer"
                    style={{
                      borderColor: 'var(--border)',
                      backgroundColor: 'var(--bg-input)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <option
                      value="text"
                      style={{
                        backgroundColor: 'var(--bg-elevated)',
                        color: 'var(--text-primary)',
                      }}
                    >
                      Text
                    </option>
                    <option
                      value="file"
                      style={{
                        backgroundColor: 'var(--bg-elevated)',
                        color: 'var(--text-primary)',
                      }}
                    >
                      File
                    </option>
                  </select>
                </td>

                {/* Value cell */}
                <td className="px-2 py-1 align-middle">
                  {row.type === 'file' ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handlePickFile(idx)}
                        className="inline-flex items-center gap-1.5 h-[24px] px-2 text-[11px] font-medium border rounded-[2px] hover:bg-[var(--bg-hover)] transition-fast"
                        style={{
                          borderColor: 'var(--border)',
                          backgroundColor: 'var(--bg-surface)',
                          color: 'var(--text-primary)',
                        }}
                      >
                        <FolderOpen className="w-3 h-3 text-[var(--accent)]" />
                        <span>Choose file...</span>
                      </button>

                      {row.value ? (
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          <span
                            className="text-[11px] font-mono truncate"
                            style={{ color: 'var(--text-primary)' }}
                            title={row.value}
                          >
                            {row.fileName || row.value}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdate(idx, { value: '', fileName: undefined })}
                            className="p-0.5 rounded hover:bg-[var(--bg-hover)] transition-fast text-[var(--text-muted)]"
                            title="Remove file"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] italic" style={{ color: 'var(--text-muted)' }}>
                          No file selected
                        </span>
                      )}
                    </div>
                  ) : (
                    <VariableInput
                      value={row.value}
                      placeholder="Field value"
                      knownVariables={knownVariables}
                      onChange={val => handleUpdate(idx, { value: val })}
                      className="w-full !h-[26px] !border-none !bg-transparent !px-1.5 !text-[12px]"
                    />
                  )}
                </td>

                {/* Delete button */}
                <td className="px-2 py-1 text-center align-middle">
                  {!isTail && (
                    <button
                      type="button"
                      onClick={() => handleDelete(idx)}
                      className="w-5 h-5 inline-flex items-center justify-center rounded-[4px] hover:bg-[var(--bg-hover)] transition-fast app-focus-ring"
                      style={{ color: 'var(--text-muted)' }}
                      title="Delete row"
                      aria-label="Delete row"
                    >
                      <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
