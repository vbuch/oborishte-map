/**
 * Wait for specified milliseconds
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Rate limiter class to throttle requests
 */
export class RateLimiter {
  private lastRequest = 0;

  constructor(private delayMs: number) {}

  /**
   * Throttle execution to ensure minimum delay between calls
   */
  async throttle(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequest;
    if (elapsed < this.delayMs) {
      await delay(this.delayMs - elapsed);
    }
    this.lastRequest = Date.now();
  }
}
