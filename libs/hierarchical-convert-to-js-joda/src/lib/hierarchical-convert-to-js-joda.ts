import { ZonedDateTime } from '@js-joda/core';
require('@js-joda/timezone');

type RecordWithDate = Record<string, string | ZonedDateTime | object>;

const setterZonedDateTime = <T extends RecordWithDate, K extends keyof T>(
  obj: T,
  prop: K,
  val: T[K]
): void => {
  obj[prop] = val;
};

/**
 * Function to recursively traverse the object and convert date strings to ZonedDateTime objects in place.
 * @param obj Object to traverse
 * @returns Void.
 */
export function hierarchicalConvertToJsJoda(obj: unknown): void {
  // Regular expression that matches ISO 8601 date strings
  const dateRegex: RegExp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;

  if (typeof obj === 'object') {
    const o = obj as RecordWithDate;

    for (const key in o) {
      if (!Object.prototype.hasOwnProperty.call(o, key)) {
        continue;
      }

      const k = key as keyof typeof o;
      const v = o[k];
      if (typeof v === 'string') {
        if (dateRegex.test(v)) {
          // Convert string to Dayjs object if it matches the date regex
          setterZonedDateTime(o, k, ZonedDateTime.parse(v));
        }
      } else if (typeof v === 'object') {
        // Recurse into the object if it's not a string (could be an array or object)
        hierarchicalConvertToJsJoda(v);
      }
    }
  } else if (Array.isArray(obj)) {
    // Recurse into the array if it's an array
    obj.forEach(hierarchicalConvertToJsJoda);
  } else if (typeof obj === 'string' && dateRegex.test(obj)) {
    obj = ZonedDateTime.parse(obj);
  }
}
