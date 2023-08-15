import * as moment from 'moment';

type RecordWithMomentAndDuration = Record<
  string,
  Date | moment.Moment | moment.Duration | string | object
>;

const setterMoment = <T extends RecordWithMomentAndDuration, K extends keyof T>(
  obj: T,
  prop: K,
  val: T[K]
): void => {
  obj[prop] = val;
};

/**
 * Function to recursively traverse the object and convert date strings to Moment and Duration objects in place.
 * @param obj Object to traverse
 * @returns Void.
 */
export function hierarchicalConvertToMoment(obj: unknown): void {
  // Regular expression that matches ISO 8601 date strings
  const dateRegex: RegExp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
  const iso8601DurationRegex: RegExp =
    /^P(?:(0|[1-9]\d*)Y)?(?:(0|[1-9]\d*)M)?(?:(0|[1-9]\d*)W)?(?:(0|[1-9]\d*)D)?(?:T(?:(0|[1-9]\d*)H)?(?:(0|[1-9]\d*)M)?(?:(0|[1-9]\d*)S)?)?$/;

  if (typeof obj === 'object') {
    const o = obj as RecordWithMomentAndDuration;

    for (const key in o) {
      if (!Object.prototype.hasOwnProperty.call(o, key)) {
        continue;
      }

      const k = key as keyof typeof o;
      const v = o[k];
      if (typeof v === 'string') {
        if (dateRegex.test(v)) {
          // Convert string to Date object if it matches the date regex
          setterMoment(o, k, moment(v));
        } else if (iso8601DurationRegex.test(v)) {
          // Convert string to Duration object if it matches the duration regex
          setterMoment(o, k, moment.duration(v));
        }
      } else if (typeof v === 'object') {
        // Recurse into the object if it's not a string (could be an array or object)
        hierarchicalConvertToMoment(v);
      }
    }
  } else if (Array.isArray(obj)) {
    // Recurse into the array if it's an array
    obj.forEach(hierarchicalConvertToMoment);
  } else if (typeof obj === 'string') {
    if (dateRegex.test(obj)) {
      obj = moment(obj);
    } else if (iso8601DurationRegex.test(obj)) {
      obj = moment.duration(obj);
    }
  }
}
