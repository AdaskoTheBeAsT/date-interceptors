# 🧰 RTK Query Hierarchical Date Conversion

`@adaskothebeast/react-redux-toolkit-hierarchical-date-hook` adapts hierarchical converters for Redux Toolkit Query. It can produce a converted copy of a query-hook result, wrap a base query so all successful results are converted, or convert a single endpoint response.

## 📦 Install

```bash
npm install @reduxjs/toolkit @adaskothebeast/react-redux-toolkit-hierarchical-date-hook @adaskothebeast/hierarchical-convert-to-date
```

## Choosing an approach

| Approach                                                                            | Store stays serializable                           | Problem Details become typed errors                                                                              |
| ----------------------------------------------------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Hook (`useAdjustUseQueryHookResultWithHierarchicalDateConverter`) — **recommended** | Yes                                                | Add `withHierarchicalDateConversion(baseQuery, () => undefined)`: problems become errors, cached data stays JSON |
| Base query wrapper (`withHierarchicalDateConversion`)                               | No, see [serializable check](#-serializable-check) | Yes, for every status                                                                                            |
| Endpoint `transformResponse` (`createHierarchicalDateTransformResponse`)            | No, see [serializable check](#-serializable-check) | No                                                                                                               |

Converting in the hook keeps plain JSON in the Redux store, which is what Redux Toolkit expects. The other two helpers put `Date` (or Luxon, Day.js, …) objects into the RTK Query cache.

## 🪝 Convert an existing hook result (recommended)

`useAdjustUseQueryHookResultWithHierarchicalDateConverter` accepts an RTK Query hook result and returns a shallow copy whose `data` and `currentData` properties have been cloned and converted. When `data` and `currentData` point at the same cache entry, they share one converted value. If there is nothing to convert, the original result is returned unchanged.

```tsx
const result = useGetOrderQuery('42');
const orderResult = useAdjustUseQueryHookResultWithHierarchicalDateConverter(result, hierarchicalConvertToDate);
```

Converted values are memoized by the original data references and the converter reference. Keep the converter stable (a module-level function or `useCallback`). The hook preserves query fields and structured errors; a converter returning a model infers its output type, while mutating `void` converters retain the original data type.

## 🌐 Convert every successful base-query result

Wrap an existing `BaseQueryFn` with `withHierarchicalDateConversion` to apply the same converter globally. Successful object data is converted in place: it has just been parsed and RTK Query has not stored or frozen it yet, so no clone is needed.

```ts
import { withHierarchicalDateConversion } from '@adaskothebeast/react-redux-toolkit-hierarchical-date-hook';
import { fetchBaseQuery } from '@reduxjs/toolkit/query';

const baseQuery = withHierarchicalDateConversion(fetchBaseQuery({ baseUrl: '/api' }), hierarchicalConvertToDate);
```

This wrapper is also the Problem-Details-aware path. Any response labelled `application/problem+json`, including HTTP 200, becomes a plain, serializable `ProblemDetailsQueryError` in `result.error`:

```ts
const { error } = useGetOrderQuery('42');
if (isProblemDetailsError(error)) {
  error.httpStatus; // numeric HTTP status
  error.problem?.title; // typed RFC 9457 members, undefined for malformed bodies
  error.body; // decoded body
}
```

`error.status` is the numeric HTTP status, except when `fetchBaseQuery` could not parse the problem body. In that case the original `'PARSING_ERROR'` discriminant (and `originalStatus`) is kept, so existing `FetchBaseQueryError` narrowing keeps working; `httpStatus` is always numeric.

## 🎯 Convert an endpoint response

Use `createHierarchicalDateTransformResponse` as an endpoint's `transformResponse`. The returned transformer deep-clones object responses with `structuredClone`, then invokes the converter.

```ts
import { hierarchicalConvertToDate } from '@adaskothebeast/hierarchical-convert-to-date';
import { createHierarchicalDateTransformResponse } from '@adaskothebeast/react-redux-toolkit-hierarchical-date-hook';
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const api = createApi({
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  endpoints: (build) => ({
    getOrder: build.query<{ createdAt: Date }, string>({
      query: (id) => `orders/${id}`,
      transformResponse: createHierarchicalDateTransformResponse(hierarchicalConvertToDate),
    }),
  }),
});
```

`transformResponse` cannot turn a response into an error: RTK Query treats anything thrown there as an unhandled error and keeps only `name`, `message`, and `stack`. The transformer therefore returns Problem Details documents sent with a 2xx status unconverted, as ordinary `data`. Use `withHierarchicalDateConversion` when you need them as errors.

## 🧪 Serializable check

The default `configureStore` middleware warns ("A non-serializable value was detected…") when the base query wrapper or the endpoint transformer puts converted objects into the cache. Either convert in the hook instead, or exempt the RTK Query cache with `hierarchicalDateSerializableCheck`:

```ts
import { hierarchicalDateSerializableCheck } from '@adaskothebeast/react-redux-toolkit-hierarchical-date-hook';
import { configureStore } from '@reduxjs/toolkit';

export const store = configureStore({
  reducer: { [api.reducerPath]: api.reducer },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: hierarchicalDateSerializableCheck(api.reducerPath),
    }).concat(api.middleware),
});
```

The helper returns `{ ignoredActions, ignoredPaths }` for the given reducer paths (default `'api'`; pass an array for several APIs). Only `<reducerPath>.queries`, `<reducerPath>.mutations`, and the RTK Query actions that write cache values are exempt; the rest of the store is still checked. The trade-off: the Redux DevTools and state persistence see objects rather than JSON in that part of the store.

> 💡 The hook and the endpoint transformer clone with `structuredClone`; use data that can be structured-cloned before applying a converter.

## Problem Details

JSON Problem Details (`application/problem+json`) bypass success conversion, including HTTP 200 responses. Use the exported `isProblemDetailsError(error)` guard to read `httpStatus`, typed `problem` members, and the original decoded `body`. Extension members such as `errors` and `traceId` are preserved. See the repository [conversion contract](https://github.com/AdaskoTheBeAsT/date-interceptors/blob/main/docs/conversion-contract.md#json-problem-details) for transport-specific behavior.
