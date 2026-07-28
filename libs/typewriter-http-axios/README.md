# Typewriter Axios

Axios request and response interceptors for Typewriter runtime schemas.

```bash
npm install @adaskothebeast/typewriter-http-axios axios
```

```ts
import axios from 'axios';
import {
  installTypewriterAxiosInterceptor,
  installTypewriterAxiosRequestInterceptor,
  requestWithSchema,
} from '@adaskothebeast/typewriter-http-axios';

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
