type RecordWithDate = Record<string, Date | string | object>;

// Regular expression that matches ISO 8601 date strings
const dateRegex: RegExp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;

/**
 * Function to recursively traverse the object and convert date strings to Date objects in place.
 * @param obj Object to traverse
 * @returns Void.
 */
export function hierarchicalConvertToDate(obj: unknown): void {
  if (typeof obj !== 'object') {
    return;
  }
  const o = obj as RecordWithDate;

  for (const key in o) {
    if (!Object.prototype.hasOwnProperty.call(o, key)) {
      continue;
    }

    const v = o[key];
    if (typeof v === 'string' && dateRegex.test(v)) {
      // Convert string to Date object if it matches the date regex
      o[key] = new Date(v);
    } else if (typeof v === 'object') {
      // Recurse into the object if it's not a string (could be an array or object)
      hierarchicalConvertToDate(v);
    }
  }
}
