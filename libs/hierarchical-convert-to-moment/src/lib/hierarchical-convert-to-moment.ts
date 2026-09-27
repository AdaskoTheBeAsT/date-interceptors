import {
  isIsoDateTime,
  isIsoDuration,
  millisecondDateTime,
  visitStrings,
} from '@adaskothebeast/hierarchical-convert-core';
import moment from 'moment';

/**
 * Replaces ISO timestamp strings with local-mode `Moment` objects and ISO
 * durations with Moment durations in place, walking arrays and plain objects
 * only; cycles and levels deeper than 100 are skipped.
 */
export function hierarchicalConvertToMoment(obj: unknown): void {
  visitStrings(obj, convert);
}

function convert(value: string): unknown {
  try {
    if (isIsoDateTime(value)) {
      const date = moment(millisecondDateTime(value));
      if (date.isValid()) return date;
    }
    if (isIsoDuration(value)) return moment.duration(value);
  } catch {
    // Unsupported or invalid backend values remain strings.
  }
  return value;
}
