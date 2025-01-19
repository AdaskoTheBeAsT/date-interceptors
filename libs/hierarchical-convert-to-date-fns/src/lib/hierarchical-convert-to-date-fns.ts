import { Duration, parseJSON } from 'date-fns';

type RecordWithDate = Record<string, string | Date | Duration | object>;

// Regular expression that matches ISO 8601 date strings
const dateRegex =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|([+-]\d{2}:\d{2}))?$/;

const durationRegex =
  /^P(?:(?<years>(0|[1-9]\d*))Y)?(?:(?<months>(0|[1-9]\d*))M)?(?:(?<weeks>(0|[1-9]\d*))W)?(?:(?<days>(0|[1-9]\d*))D)?(?:T(?:(?<hours>(0|[1-9]\d*))H)?(?:(?<minutes>(0|[1-9]\d*))M)?(?:(?<seconds>(0|[1-9]\d*))S)?)?$/; // NOSONAR

/**
 * Function to recursively traverse the object and convert date strings to Date and Duration objects in place.
 * @param obj Object to traverse
 * @returns Void.
 */
export function hierarchicalConvertToDateFns(obj: unknown): void {
  if (typeof obj !== 'object') {
    return;
  }

  const o = obj as RecordWithDate;

  for (const key in o) {
    if (!Object.hasOwn(o, key)) {
      continue;
    }

    const v = o[key];
    if (typeof v === 'string') {
      adjust(o, key, v);
    } else if (typeof v === 'object') {
      // Recurse into the object if it's not a string (could be an array or object)
      hierarchicalConvertToDateFns(v);
    }
  }
}

function adjust(o: RecordWithDate, k: keyof typeof o, v: string): void {
  if (dateRegex.test(v)) {
    // Convert string to Dayjs object if it matches the date regex
    o[k] = parseJSON(v);
    return;
  }

  const match = durationRegex.exec(v);
  if (match) {
    o[k] = convertToDuration(match);
  }
}

function convertToDuration(match: RegExpExecArray): Duration {
  // Convert string to Duration object if it matches the duration regex
  const { years, months, weeks, days, hours, minutes, seconds } =
    match.groups as {
      years?: string;
      months?: string;
      weeks?: string;
      days?: string;
      hours?: string;
      minutes?: string;
      seconds?: string;
    };

  const duration: Duration = {
    years: Number(years) || 0,
    months: Number(months) || 0,
    weeks: Number(weeks) || 0,
    days: Number(days) || 0,
    hours: Number(hours) || 0,
    minutes: Number(minutes) || 0,
    seconds: Number(seconds) || 0,
  };

  return duration;
}
