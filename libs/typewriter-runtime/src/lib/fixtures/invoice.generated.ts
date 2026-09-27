import { defineTypeRegistry, schema } from '@adaskothebeast/typewriter-schema';
import type { Temporal } from '@js-temporal/polyfill';
import type Decimal from 'decimal.js';

export interface Invoice {
  id: Uint8Array;
  amount: Decimal;
  createdAt: Temporal.Instant;
  displayName: string;
}

export const InvoiceSchema = schema.object<Invoice>({
  id: schema.property(schema.uuid()),
  amount: schema.property(schema.decimal<Decimal>('string')),
  createdAt: schema.property(schema.instant<Temporal.Instant>(), 'created_at'),
  displayName: schema.property(schema.string(), 'display_name'),
});

export const apiTypeRegistry = defineTypeRegistry({
  'Contracts.Invoice': InvoiceSchema,
});
