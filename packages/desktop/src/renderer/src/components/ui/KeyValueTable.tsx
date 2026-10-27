import React from 'react';
import { Trash2 } from 'lucide-react';

export interface KeyValueRow {
  id: string;
  enabled: boolean;
  key: string;
  value: string;
  description?: string;
}

export interface KeyValueTableProps {
  rows: KeyValueRow[];
  onChange: (rows: KeyValueRow[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  descriptionPlaceholder?: string;
  showDescription?: boolean;
}

export function KeyValueTable({
  rows,
  onChange,
  keyPlaceholder = 'Key',
  valuePlaceholder = 'Value',
  descriptionPlaceholder = 'Description',
  showDescription = false,
}: KeyValueTableProps): React.JSX.Element {
  // Always ensure one empty row exists at the end
  const displayRows = [...rows];
  const lastRow = displayRows[displayRows.length - 1];
  if (!lastRow || lastRow.key !== '' || lastRow.value !== '') {
    displayRows.push({
      id: 'blank-tail-row',
      enabled: true,
      key: '',
      value: '',
      description: '',
    });
  }

  const handleUpdate = (index: number, updates: Partial<KeyValueRow>) => {
    const isTail = index === displayRows.length - 1 && displayRows[index]?.id === 'blank-tail-row';
    const newRows = rows.map((r, i) => (i === index ? { ...r, ...updates } : r));

    if (isTail) {
      // Adding a new row from typing in the blank tail row
      newRows.push({
        id: `row-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        enabled: true,
        key: '',
        value: '',
        description: '',
        ...updates,
      });
    }

    onChange(newRows);
  };

  const handleDelete = (index: number) => {
    const newRows = rows.filter((_, i) => i !== index);
    onChange(newRows);
  };

  return (
    <div
      className="w-full border rounded-[4px] overflow-hidden"
      style={{
        borderColor: 'var(--border)',
        backgroundColor: 'var(--bg-base)',
      }}
    >
      <table className="w-full border-collapse text-left text-[12px]">
        <thead>
          <tr
            className="border-b"
            style={{
              borderColor: 'var(--border)',
              backgroundColor: 'var(--bg-subtle)',
              color: 'var(--text-secondary)',
            }}
          >
            <th className="w-[32px] px-2 py-1.5 text-center font-medium"></th>
            <th className="px-3 py-1.5 font-medium">{keyPlaceholder}</th>
            <th className="px-3 py-1.5 font-medium">{valuePlaceholder}</th>
            {showDescription && (
              <th className="px-3 py-1.5 font-medium">{descriptionPlaceholder}</th>
            )}
            <th className="w-[32px] px-2 py-1.5 text-center font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {displayRows.map((row, idx) => {
            const isTail = row.id === 'blank-tail-row';
            const isDimmed = !row.enabled && !isTail;

            return (
              <tr
                key={row.id}
                className="border-b last:border-b-0 transition-fast"
                style={{
                  borderColor: 'var(--border)',
                  backgroundColor: isDimmed ? 'var(--bg-subtle)' : 'var(--bg-base)',
                  opacity: isDimmed ? 0.6 : 1,
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
                    aria-label="Toggle row"
                  />
                </td>

                {/* Key cell */}
                <td className="px-2 py-1 align-middle">
                  <input
                    type="text"
                    value={row.key}
                    placeholder={keyPlaceholder}
                    onChange={e => handleUpdate(idx, { key: e.target.value })}
                    className="w-full bg-transparent px-1.5 py-0.5 text-[12px] font-mono outline-none app-focus-ring"
                    style={{
                      color: isDimmed ? 'var(--text-muted)' : 'var(--text-primary)',
                    }}
                  />
                </td>

                {/* Value cell */}
                <td className="px-2 py-1 align-middle">
                  <input
                    type="text"
                    value={row.value}
                    placeholder={valuePlaceholder}
                    onChange={e => handleUpdate(idx, { value: e.target.value })}
                    className="w-full bg-transparent px-1.5 py-0.5 text-[12px] font-mono outline-none app-focus-ring"
                    style={{
                      color: isDimmed ? 'var(--text-muted)' : 'var(--text-primary)',
                    }}
                  />
                </td>

                {/* Description cell */}
                {showDescription && (
                  <td className="px-2 py-1 align-middle">
                    <input
                      type="text"
                      value={row.description || ''}
                      placeholder={descriptionPlaceholder}
                      onChange={e => handleUpdate(idx, { description: e.target.value })}
                      className="w-full bg-transparent px-1.5 py-0.5 text-[12px] outline-none app-focus-ring"
                      style={{
                        color: isDimmed ? 'var(--text-muted)' : 'var(--text-primary)',
                      }}
                    />
                  </td>
                )}

                {/* Delete button */}
                <td className="px-2 py-1 text-center align-middle">
                  {!isTail && (
                    <button
                      type="button"
                      onClick={() => handleDelete(idx)}
                      className="w-5 h-5 inline-flex items-center justify-center rounded-[4px] hover:bg-[var(--bg-muted)] transition-fast app-focus-ring"
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
