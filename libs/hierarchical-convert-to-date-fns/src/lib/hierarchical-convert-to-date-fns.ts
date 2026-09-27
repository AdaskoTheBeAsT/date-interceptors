import {
  isIsoDateTime,
  millisecondDateTime,
  parseIsoDuration,
  visitStrings,
} from '@adaskothebeast/hierarchical-convert-core';
import type { Duration } from 'date-fns';
import { parseISO } from 'date-fns';

/**
 * Replaces ISO timestamp strings with `Date` objects and non-negative ISO
 * durations with date-fns `Duration` objects in place, walking arrays and plain
 * objects only; cycles and levels deeper than 100 are skipped.
 */
export function hierarchicalConvertToDateFns(obj: unknown): void {
  visitStrings(obj, convert);
}

function convert(value: string): unknown {
  try {
    if (isIsoDateTime(value)) {
      const date = parseISO(millisecondDateTime(value));
      if (!Number.isNaN(date.getTime())) return date;
    }
    // date-fns Duration has no sign, so negative wire values stay strings.
    const duration = parseIsoDuration(value);
    if (duration !== undefined && !duration.negative) {
      return duration.components satisfies Duration;
    }
  } catch {
    // Unsupported or invalid backend values remain strings.
  }
  return value;
}
