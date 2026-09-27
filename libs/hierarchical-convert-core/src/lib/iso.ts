const DATE_TIME =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-](\d{2}):(\d{2}))?$/;
const DURATION_DATE = /^(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?$/;
const DURATION_TIME = /^(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:[.,]\d{1,9})?)S)?$/;
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** Facts about a recognised ISO 8601 timestamp. */
export interface IsoDateTimeInfo {
  /** `true` when the value ends in `Z` or a `±HH:MM` offset. */
  readonly hasOffset: boolean;
}

/** Numeric duration components; absent components are `0`. */
export interface IsoDurationComponents {
  years: number;
  months: number;
  weeks: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

/** A recognised ISO 8601 duration split into its sign and components. */
export interface IsoDuration {
  negative: boolean;
  components: IsoDurationComponents;
}

const WITH_OFFSET: IsoDateTimeInfo = Object.freeze({ hasOffset: true });
const WITHOUT_OFFSET: IsoDateTimeInfo = Object.freeze({ hasOffset: false });

/**
 * Recognises `YYYY-MM-DDTHH:mm:ss[.f{1,9}][Z|±HH:MM]` and validates calendar
 * components before a backend can normalise an invalid date into a valid one.
 */
export function parseIsoDateTime(value: string): IsoDateTimeInfo | undefined {
  if (value.length < 19 || value[4] !== '-' || value[10] !== 'T') {
    return undefined;
  }
  const match = DATE_TIME.exec(value);
  if (match === null) {
    return undefined;
  }
  const [
    ,
    yearText,
    monthText,
    dayText,
    hourText,
    minuteText,
    secondText,
    offset,
    offsetHourText = '0',
    offsetMinuteText = '0',
  ] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const valid =
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= (month === 2 && leap ? 29 : DAYS_IN_MONTH[month - 1]) &&
    Number(hourText) < 24 &&
    Number(minuteText) < 60 &&
    Number(secondText) < 60 &&
    Number(offsetHourText) < 24 &&
    Number(offsetMinuteText) < 60;
  if (!valid) {
    return undefined;
  }
  return offset === undefined ? WITHOUT_OFFSET : WITH_OFFSET;
}

/** Validates calendar components before a backend can normalize invalid dates. */
export function isIsoDateTime(value: string): boolean {
  return parseIsoDateTime(value) !== undefined;
}

/**
 * Parses the common duration syntax: integer `Y`, `M`, `W`, `D`, `H`, `M`
 * components, seconds with up to nine fraction digits (`.` or `,`), and an
 * optional leading `-`. Individual backends may support a narrower subset.
 */
export function parseIsoDuration(value: string): IsoDuration | undefined {
  const negative = value.startsWith('-');
  if (!value.startsWith(negative ? '-P' : 'P')) {
    return undefined;
  }

  const body = value.slice(negative ? 2 : 1);
  const timeSeparator = body.indexOf('T');
  if (timeSeparator !== -1 && body.includes('T', timeSeparator + 1)) {
    return undefined;
  }
  const dateText = timeSeparator === -1 ? body : body.slice(0, timeSeparator);
  const timeText =
    timeSeparator === -1 ? undefined : body.slice(timeSeparator + 1);
  const date = DURATION_DATE.exec(dateText);
  const time =
    timeText === undefined ? undefined : DURATION_TIME.exec(timeText);
  if (
    date === null ||
    time === null ||
    (timeText !== undefined && !time?.slice(1).some(Boolean)) ||
    (!date.slice(1).some(Boolean) && !time?.slice(1).some(Boolean))
  ) {
    return undefined;
  }

  const [, years, months, weeks, days] = date;
  const hours = time?.[1];
  const minutes = time?.[2];
  const seconds = time?.[3];
  return {
    negative,
    components: {
      years: Number(years ?? 0),
      months: Number(months ?? 0),
      weeks: Number(weeks ?? 0),
      days: Number(days ?? 0),
      hours: Number(hours ?? 0),
      minutes: Number(minutes ?? 0),
      seconds: Number(seconds?.replace(',', '.') ?? 0),
    },
  };
}

/** Common duration syntax; individual backends may support a narrower subset. */
export function isIsoDuration(value: string): boolean {
  return parseIsoDuration(value) !== undefined;
}

/**
 * Rewrites the ISO 8601 decimal comma (`PT1,5S`) as a decimal point for
 * backends whose duration parsers only accept `.`. Only the seconds component
 * of a recognised duration can carry a fraction, so one replacement suffices.
 */
export function normalizeIsoDuration(value: string): string {
  return value.replace(',', '.');
}

/** Millisecond backends truncate extra precision, never round into another second. */
export function millisecondDateTime(value: string): string {
  return value.replace(
    /\.(\d{1,9})/,
    (_, fraction: string) => `.${fraction.padEnd(3, '0').slice(0, 3)}`,
  );
}
