import { UseQueryHookResult } from '@reduxjs/toolkit/dist/query/react/buildHooks';
import {
  BaseQueryFn,
  QueryDefinition,
  TypedUseQueryStateResult,
} from '@reduxjs/toolkit/query/react';

/**
 * This custom hook transforms the string date fields based on matching regex to Date objects
 * of a Redux Toolkit query result using the HierarchicalConverter.
 * In cases of some libraries it is also possible to convert Period automatically.
 * It deep-clones the data field and then performs the conversion.
 * If there's no data, it returns the original query result unchanged.
 *
 * Usage:
 * ```jsx
 *  // choose one function from below depending on library which you use for date manipulation
 *  import { hierarchicalConvertToDate } from '@adaskothebeast/hierarchical-convert-to-date';
 *  import { hierarchicalConvertToDateFns } from '@adaskothebeast/hierarchical-convert-to-date-fns';
 *  import { hierarchicalConvertToDayjs } from '@adaskothebeast/hierarchical-convert-to-dayjs';
 *  import { hierarchicalConvertToJsJoda } from '@adaskothebeast/hierarchical-convert-to-js-joda';
 *  import { hierarchicalConvertToLuxon } from '@adaskothebeast/hierarchical-convert-to-luxon';
 *  import { hierarchicalConvertToMoment } from '@adaskothebeast/hierarchical-convert-to-moment';
 *
 * const MyComponent: React.FC = () => {
 *   // Call your generated hook here
 *   const useQueryResult = useQueryFunction(arg, options);
 *
 *   // Pass the result to the custom hook
 *   const adjustedResult = useAdjustUseQueryHookResultWithHierarchicalDateConverter(useQueryResult, hierarchicalConvertToDate);
 *
 *   // Rest of your component...
 * }
 * ```
 *
 * @param useQueryResult The result of a Redux Toolkit query hook
 * @param convertFunc The function that performs the conversion in place
 * @returns The original query result with its data field transformed, if it exists
 */
export function useAdjustUseQueryHookResultWithHierarchicalDateConverter<
  ResultType,
  QueryArg,
  BaseQuery extends BaseQueryFn = BaseQueryFn,
  ReducerPath extends string = string,
  R extends TypedUseQueryStateResult<
    ResultType,
    QueryArg,
    BaseQuery
  > = TypedUseQueryStateResult<ResultType, QueryArg, BaseQuery>
>(
  useQueryResult: UseQueryHookResult<
    QueryDefinition<QueryArg, BaseQuery, string, ResultType, ReducerPath>,
    R
  >,
  convertFunc: (obj: object) => void
): UseQueryHookResult<
  QueryDefinition<QueryArg, BaseQuery, string, ResultType, ReducerPath>,
  R
> {
  const result = useQueryResult;

  // Transform 'data' field if it exists
  if (result.data) {
    // Deep clone the data to avoid mutating the state directly
    const clonedData = JSON.parse(JSON.stringify(result.data));

    convertFunc(clonedData as object);

    return {
      ...result,
      data: clonedData,
    } as unknown as UseQueryHookResult<
      QueryDefinition<QueryArg, BaseQuery, string, ResultType, ReducerPath>,
      R
    >; // Type assertion via 'unknown'
  }

  // If there's no 'data', return the result as is
  return result as UseQueryHookResult<
    QueryDefinition<QueryArg, BaseQuery, string, ResultType, ReducerPath>,
    R
  >;
}
