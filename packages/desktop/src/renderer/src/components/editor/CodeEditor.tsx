import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { EditorState, Compartment } from '@codemirror/state';
import {
  EditorView,
  lineNumbers,
  highlightActiveLineGutter,
  highlightActiveLine,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { keymap } from '@codemirror/view';
import {
  bracketMatching,
  syntaxHighlighting,
  HighlightStyle,
  foldGutter,
  foldKeymap,
} from '@codemirror/language';
import {
  search,
  searchKeymap,
  highlightSelectionMatches,
  openSearchPanel,
} from '@codemirror/search';
import { tags } from '@lezer/highlight';
import { json } from '@codemirror/lang-json';
import { xml } from '@codemirror/lang-xml';
import { html } from '@codemirror/lang-html';

export type EditorMode = 'json' | 'xml' | 'html' | 'text';

export interface CodeEditorProps {
  value: string;
  onChange?: (val: string) => void;
  mode?: EditorMode;
  readOnly?: boolean;
  background?: 'base' | 'surface';
  minHeight?: string;
  maxHeight?: string;
  className?: string;
}

export interface CodeEditorHandle {
  openSearch: () => void;
  getView: () => EditorView | null;
}

// Syntax highlighting style mapped to Terminal & Slate design tokens
const reqitHighlightStyle = HighlightStyle.define([
  { tag: [tags.propertyName, tags.definition(tags.propertyName)], color: 'var(--syntax-key)' },
  { tag: tags.string, color: 'var(--syntax-string)' },
  { tag: tags.number, color: 'var(--syntax-number)' },
  { tag: [tags.bool, tags.null], color: 'var(--syntax-bool)' },
  { tag: [tags.punctuation, tags.bracket], color: 'var(--syntax-punct)' },
  { tag: tags.comment, color: 'var(--syntax-comment)', fontStyle: 'italic' },
  { tag: tags.invalid, color: 'var(--danger)' },
]);

export const CodeEditor = forwardRef<CodeEditorHandle, CodeEditorProps>(function CodeEditor(
  {
    value,
    onChange,
    mode = 'text',
    readOnly = false,
    background = 'base',
    minHeight = '140px',
    maxHeight = '400px',
    className = '',
  }: CodeEditorProps,
  ref,
): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const languageCompartment = useRef(new Compartment());
  const readOnlyCompartment = useRef(new Compartment());

  useImperativeHandle(ref, () => ({
    openSearch: () => {
      if (viewRef.current) {
        openSearchPanel(viewRef.current);
      }
    },
    getView: () => viewRef.current,
  }));

  const getLanguageExtension = (m: EditorMode) => {
    switch (m) {
      case 'json':
        return json();
      case 'xml':
        return xml();
      case 'html':
        return html();
      default:
        return [];
    }
  };

  useEffect(() => {
    if (!containerRef.current) return;

    const bgVar = background === 'surface' ? 'var(--bg-surface)' : 'var(--bg-base)';

    const reqitTheme = EditorView.theme({
      '&': {
        color: 'var(--text-primary)',
        backgroundColor: bgVar,
        fontFamily: 'var(--font-mono)',
        fontSize: '12px',
        lineHeight: '18px',
        height: '100%',
        minHeight,
        maxHeight,
      },
      '.cm-content': {
        caretColor: 'var(--accent)',
        padding: '8px 0',
      },
      '&.cm-focused .cm-cursor': {
        borderLeftColor: 'var(--accent)',
      },
      '&.cm-focused .cm-selectionBackground, ::selection': {
        backgroundColor: 'var(--accent-subtle) !important',
      },
      '.cm-selectionMatch': {
        backgroundColor: 'var(--accent-subtle)',
      },
      '.cm-gutters': {
        backgroundColor: 'transparent',
        color: 'var(--text-muted)',
        borderRight: '1px solid var(--border)',
        paddingRight: '4px',
      },
      '.cm-activeLine': {
        backgroundColor: 'var(--bg-hover)',
      },
      '.cm-activeLineGutter': {
        backgroundColor: 'transparent',
        color: 'var(--text-primary)',
      },
      '.cm-foldGutter .cm-gutterElement': {
        color: 'var(--text-muted)',
        cursor: 'pointer',
        padding: '0 4px',
      },
      '.cm-foldGutter .cm-gutterElement:hover': {
        color: 'var(--accent)',
      },
      '.cm-scroller': {
        overflow: 'auto',
        fontFamily: 'var(--font-mono)',
      },
      /* Search Panel styling matching Terminal & Slate */
      '.cm-panels': {
        backgroundColor: 'var(--bg-elevated) !important',
        color: 'var(--text-primary) !important',
      },
      '.cm-panels.cm-panels-top': {
        borderBottom: '1px solid var(--border) !important',
      },
      '.cm-panel.cm-search': {
        backgroundColor: 'var(--bg-elevated) !important',
        color: 'var(--text-primary) !important',
        padding: '6px 10px !important',
        fontFamily: 'var(--font-mono) !important',
        fontSize: '12px !important',
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '6px',
      },
      '.cm-panel.cm-search input.cm-textfield': {
        backgroundColor: 'var(--bg-input) !important',
        border: '1px solid var(--border-strong) !important',
        color: 'var(--text-primary) !important',
        borderRadius: 'var(--radius-sm) !important',
        padding: '3px 8px !important',
        fontSize: '12px !important',
        fontFamily: 'var(--font-mono) !important',
        outline: 'none !important',
      },
      '.cm-panel.cm-search input.cm-textfield:focus': {
        borderColor: 'var(--accent) !important',
        boxShadow: '0 0 0 1px var(--accent)',
      },
      /* Buttons: next, previous, all, replace */
      '.cm-panel.cm-search .cm-button, .cm-panel.cm-search button': {
        background: 'var(--bg-surface) !important',
        backgroundColor: 'var(--bg-surface) !important',
        backgroundImage: 'none !important',
        border: '1px solid var(--border) !important',
        borderRadius: 'var(--radius-sm) !important',
        color: 'var(--text-primary) !important',
        padding: '3px 10px !important',
        fontSize: '11px !important',
        fontWeight: '500 !important',
        fontFamily: 'var(--font-sans) !important',
        cursor: 'pointer !important',
        margin: '0 2px !important',
        textTransform: 'capitalize',
        transition: 'all 0.15s ease',
        boxShadow: 'none !important',
      },
      '.cm-panel.cm-search .cm-button:hover, .cm-panel.cm-search button:hover': {
        background: 'var(--bg-hover) !important',
        backgroundColor: 'var(--bg-hover) !important',
        borderColor: 'var(--border-strong) !important',
        color: 'var(--text-primary) !important',
      },
      '.cm-panel.cm-search .cm-button:active, .cm-panel.cm-search button:active': {
        background: 'var(--bg-active) !important',
        backgroundColor: 'var(--bg-active) !important',
      },
      '.cm-panel.cm-search button[name="close"]': {
        background: 'transparent !important',
        backgroundColor: 'transparent !important',
        border: 'none !important',
        color: 'var(--text-muted) !important',
        fontSize: '16px !important',
        padding: '1px 6px !important',
        marginLeft: 'auto !important',
        cursor: 'pointer !important',
        lineHeight: '1',
      },
      '.cm-panel.cm-search button[name="close"]:hover': {
        color: 'var(--text-primary) !important',
        backgroundColor: 'var(--bg-hover) !important',
      },
      /* Labels & Beautified Checkboxes */
      '.cm-panel.cm-search label': {
        display: 'inline-flex !important',
        alignItems: 'center !important',
        gap: '5px !important',
        color: 'var(--text-secondary) !important',
        fontSize: '11px !important',
        fontFamily: 'var(--font-sans) !important',
        cursor: 'pointer !important',
        userSelect: 'none !important',
        padding: '2px 4px !important',
        borderRadius: 'var(--radius-sm) !important',
      },
      '.cm-panel.cm-search label:hover': {
        color: 'var(--text-primary) !important',
      },
      '.cm-panel.cm-search input[type="checkbox"]': {
        appearance: 'none !important',
        WebkitAppearance: 'none !important',
        width: '13px !important',
        height: '13px !important',
        border: '1px solid var(--border-strong) !important',
        borderRadius: '3px !important',
        backgroundColor: 'var(--bg-input) !important',
        cursor: 'pointer !important',
        display: 'inline-grid !important',
        placeContent: 'center !important',
        margin: '0 2px 0 0 !important',
        verticalAlign: 'middle !important',
        transition: 'all 0.15s ease',
        position: 'relative !important',
      },
      '.cm-panel.cm-search input[type="checkbox"]:hover': {
        borderColor: 'var(--accent) !important',
      },
      '.cm-panel.cm-search input[type="checkbox"]:checked': {
        backgroundColor: 'var(--accent) !important',
        borderColor: 'var(--accent) !important',
      },
      '.cm-panel.cm-search input[type="checkbox"]:checked::after': {
        content: '""',
        display: 'block',
        width: '3.5px',
        height: '6.5px',
        border: 'solid var(--accent-fg)',
        borderWidth: '0 1.5px 1.5px 0',
        transform: 'rotate(45deg) translate(-0.5px, -0.5px)',
      },
      /* Match Highlighting - soft clear background without disruptive border */
      '.cm-searchMatch': {
        backgroundColor: 'rgba(234, 179, 8, 0.28) !important',
        borderRadius: '2px',
        outline: 'none !important',
      },
      /* Active Match Highlighting - vibrant solid color with jet-black text */
      '.cm-searchMatch-selected, .cm-searchMatch.cm-searchMatch-selected, &.cm-focused .cm-searchMatch-selected':
        {
          backgroundColor: '#f59e0b !important',
          color: '#000000 !important',
          borderRadius: '2px !important',
          outline: 'none !important',
          fontWeight: '600 !important',
        },
      '.cm-searchMatch-selected *': {
        color: '#000000 !important',
      },
      '.cm-searchMatch.cm-searchMatch-selected *': {
        color: '#000000 !important',
      },
    });

    const updateListener = EditorView.updateListener.of(update => {
      if (update.docChanged && onChange) {
        onChange(update.state.doc.toString());
      }
    });

    const startState = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        foldGutter(),
        history(),
        bracketMatching(),
        search({ top: true }),
        highlightSelectionMatches(),
        syntaxHighlighting(reqitHighlightStyle),
        keymap.of([...defaultKeymap, ...historyKeymap, ...foldKeymap, ...searchKeymap]),
        languageCompartment.current.of(getLanguageExtension(mode)),
        readOnlyCompartment.current.of(EditorState.readOnly.of(readOnly)),
        reqitTheme,
        updateListener,
      ],
    });

    const view = new EditorView({
      state: startState,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  // Update read-only setting dynamically
  useEffect(() => {
    if (!viewRef.current) return;
    viewRef.current.dispatch({
      effects: readOnlyCompartment.current.reconfigure(EditorState.readOnly.of(readOnly)),
    });
  }, [readOnly]);

  // Update language mode dynamically
  useEffect(() => {
    if (!viewRef.current) return;
    viewRef.current.dispatch({
      effects: languageCompartment.current.reconfigure(getLanguageExtension(mode)),
    });
  }, [mode]);

  // Sync external value changes when not focused
  useEffect(() => {
    if (!viewRef.current) return;
    const currentVal = viewRef.current.state.doc.toString();
    if (value !== currentVal) {
      viewRef.current.dispatch({
        changes: { from: 0, to: currentVal.length, insert: value },
      });
    }
  }, [value]);

  return (
    <div
      ref={containerRef}
      className={`app-focus-ring overflow-hidden rounded-sm border ${className}`}
      style={{
        borderColor: 'var(--border)',
        backgroundColor: background === 'surface' ? 'var(--bg-surface)' : 'var(--bg-base)',
      }}
    />
  );
});
