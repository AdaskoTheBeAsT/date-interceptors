# Typewriter Runtime

Schema-guided JSON hydration and serialization for Typewriter-generated contracts.

```bash
npm install @adaskothebeast/typewriter-runtime @adaskothebeast/typewriter-schema
```

```ts
import { serializeJson, transformJson } from '@adaskothebeast/typewriter-runtime';

const invoice = transformJson(responseJson, InvoiceSchema, apiTypeRegistry);
const requestJson = serializeJson(invoice, InvoiceSchema, apiTypeRegistry);
```

`transformJson` mutates object and array containers while replacing schema-defined wire names with their model property names. `serializeJson` creates a new wire-value graph and maps model names back to serialized names.

Both operations use tolerant mode by default. Enable path-aware errors when contracts must match exactly:

```ts
transformJson(value, InvoiceSchema, apiTypeRegistry, { strict: true });
serializeJson(value, InvoiceSchema, apiTypeRegistry, { strict: true });
```

Custom schema kinds can be supplied through `customTransformers` and `customSerializers`.

Shared input objects transformed with the same schema reuse the replacement result.
Valid cyclic data is preserved. Circular schema references that do not descend into
data raise path-aware errors in strict mode and preserve the value in tolerant mode.

Strict object conversion validates missing properties as `undefined`. Use `schema.optional(...)` for absent fields; nullable fields still require a value. Renames are staged so overlapping model/wire names round trip without data loss.
