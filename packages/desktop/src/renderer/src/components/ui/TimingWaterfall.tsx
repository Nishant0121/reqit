import React from 'react';
import type { ResponseTiming } from '@reqit/core';
import { Zap, CornerDownRight } from 'lucide-react';

export interface TimingWaterfallProps {
  timing: ResponseTiming;
  totalMs: number;
  redirectHops?: ResponseTiming[];
}

export function TimingWaterfall({
  timing,
  totalMs,
  redirectHops,
}: TimingWaterfallProps): React.JSX.Element {
  const safeTotal = totalMs > 0 ? totalMs : 1;

  // Compute staggered start offsets
  const dnsStart = 0;
  const tcpStart = timing.dnsMs;
  const tlsStart = tcpStart + timing.tcpMs;
  const ttfbStart = tlsStart + timing.tlsMs;
  const downloadStart = ttfbStart + timing.ttfbMs;

  const phases = [
    { label: 'DNS lookup', ms: timing.dnsMs, startMs: dnsStart, color: 'var(--info-mark)' },
    { label: 'TCP handshake', ms: timing.tcpMs, startMs: tcpStart, color: 'var(--accent)' },
    {
      label: 'TLS negotiation',
      ms: timing.tlsMs,
      startMs: tlsStart,
      color: 'var(--git-untracked)',
    },
    {
      label: 'Time to first byte (TTFB)',
      ms: timing.ttfbMs,
      startMs: ttfbStart,
      color: 'var(--warning-mark)',
    },
    {
      label: 'Content download',
      ms: timing.downloadMs,
      startMs: downloadStart,
      color: 'var(--success-mark)',
    },
  ];

  const isKeepAlive = timing.dnsMs === 0 && timing.tcpMs === 0 && timing.tlsMs === 0;

  return (
    <div className="w-full space-y-4 p-4 select-none">
      {/* Total & Summary Header */}
      <div
        className="flex items-center justify-between border-b pb-2.5"
        style={{ borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
            Timing breakdown
          </span>
          {isKeepAlive && (
            <span
              className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-[4px] border"
              style={{
                backgroundColor: 'var(--accent-subtle)',
                borderColor: 'var(--accent)',
                color: 'var(--accent)',
              }}
            >
              <Zap className="w-3 h-3" />
              <span>Connection reused (keep-alive)</span>
            </span>
          )}
        </div>
        <span
          className="text-[12px] font-mono font-medium"
          style={{ color: 'var(--text-secondary)' }}
        >
          Total duration: {totalMs} ms
        </span>
      </div>

      {/* Waterfall Bars */}
      <div className="space-y-2.5">
        {phases.map(phase => {
          const leftPercent = Math.min(99, Math.max(0, (phase.startMs / safeTotal) * 100));
          const widthPercent =
            phase.ms > 0
              ? Math.min(100 - leftPercent, Math.max(1, (phase.ms / safeTotal) * 100))
              : 0;

          return (
            <div
              key={phase.label}
              className="grid grid-cols-[180px_1fr_70px] items-center gap-3 text-[12px]"
            >
              <span className="truncate font-medium" style={{ color: 'var(--text-secondary)' }}>
                {phase.label}
              </span>

              {/* Waterfall Track */}
              <div
                className="relative w-full h-3.5 rounded-[2px] overflow-hidden"
                style={{ backgroundColor: 'var(--bg-active)' }}
              >
                {phase.ms > 0 ? (
                  <div
                    className="absolute top-0 bottom-0 rounded-[2px] transition-panel"
                    style={{
                      left: `${leftPercent}%`,
                      width: `${widthPercent}%`,
                      backgroundColor: phase.color,
                      minWidth: '3px',
                    }}
                    title={`${phase.label}: ${phase.ms} ms (offset: ${phase.startMs} ms)`}
                  />
                ) : (
                  <div
                    className="absolute top-0 bottom-0 w-[2px]"
                    style={{
                      left: `${leftPercent}%`,
                      backgroundColor: 'var(--text-muted)',
                      opacity: 0.5,
                    }}
                  />
                )}
              </div>

              <span
                className="font-mono text-right text-[12px]"
                style={{ color: 'var(--text-primary)' }}
              >
                {phase.ms} ms
              </span>
            </div>
          );
        })}
      </div>

      {/* Redirect Hops Section */}
      {redirectHops && redirectHops.length > 0 && (
        <div className="mt-4 pt-3 border-t space-y-2" style={{ borderColor: 'var(--border)' }}>
          <span
            className="text-[12px] font-semibold block"
            style={{ color: 'var(--text-secondary)' }}
          >
            Redirect chain ({redirectHops.length} hops)
          </span>
          <div className="space-y-1.5">
            {redirectHops.map((hop, index) => (
              <div
                key={index}
                className="flex items-center gap-2 text-[12px] font-mono px-2 py-1 rounded-[4px]"
                style={{ backgroundColor: 'var(--bg-input)' }}
              >
                <CornerDownRight className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                <span className="truncate flex-1" style={{ color: 'var(--text-primary)' }}>
                  Hop {index + 1}
                </span>
                <span style={{ color: 'var(--text-muted)' }}>{hop.totalMs} ms</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
