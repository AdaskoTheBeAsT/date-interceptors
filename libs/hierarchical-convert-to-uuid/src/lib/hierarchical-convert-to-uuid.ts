import { parse } from 'uuid';

type UuidValue = Uint8Array | string | number | boolean | null;
type UuidObject = { [key: string]: UuidValue | UuidObject | UuidArray };
type UuidArray = Array<UuidValue | UuidObject | UuidArray>;

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export function hierarchicalConvertToUuid(
  obj: unknown,
  depth = 0,
  visited = new WeakSet(),
): void {
  if (typeof obj !== 'object' || obj === null || depth > 100) {
    return;
  }

  if (visited.has(obj)) {
    return;
  }
  visited.add(obj);

  const record = obj as UuidObject;

  for (const key in record) {
    if (DANGEROUS_KEYS.has(key) || !Object.hasOwn(record, key)) {
      continue;
    }

    const value = record[key];
    if (
      typeof value === 'string' &&
      value.length === 36 &&
      value[8] === '-' &&
      value[13] === '-' &&
      value[18] === '-' &&
      value[23] === '-'
    ) {
      try {
        record[key] = parse(value);
      } catch {
        // Leave invalid UUID strings unchanged.
      }
    } else if (typeof value === 'object' && value !== null) {
      hierarchicalConvertToUuid(value, depth + 1, visited);
    }
  }
}
