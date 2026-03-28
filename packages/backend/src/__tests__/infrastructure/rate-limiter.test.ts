import { type RateLimitsConfig } from "../../shared/agent-config-types";

type DateNowFn = () => number;

let sleepCallCount: number = 0;
let originalDateNow: DateNowFn;
let fakeNow: number = 0;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
vi.mock("../../shared/util.js", async (): Promise<any> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actual: any = await vi.importActual("../../shared/util.js");
  const mod = {
    ...actual,
    sleep: (ms: number): Promise<void> => {
      sleepCallCount++;
      // Advance fake time so the next iteration sees the window has moved
      fakeNow += ms;
      const resolved: Promise<void> = Promise.resolve();
      return resolved;
    },
  };
  return mod;
});

import * as RateLimiter from "../../shared/rate-limiter";

describe("createRateLimiter", () => {
  beforeEach(() => {
    sleepCallCount = 0;
    originalDateNow = Date.now;
    fakeNow = originalDateNow.call(Date);
    Date.now = (): number => fakeNow;
  });

  afterEach(() => {
    Date.now = originalDateNow;
  });

  it("allows requests immediately when no limits are set", async (): Promise<void> => {
    const config: RateLimitsConfig = {
      maxRpm: null,
      maxTpm: null,
      maxRpd: null,
      maxSpending: null,
    };
    const limiter: RateLimiter.RateLimiter = RateLimiter.createRateLimiter(config);

    await limiter.waitForAvailability();
    await limiter.waitForAvailability();
    await limiter.waitForAvailability();

    expect(sleepCallCount).toBe(0);
  });

  it("allows requests up to the RPM limit without sleeping", async (): Promise<void> => {
    const config: RateLimitsConfig = {
      maxRpm: 3,
      maxTpm: null,
      maxRpd: null,
      maxSpending: null,
    };
    const limiter: RateLimiter.RateLimiter = RateLimiter.createRateLimiter(config);

    await limiter.waitForAvailability();
    fakeNow += 100;
    await limiter.waitForAvailability();
    fakeNow += 100;
    await limiter.waitForAvailability();

    expect(sleepCallCount).toBe(0);
  });

  it("sleeps when RPM limit is exceeded", async (): Promise<void> => {
    const config: RateLimitsConfig = {
      maxRpm: 2,
      maxTpm: null,
      maxRpd: null,
      maxSpending: null,
    };
    const limiter: RateLimiter.RateLimiter = RateLimiter.createRateLimiter(config);

    await limiter.waitForAvailability();
    fakeNow += 100;
    await limiter.waitForAvailability();
    fakeNow += 100;

    // Third request should trigger a sleep (RPM limit reached)
    await limiter.waitForAvailability();

    expect(sleepCallCount).toBeGreaterThanOrEqual(1);
  });

  it("allows requests up to the RPD limit without sleeping", async (): Promise<void> => {
    const config: RateLimitsConfig = {
      maxRpm: null,
      maxTpm: null,
      maxRpd: 5,
      maxSpending: null,
    };
    const limiter: RateLimiter.RateLimiter = RateLimiter.createRateLimiter(config);

    for (let i: number = 0; i < 5; i++) {
      await limiter.waitForAvailability();
      fakeNow += 100;
    }

    expect(sleepCallCount).toBe(0);
  });

  it("sleeps when RPD limit is exceeded", async (): Promise<void> => {
    const config: RateLimitsConfig = {
      maxRpm: null,
      maxTpm: null,
      maxRpd: 2,
      maxSpending: null,
    };
    const limiter: RateLimiter.RateLimiter = RateLimiter.createRateLimiter(config);

    await limiter.waitForAvailability();
    fakeNow += 100;
    await limiter.waitForAvailability();
    fakeNow += 100;

    // Third request should trigger a sleep (RPD limit reached)
    await limiter.waitForAvailability();

    expect(sleepCallCount).toBeGreaterThanOrEqual(1);
  });

  it("returns a RateLimiter object with waitForAvailability function", (): void => {
    const config: RateLimitsConfig = {
      maxRpm: 10,
      maxTpm: null,
      maxRpd: null,
      maxSpending: null,
    };
    const limiter: RateLimiter.RateLimiter = RateLimiter.createRateLimiter(config);

    expect(limiter).toBeDefined();
    expect(typeof limiter.waitForAvailability).toBe("function");
  });
});
