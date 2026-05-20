// Pure decision logic for "should we query Claude right now?" — extracted so
// it can be tested without the orchestrator's timers, IO, or Anthropic SDK.

export interface ThrottleInputs {
  now: number;
  enabled: boolean;
  inFlight: boolean;
  lastEventTime: number;
  lastQueryAt: number;
  isTyping: boolean;
  idleThresholdMs: number;
  minQueryIntervalMs: number;
}

export type ThrottleDecision =
  | { query: false; reason: 'disabled' | 'in_flight' | 'not_idle' | 'throttled' | 'typing' }
  | { query: true; reason: 'idle' };

/** Should the periodic tick fire a query? Pure, deterministic. */
export function shouldQuery(inputs: ThrottleInputs): ThrottleDecision {
  if (!inputs.enabled) return { query: false, reason: 'disabled' };
  if (inputs.inFlight) return { query: false, reason: 'in_flight' };
  const idle = inputs.now - inputs.lastEventTime;
  if (idle < inputs.idleThresholdMs) return { query: false, reason: 'not_idle' };
  if (inputs.now - inputs.lastQueryAt < inputs.minQueryIntervalMs) {
    return { query: false, reason: 'throttled' };
  }
  if (inputs.isTyping) return { query: false, reason: 'typing' };
  return { query: true, reason: 'idle' };
}

/** Should we send the captured screen, or skip because it's identical to last time? */
export function shouldSendCapture(
  fingerprint: string,
  lastFingerprint: string,
  userRequested: boolean,
): boolean {
  if (userRequested) return true;
  return fingerprint !== lastFingerprint;
}
