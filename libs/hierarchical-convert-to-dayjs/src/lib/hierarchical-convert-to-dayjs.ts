import * as dayjs from 'dayjs';
import * as duration from 'dayjs/plugin/duration';
import * as utc from 'dayjs/plugin/utc';

dayjs.extend(utc);
dayjs.extend(duration);

type RecordWithDate = Record<
  string,
  string | dayjs.Dayjs | duration.Duration | object
>;

// Regular expression that matches ISO 8601 date strings
const dateRegex: RegExp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
const durationRegex: RegExp =
  /^P(?:(0|[1-9]\d*)Y)?(?:(0|[1-9]\d*)M)?(?:(0|[1-9]\d*)W)?(?:(0|[1-9]\d*)D)?(?:T(?:(0|[1-9]\d*)H)?(?:(0|[1-9]\d*)M)?(?:(0|[1-9]\d*)S)?)?$/;

/**
 * Function to recursively traverse the object and convert date strings to Dayjs and Duration objects in place.
 * @param obj Object to traverse
 * @returns Void.
 */
export function hierarchicalConvertToDayjs(obj: unknown): void {
  if (typeof obj !== 'object') {
    return;
  }

  const o = obj as RecordWithDate;

  for (const key in o) {
    if (!Object.prototype.hasOwnProperty.call(o, key)) {
      continue;
    }

    const v = o[key];
    if (typeof v === 'string') {
      adjust(o, key, v);
    } else if (typeof v === 'object') {
      // Recurse into the object if it's not a string (could be an array or object)
      hierarchicalConvertToDayjs(v);
    }
  }
}

function adjust(o: RecordWithDate, k: keyof typeof o, v: string): void {
  if (dateRegex.test(v)) {
    // Convert string to Dayjs object if it matches the date regex
    o[k] = dayjs.utc(v);
    return;
  }

  const match = durationRegex.exec(v);
  if (match) {
    // Convert string to Duration object if it matches the duration regex
    o[k] = dayjs.duration(v);
  }
}
