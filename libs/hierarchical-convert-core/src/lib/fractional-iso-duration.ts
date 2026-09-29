const COMPONENT_PATTERN = /(\d+(?:[.,]\d+)?)([YMWDHS])/y;
const DATE_SUFFIXES = 'YMWD';
const TIME_SUFFIXES = 'HMS';
const DATE_KEYS = ['years', 'months', 'weeks', 'days'] as const;
const TIME_KEYS = ['hours', 'minutes', 'seconds'] as const;

type DurationKey = (typeof DATE_KEYS)[number] | (typeof TIME_KEYS)[number];

export interface FractionalIsoDuration {
  sign: '+' | '-' | undefined;
  components: Partial<Record<DurationKey, number>>;
}

function parseComponents(
  text: string,
  suffixes: string,
  keys: readonly DurationKey[],
  components: FractionalIsoDuration['components'],
): boolean {
  let position = 0;
  let previousIndex = -1;
  while (position < text.length) {
    COMPONENT_PATTERN.lastIndex = position;
    const match = COMPONENT_PATTERN.exec(text);
    if (match === null) {
      return false;
    }
    const index = suffixes.indexOf(match[2]);
    if (index <= previousIndex) {
      return false;
    }
    components[keys[index]] = Number(match[1].replace(',', '.'));
    previousIndex = index;
    position = COMPONENT_PATTERN.lastIndex;
  }
  return true;
}

/**
 * Parses ordered ISO duration components with fractional values in any unit.
 * Some backends also accept a trailing empty `T` after date components.
 */
export function parseFractionalIsoDuration(
  value: string,
  allowEmptyTime = false,
): FractionalIsoDuration | undefined {
  const first = value[0];
  const sign = first === '-' || first === '+' ? first : undefined;
  const prefixLength = sign === undefined ? 1 : 2;
  if (value[prefixLength - 1] !== 'P') {
    return undefined;
  }

  const body = value.slice(prefixLength);
  const separator = body.indexOf('T');
  const dateText = separator === -1 ? body : body.slice(0, separator);
  const timeText = separator === -1 ? undefined : body.slice(separator + 1);
  if (
    (timeText !== undefined &&
      (timeText.includes('T') ||
        (timeText === '' && (!allowEmptyTime || dateText === '')))) ||
    (dateText === '' && (timeText === undefined || timeText === ''))
  ) {
    return undefined;
  }

  const components: FractionalIsoDuration['components'] = {};
  if (
    !parseComponents(dateText, DATE_SUFFIXES, DATE_KEYS, components) ||
    (timeText !== undefined &&
      !parseComponents(timeText, TIME_SUFFIXES, TIME_KEYS, components)) ||
    Object.keys(components).length === 0
  ) {
    return undefined;
  }
  return { sign, components };
}
