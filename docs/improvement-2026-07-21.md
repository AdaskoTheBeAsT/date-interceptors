# angular

## 1. in https://github.com/adaskothebeast/date-interceptors in readme I have few ways described for communicating with api - are there any popular one non included in readme worth adding?

Yes. Your README already covers Angular `HttpClient`, a typed Angular client, Axios, React Query, RTK Query, SWR, Redux Saga, and Redux Thunk. However, it currently mixes **HTTP transports**, **server-state libraries**, and **state-management patterns** in one section. ([GitHub][1])

## Highest-value additions

### 1. Native Fetch API

This is the biggest omission. Fetch appears inside the React Query, SWR, and Thunk examples, but it does not have its own standalone section. Fetch is the native, widely available modern HTTP API and is also the foundation used by many higher-level clients. ([GitHub][1])

A reusable integration would be more valuable than repeating conversion logic:

```ts
import { hierarchicalConvertToDate }
  from '@adaskothebeast/hierarchical-convert-to-date';

export async function fetchJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(input, init);

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status}: ${response.statusText}`,
    );
  }

  const data = await response.json() as T;

  hierarchicalConvertToDate(data);

  return data;
}
```

Usage:

```ts
const user = await fetchJson<User>('/api/users/1');
```

I would avoid describing this as a global Fetch interceptor. Fetch has no native interceptor pipeline; a wrapper or custom `fetch` implementation is safer and more composable.

---

### 2. Modern Angular: Fetch, XHR and `httpResource`

This deserves its own updated section, especially considering your recent work around uploads.

In current Angular:

* `HttpClient` uses Fetch by default.
* `withXhr()` switches a particular `HttpClient` configuration to `XMLHttpRequest`.
* XHR is required when upload progress events are needed.
* `httpResource()` uses `HttpClient`, so normal Angular interceptors also apply to it. ([Angular][2])

Your README should explicitly explain that the date interceptor works at the `HttpClient` level and therefore applies to:

```ts
httpClient.get<User>('/api/users/1');
```

and:

```ts
userResource = httpResource<User>(() => '/api/users/1');
```

You could add a small compatibility table:

| Angular configuration          | Transport         | Date interceptor |                  Upload progress |
| ------------------------------ | ----------------- | ---------------: | -------------------------------: |
| `provideHttpClient()`          | Fetch             |              Yes |                               No |
| `provideHttpClient(withXhr())` | XHR               |              Yes |                              Yes |
| `httpResource()`               | Uses `HttpClient` |              Yes | Not intended for upload progress |

This is probably more valuable for Angular users than adding another standalone package.

Also add a modern standalone-provider example. The current main Angular example still uses `NgModule`, while Angular applications increasingly use standalone bootstrapping. ([GitHub][1])

---

### 3. TanStack Query v5

The current README uses:

```ts
import { useQuery } from 'react-query';

useQuery('users', () => fetcher('/api/users'));
```

That is the older package and API style. The current package is `@tanstack/react-query`, using object-based query options. ([GitHub][1])

Replace it with:

```ts
import { useQuery } from '@tanstack/react-query';

const query = useQuery({
  queryKey: ['users'],
  queryFn: () => fetchJson<User[]>('/api/users'),
});
```

Perform conversion inside `queryFn`, before the data enters the query cache. I would not primarily recommend `select`, because `select` transforms what consumers see but does not change the value stored in the cache; additionally, your converter currently mutates its argument. ([TanStack][3])

---

### 4. Proper RTK Query integration

The existing RTK Query example adjusts the result returned by a generated React hook:

```ts
useAdjustUseQueryHookResultWithHierarchicalDateConverter(...)
```

That means the conversion happens at the component/hook boundary. The Redux cache may still contain strings.

RTK Query provides `transformResponse`, which runs before the result is stored in its cache. ([redux-toolkit.js.org][4])

Per endpoint:

```ts
getUser: build.query<User, number>({
  query: id => `/users/${id}`,

  transformResponse: response => {
    hierarchicalConvertToDate(response);
    return response as User;
  },
}),
```

Even better, show a global `baseQuery` wrapper:

```ts
const rawBaseQuery = fetchBaseQuery({
  baseUrl: '/api',
});

const dateBaseQuery: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  const result = await rawBaseQuery(args, api, extraOptions);

  if ('data' in result) {
    hierarchicalConvertToDate(result.data);
  }

  return result;
};
```

This would be a stronger integration than the current hook because all query and mutation responses are converted before caching.

---

### 5. GraphQL / Apollo Client

GraphQL is the other significant communication style missing from the README.

Apollo Link is specifically designed to customize the request and response flow, including modifying `response.data`. ([apollographql.com][5])

```ts
import {
  ApolloClient,
  ApolloLink,
  HttpLink,
  InMemoryCache,
} from '@apollo/client';

