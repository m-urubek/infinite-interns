import { type RateLimitsConfig } from "./agent-config-types";
import * as Util from "./util";

type TimestampEntry = NonNullable<number>;

export type RateLimiter = {
  waitForAvailability: NonNullable<() => NonNullable<Promise<void>>>;
};

/**
 * Creates a sliding-window rate limiter based on RateLimitsConfig.
 * Tracks RPM (requests per minute) and RPD (requests per day).
 * TPM and maxSpending are not enforced here as token counts
 * are not known before the request — they serve as soft caps.
 */
export function createRateLimiter(config: NonNullable<RateLimitsConfig>): NonNullable<RateLimiter> {
  const requestTimestamps: NonNullable<Array<TimestampEntry>> = [];

  async function waitForAvailability(): NonNullable<Promise<void>> {
    const hasRpmLimit: NonNullable<boolean> = Util.isNotNullOrUndf(config.maxRpm) && config.maxRpm > 0;
    const hasRpdLimit: NonNullable<boolean> = Util.isNotNullOrUndf(config.maxRpd) && config.maxRpd > 0;

    if (!hasRpmLimit && !hasRpdLimit) {
      recordRequest();
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    while (true) {
      const now: NonNullable<number> = Date.now();
      pruneOldEntries(now);

      const waitMs: NonNullable<number> = calculateWaitMs(now, hasRpmLimit, hasRpdLimit);

      if (waitMs <= 0) {
        recordRequest();
        return;
      }

      await Util.sleep(waitMs);
    }
  }

  function calculateWaitMs(
    now: NonNullable<number>,
    hasRpmLimit: NonNullable<boolean>,
    hasRpdLimit: NonNullable<boolean>
  ): NonNullable<number> {
    let waitMs: NonNullable<number> = 0;

    if (hasRpmLimit) {
      const rpmLimit: NonNullable<number> = config.maxRpm ?? 0;
      const oneMinuteAgo: NonNullable<number> = now - 60_000;
      const recentMinute: NonNullable<Array<TimestampEntry>> = requestTimestamps.filter(
        (ts: NonNullable<TimestampEntry>) => ts > oneMinuteAgo
      );
      if (recentMinute.length >= rpmLimit) {
        const rpmOldestInWindow: NonNullable<number> = recentMinute[0] ?? now;
        const rpmMsUntilSlotOpens: NonNullable<number> = rpmOldestInWindow + 60_000 - now + 100;
        waitMs = Math.max(waitMs, rpmMsUntilSlotOpens);
      }
    }

    if (hasRpdLimit) {
      const rpdLimit: NonNullable<number> = config.maxRpd ?? 0;
      const oneDayAgo: NonNullable<number> = now - 86_400_000;
      const recentDay: NonNullable<Array<TimestampEntry>> = requestTimestamps.filter(
        (ts: NonNullable<TimestampEntry>) => ts > oneDayAgo
      );
      if (recentDay.length >= rpdLimit) {
        const rpdOldestInWindow: NonNullable<number> = recentDay[0] ?? now;
        const rpdMsUntilSlotOpens: NonNullable<number> = rpdOldestInWindow + 86_400_000 - now + 100;
        waitMs = Math.max(waitMs, rpdMsUntilSlotOpens);
      }
    }

    return waitMs;
  }

  function pruneOldEntries(now: NonNullable<number>): void {
    const oneDayAgo: NonNullable<number> = now - 86_400_000;
    while (requestTimestamps.length > 0 && (requestTimestamps[0] ?? now) <= oneDayAgo) {
      requestTimestamps.shift();
    }
  }

  function recordRequest(): void {
    const now: NonNullable<number> = Date.now();
    requestTimestamps.push(now);
  }

  const limiter: NonNullable<RateLimiter> = {
    waitForAvailability,
  };
  return limiter;
}
