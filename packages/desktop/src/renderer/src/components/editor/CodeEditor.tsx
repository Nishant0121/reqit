import React, { useEffect, useRef } from 'react';
import { EditorState, Compartment } from '@codemirror/state';
import {
  EditorView,
  lineNumbers,
  highlightActiveLineGutter,
  highlightActiveLine,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { keymap } from '@codemirror/view';
import { bracketMatching, syntaxHighlighting, HighlightStyle } from '@codemirror/language';
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

export function CodeEditor({
  value,
  onChange,
  mode = 'text',
  readOnly = false,
  background = 'base',
  minHeight = '140px',
  maxHeight = '400px',
  className = '',
}: CodeEditorProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const languageCompartment = useRef(new Compartment());
  const readOnlyCompartment = useRef(new Compartment());

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
        paddingRight: '6px',
      },
      '.cm-activeLine': {
        backgroundColor: 'var(--bg-hover)',
      },
      '.cm-activeLineGutter': {
        backgroundColor: 'transparent',
        color: 'var(--text-primary)',
      },
      '.cm-scroller': {
        overflow: 'auto',
        fontFamily: 'var(--font-mono)',
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
        history(),
        bracketMatching(),
        syntaxHighlighting(reqitHighlightStyle),
        keymap.of([...defaultKeymap, ...historyKeymap]),
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
      className={`border rounded-[4px] overflow-hidden app-focus-ring ${className}`}
      style={{
        borderColor: 'var(--border)',
        backgroundColor: background === 'surface' ? 'var(--bg-surface)' : 'var(--bg-base)',
      }}
    />
  );
}