const dateLink = new ApolloLink((operation, forward) =>
  forward(operation).map(result => {
    if (result.data) {
      hierarchicalConvertToDate(result.data);
    }

    return result;
  }),
);

const client = new ApolloClient({
  link: ApolloLink.from([
    dateLink,
    new HttpLink({ uri: '/graphql' }),
  ]),
  cache: new InMemoryCache(),
});
```

Add an important caveat: for GraphQL applications with explicitly declared `DateTime` scalars, scalar-aware code generation can be more precise than converting every matching ISO string. The generic Apollo Link remains useful when the schema or generated client does not deserialize custom scalars.

You do not initially need separate examples for Apollo, urql, and Relay. One Apollo example plus a generic GraphQL note is sufficient.

---

### 6. Generated OpenAPI clients

This would fit your ecosystem especially well.

Add a section explaining how to place conversion at the generated-client boundary for:

* your Typewriter-generated clients,
* Orval,
* `openapi-fetch`,
* NSwag-generated clients,
* other generated Fetch/Axios clients.

Orval supports custom clients and mutators, while `openapi-fetch` exposes middleware/customization points. ([orval.dev][6])

Conceptually:

```ts
export async function generatedClientMutator<T>(
  config: RequestConfig,
): Promise<T> {
  const result = await fetchJson<T>(
    config.url,
    config.init,
  );

  return result;
}
```

This is more valuable than documenting every generated-client library separately. Call it something like:

> **Generated clients and custom transports**

Your Typewriter schema metadata could eventually determine whether a property should become `Date`, `Temporal.Instant`, `Decimal`, `UUID`, or remain a string, which would be more precise than heuristic traversal.

## Nice-to-have, lower priority

### `ky`, `ofetch` and similar Fetch wrappers

These are simple to support through response hooks, but I would not create dedicated packages immediately. A short generic section is enough:

```ts
const api = ky.create({
  hooks: {
    afterResponse: [
      async (_request, _options, response) => {
        // Parse and transform through an application wrapper.
        return response;
      },
    ],
  },
});
```

### WebSocket and Server-Sent Events

Dates in WebSocket or SSE messages can be converted after `JSON.parse`:

```ts
socket.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  hierarchicalConvertToDate(message);
  handleMessage(message);
});
```

Useful, but this should be under “Streaming messages,” not “HTTP integrations.”

### RxJS Ajax

RxJS has its own `ajax` transport, but Angular users already have `HttpClient`, so this would be lower priority. ([rxjs.dev][7])

## README issues to fix before expanding

There are two visible documentation problems:

1. The first `### Axios` heading actually contains the Angular typed-client example, followed immediately by a second real Axios section. ([GitHub][1])
2. The React Query example uses the obsolete `react-query` import and positional `useQuery` syntax. ([GitHub][1])

## Recommended final structure

I would reorganize the integration chapter as:

```text
Framework and API Integration

1. HTTP transports
   - Native Fetch
   - Angular HttpClient
     - Fetch backend
     - XHR backend and upload progress
     - httpResource
   - Axios

2. Server-state libraries
   - TanStack Query
   - RTK Query
   - SWR

3. GraphQL
   - Apollo Client
   - Custom scalar note

4. Generated API clients
   - Typewriter
   - OpenAPI / Orval / openapi-fetch

5. State-management recipes
   - Redux Saga
   - Redux Thunk

6. Streaming
   - WebSocket
   - Server-Sent Events
```

My priority order would be: **Native Fetch → modern Angular/httpResource → TanStack Query v5 → RTK `transformResponse` → Apollo → generated clients**. Redux Saga and Thunk can remain, but they should be presented as recipes rather than primary API communication mechanisms.

[1]: https://github.com/adaskothebeast/date-interceptors "GitHub - AdaskoTheBeAsT/date-interceptors: Automatically converts ISO 8601 date strings in JSON responses into native Date objects — deeply, safely, and blazingly fast. · GitHub"
[2]: https://angular.dev/guide/http/setup?utm_source=chatgpt.com "Setting up HttpClient"
[3]: https://tanstack.com/query/v5/docs/framework/react/guides/query-functions?utm_source=chatgpt.com "Query Functions | TanStack Query React Docs"
[4]: https://redux-toolkit.js.org/rtk-query/usage/customizing-queries?utm_source=chatgpt.com "Customizing Queries | Redux Toolkit"
[5]: https://www.apollographql.com/docs/react/api/link/introduction?utm_source=chatgpt.com "Apollo Link overview"
[6]: https://orval.dev/docs/guides/custom-client/?utm_source=chatgpt.com "Orval - Generate type-safe API clients from OpenAPI"
[7]: https://rxjs.dev/api/ajax/ajax?utm_source=chatgpt.com "RxJS - ajax"

