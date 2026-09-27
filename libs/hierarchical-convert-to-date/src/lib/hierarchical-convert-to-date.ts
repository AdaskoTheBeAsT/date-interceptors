import {
  isIsoDateTime,
  millisecondDateTime,
  visitStrings,
} from '@adaskothebeast/hierarchical-convert-core';

/**
 * Replaces ISO timestamp strings with `Date` objects in place, walking arrays
 * and plain objects only; cycles and levels deeper than 100 are skipped.
 */
export function hierarchicalConvertToDate(obj: unknown): void {
  visitStrings(obj, convert);
}

function convert(value: string): unknown {
  try {
    if (isIsoDateTime(value)) {
      const date = new Date(millisecondDateTime(value));
      if (!Number.isNaN(date.getTime())) return date;
    }
  } catch {
    // Unsupported or invalid backend values remain strings.
  }
  return value;
}
