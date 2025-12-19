import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NETWORK_CONFIG } from '../types';
import {
  createRateLimitState,
  checkConnectionRateLimit,
  recordConnectionAttempt,
  checkAuthRateLimit,
  recordFailedAuthAttempt,
  clearAuthRateLimit,
  resetRateLimitState,
  type RateLimitState,
} from './peerConnection';

describe('Rate Limiting', () => {
  let rateLimitState: RateLimitState;

  beforeEach(() => {
    vi.useFakeTimers();
    rateLimitState = createRateLimitState();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('createRateLimitState', () => {
    it('should create initial state with empty values', () => {
      const state = createRateLimitState();

      expect(state.connectionAttempts).toEqual([]);
      expect(state.rateLimitCooldownEnd).toBe(0);
      expect(state.failedAuthAttempts.size).toBe(0);
    });
  });

  describe('checkConnectionRateLimit', () => {
    it('should allow connection when under limit', () => {
      const result = checkConnectionRateLimit(rateLimitState);

      expect(result.allowed).toBe(true);
    });

    it('should allow connections up to the limit', () => {
      // Record attempts up to but not exceeding the limit
      for (let i = 0; i < NETWORK_CONFIG.RATE_LIMIT_MAX_ATTEMPTS - 1; i++) {
        recordConnectionAttempt(rateLimitState);
      }

      const result = checkConnectionRateLimit(rateLimitState);

      expect(result.allowed).toBe(true);
    });

    it('should deny connection when at limit', () => {
      // Record attempts up to the limit
      for (let i = 0; i < NETWORK_CONFIG.RATE_LIMIT_MAX_ATTEMPTS; i++) {
        recordConnectionAttempt(rateLimitState);
      }

      const result = checkConnectionRateLimit(rateLimitState);

      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.retryAfterMs).toBe(NETWORK_CONFIG.RATE_LIMIT_COOLDOWN_MS);
      }
    });

    it('should deny connection during cooldown period', () => {
      // Trigger cooldown
      for (let i = 0; i < NETWORK_CONFIG.RATE_LIMIT_MAX_ATTEMPTS; i++) {
        recordConnectionAttempt(rateLimitState);
      }
      checkConnectionRateLimit(rateLimitState); // This sets the cooldown

      // Check that subsequent requests are denied
      const result = checkConnectionRateLimit(rateLimitState);

      expect(result.allowed).toBe(false);
    });

    it('should allow connection after cooldown and window period expires', () => {
      // Trigger cooldown
      for (let i = 0; i < NETWORK_CONFIG.RATE_LIMIT_MAX_ATTEMPTS; i++) {
        recordConnectionAttempt(rateLimitState);
      }
      checkConnectionRateLimit(rateLimitState);

      // Advance time past both cooldown AND the rate limit window
      // (old attempts need to age out of the window as well)
      const maxPeriod = Math.max(
        NETWORK_CONFIG.RATE_LIMIT_COOLDOWN_MS,
        NETWORK_CONFIG.RATE_LIMIT_WINDOW_MS
      );
      vi.advanceTimersByTime(maxPeriod + 1);

      const result = checkConnectionRateLimit(rateLimitState);

      expect(result.allowed).toBe(true);
    });

    it('should clean up old attempts outside the time window', () => {
      // Record some attempts
      for (let i = 0; i < NETWORK_CONFIG.RATE_LIMIT_MAX_ATTEMPTS - 1; i++) {
        recordConnectionAttempt(rateLimitState);
      }

      // Advance time past the window
      vi.advanceTimersByTime(NETWORK_CONFIG.RATE_LIMIT_WINDOW_MS + 1);

      // Should allow new attempts since old ones are cleaned up
      for (let i = 0; i < NETWORK_CONFIG.RATE_LIMIT_MAX_ATTEMPTS - 1; i++) {
        recordConnectionAttempt(rateLimitState);
      }

      const result = checkConnectionRateLimit(rateLimitState);

      expect(result.allowed).toBe(true);
    });

    it('should return correct retryAfterMs during cooldown', () => {
      // Trigger cooldown
      for (let i = 0; i < NETWORK_CONFIG.RATE_LIMIT_MAX_ATTEMPTS; i++) {
        recordConnectionAttempt(rateLimitState);
      }
      checkConnectionRateLimit(rateLimitState);

      // Advance time partially through cooldown
      const partialTime = NETWORK_CONFIG.RATE_LIMIT_COOLDOWN_MS / 2;
      vi.advanceTimersByTime(partialTime);

      const result = checkConnectionRateLimit(rateLimitState);

      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        // Should be approximately half the cooldown time remaining
        expect(result.retryAfterMs).toBeCloseTo(
          NETWORK_CONFIG.RATE_LIMIT_COOLDOWN_MS - partialTime,
          -2
        );
      }
    });
  });

  describe('recordConnectionAttempt', () => {
    it('should add timestamp to connection attempts', () => {
      const timeBefore = Date.now();
      recordConnectionAttempt(rateLimitState);

      expect(rateLimitState.connectionAttempts.length).toBe(1);
      expect(rateLimitState.connectionAttempts[0]).toBeGreaterThanOrEqual(timeBefore);
    });

    it('should accumulate multiple attempts', () => {
      recordConnectionAttempt(rateLimitState);
      vi.advanceTimersByTime(100);
      recordConnectionAttempt(rateLimitState);
      vi.advanceTimersByTime(100);
      recordConnectionAttempt(rateLimitState);

      expect(rateLimitState.connectionAttempts.length).toBe(3);
    });
  });

  describe('checkAuthRateLimit', () => {
    it('should allow auth for new peer', () => {
      const result = checkAuthRateLimit(rateLimitState, 'peer-123');

      expect(result.allowed).toBe(true);
    });

    it('should allow auth for peer with fewer than max failed attempts', () => {
      recordFailedAuthAttempt(rateLimitState, 'peer-123');

      const result = checkAuthRateLimit(rateLimitState, 'peer-123');

      expect(result.allowed).toBe(true);
    });

    it('should deny auth for blocked peer', () => {
      // Record enough failed attempts to trigger block
      for (let i = 0; i < NETWORK_CONFIG.MAX_FAILED_AUTH_ATTEMPTS; i++) {
        recordFailedAuthAttempt(rateLimitState, 'peer-123');
      }

      const result = checkAuthRateLimit(rateLimitState, 'peer-123');

      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.retryAfterMs).toBeGreaterThan(0);
      }
    });

    it('should allow auth after block expires', () => {
      // Trigger block
      for (let i = 0; i < NETWORK_CONFIG.MAX_FAILED_AUTH_ATTEMPTS; i++) {
        recordFailedAuthAttempt(rateLimitState, 'peer-123');
      }

      // Advance time past block duration
      vi.advanceTimersByTime(NETWORK_CONFIG.AUTH_BLOCK_DURATION_MS + 1);

      const result = checkAuthRateLimit(rateLimitState, 'peer-123');

      expect(result.allowed).toBe(true);
    });

    it('should track different peers independently', () => {
      // Block peer-123
      for (let i = 0; i < NETWORK_CONFIG.MAX_FAILED_AUTH_ATTEMPTS; i++) {
        recordFailedAuthAttempt(rateLimitState, 'peer-123');
      }

      // peer-456 should still be allowed
      const result = checkAuthRateLimit(rateLimitState, 'peer-456');

      expect(result.allowed).toBe(true);
    });
  });

  describe('recordFailedAuthAttempt', () => {
    it('should return false when under max attempts', () => {
      const result = recordFailedAuthAttempt(rateLimitState, 'peer-123');

      expect(result).toBe(false);
    });

    it('should return true when reaching max attempts', () => {
      // Record up to max-1 attempts
      for (let i = 0; i < NETWORK_CONFIG.MAX_FAILED_AUTH_ATTEMPTS - 1; i++) {
        recordFailedAuthAttempt(rateLimitState, 'peer-123');
      }

      // This should trigger the block
      const result = recordFailedAuthAttempt(rateLimitState, 'peer-123');

      expect(result).toBe(true);
    });

    it('should increment count for existing peer', () => {
      recordFailedAuthAttempt(rateLimitState, 'peer-123');
      const firstCount = rateLimitState.failedAuthAttempts.get('peer-123')?.count;

      recordFailedAuthAttempt(rateLimitState, 'peer-123');
      const secondCount = rateLimitState.failedAuthAttempts.get('peer-123')?.count;

      expect(firstCount).toBe(1);
      expect(secondCount).toBe(2);
    });

    it('should set blockedUntil when max attempts reached', () => {
      const now = Date.now();

      for (let i = 0; i < NETWORK_CONFIG.MAX_FAILED_AUTH_ATTEMPTS; i++) {
        recordFailedAuthAttempt(rateLimitState, 'peer-123');
      }

      const peerState = rateLimitState.failedAuthAttempts.get('peer-123');
      expect(peerState?.blockedUntil).toBeGreaterThanOrEqual(
        now + NETWORK_CONFIG.AUTH_BLOCK_DURATION_MS
      );
    });
  });

  describe('clearAuthRateLimit', () => {
    it('should remove peer from failed attempts', () => {
      recordFailedAuthAttempt(rateLimitState, 'peer-123');
      expect(rateLimitState.failedAuthAttempts.has('peer-123')).toBe(true);

      clearAuthRateLimit(rateLimitState, 'peer-123');

      expect(rateLimitState.failedAuthAttempts.has('peer-123')).toBe(false);
    });

    it('should not throw when clearing non-existent peer', () => {
      expect(() => clearAuthRateLimit(rateLimitState, 'non-existent')).not.toThrow();
    });
  });

  describe('resetRateLimitState', () => {
    it('should clear all state', () => {
      // Set up some state
      recordConnectionAttempt(rateLimitState);
      recordConnectionAttempt(rateLimitState);
      recordFailedAuthAttempt(rateLimitState, 'peer-123');

      // Trigger cooldown
      for (let i = 0; i < NETWORK_CONFIG.RATE_LIMIT_MAX_ATTEMPTS; i++) {
        recordConnectionAttempt(rateLimitState);
      }
      checkConnectionRateLimit(rateLimitState);

      // Reset
      resetRateLimitState(rateLimitState);

      expect(rateLimitState.connectionAttempts).toEqual([]);
      expect(rateLimitState.rateLimitCooldownEnd).toBe(0);
      expect(rateLimitState.failedAuthAttempts.size).toBe(0);
    });

    it('should allow connections after reset even if previously blocked', () => {
      // Trigger cooldown
      for (let i = 0; i < NETWORK_CONFIG.RATE_LIMIT_MAX_ATTEMPTS; i++) {
        recordConnectionAttempt(rateLimitState);
      }
      checkConnectionRateLimit(rateLimitState);

      // Verify blocked
      expect(checkConnectionRateLimit(rateLimitState).allowed).toBe(false);

      // Reset
      resetRateLimitState(rateLimitState);

      // Should be allowed again
      expect(checkConnectionRateLimit(rateLimitState).allowed).toBe(true);
    });
  });

  describe('integration scenarios', () => {
    it('should handle rapid connection attempts gracefully', () => {
      // Simulate rapid-fire connection attempts
      for (let i = 0; i < 10; i++) {
        recordConnectionAttempt(rateLimitState);
        vi.advanceTimersByTime(100); // 100ms between attempts
      }

      const result = checkConnectionRateLimit(rateLimitState);

      // Should be rate limited
      expect(result.allowed).toBe(false);
    });

    it('should handle brute force PIN attack', () => {
      const peerId = 'attacker-peer';

      // Simulate repeated failed auth attempts
      for (let i = 0; i < NETWORK_CONFIG.MAX_FAILED_AUTH_ATTEMPTS; i++) {
        const stillAllowed = checkAuthRateLimit(rateLimitState, peerId);
        expect(stillAllowed.allowed).toBe(true);

        recordFailedAuthAttempt(rateLimitState, peerId);
      }

      // Should now be blocked
      const blockedResult = checkAuthRateLimit(rateLimitState, peerId);
      expect(blockedResult.allowed).toBe(false);

      // Should remain blocked for the duration
      vi.advanceTimersByTime(NETWORK_CONFIG.AUTH_BLOCK_DURATION_MS / 2);
      expect(checkAuthRateLimit(rateLimitState, peerId).allowed).toBe(false);

      // Should be unblocked after duration
      vi.advanceTimersByTime(NETWORK_CONFIG.AUTH_BLOCK_DURATION_MS / 2 + 1);
      expect(checkAuthRateLimit(rateLimitState, peerId).allowed).toBe(true);
    });

    it('should allow legitimate slow connections', () => {
      // Simulate legitimate user connecting slowly over time
      for (let i = 0; i < 10; i++) {
        recordConnectionAttempt(rateLimitState);
        // Wait longer than the window between attempts
        vi.advanceTimersByTime(NETWORK_CONFIG.RATE_LIMIT_WINDOW_MS / 3);
      }

      // Old attempts should have been cleaned up, so should still be allowed
      const result = checkConnectionRateLimit(rateLimitState);
      expect(result.allowed).toBe(true);
    });

    it('should clear failed auth on successful authentication', () => {
      const peerId = 'user-peer';

      // Record some failed attempts (but not enough to block)
      for (let i = 0; i < NETWORK_CONFIG.MAX_FAILED_AUTH_ATTEMPTS - 1; i++) {
        recordFailedAuthAttempt(rateLimitState, peerId);
      }

      // Successful auth - clear the failures
      clearAuthRateLimit(rateLimitState, peerId);

      // Should be able to have full attempts again
      for (let i = 0; i < NETWORK_CONFIG.MAX_FAILED_AUTH_ATTEMPTS - 1; i++) {
        recordFailedAuthAttempt(rateLimitState, peerId);
      }

      // Still allowed because we cleared earlier
      expect(checkAuthRateLimit(rateLimitState, peerId).allowed).toBe(true);
    });
  });
});
