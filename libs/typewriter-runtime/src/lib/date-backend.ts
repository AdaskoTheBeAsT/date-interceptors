export type DateSchemaKind =
  | 'instant'
  | 'plain-date'
  | 'plain-time'
  | 'plain-date-time'
  | 'zoned-date-time'
  | 'duration'
  | 'period'
  | 'plain-year-month'
  | 'plain-month-day';

export interface DateCodec<T = unknown> {
  is(value: unknown): value is T;
  parse(value: string): T;
  serialize(value: T): string;
}

export interface DateBackend {
  readonly name: string;
  readonly codecs: Partial<
    Readonly<Record<DateSchemaKind, DateCodec>>
  >;
}

export function defineDateBackend<TBackend extends DateBackend>(
  backend: TBackend,
): TBackend {
  return backend;
}
