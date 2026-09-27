# ⚡ Axios Interceptor

`@adaskothebeast/axios-interceptor` adjusts successful Axios JSON response bodies before your application receives them. It is intended to be paired with one of the hierarchical converters, such as `@adaskothebeast/hierarchical-convert-to-date`.

## 📦 Install

```bash
npm install axios @adaskothebeast/axios-interceptor @adaskothebeast/hierarchical-convert-to-date
```

## 🚀 Create an instance with date conversion

Pass a function that changes a response body in place, plus optional `axios.create` defaults.

```ts
import { AxiosInstanceManager } from '@adaskothebeast/axios-interceptor';
import { hierarchicalConvertToDate } from '@adaskothebeast/hierarchical-convert-to-date';

const api = AxiosInstanceManager.createInstance(hierarchicalConvertToDate, {
  baseURL: 'https://example.com/api',
  timeout: 10_000,
});

const response = await api.get<{ createdAt: Date }>('/orders/42');
response.data.createdAt instanceof Date; // true
```

Store and reuse the returned instance. Each call to `createInstance` creates a new Axios instance; it does not modify Axios's global default instance.

## 🔌 Attach to an existing instance

`attachHierarchicalConverter` adds the same behavior to an instance you already own and returns a function that removes it again.

```ts
import { attachHierarchicalConverter } from '@adaskothebeast/axios-interceptor';
import axios from 'axios';

const api = axios.create({ baseURL: '/api' });
const eject = attachHierarchicalConverter(api, hierarchicalConvertToDate);

// Later, for example in a test teardown:
eject();
```

## 🧩 Run several adjustments

`createInstanceWithMultipleInterceptors(functions, config?)` and `attachHierarchicalConverter(instance, functions)` accept an array of body-adjustment functions. They run in the listed order against the same `response.data` object.

```ts
const api = AxiosInstanceManager.createInstanceWithMultipleInterceptors([
  hierarchicalConvertToDate,
  (body) => {
    // Perform another application-specific adjustment.
    console.debug(body);
  },
]);
```

## 🔍 Which responses are converted

Conversion functions run only for successful responses when:

- `config.responseType` is `'json'` or not set, and
- `response.data` is a plain object or array, which is what Axios produces when it parses a JSON body (`application/json`, `application/vnd.api+json`, or any other `+json` type).

`arraybuffer`, `stream`, `blob`, `document`, and `text` responses are passed through untouched, even when the server labels them as JSON. Non-plain data such as `Buffer`s or class instances created by a custom `transformResponse` is also left alone.

> 💡 The library leaves rejected Axios responses unchanged and rethrows the original error. Conversion functions are never called for them.

## Problem Details

JSON Problem Details (`application/problem+json`) bypass success conversion, including HTTP 200 responses. Use the exported `isProblemDetailsError(error)` guard to read `httpStatus`, typed `problem` members, and the original decoded `body`. Extension members such as `errors` and `traceId` are preserved. See the repository [conversion contract](https://github.com/AdaskoTheBeAsT/date-interceptors/blob/main/docs/conversion-contract.md#json-problem-details) for transport-specific behavior.
