import { defineTypeRegistry, schema } from '@adaskothebeast/typewriter-schema';
import { Temporal } from '@js-temporal/polyfill';
import Decimal from 'decimal.js';
import { parse as parseUuid, v4 as uuidV4 } from 'uuid';

import type { DateBackend } from './date-backend';
import { temporalDateBackend } from './temporal-date-backend';
import { transformJson } from './typewriter-runtime';
import {
  JsonSerializationError,
  createJsonSerializer,
  serializeJson,
} from './typewriter-serializer';

interface Invoice {
  id: Uint8Array;
  amount: Decimal;
  createdAt: Temporal.Instant;
  displayName: string;
  periods: Temporal.Duration[];
}

const invoiceSchema = schema.object<Invoice>({
  id: schema.property(schema.uuid()),
  amount: schema.property(schema.decimal<Decimal>('string')),
  createdAt: schema.property(schema.instant<Temporal.Instant>()),
  displayName: schema.property(schema.string(), 'display_name'),
  periods: schema.property(schema.array(schema.duration<Temporal.Duration>())),
});

describe('typewriter serializer', () => {
  it('serializes rich values and maps model property names to wire names', () => {
    const id = uuidV4();
    const result = serializeJson<Invoice>(
      {
        id: parseUuid(id),
        amount: new Decimal('12345678901234567890.123456789'),
        createdAt: Temporal.Instant.from('2026-07-21T12:34:56.123456789Z'),
        displayName: 'Invoice 1',
        periods: [Temporal.Duration.from('PT1H30M')],
      },
      invoiceSchema,
    );

    expect(result).toEqual({
      id,
      amount: '12345678901234567890.123456789',
      createdAt: '2026-07-21T12:34:56.123456789Z',
      display_name: 'Invoice 1',
      periods: ['PT1H30M'],
    });
  });

  it('round-trips a generated-style registry reference', () => {
    const registry = defineTypeRegistry({
      'Contracts.Invoice': invoiceSchema,
    });
    const id = uuidV4();
    const wireValue = {
      id,
      amount: '42.75',
      createdAt: '2026-07-21T12:34:56Z',
      display_name: 'Invoice 2',
      periods: ['P1D'],
    };
    const expectedWireValue = structuredClone(wireValue);
    const hydrated = transformJson<Invoice>(
      wireValue,
      schema.reference<Invoice>('Contracts.Invoice'),
      registry,
    );

    const serialized = serializeJson(
      hydrated,
      schema.reference<Invoice>('Contracts.Invoice'),
      registry,
    );

    expect(serialized).toEqual(expectedWireValue);
  });

  it('supports custom serializers', () => {
    const serializeMoney = createJsonSerializer<{ amount: Decimal }>(
      schema.object({
        amount: schema.property(schema.custom<Decimal>('money')),
      }),
      undefined,
      {
        serializers: {
          money: (value) => (value as Decimal).toFixed(2),
        },
      },
    );

    expect(serializeMoney({ amount: new Decimal('12.5') })).toEqual({
      amount: '12.50',
    });
  });

  it('throws path-aware strict errors', () => {
    expect(() =>
      serializeJson<unknown>(
        { amount: 'not-a-decimal' },
        schema.object({
          amount: schema.property(schema.decimal<Decimal>('string')),
        }),
        undefined,
        { strict: true },
      ),
    ).toThrow(JsonSerializationError);
  });

  it('preserves circular object relationships without mutating the source', () => {
    interface Node {
      amount: Decimal;
      next: Node | null;
    }

    const nodeSchema = schema.object<Node>({
      amount: schema.property(schema.decimal<Decimal>('string')),
      next: schema.property(schema.nullable(schema.reference<Node>('Node'))),
    });
    const registry = defineTypeRegistry({ Node: nodeSchema });
    const value = { amount: new Decimal('1.5') } as Node;
    value.next = value;

    const result = serializeJson(
      value,
      schema.reference<Node>('Node'),
      registry,
    ) as { amount: string; next: unknown };

    expect(result).not.toBe(value);
    expect(result.amount).toBe('1.5');
    expect(result.next).toBe(result);
    expect(value.amount).toBeInstanceOf(Decimal);
  });

  it('uses the built-in Temporal backend by default for dates', () => {
    const result = serializeJson(
      Temporal.Instant.from('2026-07-21T12:34:56Z'),
      schema.instant<Temporal.Instant>(),
    );

    expect(result).toBe('2026-07-21T12:34:56Z');
  });

  it('uses a custom date backend when provided', () => {
    const customBackend: DateBackend = {
      name: 'custom',
      codecs: {
        instant: {
          is(value: unknown): value is string {
            return typeof value === 'string' && value.startsWith('T:');
          },
          parse(value: string) {
            return `T:${value}`;
          },
          serialize(value: string) {
            return value.slice(2);
          },
        },
      },
    };

    const result = serializeJson(
      'T:2026-07-21T12:34:56Z',
      schema.instant<string>(),
      undefined,
      { dateBackend: customBackend },
    );

    expect(result).toBe('2026-07-21T12:34:56Z');
  });

  it('preserves values for unsupported date kinds in tolerant mode', () => {
    const partialBackend: DateBackend = {
      name: 'partial',
      codecs: {
        instant: temporalDateBackend.codecs.instant,
      },
    };

    const result = serializeJson(
      '2024-01-02',
      schema.plainDate<string>(),
      undefined,
      { dateBackend: partialBackend },
    );

    expect(result).toBe('2024-01-02');
  });
});
