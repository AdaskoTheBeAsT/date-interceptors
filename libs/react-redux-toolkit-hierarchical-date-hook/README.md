# 🧰 RTK Query Hierarchical Date Conversion

`@adaskothebeast/react-redux-toolkit-hierarchical-date-hook` adapts hierarchical converters for Redux Toolkit Query. It can convert a single endpoint response, wrap a base query so all successful results are converted, or produce a converted copy of a query-hook result.

## 📦 Install

```bash
npm install @reduxjs/toolkit @adaskothebeast/react-redux-toolkit-hierarchical-date-hook @adaskothebeast/hierarchical-convert-to-date
```

## 🎯 Convert an endpoint response

Use `createHierarchicalDateTransformResponse` as an endpoint's `transformResponse`. The returned transformer deep-clones object responses with `structuredClone`, then invokes the converter, so RTK Query's original cached value is not mutated.

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

## 🌐 Convert every successful base-query result

Wrap an existing `BaseQueryFn` with `withHierarchicalDateConversion` to apply the same converter globally. Error results pass through unchanged; successful object data is cloned and converted.

```ts
import { withHierarchicalDateConversion } from '@adaskothebeast/react-redux-toolkit-hierarchical-date-hook';
import { fetchBaseQuery } from '@reduxjs/toolkit/query';

const baseQuery = withHierarchicalDateConversion(fetchBaseQuery({ baseUrl: '/api' }), hierarchicalConvertToDate);
```

## 🪝 Convert an existing hook result

`useAdjustUseQueryHookResultWithHierarchicalDateConverter` accepts an RTK Query hook result and returns a shallow copy whose `data` property has been cloned and converted. If there is no data, it returns the original result unchanged.

```tsx
const result = useGetOrderQuery('42');
const orderResult = useAdjustUseQueryHookResultWithHierarchicalDateConverter(result, hierarchicalConvertToDate);
```

> 💡 All three helpers rely on `structuredClone`; use data that can be structured-cloned before applying a converter.
