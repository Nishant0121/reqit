import { describe, expect, it } from 'vitest';
import { ping, VERSION } from '../src/index.js';

describe('placeholder core test', () => {
  it('should return version and respond to ping', () => {
    expect(VERSION).toBe('0.1.0');
    expect(ping()).toBe('pong');
  });
});
