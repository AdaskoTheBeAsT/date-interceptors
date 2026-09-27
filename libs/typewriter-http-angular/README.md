# Typewriter Angular HTTP

Applies Typewriter runtime schemas to Angular `HttpClient` request and response bodies.
Schema metadata is stored per request in `HttpContext`, so the interceptor is
backend agnostic and works with the default backend, `withFetch()`, `withXhr()`,
and APIs such as `httpResource` that use `HttpClient`.

## Install

```sh
npm install @adaskothebeast/typewriter-http-angular
```

## Configure

Register the feature alongside any backend features selected by the
application:

```ts
import { withTypewriterHttpInterceptor } from '@adaskothebeast/typewriter-http-angular';
import { provideHttpClient } from '@angular/common/http';

bootstrapApplication(AppComponent, {
  providers: [provideHttpClient(withTypewriterHttpInterceptor())],
});
```

The package does not select or replace an HTTP backend.

## Use

```ts
import { withTypewriterRequestSchema, withTypewriterResponseSchema } from '@adaskothebeast/typewriter-http-angular';
import { schema } from '@adaskothebeast/typewriter-schema';
import { HttpClient } from '@angular/common/http';

const invoiceSchema = schema.object({
  amount: schema.property(schema.decimal('string')),
});

http.get('/api/invoice', {
  context: withTypewriterResponseSchema(invoiceSchema),
});

const context = withTypewriterResponseSchema(invoiceSchema, {
  context: withTypewriterRequestSchema(invoiceSchema),
});

http.post('/api/invoice', invoice, { context });
```

Pass an existing context, registry, or runtime options when needed:

```ts
const context = withTypewriterResponseSchema(invoiceSchema, {
  context: existingContext,
  registry,
  transformOptions: { strict: true },
});
```

The functional `typewriterHttpInterceptor` and all context tokens are
also exported for direct composition.

JSON Problem Details (`application/problem+json`) bypass success conversion, including HTTP 200 responses. Use the exported `isProblemDetailsError(error)` guard to read `httpStatus`, typed `problem` members, and the original decoded `body`. Extension members such as `errors` and `traceId` are preserved. See the repository [conversion contract](https://github.com/AdaskoTheBeAsT/date-interceptors/blob/main/docs/conversion-contract.md#json-problem-details) for transport-specific behavior.
