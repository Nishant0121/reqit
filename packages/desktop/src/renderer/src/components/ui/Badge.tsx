import React from 'react';
import type { HttpMethod } from '@reqit/core';

export const SHORT_METHOD_NAMES: Record<HttpMethod, string> = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  PATCH: 'PTCH',
  DELETE: 'DEL',
  HEAD: 'HEAD',
  OPTIONS: 'OPT',
};

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: 'var(--success)',
  POST: 'var(--warning)',
  PUT: 'var(--info)',
  PATCH: 'var(--info)',
  DELETE: 'var(--danger)',
  HEAD: 'var(--text-muted)',
  OPTIONS: 'var(--text-muted)',
};

export interface MethodBadgeProps {
  method: HttpMethod;
  short?: boolean;
  className?: string;
}

export function MethodBadge({
  method,
  short = false,
  className = '',
}: MethodBadgeProps): React.JSX.Element {
  const label = short ? SHORT_METHOD_NAMES[method] || method : method;
  const color = METHOD_COLORS[method] || 'var(--text-muted)';

  return (
    <span
      className={`inline-flex items-center justify-start font-mono text-[11px] leading-4 font-bold tracking-[0.02em] uppercase select-none ${
        short ? 'w-11 shrink-0' : ''
      } ${className}`}
      style={{ color }}
    >
      {label}
    </span>
  );
}

export interface StatusBadgeProps {
  status: number;
  statusText?: string;
  isError?: boolean;
  isCancelled?: boolean;
  className?: string;
}

export function StatusBadge({
  status,
  statusText,
  isError,
  isCancelled,
  className = '',
}: StatusBadgeProps): React.JSX.Element {
  let color = 'var(--text-muted)';
  let bg = 'var(--bg-active)';
  let text = statusText || '';

  if (isCancelled) {
    color = 'var(--text-muted)';
    bg = 'var(--bg-active)';
    text = text || 'Cancelled';
  } else if (isError) {
    color = 'var(--danger)';
    bg = 'var(--danger-subtle)';
    text = text || 'Network error';
  } else if (status >= 200 && status < 300) {
    color = 'var(--success)';
    bg = 'var(--success-subtle)';
    text = text || 'OK';
  } else if (status >= 300 && status < 400) {
    color = 'var(--info)';
    bg = 'var(--info-subtle)';
    text = text || 'Redirect';
  } else if (status >= 400 && status < 500) {
    color = 'var(--warning)';
    bg = 'var(--warning-subtle)';
    text = text || 'Client error';
  } else if (status >= 500) {
    color = 'var(--danger)';
    bg = 'var(--danger-subtle)';
    text = text || 'Server error';
  } else if (status >= 100) {
    color = 'var(--info)';
    bg = 'var(--info-subtle)';
    text = text || 'Info';
  }

  const displayText = status > 0 ? `${status} ${text}`.trim() : text;

  return (
    <span
      className={`inline-flex items-center rounded-sm border px-2 py-0.5 font-mono text-[11px] leading-4 font-medium select-none ${className}`}
      style={{
        color,
        backgroundColor: bg,
        borderColor: color,
      }}
    >
      {displayText}
    </span>
  );
}

export interface CountBadgeProps {
  count: number | string;
  className?: string;
}

export function CountBadge({ count, className = '' }: CountBadgeProps): React.JSX.Element {
  return (
    <span
      className={`inline-flex items-center rounded-sm px-1.5 py-0.5 text-[11px] leading-4 font-medium select-none ${className}`}
      style={{
        backgroundColor: 'var(--bg-elevated)',
        color: 'var(--text-secondary)',
      }}
    >
      {count}
    </span>
  );
}
