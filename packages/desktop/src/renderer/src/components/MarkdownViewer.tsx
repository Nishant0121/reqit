import React, { useState } from 'react';
import { Copy, Check, ExternalLink } from 'lucide-react';

export interface MarkdownViewerProps {
  content: string;
  className?: string;
}

interface CodeBlockProps {
  code: string;
  language?: string;
}

function CodeBlock({ code, language }: CodeBlockProps): React.JSX.Element {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      className="my-3 overflow-hidden rounded border font-mono text-[12px]"
      style={{
        backgroundColor: 'var(--bg-elevated)',
        borderColor: 'var(--border)',
      }}
    >
      <div
        className="flex items-center justify-between border-b px-3 py-1.5 text-[11px]"
        style={{
          borderColor: 'var(--border)',
          backgroundColor: 'var(--bg-surface)',
          color: 'var(--text-muted)',
        }}
      >
        <span className="uppercase">{language || 'text'}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="transition-fast flex cursor-pointer items-center gap-1 hover:text-(--text-primary)"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-500" />
              <span className="text-emerald-500">Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-(--text-primary)">
        <code>{code}</code>
      </pre>
    </div>
  );
}

/**
 * Parses inline markdown: bold, italic, code, links.
 */
function renderInline(text: string): React.ReactNode[] {
  const elements: React.ReactNode[] = [];
  let remaining = text;
  let keyIdx = 0;

  // Regex to match inline patterns: code, links, bold, italic
  const inlineRegex =
    /(`([^`]+)`)|(\[([^\]]+)\]\(([^)]+)\))|(\*\*\*([^*]+)\*\*\*)|(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(__([^_]+)__)|(_([^_]+)_)/;

  while (remaining.length > 0) {
    const match = remaining.match(inlineRegex);
    if (!match || match.index === undefined) {
      elements.push(remaining);
      break;
    }

    if (match.index > 0) {
      elements.push(remaining.substring(0, match.index));
    }

    const matchedStr = match[0];
    const key = `inline-${keyIdx++}`;

    if (match[1]) {
      // Inline code
      elements.push(
        <code
          key={key}
          className="rounded px-1.5 py-0.5 font-mono text-[11px]"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            color: 'var(--syntax-string)',
          }}
        >
          {match[2]}
        </code>,
      );
    } else if (match[3]) {
      // Link [text](url)
      const linkText = match[4];
      const linkUrl = match[5];
      elements.push(
        <a
          key={key}
          href={linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 text-(--accent) hover:underline"
        >
          {linkText}
          <ExternalLink className="inline h-2.5 w-2.5 opacity-70" />
        </a>,
      );
    } else if (match[6]) {
      // Bold + Italic ***text***
      elements.push(
        <strong key={key}>
          <em>{match[7]}</em>
        </strong>,
      );
    } else if (match[8]) {
      // Bold **text**
      elements.push(
        <strong key={key} className="font-semibold text-(--text-primary)">
          {match[9]}
        </strong>,
      );
    } else if (match[10]) {
      // Italic *text*
      elements.push(
        <em key={key} className="text-(--text-primary) italic">
          {match[11]}
        </em>,
      );
    } else if (match[12]) {
      // Bold __text__
      elements.push(
        <strong key={key} className="font-semibold text-(--text-primary)">
          {match[13]}
        </strong>,
      );
    } else if (match[14]) {
      // Italic _text_
      elements.push(
        <em key={key} className="text-(--text-primary) italic">
          {match[15]}
        </em>,
      );
    }

    remaining = remaining.substring(match.index + matchedStr.length);
  }

  return elements;
}

export function MarkdownViewer({
  content,
  className = '',
}: MarkdownViewerProps): React.JSX.Element {
  if (!content || !content.trim()) {
    return (
      <div
        className="flex h-full items-center justify-center p-6 text-[13px]"
        style={{ color: 'var(--text-muted)' }}
      >
        No documentation provided for this request.
      </div>
    );
  }

  const lines = content.split('\n');
  const blocks: React.JSX.Element[] = [];

  let i = 0;
  let blockKey = 0;

  while (i < lines.length) {
    const line = lines[i]!;

    // 1. Fenced Code Block
    if (line.trim().startsWith('```')) {
      const lang = line.trim().slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i]!.trim().startsWith('```')) {
        codeLines.push(lines[i]!);
        i++;
      }
      i++; // skip closing ```
      blocks.push(
        <CodeBlock key={`block-${blockKey++}`} code={codeLines.join('\n')} language={lang} />,
      );
      continue;
    }

    // 2. Horizontal Rule (---, ***, ___)
    if (/^(\s*[-*_]\s*){3,}$/.test(line)) {
      blocks.push(
        <hr
          key={`block-${blockKey++}`}
          className="my-4 border-t"
          style={{ borderColor: 'var(--border)' }}
        />,
      );
      i++;
      continue;
    }

    // 3. Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch && headingMatch[1] && headingMatch[2]) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      const inline = renderInline(text);

      if (level === 1) {
        blocks.push(
          <h1
            key={`block-${blockKey++}`}
            className="mt-5 mb-2.5 border-b pb-1.5 text-[20px] font-bold text-(--text-primary)"
            style={{ borderColor: 'var(--border)' }}
          >
            {inline}
          </h1>,
        );
      } else if (level === 2) {
        blocks.push(
          <h2
            key={`block-${blockKey++}`}
            className="mt-4 mb-2 border-b pb-1 text-[17px] font-semibold text-(--text-primary)"
            style={{ borderColor: 'var(--border)' }}
          >
            {inline}
          </h2>,
        );
      } else if (level === 3) {
        blocks.push(
          <h3
            key={`block-${blockKey++}`}
            className="mt-3.5 mb-1.5 text-[15px] font-semibold text-(--text-primary)"
          >
            {inline}
          </h3>,
        );
      } else {
        blocks.push(
          <h4
            key={`block-${blockKey++}`}
            className="mt-3 mb-1 text-[13px] font-semibold text-(--text-primary)"
          >
            {inline}
          </h4>,
        );
      }
      i++;
      continue;
    }

    // 4. Blockquotes (> ...)
    if (line.trim().startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i]!.trim().startsWith('>')) {
        quoteLines.push(lines[i]!.replace(/^\s*>\s?/, ''));
        i++;
      }
      blocks.push(
        <blockquote
          key={`block-${blockKey++}`}
          className="my-3 border-l-3 pl-3.5 text-(--text-secondary) italic"
          style={{ borderColor: 'var(--accent)' }}
        >
          {quoteLines.map((ql, qIdx) => (
            <p key={qIdx} className="my-1">
              {renderInline(ql)}
            </p>
          ))}
        </blockquote>,
      );
      continue;
    }

    // 5. Tables (| th | th |)
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      const tableLines: string[] = [];
      while (
        i < lines.length &&
        lines[i]!.trim().startsWith('|') &&
        lines[i]!.trim().endsWith('|')
      ) {
        tableLines.push(lines[i]!.trim());
        i++;
      }

      if (tableLines.length >= 2) {
        const headerRow = tableLines[0]!
          .slice(1, -1)
          .split('|')
          .map(c => c.trim());
        const bodyRows = tableLines.slice(2).map(r =>
          r
            .slice(1, -1)
            .split('|')
            .map(c => c.trim()),
        );

        blocks.push(
          <div key={`block-${blockKey++}`} className="my-3 overflow-x-auto">
            <table
              className="w-full border-collapse rounded border text-[12px]"
              style={{ borderColor: 'var(--border)' }}
            >
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-elevated)' }}>
                  {headerRow.map((th, hIdx) => (
                    <th
                      key={hIdx}
                      className="border px-3 py-1.5 text-left font-semibold text-(--text-primary)"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      {renderInline(th)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bodyRows.map((row, rIdx) => (
                  <tr
                    key={rIdx}
                    className="transition-fast hover:bg-(--bg-hover)"
                    style={{
                      backgroundColor: rIdx % 2 === 0 ? 'transparent' : 'var(--bg-surface)',
                    }}
                  >
                    {row.map((td, dIdx) => (
                      <td
                        key={dIdx}
                        className="border px-3 py-1.5 text-(--text-secondary)"
                        style={{ borderColor: 'var(--border)' }}
                      >
                        {renderInline(td)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>,
        );
        continue;
      }
    }

    // 6. Lists (Unordered - or *, Ordered 1.)
    if (/^\s*([*+-]|\d+\.)\s+/.test(line)) {
      const isOrdered = /^\s*\d+\.\s+/.test(line);
      const listItems: string[] = [];

      while (i < lines.length && /^\s*([*+-]|\d+\.)\s+/.test(lines[i]!)) {
        const itemText = lines[i]!.replace(/^\s*([*+-]|\d+\.)\s+/, '');
        listItems.push(itemText);
        i++;
      }

      if (isOrdered) {
        blocks.push(
          <ol
            key={`block-${blockKey++}`}
            className="my-2 list-decimal space-y-1 pl-5 text-[13px] text-(--text-primary)"
          >
            {listItems.map((item, idx) => (
              <li key={idx}>{renderInline(item)}</li>
            ))}
          </ol>,
        );
      } else {
        blocks.push(
          <ul
            key={`block-${blockKey++}`}
            className="my-2 list-disc space-y-1 pl-5 text-[13px] text-(--text-primary)"
          >
            {listItems.map((item, idx) => (
              <li key={idx}>{renderInline(item)}</li>
            ))}
          </ul>,
        );
      }
      continue;
    }

    // 7. Regular paragraph / empty line
    if (!line.trim()) {
      i++;
      continue;
    }

    // Accumulate consecutive paragraph lines
    const pLines: string[] = [];
    while (
      i < lines.length &&
      lines[i]!.trim() &&
      !lines[i]!.trim().startsWith('```') &&
      !lines[i]!.trim().startsWith('#') &&
      !lines[i]!.trim().startsWith('>') &&
      !lines[i]!.trim().startsWith('|') &&
      !/^\s*([*+-]|\d+\.)\s+/.test(lines[i]!) &&
      !/^(\s*[-*_]\s*){3,}$/.test(lines[i]!)
    ) {
      pLines.push(lines[i]!);
      i++;
    }

    blocks.push(
      <p
        key={`block-${blockKey++}`}
        className="my-2 text-[13px] leading-relaxed text-(--text-primary)"
      >
        {renderInline(pLines.join(' '))}
      </p>,
    );
  }

  return (
    <div
      className={`prose max-w-none text-(--text-primary) select-text ${className}`}
      style={{
        lineHeight: 1.6,
      }}
    >
      {blocks}
    </div>
  );
}
