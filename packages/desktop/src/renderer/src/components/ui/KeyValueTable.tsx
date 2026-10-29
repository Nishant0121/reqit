import React, { useState, useRef, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import { VariableInput, type VariableDetail } from './VariableInput';

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
  keySuggestions?: string[];
  valueSuggestions?: (key: string) => string[];
  knownVariables?: string[];
  variablesMap?: Record<string, VariableDetail>;
}

export function KeyValueTable({
  rows,
  onChange,
  keyPlaceholder = 'Key',
  valuePlaceholder = 'Value',
  descriptionPlaceholder = 'Description',
  showDescription = false,
  keySuggestions = [],
  valueSuggestions,
  knownVariables,
  variablesMap,
}: KeyValueTableProps): React.JSX.Element {
  // Autocomplete state
  const [activeKeySuggestRow, setActiveKeySuggestRow] = useState<number | null>(null);
  const [activeValueSuggestRow, setActiveValueSuggestRow] = useState<number | null>(null);
  const [suggestIndex, setSuggestIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setActiveKeySuggestRow(null);
        setActiveValueSuggestRow(null);
      }
    };
    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, []);

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
    setActiveKeySuggestRow(null);
    setActiveValueSuggestRow(null);
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full rounded-sm border"
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
              backgroundColor: 'var(--bg-surface)',
              color: 'var(--text-secondary)',
            }}
          >
            <th className="w-8 px-2 py-1.5 text-center font-medium"></th>
            <th className="px-3 py-1.5 font-medium">{keyPlaceholder}</th>
            <th className="px-3 py-1.5 font-medium">{valuePlaceholder}</th>
            {showDescription && (
              <th className="px-3 py-1.5 font-medium">{descriptionPlaceholder}</th>
            )}
            <th className="w-8 px-2 py-1.5 text-center font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {displayRows.map((row, idx) => {
            const isTail = row.id === 'blank-tail-row';
            const isDimmed = !row.enabled && !isTail;

            // Filter key suggestions
            const matchingKeys =
              activeKeySuggestRow === idx && keySuggestions.length > 0
                ? keySuggestions
                    .filter(
                      k =>
                        k.toLowerCase().includes(row.key.toLowerCase()) &&
                        k.toLowerCase() !== row.key.toLowerCase(),
                    )
                    .slice(0, 8)
                : [];

            // Filter value suggestions
            const availableValues = valueSuggestions ? valueSuggestions(row.key) : [];
            const matchingValues =
              activeValueSuggestRow === idx && availableValues.length > 0
                ? availableValues
                    .filter(
                      v =>
                        v.toLowerCase().includes(row.value.toLowerCase()) &&
                        v.toLowerCase() !== row.value.toLowerCase(),
                    )
                    .slice(0, 8)
                : [];

            return (
              <tr
                key={row.id}
                className="transition-fast border-b last:border-b-0"
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
                    className="app-focus-ring h-3.5 w-3.5 cursor-pointer rounded-xs"
                    aria-label="Toggle row"
                  />
                </td>

                {/* Key cell with autocomplete */}
                <td className="relative px-2 py-1 align-middle">
                  <input
                    type="text"
                    value={row.key}
                    placeholder={keyPlaceholder}
                    onFocus={() => {
                      setActiveKeySuggestRow(idx);
                      setActiveValueSuggestRow(null);
                      setSuggestIndex(0);
                    }}
                    onChange={e => {
                      handleUpdate(idx, { key: e.target.value });
                      setActiveKeySuggestRow(idx);
                      setSuggestIndex(0);
                    }}
                    onKeyDown={e => {
                      if (matchingKeys.length > 0) {
                        if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          setSuggestIndex(prev => (prev + 1) % matchingKeys.length);
                          return;
                        }
                        if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          setSuggestIndex(
                            prev => (prev - 1 + matchingKeys.length) % matchingKeys.length,
                          );
                          return;
                        }
                        if (e.key === 'Enter' || e.key === 'Tab') {
                          const item = matchingKeys[suggestIndex];
                          if (item) {
                            e.preventDefault();
                            handleUpdate(idx, { key: item });
                            setActiveKeySuggestRow(null);
                            return;
                          }
                        }
                        if (e.key === 'Escape') {
                          e.preventDefault();
                          setActiveKeySuggestRow(null);
                          return;
                        }
                      }
                    }}
                    className="app-focus-ring w-full bg-transparent px-1.5 py-0.5 font-mono text-[12px] outline-none"
                    style={{
                      color: isDimmed ? 'var(--text-muted)' : 'var(--text-primary)',
                    }}
                  />

                  {/* Key suggestions dropdown */}
                  {matchingKeys.length > 0 && (
                    <div
                      className="shadow-elevation absolute top-full left-2 z-50 mt-1 max-h-50 min-w-45 overflow-y-auto rounded-sm border py-1 select-none"
                      style={{
                        backgroundColor: 'var(--bg-elevated)',
                        borderColor: 'var(--border)',
                      }}
                    >
                      {matchingKeys.map((sug, i) => (
                        <div
                          key={sug}
                          data-suggestion={sug}
                          onMouseDown={e => {
                            e.preventDefault();
                            handleUpdate(idx, { key: sug });
                            setActiveKeySuggestRow(null);
                          }}
                          onClick={e => {
                            e.preventDefault();
                            handleUpdate(idx, { key: sug });
                            setActiveKeySuggestRow(null);
                          }}
                          className="transition-fast flex cursor-pointer items-center justify-between px-2.5 py-1 font-mono text-[12px]"
                          style={{
                            backgroundColor:
                              i === suggestIndex ? 'var(--bg-active)' : 'transparent',
                            color: 'var(--text-primary)',
                          }}
                        >
                          <span>{sug}</span>
                          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                            header
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </td>

                {/* Value cell with variable support and value suggestions */}
                <td className="relative px-2 py-1 align-middle">
                  <VariableInput
                    value={row.value}
                    placeholder={valuePlaceholder}
                    knownVariables={knownVariables}
                    variablesMap={variablesMap}
                    onFocus={() => {
                      setActiveValueSuggestRow(idx);
                      setActiveKeySuggestRow(null);
                      setSuggestIndex(0);
                    }}
                    onChange={val => {
                      handleUpdate(idx, { value: val });
                      setActiveValueSuggestRow(idx);
                      setSuggestIndex(0);
                    }}
                    onKeyDown={e => {
                      if (matchingValues.length > 0) {
                        if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          setSuggestIndex(prev => (prev + 1) % matchingValues.length);
                          return;
                        }
                        if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          setSuggestIndex(
                            prev => (prev - 1 + matchingValues.length) % matchingValues.length,
                          );
                          return;
                        }
                        if (e.key === 'Enter' || e.key === 'Tab') {
                          const item = matchingValues[suggestIndex];
                          if (item) {
                            e.preventDefault();
                            handleUpdate(idx, { value: item });
                            setActiveValueSuggestRow(null);
                            return;
                          }
                        }
                        if (e.key === 'Escape') {
                          e.preventDefault();
                          setActiveValueSuggestRow(null);
                          return;
                        }
                      }
                    }}
                    className="h-6.5! w-full border-none! bg-transparent! px-1.5! text-[12px]!"
                  />

                  {/* Value suggestions dropdown */}
                  {matchingValues.length > 0 && !row.value.includes('{{') && (
                    <div
                      className="shadow-elevation absolute top-full left-2 z-50 mt-1 max-h-50 min-w-50 overflow-y-auto rounded-sm border py-1 select-none"
                      style={{
                        backgroundColor: 'var(--bg-elevated)',
                        borderColor: 'var(--border)',
                      }}
                    >
                      {matchingValues.map((valSug, i) => (
                        <div
                          key={valSug}
                          onMouseDown={e => {
                            e.preventDefault();
                            handleUpdate(idx, { value: valSug });
                            setActiveValueSuggestRow(null);
                          }}
                          className="transition-fast flex cursor-pointer items-center justify-between px-2.5 py-1 font-mono text-[12px]"
                          style={{
                            backgroundColor:
                              i === suggestIndex ? 'var(--bg-active)' : 'transparent',
                            color: 'var(--text-primary)',
                          }}
                        >
                          <span className="truncate">{valSug}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </td>

                {/* Description cell */}
                {showDescription && (
                  <td className="px-2 py-1 align-middle">
                    <input
                      type="text"
                      value={row.description || ''}
                      placeholder={descriptionPlaceholder}
                      onChange={e => handleUpdate(idx, { description: e.target.value })}
                      className="app-focus-ring w-full bg-transparent px-1.5 py-0.5 text-[12px] outline-none"
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
                      className="transition-fast app-focus-ring inline-flex h-6 w-6 items-center justify-center rounded-sm text-(--text-muted) hover:bg-(--bg-hover) hover:text-(--danger)"
                      title="Delete row"
                      aria-label="Delete row"
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={1.75} />
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
