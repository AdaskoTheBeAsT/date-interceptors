import Decimal from 'decimal.js';

type DecimalValue = Decimal | string | number | boolean | null;
type DecimalObject = {
  [key: string]: DecimalValue | DecimalObject | DecimalArray;
};
type DecimalArray = Array<DecimalValue | DecimalObject | DecimalArray>;

const decimalRegex =
  /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export function hierarchicalConvertToDecimal(
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

  const record = obj as DecimalObject;

  for (const key in record) {
    if (DANGEROUS_KEYS.has(key) || !Object.hasOwn(record, key)) {
      continue;
    }

    const value = record[key];
    const firstCharacter = typeof value === 'string' ? value[0] : undefined;
    if (
      typeof value === 'string' &&
      firstCharacter !== undefined &&
      (firstCharacter === '+' ||
        firstCharacter === '-' ||
        firstCharacter === '.' ||
        (firstCharacter >= '0' && firstCharacter <= '9')) &&
      decimalRegex.test(value)
    ) {
      try {
        record[key] = new Decimal(value);
      } catch (error) {
        console.warn(`Failed to parse decimal string: ${value}`, error);
      }
    } else if (typeof value === 'object' && value !== null) {
      hierarchicalConvertToDecimal(value, depth + 1, visited);
    }
  }
}
