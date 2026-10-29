import React, { useState, useRef, useEffect, forwardRef } from 'react';

export interface VariableDetail {
  value: unknown;
  scope: string;
}

export interface VariableInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'onChange'
> {
  value: string;
  onChange: (value: string) => void;
  knownVariables?: string[];
  variablesMap?: Record<string, VariableDetail>;
  inputSize?: 'default' | 'large';
  error?: string;
  leftIcon?: React.ReactNode;
  rightElement?: React.ReactNode;
}

const DEFAULT_KNOWN_VARS = ['baseUrl', 'token', 'userId', 'apiKey', 'env', 'apiVersion'];

export const VariableInput = forwardRef<HTMLInputElement, VariableInputProps>(
  function VariableInput(
    {
      value,
      onChange,
      knownVariables = DEFAULT_KNOWN_VARS,
      variablesMap,
      inputSize = 'default',
      error,
      leftIcon,
      rightElement,
      className = '',
      placeholder,
      id,
      onKeyDown,
      ...props
    },
    ref,
  ) {
    const [autocompleteOpen, setAutocompleteOpen] = useState(false);
    const [autocompleteQuery, setAutocompleteQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [hoveredVar, setHoveredVar] = useState<{
      name: string;
      value: string;
      scope: string;
      isDefined: boolean;
      x: number;
    } | null>(null);

    const internalInputRef = useRef<HTMLInputElement | null>(null);
    const overlayRef = useRef<HTMLDivElement | null>(null);

    const heightClass = inputSize === 'large' ? 'h-[32px]' : 'h-[28px]';

    const effectiveKnownVars = variablesMap
      ? Array.from(new Set([...Object.keys(variablesMap), ...knownVariables]))
      : knownVariables;

    // Filter known variables for autocomplete
    const matchingVars = effectiveKnownVars.filter(v =>
      v.toLowerCase().includes(autocompleteQuery.toLowerCase()),
    );

    // Check for {{ trigger on text change
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newVal = e.target.value;
      onChange(newVal);

      const cursor = e.target.selectionStart || 0;
      const textBeforeCursor = newVal.slice(0, cursor);
      const match = textBeforeCursor.match(/\{\{([^{}]*)$/);

      if (match) {
        setAutocompleteQuery(match[1] ?? '');
        setAutocompleteOpen(true);
        setSelectedIndex(0);
      } else {
        setAutocompleteOpen(false);
      }
    };

    const handleSelectVariable = (varName: string) => {
      const input = internalInputRef.current;
      if (!input) return;

      const cursor = input.selectionStart || 0;
      const textBeforeCursor = value.slice(0, cursor);
      const textAfterCursor = value.slice(cursor);

      const openBracesIndex = textBeforeCursor.lastIndexOf('{{');
      if (openBracesIndex !== -1) {
        const prefix = textBeforeCursor.slice(0, openBracesIndex);
        const suffix = textAfterCursor.startsWith('}}')
          ? textAfterCursor.slice(2)
          : textAfterCursor;
        const inserted = `${prefix}{{${varName}}}${suffix}`;
        onChange(inserted);
        setAutocompleteOpen(false);

        // Put cursor after inserted variable
        const newPos = prefix.length + varName.length + 4;
        input.value = inserted;
        input.setSelectionRange(newPos, newPos);
        input.focus();
      }
    };

    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (autocompleteOpen && matchingVars.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIndex(prev => (prev + 1) % matchingVars.length);
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIndex(prev => (prev - 1 + matchingVars.length) % matchingVars.length);
          return;
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          const selected = matchingVars[selectedIndex];
          if (selected) {
            handleSelectVariable(selected);
            return;
          }
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          setAutocompleteOpen(false);
          return;
        }
      }

      onKeyDown?.(e);
    };

    // Close autocomplete on click outside
    useEffect(() => {
      const handleClickOutside = () => setAutocompleteOpen(false);
      window.addEventListener('click', handleClickOutside);
      return () => window.removeEventListener('click', handleClickOutside);
    }, []);

    // Render highlighted variable segments for visual preview overlay
    const renderVariableHighlights = () => {
      if (!value || !value.includes('{{')) return null;

      const regex = /\{\{([^{}]+)\}\}/g;
      const segments: React.ReactNode[] = [];
      let lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = regex.exec(value)) !== null) {
        const start = match.index;
        const varName = match[1]?.trim() ?? '';

        if (start > lastIndex) {
          segments.push(
            <span key={`text-${lastIndex}`} style={{ color: 'var(--text-primary)' }}>
              {value.slice(lastIndex, start)}
            </span>,
          );
        }

        const detail = variablesMap?.[varName];
        const isDefined = Boolean(detail);
        const resolvedVal = detail?.value !== undefined ? String(detail.value) : '(undefined)';
        const scopeLabel =
          detail?.scope ?? 'undefined (not defined in active environment or collection)';

        const tooltip = isDefined
          ? `${varName} = ${typeof detail?.value === 'object' ? JSON.stringify(detail?.value) : resolvedVal}\n(scope: ${scopeLabel})`
          : `${varName}\n(undefined variable - not defined in active environment or collection)`;

        segments.push(
          <span
            key={`var-${start}`}
            title={tooltip}
            onMouseEnter={e => {
              const rect = e.currentTarget.getBoundingClientRect();
              const containerRect = overlayRef.current?.getBoundingClientRect();
              setHoveredVar({
                name: varName,
                value: resolvedVal,
                scope: scopeLabel,
                isDefined,
                x: Math.max(0, rect.left - (containerRect?.left || 0)),
              });
            }}
            onMouseLeave={() => setHoveredVar(null)}
            onMouseDown={e => {
              e.preventDefault();
              const input = internalInputRef.current;
              if (!input) return;
              input.focus();
              const rect = e.currentTarget.getBoundingClientRect();
              const clickX = e.clientX - rect.left;
              const ratio = clickX / rect.width;
              const targetPos = ratio < 0.5 ? start : match!.index + match![0].length;
              input.setSelectionRange(targetPos, targetPos);
            }}
            onDoubleClick={e => {
              e.preventDefault();
              const input = internalInputRef.current;
              if (!input) return;
              input.focus();
              input.setSelectionRange(start, match!.index + match![0].length);
            }}
            className="rounded-[2px] font-mono pointer-events-auto cursor-help select-none"
            style={{
              color: isDefined ? 'var(--var-known)' : 'var(--danger)',
              backgroundColor: isDefined ? 'var(--accent-subtle)' : 'var(--danger-subtle)',
              boxShadow: isDefined ? '0 0 0 1px var(--accent)' : '0 0 0 1px var(--danger)',
            }}
          >
            {`{{${varName}}}`}
          </span>,
        );

        lastIndex = regex.lastIndex;
      }

      if (lastIndex < value.length) {
        segments.push(
          <span key={`text-${lastIndex}`} style={{ color: 'var(--text-primary)' }}>
            {value.slice(lastIndex)}
          </span>,
        );
      }

      return segments;
    };

    return (
      <div className="relative flex flex-col w-full">
        <div
          className={`relative flex items-center w-full transition-fast ${heightClass}`}
          style={{
            backgroundColor: 'var(--bg-input)',
            border: `1px solid ${error ? 'var(--danger)' : 'var(--border-strong)'}`,
            borderRadius: 'var(--radius-sm)',
          }}
        >
          {leftIcon && (
            <div
              className="pl-2.5 flex items-center justify-center pointer-events-none shrink-0"
              style={{ color: 'var(--text-muted)' }}
            >
              {leftIcon}
            </div>
          )}

          {/* Variables visual highlight layer (z-20 so variable pills can receive hover/clicks) */}
          <div
            ref={overlayRef}
            className={`absolute inset-0 px-2.5 flex items-center text-[13px] font-mono pointer-events-none overflow-hidden whitespace-pre z-20 ${
              leftIcon ? 'pl-8' : ''
            } ${rightElement ? 'pr-8' : ''}`}
          >
            {renderVariableHighlights()}
          </div>

          <input
            id={id}
            ref={node => {
              internalInputRef.current = node;
              if (typeof ref === 'function') ref(node);
              else if (ref) ref.current = node;
            }}
            type="text"
            value={value}
            onChange={handleChange}
            onKeyDown={handleInputKeyDown}
            onScroll={e => {
              if (overlayRef.current) {
                overlayRef.current.scrollLeft = e.currentTarget.scrollLeft;
              }
            }}
            placeholder={placeholder}
            className={`w-full h-full bg-transparent px-2.5 text-[13px] font-mono app-focus-ring outline-none transition-fast relative z-10 whitespace-pre ${
              value.includes('{{') ? 'text-transparent' : ''
            } ${leftIcon ? 'pl-2' : ''} ${rightElement ? 'pr-8' : ''} ${className}`}
            style={{
              color: value.includes('{{') ? 'transparent' : 'var(--text-primary)',
              caretColor: 'var(--text-primary)',
            }}
            {...props}
          />

          {rightElement && (
            <div className="absolute right-1 flex items-center z-20">{rightElement}</div>
          )}

          {/* Hover Popover showing resolved value and scope */}
          {!autocompleteOpen && hoveredVar && (
            <div
              className="absolute top-full mt-1.5 z-50 px-2.5 py-1.5 text-[11px] rounded-[6px] shadow-elevation font-mono border pointer-events-none whitespace-normal transition-fast"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                borderColor: hoveredVar.isDefined ? 'var(--border)' : 'var(--danger)',
                color: 'var(--text-primary)',
                left: `${Math.max(4, Math.min(hoveredVar.x, 260))}px`,
                maxWidth: '320px',
                minWidth: '180px',
              }}
            >
              <div className="flex items-center gap-1.5 font-bold mb-0.5">
                <span style={{ color: hoveredVar.isDefined ? 'var(--accent)' : 'var(--danger)' }}>
                  {`{{${hoveredVar.name}}}`}
                </span>
                {!hoveredVar.isDefined && (
                  <span className="text-[10px] px-1 py-0.2 rounded font-sans bg-red-950/40 text-red-400">
                    undefined
                  </span>
                )}
              </div>
              <div className="text-[var(--text-secondary)] truncate">
                value:{' '}
                <span
                  className={
                    hoveredVar.isDefined
                      ? 'text-[var(--text-primary)] font-semibold'
                      : 'text-red-400 font-semibold italic'
                  }
                >
                  {hoveredVar.value}
                </span>
              </div>
              <div className="text-[10px] text-[var(--text-muted)] mt-0.5 flex items-center gap-1">
                <span>scope:</span>
                <span className="px-1 py-0.2 rounded bg-[var(--bg-surface)] text-[var(--text-secondary)] font-medium">
                  {hoveredVar.scope}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Variable Autocomplete Popup */}
        {autocompleteOpen && matchingVars.length > 0 && (
          <div
            className="absolute top-full left-0 mt-1 z-50 min-w-[200px] py-1 rounded-[6px] border shadow-elevation select-none transition-fast"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border)',
            }}
          >
            <div
              className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider border-b"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
            >
              Variables
            </div>
            {matchingVars.map((v, idx) => {
              const isSelected = idx === selectedIndex;
              const scopeLabel = variablesMap?.[v]?.scope || 'variable';
              return (
                <div
                  key={v}
                  onClick={() => handleSelectVariable(v)}
                  className="px-3 py-1.5 text-[12px] font-mono cursor-pointer flex items-center justify-between transition-fast"
                  style={{
                    backgroundColor: isSelected ? 'var(--bg-active)' : 'transparent',
                    color: 'var(--text-primary)',
                  }}
                >
                  <span style={{ color: 'var(--var-known)' }}>{`{{${v}}}`}</span>
                  <span
                    className="text-[10px] px-1 py-0.2 rounded font-sans"
                    style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-muted)' }}
                  >
                    {scopeLabel}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {error && (
          <span className="mt-1 text-[12px] leading-[16px]" style={{ color: 'var(--danger)' }}>
            {error}
          </span>
        )}
      </div>
    );
  },
);
