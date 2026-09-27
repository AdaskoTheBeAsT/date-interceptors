import {
  isIsoDateTime,
  isIsoDuration,
  millisecondDateTime,
  visitStrings,
} from '@adaskothebeast/hierarchical-convert-core';
import { DateTime, Duration } from 'luxon';

/**
 * Replaces ISO timestamp strings with local-zone `DateTime` objects and ISO
 * durations with `Duration` objects in place, walking arrays and plain objects
 * only; cycles and levels deeper than 100 are skipped.
 */
export function hierarchicalConvertToLuxon(obj: unknown): void {
  visitStrings(obj, convert);
}

function convert(value: string): unknown {
  try {
    if (isIsoDateTime(value)) {
      const date = DateTime.fromISO(millisecondDateTime(value));
      if (date.isValid) return date;
    }
    if (isIsoDuration(value)) {
      const duration = Duration.fromISO(value);
      if (duration.isValid) return duration;
    }
  } catch {
    // Unsupported or invalid backend values remain strings.
  }
  return value;
}
