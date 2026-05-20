import { describe, it, expect } from 'vitest';
import { shouldQuery, shouldSendCapture, ThrottleInputs } from '../../src/main/throttle';

function base(): ThrottleInputs {
  return {
    now: 100_000,
    enabled: true,
    inFlight: false,
    lastEventTime: 80_000,   // idle for 20s
    lastQueryAt: 50_000,     // last query 50s ago
    isTyping: false,
    idleThresholdMs: 6_000,
    minQueryIntervalMs: 20_000,
  };
}

describe('shouldQuery', () => {
  it('returns query=true when idle and not throttled', () => {
    expect(shouldQuery(base())).toEqual({ query: true, reason: 'idle' });
  });

  it('returns disabled when not enabled', () => {
    expect(shouldQuery({ ...base(), enabled: false })).toEqual({ query: false, reason: 'disabled' });
  });

  it('returns in_flight when already querying', () => {
    expect(shouldQuery({ ...base(), inFlight: true })).toEqual({ query: false, reason: 'in_flight' });
  });

  it('returns not_idle when user was recently active', () => {
    expect(shouldQuery({ ...base(), lastEventTime: 99_000 })).toEqual({ query: false, reason: 'not_idle' });
  });

  it('returns throttled when last query was too recent', () => {
    expect(shouldQuery({ ...base(), lastQueryAt: 95_000 })).toEqual({ query: false, reason: 'throttled' });
  });

  it('returns typing when user is typing', () => {
    expect(shouldQuery({ ...base(), isTyping: true })).toEqual({ query: false, reason: 'typing' });
  });
});

describe('shouldSendCapture', () => {
  it('returns true when fingerprint changed', () => {
    expect(shouldSendCapture('abc', 'def', false)).toBe(true);
  });

  it('returns false when fingerprint is same and not user-requested', () => {
    expect(shouldSendCapture('abc', 'abc', false)).toBe(false);
  });

  it('returns true when user-requested even if fingerprint is same', () => {
    expect(shouldSendCapture('abc', 'abc', true)).toBe(true);
  });
});
