import type { BaseQueryFn } from '@reduxjs/toolkit/query';

export type HierarchicalDateConverter = (obj: object) => void;

export function createHierarchicalDateTransformResponse<T>(
  convert: HierarchicalDateConverter,
): (response: T) => T {
  return (response: T): T => {
    if (typeof response !== 'object' || response === null) {
      return response;
    }

    const converted = structuredClone(response);
    convert(converted);
    return converted;
  };
}

export function withHierarchicalDateConversion<
  Args,
  Result,
  Error,
  DefinitionExtraOptions = object,
  Meta = object,
>(
  baseQuery: BaseQueryFn<
    Args,
    Result,
    Error,
    DefinitionExtraOptions,
    Meta
  >,
  convert: HierarchicalDateConverter,
): BaseQueryFn<
  Args,
  Result,
  Error,
  DefinitionExtraOptions,
  Meta
> {
  return async (args, api, extraOptions) => {
    const result = await baseQuery(args, api, extraOptions);

    if ('error' in result) {
      return result;
    }

    if (
      typeof result.data === 'object' &&
      result.data !== null
    ) {
      const data = createHierarchicalDateTransformResponse<Result>(convert)(
        result.data,
      );

      return result.meta === undefined
        ? { data }
        : { data, meta: result.meta };
    }

    return result;
  };
}
