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
import { provideHttpClient } from '@angular/common/http';
import { withTypewriterHttpInterceptor } from '@adaskothebeast/typewriter-http-angular';

bootstrapApplication(AppComponent, {
  providers: [provideHttpClient(withTypewriterHttpInterceptor())],
});
```

The package does not select or replace an HTTP backend.

## Use

```ts
import { HttpClient } from '@angular/common/http';
import { schema } from '@adaskothebeast/typewriter-schema';
import {
  withTypewriterRequestSchema,
  withTypewriterResponseSchema,
} from '@adaskothebeast/typewriter-http-angular';

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
