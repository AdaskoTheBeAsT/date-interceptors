# Typewriter Schema

Runtime schema descriptors for Typewriter-generated TypeScript contracts.

```bash
npm install @adaskothebeast/typewriter-schema
```

```ts
import { defineTypeRegistry, schema } from '@adaskothebeast/typewriter-schema';
import type Decimal from 'decimal.js';

interface Invoice {
  amount: Decimal;
  displayName: string;
}

export const InvoiceSchema = schema.object<Invoice>({
  amount: schema.property(schema.decimal<Decimal>('string')),
  displayName: schema.property(schema.string(), 'display_name'),
});

export const apiTypeRegistry = defineTypeRegistry({
  'Contracts.Invoice': InvoiceSchema,
});
```

Descriptors support primitives, Decimal, UUID, Temporal values, arrays, records, nullability, references, discriminated unions, and custom types.
