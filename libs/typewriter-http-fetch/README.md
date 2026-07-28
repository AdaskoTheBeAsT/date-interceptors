# Typewriter Fetch

Fetch helpers for Typewriter runtime schemas.

```bash
npm install @adaskothebeast/typewriter-http-fetch
```

```ts
import {
  fetchJson,
  serializeJsonBody,
} from '@adaskothebeast/typewriter-http-fetch';

const invoice = await fetchJson('/api/invoices/1', InvoiceSchema, undefined, {
  registry: apiTypeRegistry,
});

await fetch('/api/invoices', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: serializeJsonBody(invoice, InvoiceSchema, {
    registry: apiTypeRegistry,
  }),
});
```

`fetchJson` rejects non-success responses with `TypewriterFetchError`. A custom Fetch implementation can be provided through the `fetch` option.
