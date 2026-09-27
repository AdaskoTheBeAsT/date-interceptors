import {
  isIsoDuration,
  parseIsoDateTime,
  visitStrings,
} from '@adaskothebeast/hierarchical-convert-core';
import { Temporal } from '@js-temporal/polyfill';

/**
 * Replaces ISO timestamp strings with `Temporal.Instant` (when an offset is
 * present) or `Temporal.PlainDateTime` objects and ISO durations with
 * `Temporal.Duration` objects in place, walking arrays and plain objects only;
 * cycles and levels deeper than 100 are skipped.
 */
export function hierarchicalConvertToTemporal(obj: unknown): void {
  visitStrings(obj, convert);
}

function convert(value: string): unknown {
  try {
    const dateTime = parseIsoDateTime(value);
    if (dateTime !== undefined) {
      return dateTime.hasOffset
        ? Temporal.Instant.from(value)
        : Temporal.PlainDateTime.from(value);
    }
    if (isIsoDuration(value)) return Temporal.Duration.from(value);
  } catch {
    // Unsupported or invalid backend values remain strings.
  }
  return value;
}
