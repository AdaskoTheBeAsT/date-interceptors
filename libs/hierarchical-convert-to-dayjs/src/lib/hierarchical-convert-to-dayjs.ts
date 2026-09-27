import {
  isIsoDateTime,
  isIsoDuration,
  millisecondDateTime,
  normalizeIsoDuration,
  visitStrings,
} from '@adaskothebeast/hierarchical-convert-core';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration.js';
dayjs.extend(duration);

/**
 * Replaces ISO timestamp strings with local-mode `Dayjs` objects and
 * non-negative ISO durations with Day.js durations in place, walking arrays and
 * plain objects only; cycles and levels deeper than 100 are skipped.
 */
export function hierarchicalConvertToDayjs(obj: unknown): void {
  visitStrings(obj, convert);
}

function convert(value: string): unknown {
  try {
    if (isIsoDateTime(value)) {
      const date = dayjs(millisecondDateTime(value));
      if (date.isValid()) return date;
    }
    // Day.js ignores a leading duration sign, so preserve negative wire values.
    if (isIsoDuration(value) && !value.startsWith('-')) {
      // Day.js silently parses PT1,5S as P0D.
      return dayjs.duration(normalizeIsoDuration(value));
    }
  } catch {
    // Unsupported or invalid backend values remain strings.
  }
  return value;
}
