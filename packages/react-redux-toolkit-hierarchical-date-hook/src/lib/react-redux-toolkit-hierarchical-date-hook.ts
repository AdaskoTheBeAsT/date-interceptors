/* eslint-disable @typescript-eslint/ban-types */
import { HierarchicalConverter } from '@adaskothebeast/hierarchical-convert';
import {
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError,
  FetchBaseQueryMeta,
  QueryDefinition,
} from '@reduxjs/toolkit/dist/query';
import {
  UseQuery,
  UseQueryHookResult,
  UseQueryStateResult,
  UseQuerySubscriptionResult,
} from '@reduxjs/toolkit/dist/query/react/buildHooks';

export const useGetEntityWithDatesQuery = <TK, T>(
  query: UseQuery<
    QueryDefinition<
      TK,
      BaseQueryFn<
        string | FetchArgs,
        unknown,
        FetchBaseQueryError,
        {},
        FetchBaseQueryMeta
      >,
      never,
      T,
      'api'
    >
  >,
  params: TK
): UseQueryHookResult<
  QueryDefinition<
    TK,
    BaseQueryFn<
      string | FetchArgs,
      unknown,
      FetchBaseQueryError,
      {},
      FetchBaseQueryMeta
    >,
    never,
    T,
    'api'
  >,
  UseQueryStateResult<
    QueryDefinition<
      TK,
      BaseQueryFn<
        string | FetchArgs,
        unknown,
        FetchBaseQueryError,
        {},
        FetchBaseQueryMeta
      >,
      never,
      T,
      'api'
    >,
    unknown
  > &
    UseQuerySubscriptionResult<
      QueryDefinition<
        TK,
        BaseQueryFn<
          string | FetchArgs,
          unknown,
          FetchBaseQueryError,
          {},
          FetchBaseQueryMeta
        >,
        never,
        T,
        'api'
      >
    >
> => {
  const result = query(params);

  // Transform 'data' field if it exists
  if (result.data) {
    // Deep clone the data to avoid mutating the state directly
    const clonedData = JSON.parse(JSON.stringify(result.data));
    HierarchicalConverter.instance.convert(clonedData as object);
    return {
      ...result,
      data: clonedData,
    } as unknown as UseQuerySubscriptionResult<
      QueryDefinition<
        TK,
        BaseQueryFn<
          string | FetchArgs,
          unknown,
          FetchBaseQueryError,
          {},
          FetchBaseQueryMeta
        >,
        never,
        T,
        'api'
      >
    >;
  }

  // If there's no 'data', return the result as is
  return result;
};

export default useGetEntityWithDatesQuery;
