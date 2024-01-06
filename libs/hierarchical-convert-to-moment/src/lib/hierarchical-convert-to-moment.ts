import * as moment from 'moment';

type RecordWithMomentAndDuration = Record<
  string,
  Date | moment.Moment | moment.Duration | string | object
>;

// Regular expression that matches ISO 8601 date strings
const dateRegex: RegExp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|([+-]\d{2}:\d{2}))?$/;
const durationRegex: RegExp =
  /^P(?:(0|[1-9]\d*)Y)?(?:(0|[1-9]\d*)M)?(?:(0|[1-9]\d*)W)?(?:(0|[1-9]\d*)D)?(?:T(?:(0|[1-9]\d*)H)?(?:(0|[1-9]\d*)M)?(?:(0|[1-9]\d*)S)?)?$/;

/**
 * Function to recursively traverse the object and convert date strings to Moment and Duration objects in place.
 * @param obj Object to traverse
 * @returns Void.
 */
export function hierarchicalConvertToMoment(obj: unknown): void {
  if (typeof obj !== 'object') {
    return;
  }
  const o = obj as RecordWithMomentAndDuration;

  for (const key in o) {
    if (!Object.prototype.hasOwnProperty.call(o, key)) {
      continue;
    }

    const v = o[key];
    if (typeof v === 'string') {
      adjust(o, key, v);
    } else if (typeof v === 'object') {
      // Recurse into the object if it's not a string (could be an array or object)
      hierarchicalConvertToMoment(v);
    }
  }
}

function adjust(
  o: RecordWithMomentAndDuration,
  k: keyof typeof o,
  v: string
): void {
  if (dateRegex.test(v)) {
    // Convert string to Moment object if it matches the date regex
    o[k] = moment(v);
    return;
  }

  const match = durationRegex.exec(v);
  if (match) {
    // Convert string to Duration object if it matches the duration regex
    o[k] = moment.duration(v);
  }
}
