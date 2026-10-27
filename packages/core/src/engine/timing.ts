import * as net from 'node:net';
import type { ResponseTiming } from './types.js';

export class TimingTracker {
  private startTime: number;
  private tDns: number | null = null;
  private tTcp: number | null = null;
  private tTls: number | null = null;
  private tResponse: number | null = null;
  private tEnd: number | null = null;
  private isReused = false;
  private isIp: boolean;
  private isHttps: boolean;

  constructor(hostname: string, isHttps: boolean) {
    this.startTime = performance.now();
    this.isIp = net.isIP(hostname) !== 0;
    this.isHttps = isHttps;
  }

  public hookSocket(socket: net.Socket): void {
    if (!socket.connecting || socket.readyState === 'open') {
      this.isReused = true;
      return;
    }

    socket.once('lookup', () => {
      if (this.tDns === null) {
        this.tDns = performance.now();
      }
    });

    socket.once('connect', () => {
      if (this.tTcp === null) {
        this.tTcp = performance.now();
      }
    });

    socket.once('secureConnect', () => {
      if (this.tTls === null) {
        this.tTls = performance.now();
      }
    });
  }

  public onResponse(): void {
    if (this.tResponse === null) {
      this.tResponse = performance.now();
    }
  }

  public onEnd(): void {
    if (this.tEnd === null) {
      this.tEnd = performance.now();
    }
  }

  public compute(): ResponseTiming {
    const end = this.tEnd ?? performance.now();
    const response = this.tResponse ?? end;

    if (this.isReused) {
      const ttfbMs = Math.max(0, Math.round(response - this.startTime));
      const downloadMs = Math.max(0, Math.round(end - response));
      const totalMs = Math.max(0, Math.round(end - this.startTime));

      return {
        dnsMs: 0,
        tcpMs: 0,
        tlsMs: 0,
        ttfbMs,
        downloadMs,
        totalMs,
      };
    }

    // 1. DNS
    let dnsEnd: number;
    let dnsMs: number;
    if (this.isIp) {
      dnsEnd = this.startTime;
      dnsMs = 0;
    } else {
      dnsEnd = this.tDns ?? this.startTime;
      dnsMs = Math.max(0, Math.round(dnsEnd - this.startTime));
    }

    // 2. TCP
    const tcpEnd = this.tTcp ?? dnsEnd;
    const tcpMs = Math.max(0, Math.round(tcpEnd - dnsEnd));

    // 3. TLS
    let tlsEnd: number;
    let tlsMs: number;
    if (!this.isHttps) {
      tlsEnd = tcpEnd;
      tlsMs = 0;
    } else {
      tlsEnd = this.tTls ?? tcpEnd;
      tlsMs = Math.max(0, Math.round(tlsEnd - tcpEnd));
    }

    // 4. TTFB (from TLS/TCP ready to first byte of response)
    const ttfbEnd = Math.max(tlsEnd, response);
    const ttfbMs = Math.max(0, Math.round(ttfbEnd - tlsEnd));

    // 5. Download (from response headers to body end)
    const downloadMs = Math.max(0, Math.round(end - ttfbEnd));

    // 6. Total
    const totalMs = Math.max(0, Math.round(end - this.startTime));

    return {
      dnsMs,
      tcpMs,
      tlsMs,
      ttfbMs,
      downloadMs,
      totalMs,
    };
  }
}
