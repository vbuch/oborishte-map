import { describe, it, expect, vi, beforeEach } from "vitest";
import { delay, RateLimiter } from "../rate-limiting";

describe("rate-limiting utilities", () => {
  describe("delay", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it("should resolve after specified milliseconds", async () => {
      const promise = delay(1000);

      // Fast-forward time
      vi.advanceTimersByTime(1000);

      await expect(promise).resolves.toBeUndefined();
    });

    it("should not resolve before specified time", async () => {
      const promise = delay(1000);
      let resolved = false;

      promise.then(() => {
        resolved = true;
      });

      // Advance less than the delay
      vi.advanceTimersByTime(500);
      await Promise.resolve(); // Flush microtasks

      expect(resolved).toBe(false);

      // Advance the rest
      vi.advanceTimersByTime(500);
      await promise;

      expect(resolved).toBe(true);
    });
  });

  describe("RateLimiter", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it("should throttle calls to ensure minimum delay", async () => {
      const limiter = new RateLimiter(1000);

      // First call should not delay
      const start = Date.now();
      await limiter.throttle();
      const firstCallTime = Date.now() - start;

      expect(firstCallTime).toBe(0);

      // Second call immediately after should delay
      const promise = limiter.throttle();
      vi.advanceTimersByTime(1000);
      await promise;

      expect(Date.now() - start).toBeGreaterThanOrEqual(1000);
    });

    it("should not add extra delay if enough time has passed", async () => {
      const limiter = new RateLimiter(1000);

      // First call
      await limiter.throttle();

      // Wait more than the delay period
      vi.advanceTimersByTime(1500);

      // Second call should not add delay
      const start = Date.now();
      await limiter.throttle();
      const elapsed = Date.now() - start;

      expect(elapsed).toBe(0);
    });

    it("should handle multiple sequential calls", async () => {
      const limiter = new RateLimiter(500);
      const callTimes: number[] = [];

      // Make 3 calls
      for (let i = 0; i < 3; i++) {
        const promise = limiter.throttle();
        vi.advanceTimersByTime(500);
        await promise;
        callTimes.push(Date.now());
      }

      // Each call should be at least 500ms apart
      expect(callTimes[1] - callTimes[0]).toBeGreaterThanOrEqual(500);
      expect(callTimes[2] - callTimes[1]).toBeGreaterThanOrEqual(500);
    });
  });
});
