import { useMemo } from 'react';

/** Preserves query flags, error unions, methods, and optional/required data. */
export type ConvertedQueryResult<
  TQuery,
  TData,
  TCurrentData = TData,
> = TQuery extends unknown
  ? {
      [K in keyof TQuery]: K extends 'data'
        ? TData
        : K extends 'currentData'
          ? TCurrentData
          : TQuery[K];
    }
  : never;

type ConvertedValue<TValue, TConverted> = TConverted extends void
  ? TValue
  : TConverted | Exclude<TValue, object>;

type CurrentDataOf<TQuery> = TQuery extends { currentData?: infer C }
  ? C
  : undefined;

function cloneAndConvert<TConverted>(
  value: unknown,
  convertFunc: (obj: object) => TConverted,
): unknown {
  if (typeof value !== 'object' || value === null) return value;
  const cloned = structuredClone(value);
  const converted = convertFunc(cloned);
  return converted === undefined ? cloned : converted;
}

/**
 * Clones and converts `data` and `currentData` only when their references or
 * the converter change; when both point at the same cache entry, the
 * converted value is shared. A mutating converter may return void. Returning
 * a value additionally infers a distinct output type, e.g. a schema
 * transformer returning a hydrated model. Keep the converter reference stable
 * (a module function or useCallback).
 *
 * Converting here, rather than in the base query, keeps the Redux store
 * serializable.
 */
export function useAdjustUseQueryHookResultWithHierarchicalDateConverter<
  TQuery extends { data?: unknown; currentData?: unknown },
  TConverted,
>(
  useQueryResult: TQuery,
  convertFunc: (obj: object) => TConverted,
): ConvertedQueryResult<
  TQuery,
  ConvertedValue<TQuery['data'], TConverted>,
  ConvertedValue<CurrentDataOf<TQuery>, TConverted>
> {
  const rawData = useQueryResult.data;
  const rawCurrentData = useQueryResult.currentData;

  const data = useMemo(
    () => cloneAndConvert(rawData, convertFunc),
    [rawData, convertFunc],
  );
  const currentData = useMemo(
    () =>
      rawCurrentData === rawData
        ? data
        : cloneAndConvert(rawCurrentData, convertFunc),
    [rawCurrentData, rawData, data, convertFunc],
  );

  return useMemo(() => {
    if (data === rawData && currentData === rawCurrentData) {
      return useQueryResult;
    }
    const result: Record<string, unknown> = { ...useQueryResult, data };
    if ('currentData' in useQueryResult) result['currentData'] = currentData;
    return result;
  }, [
    useQueryResult,
    rawData,
    rawCurrentData,
    data,
    currentData,
  ]) as ConvertedQueryResult<
    TQuery,
    ConvertedValue<TQuery['data'], TConverted>,
    ConvertedValue<CurrentDataOf<TQuery>, TConverted>
  >;
}
