// "last write wins" reducer - new value replaces old
export function lastValue<T>(_prev: T, next: T): T {
  return next;
}

export function isNotNullOrUndf(value: unknown): value is NonNullable<unknown> {
  if (value === null || value === undefined) {
    return false;
  } else {
    return true;
  }
}

export function isNotNullOrEmpty(
  value: Array<unknown> | string | null | undefined
): value is NonNullable<Array<unknown> | string> {
  if (value === null || value === undefined || value.length === 0) {
    return false;
  } else {
    return true;
  }
}

/** If target is null or undefined, set to defaultValue and then return target. If not, return target. */
export function applyDefault<T>(target: T | null | undefined, defaultValue: NonNullable<T>): NonNullable<T> {
  let result: NonNullable<T>;
  if (isNotNullOrUndf(target)) {
    result = target;
  } else {
    result = defaultValue;
  }
  return result;
}

import * as Promises from "node:timers/promises";

type SleepMs = NonNullable<number | null | undefined>;

export function sleep(ms: NonNullable<SleepMs>): NonNullable<Promise<void>> {
  const result: NonNullable<Promise<void>> = Promises.setTimeout(ms);
  return result;
}
