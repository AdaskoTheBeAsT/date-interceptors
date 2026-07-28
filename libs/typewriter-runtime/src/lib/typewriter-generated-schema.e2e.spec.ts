import { schema } from '@adaskothebeast/typewriter-schema';
import { Temporal } from '@js-temporal/polyfill';
import Decimal from 'decimal.js';
import { stringify as stringifyUuid } from 'uuid';

import {
  Invoice,
  apiTypeRegistry,
} from './fixtures/invoice.generated';
import { transformJson } from './typewriter-runtime';
import { serializeJson } from './typewriter-serializer';

describe('generated Typewriter schema', () => {
  it('hydrates and serializes a generated contract through its registry', () => {
    const responseJson = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      amount: '12345678901234567890.125',
      created_at: '2026-07-21T12:34:56.123456789Z',
      display_name: 'Generated invoice',
    };

    const invoice = transformJson<Invoice>(
      structuredClone(responseJson),
      schema.reference<Invoice>('Contracts.Invoice'),
      apiTypeRegistry,
      { strict: true },
    );

    expect(invoice.amount).toBeInstanceOf(Decimal);
    expect(invoice.createdAt).toBeInstanceOf(Temporal.Instant);
    expect(invoice.displayName).toBe('Generated invoice');
    expect(invoice).not.toHaveProperty('created_at');
    expect(invoice).not.toHaveProperty('display_name');

    expect(
      serializeJson(
        invoice,
        schema.reference<Invoice>('Contracts.Invoice'),
        apiTypeRegistry,
        { strict: true },
      ),
    ).toEqual({
      ...responseJson,
      id: stringifyUuid(invoice.id),
    });
  });
});
