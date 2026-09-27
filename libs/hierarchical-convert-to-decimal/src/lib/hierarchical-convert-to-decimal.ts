import { visitStrings } from '@adaskothebeast/hierarchical-convert-core';
import Decimal from 'decimal.js';

/**
 * Replaces decimal-number strings with `Decimal` objects in place, walking
 * arrays and plain objects only; cycles and levels deeper than 100 are skipped.
 */
export function hierarchicalConvertToDecimal(obj: unknown): void {
  visitStrings(obj, convert);
}

function convert(value: string): unknown {
  try {
    if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value)) {
      return new Decimal(value);
    }
  } catch {
    // Unsupported or invalid backend values remain strings.
  }
  return value;
}
