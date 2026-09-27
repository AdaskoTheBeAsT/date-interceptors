import '@js-joda/timezone';

import {
  parseIsoDateTime,
  visitStrings,
} from '@adaskothebeast/hierarchical-convert-core';
import { ZonedDateTime } from '@js-joda/core';

/**
 * Replaces ISO timestamp strings that carry `Z` or a `±HH:MM` offset with
 * `ZonedDateTime` objects in place, walking arrays and plain objects only;
 * cycles and levels deeper than 100 are skipped.
 */
export function hierarchicalConvertToJsJoda(obj: unknown): void {
  visitStrings(obj, convert);
}

function convert(value: string): unknown {
  try {
    if (parseIsoDateTime(value)?.hasOffset === true) {
      return ZonedDateTime.parse(value);
    }
  } catch {
    // Unsupported or invalid backend values remain strings.
  }
  return value;
}
