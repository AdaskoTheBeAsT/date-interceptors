interface CustomQueryResult<ResultType> {
  // State properties
  data?: ResultType;
  error?: Error;
  isLoading: boolean;
  isFetching: boolean;
  isSuccess: boolean;
  isError: boolean;

  // Subscription methods
  refetch: () => void;
  // Add other methods if needed

  // Additional properties if necessary
  // [key: string]: any; // Optional, if you want to allow additional properties
}

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
 *   import { hierarchicalConvertToDate } from '@adaskothebeast/hierarchical-convert-to-date';
 *
 *   const MyComponent: React.FC = () => {
 *     const useQueryResult = useGetUserQuery(userId);
 *     const adjustedResult = useAdjustUseQueryHookResultWithHierarchicalDateConverter(
 *       useQueryResult,
 *       hierarchicalConvertToDate
 *     );
 *
 *     if (adjustedResult.isLoading) {
 *       return <div>Loading...</div>;
 *     }
 *
 *     if (adjustedResult.error) {
 *       return <div>Error: {adjustedResult.error}</div>;
 *     }
 *
 *     return <div>User's name is {adjustedResult.data?.name}</div>;
 *   };
 * ```
 *
 * @param useQueryResult The result of a Redux Toolkit query hook
 * @param convertFunc The function that performs the conversion in place
 * @returns The original query result with its data field transformed, if it exists
 */
export function useAdjustUseQueryHookResultWithHierarchicalDateConverter<
  ResultType,
>(
  useQueryResult: CustomQueryResult<ResultType>,
  convertFunc: (obj: object) => void,
): CustomQueryResult<ResultType> {
  if (useQueryResult.data) {
    const clonedData = structuredClone(useQueryResult.data);
    convertFunc(clonedData as object);
    return {
      ...useQueryResult,
      data: clonedData,
    };
  }
  return useQueryResult;
}
