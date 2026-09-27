# Typewriter Fetch

Fetch helpers for Typewriter runtime schemas.

`serializeJsonBody` always returns a JSON string or throws. An `undefined` root
throws `TypeError`, including with an optional schema. Omit the request's `body`
when no payload is wanted. Optional properties inside objects remain supported.

```bash
npm install @adaskothebeast/typewriter-http-fetch
```

```ts
import { fetchJson, serializeJsonBody } from '@adaskothebeast/typewriter-http-fetch';

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

`fetchJson` returns `Promise<T | undefined>`: 204/205 and empty successful bodies return `undefined`. Nonempty malformed JSON rejects with `SyntaxError`. HTTP errors expose the original, unconsumed `Response` through `error.response` for headers and error-body inspection.

JSON Problem Details (`application/problem+json`) bypass success conversion, including HTTP 200 responses. Use the exported `isProblemDetailsError(error)` guard to read `httpStatus`, typed `problem` members, and the original decoded `body`. Extension members such as `errors` and `traceId` are preserved. See the repository [conversion contract](https://github.com/AdaskoTheBeAsT/date-interceptors/blob/main/docs/conversion-contract.md#json-problem-details) for transport-specific behavior.
