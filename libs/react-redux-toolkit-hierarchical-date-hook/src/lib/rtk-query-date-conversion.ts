import {
  isProblemDetailsResponse,
  withProblemDetails,
} from '@adaskothebeast/hierarchical-convert-core';
import type { ProblemDetailsFailure } from '@adaskothebeast/hierarchical-convert-core';
import type { BaseQueryFn } from '@reduxjs/toolkit/query';

export type HierarchicalDateConverter = (obj: object) => void;

/**
 * Plain data, suitable for RTK Query's serialized error state.
 *
 * `status` is the HTTP status, except when the base query reported
 * `'PARSING_ERROR'` (a malformed problem body). That discriminant is kept so
 * `FetchBaseQueryError` narrowing keeps working; `httpStatus` is always the
 * numeric HTTP status.
 */
export interface ProblemDetailsQueryError extends ProblemDetailsFailure {
  readonly status: number | 'PARSING_ERROR';
  readonly data: unknown;
}

function problemResponse(meta: unknown): { status: number } | undefined {
  if (typeof meta !== 'object' || meta === null || !('response' in meta))
    return undefined;
  const response = meta.response;
  if (
    typeof response !== 'object' ||
    response === null ||
    !('status' in response) ||
    typeof response.status !== 'number' ||
    !('headers' in response) ||
    !isProblemDetailsResponse({ headers: response.headers })
  )
    return undefined;
  return { status: response.status };
}

function toProblemQueryError(
  originalError: unknown,
  data: unknown,
  httpStatus: number,
): ProblemDetailsQueryError {
  const original =
    typeof originalError === 'object' && originalError !== null
      ? (originalError as Record<string, unknown>)
      : undefined;
  let body = originalError;
  if (originalError === undefined) {
    body = data;
  } else if (original !== undefined && 'data' in original) {
    body = original['data'];
  }
  const details = withProblemDetails({}, httpStatus, body);
  return {
    ...original,
    status:
      original?.['status'] === 'PARSING_ERROR' ? 'PARSING_ERROR' : httpStatus,
    data: details.body,
    ...details,
  };
}

/**
 * Creates an endpoint `transformResponse` that converts a clone of the data.
 *
 * `transformResponse` cannot reject a request: RTK Query treats anything it
 * throws as an unhandled error and keeps only `name`/`message`/`stack`. Problem
 * Details documents sent with HTTP 2xx are therefore returned unconverted. Use
 * {@link withHierarchicalDateConversion} to surface them as
 * {@link ProblemDetailsQueryError}s.
 */
export function createHierarchicalDateTransformResponse<T>(
  convert: HierarchicalDateConverter,
): (response: T, meta?: unknown) => T {
  return (response: T, meta?: unknown): T => {
    if (
      typeof response !== 'object' ||
      response === null ||
      problemResponse(meta) !== undefined
    )
      return response;
    const converted = structuredClone(response);
    convert(converted);
    return converted;
  };
}

/**
 * Wraps a base query: Problem Details responses (any status) become
 * serializable {@link ProblemDetailsQueryError}s, and successful data is
 * converted in place before RTK Query stores (and freezes) it.
 */
export function withHierarchicalDateConversion<
  Args,
  Result,
  TError,
  DefinitionExtraOptions = object,
  Meta = object,
>(
  baseQuery: BaseQueryFn<Args, Result, TError, DefinitionExtraOptions, Meta>,
  convert: HierarchicalDateConverter,
): BaseQueryFn<
  Args,
  Result,
  TError | ProblemDetailsQueryError,
  DefinitionExtraOptions,
  Meta
> {
  return async (args, api, extraOptions) => {
    const result = await baseQuery(args, api, extraOptions);
    const problem = problemResponse(result.meta);
    if (problem !== undefined) {
      return {
        error: toProblemQueryError(result.error, result.data, problem.status),
        meta: result.meta,
      };
    }
    if (
      result.error === undefined &&
      typeof result.data === 'object' &&
      result.data !== null
    ) {
      convert(result.data);
    }
    return result;
  };
}

/** Action types whose payloads carry converted (non-serializable) cache values. */
function cacheWriteActions(reducerPath: string): string[] {
  return [
    `${reducerPath}/executeQuery/fulfilled`,
    `${reducerPath}/executeMutation/fulfilled`,
    `${reducerPath}/queries/queryResultPatched`,
    `${reducerPath}/queries/cacheEntriesUpserted`,
  ];
}

/**
 * `serializableCheck` options for stores whose RTK Query cache holds converted
 * values (Dates, Luxon/Day.js objects, ...). Only the listed APIs' cache
 * slices and cache-writing actions are exempt; the rest of the store is still
 * checked. Pass each API's `reducerPath` (default `'api'`).
 *
 * ```ts
 * configureStore({
 *   reducer: { [api.reducerPath]: api.reducer },
 *   middleware: (getDefaultMiddleware) =>
 *     getDefaultMiddleware({
 *       serializableCheck: hierarchicalDateSerializableCheck(api.reducerPath),
 *     }).concat(api.middleware),
 * });
 * ```
 */
export function hierarchicalDateSerializableCheck(
  reducerPaths: string | readonly string[] = 'api',
): { ignoredActions: string[]; ignoredPaths: string[] } {
  const paths =
    typeof reducerPaths === 'string' ? [reducerPaths] : reducerPaths;
  return {
    ignoredActions: paths.flatMap(cacheWriteActions),
    ignoredPaths: paths.flatMap((path) => [
      `${path}.queries`,
      `${path}.mutations`,
    ]),
  };
}
