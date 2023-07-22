type RecordWithDate = Record<string, Date | string | object>;

const setter = <T extends RecordWithDate, K extends keyof T>(
  obj: T,
  prop: K,
  val: T[K]
): void => {
  obj[prop] = val;
};

/**
 * Function to recursively traverse the object and convert date strings to Date objects in place.
 * @param obj Object to traverse
 * @returns Void.
 */
export function hierarchicalConvertToDate(obj: unknown): void {
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
      if (typeof v === 'string' && dateRegex.test(v)) {
        // Convert string to Date object if it matches the date regex
        setter(o, k, new Date(v));
      } else if (typeof v === 'object') {
        // Recurse into the object if it's not a string (could be an array or object)
        hierarchicalConvertToDate(v);
      }
    }
  } else if (Array.isArray(obj)) {
    // Recurse into the array if it's an array
    obj.forEach(hierarchicalConvertToDate);
  } else if (typeof obj === 'string' && dateRegex.test(obj)) {
    obj = new Date(obj);
  }
}
