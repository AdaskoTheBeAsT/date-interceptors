# ⚡ Axios Interceptor

`@adaskothebeast/axios-interceptor` creates Axios instances whose successful response bodies are adjusted before your application receives them. It is intended to be paired with one of the hierarchical converters, such as `@adaskothebeast/hierarchical-convert-to-date`.

## 📦 Install

```bash
npm install axios @adaskothebeast/axios-interceptor @adaskothebeast/hierarchical-convert-to-date
```

## 🚀 Create an instance with date conversion

Pass a function that changes a response body in place. The returned Axios instance runs that function for every non-null successful response body.

```ts
import { AxiosInstanceManager } from '@adaskothebeast/axios-interceptor';
import { hierarchicalConvertToDate } from '@adaskothebeast/hierarchical-convert-to-date';

const api = AxiosInstanceManager.createInstance(hierarchicalConvertToDate);

const response = await api.get<{ createdAt: Date }>('/orders/42');
response.data.createdAt instanceof Date; // true
```

Store and reuse the returned instance. Each call to `createInstance` creates a new Axios instance; it does not modify Axios's global default instance.

## 🧩 Run several adjustments

`createInstanceWithMultipleInterceptors` accepts an array of body-adjustment functions. They run in the listed order against the same `response.data` object.

```ts
const api = AxiosInstanceManager.createInstanceWithMultipleInterceptors([
  hierarchicalConvertToDate,
  (body) => {
    // Perform another application-specific adjustment.
    console.debug(body);
  },
]);
```

> 💡 The library leaves rejected Axios responses unchanged and rethrows the original error. Conversion functions are called only for successful responses with a non-null body.
