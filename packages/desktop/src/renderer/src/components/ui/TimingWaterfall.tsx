import React from 'react';
import type { ResponseTiming } from '@reqit/core';

export interface TimingWaterfallProps {
  timing: ResponseTiming;
  totalMs: number;
}

export function TimingWaterfall({ timing, totalMs }: TimingWaterfallProps): React.JSX.Element {
  const phases = [
    { label: 'DNS lookup', ms: timing.dnsMs, color: 'var(--method-head)' },
    { label: 'TCP handshake', ms: timing.tcpMs, color: 'var(--method-put)' },
    { label: 'TLS negotiation', ms: timing.tlsMs, color: 'var(--method-patch)' },
    { label: 'Time to first byte (TTFB)', ms: timing.ttfbMs, color: 'var(--method-post)' },
    { label: 'Content download', ms: timing.downloadMs, color: 'var(--method-get)' },
  ];

  const safeTotal = totalMs > 0 ? totalMs : 1;

  return (
    <div className="w-full space-y-3 p-4">
      <div
        className="flex items-center justify-between border-b pb-2"
        style={{ borderColor: 'var(--border)' }}
      >
        <span className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
          Timing breakdown
        </span>
        <span
          className="text-[12px] font-mono font-medium"
          style={{ color: 'var(--text-secondary)' }}
        >
          Total: {totalMs} ms
        </span>
      </div>

      <div className="space-y-2">
        {phases.map(phase => {
          const percent = Math.min(100, Math.max(1, Math.round((phase.ms / safeTotal) * 100)));
          return (
            <div
              key={phase.label}
              className="grid grid-cols-[180px_1fr_70px] items-center gap-3 text-[12px]"
            >
              <span className="truncate" style={{ color: 'var(--text-secondary)' }}>
                {phase.label}
              </span>
              <div
                className="w-full h-3 rounded-[2px] overflow-hidden"
                style={{ backgroundColor: 'var(--bg-muted)' }}
              >
                <div
                  className="h-full rounded-[2px] transition-panel"
                  style={{
                    width: `${percent}%`,
                    backgroundColor: phase.color,
                  }}
                />
              </div>
              <span className="font-mono text-right" style={{ color: 'var(--text-primary)' }}>
                {phase.ms} ms
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
