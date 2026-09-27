# Typewriter Axios

Axios request and response interceptors for Typewriter runtime schemas.

```bash
npm install @adaskothebeast/typewriter-http-axios axios
```

```ts
import { installTypewriterAxiosInterceptor, installTypewriterAxiosRequestInterceptor, requestWithSchema } from '@adaskothebeast/typewriter-http-axios';
import axios from 'axios';

const api = axios.create();
installTypewriterAxiosRequestInterceptor(api);
installTypewriterAxiosInterceptor(api);

const response = await requestWithSchema(api, InvoiceSchema, {
  method: 'GET',
  url: '/api/invoices/1',
  responseSchemaRegistry: apiTypeRegistry,
});
```

Generated clients can set `responseSchema`, `responseSchemaRegistry`, and `responseTransformOptions` in `AxiosRequestConfig`. For outgoing bodies, use `requestSchema`, `requestSchemaRegistry`, and `requestSerializeOptions`.

JSON Problem Details (`application/problem+json`) bypass success conversion, including HTTP 200 responses. Use the exported `isProblemDetailsError(error)` guard to read `httpStatus`, typed `problem` members, and the original decoded `body`. Extension members such as `errors` and `traceId` are preserved. See the repository [conversion contract](https://github.com/AdaskoTheBeAsT/date-interceptors/blob/main/docs/conversion-contract.md#json-problem-details) for transport-specific behavior.
