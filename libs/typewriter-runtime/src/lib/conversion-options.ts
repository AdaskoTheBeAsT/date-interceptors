export interface StrictnessOptions {
  /**
   * Throw path-aware errors instead of preserving invalid values. The core
   * functions default to `false`; the HTTP adapters default to `true`.
   */
  readonly strict?: boolean;
  /** @deprecated Use `strict: true` or `strict: false`. */
  readonly mode?: 'strict' | 'tolerant';
}

export function resolveStrict(
  options: StrictnessOptions,
  defaultStrict = false,
): boolean {
  if (options.strict !== undefined) {
    return options.strict;
  }
  const mode = options.mode;
  return mode === undefined ? defaultStrict : mode === 'strict';
}

/**
 * Returns options with `strict` set to the given default unless the caller
 * chose a strictness through `strict` or the deprecated `mode` option.
 */
export function withStrictDefault<TOptions extends StrictnessOptions>(
  options: TOptions | undefined,
  strict = true,
): TOptions {
  if (
    options !== undefined &&
    (options.strict !== undefined || options.mode !== undefined)
  ) {
    return options;
  }
  return { ...options, strict } as TOptions;
}

export function normalizeMaxDepth(value: number | undefined): number {
  return value === undefined || !Number.isInteger(value) || value < 0
    ? 100
    : value;
}
