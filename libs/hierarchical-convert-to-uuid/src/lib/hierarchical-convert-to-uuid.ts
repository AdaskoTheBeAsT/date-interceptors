import { visitStrings } from '@adaskothebeast/hierarchical-convert-core';
import { parse, validate } from 'uuid';

/**
 * Replaces UUID strings accepted by `uuid.validate` with their 16-byte
 * `Uint8Array` form in place, walking arrays and plain objects only; cycles and
 * levels deeper than 100 are skipped.
 */
export function hierarchicalConvertToUuid(obj: unknown): void {
  visitStrings(obj, convert);
}

function convert(value: string): unknown {
  try {
    if (value.length === 36 && validate(value)) return parse(value);
  } catch {
    // Unsupported or invalid backend values remain strings.
  }
  return value;
}
