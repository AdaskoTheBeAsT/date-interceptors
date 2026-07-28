import {
  defineTypeRegistry,
  schema,
} from '@adaskothebeast/typewriter-schema';
import { JsonTransformationError } from '@adaskothebeast/typewriter-runtime';
import Decimal from 'decimal.js';
import { parse as parseUuid, v4 as uuidV4 } from 'uuid';

import {
  fetchJson,
  serializeJsonBody,
  TypewriterFetchError,
} from './typewriter-http-fetch';

describe('fetchJson', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('hydrates a successful JSON response', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ amount: '123.45' }), {
        status: 200,
        statusText: 'OK',
      }),
    );

    const result = await fetchJson<{ amount: Decimal }>(
      '/amount',
      schema.object({
        amount: schema.property(schema.decimal<Decimal>('string')),
      }),
    );

    expect(result.amount.constructor.name).toBe('Decimal');
    expect(result.amount.toString()).toBe('123.45');
  });

  it('uses a custom fetch implementation', async () => {
    const customFetch = jest.fn(async () =>
      new Response(JSON.stringify('6.25'), { status: 200 }),
    );

    const result = await fetchJson<Decimal>(
      '/custom',
      schema.decimal<Decimal>('string'),
      undefined,
      { fetch: customFetch },
    );

    expect(result.toString()).toBe('6.25');
    expect(customFetch).toHaveBeenCalledTimes(1);
  });

  it('forwards request initialization to fetch', async () => {
    const customFetch = jest.fn(async () =>
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    const init: RequestInit = {
      headers: { authorization: 'Bearer token' },
      method: 'POST',
    };

    await fetchJson(
      '/items',
      schema.unknown(),
      init,
      { fetch: customFetch },
    );

    expect(customFetch).toHaveBeenCalledWith('/items', init);
  });

  it('throws a typed error for non-ok responses', async () => {
    const customFetch = jest.fn(async () =>
      new Response('failure', {
        status: 503,
        statusText: 'Service Unavailable',
      }),
    );

    const result = fetchJson(
      '/unavailable',
      schema.unknown(),
      undefined,
      { fetch: customFetch },
    );

    await expect(result).rejects.toBeInstanceOf(TypewriterFetchError);
    await expect(result).rejects.toMatchObject({
      status: 503,
      statusText: 'Service Unavailable',
    });
  });

  it('serializes rich request values with generated wire names', () => {
    const id = uuidV4();
    const body = serializeJsonBody(
      {
        id: parseUuid(id),
        amount: new Decimal('123.45'),
        displayName: 'Invoice',
      },
      schema.object({
        id: schema.property(schema.uuid()),
        amount: schema.property(schema.decimal<Decimal>('string')),
        displayName: schema.property(schema.string(), 'display_name'),
      }),
    );

    expect(JSON.parse(body)).toEqual({
      id,
      amount: '123.45',
      display_name: 'Invoice',
    });
  });

  it('forwards registries and strict transformation options', async () => {
    const customFetch = jest.fn(async () =>
      new Response(JSON.stringify({ amount: 'invalid' }), { status: 200 }),
    );
    const registry = defineTypeRegistry({
      Invoice: schema.object<{ amount: Decimal }>({
        amount: schema.property(schema.decimal<Decimal>('string')),
      }),
    });

    await expect(
      fetchJson(
        '/invoice',
        schema.reference<{ amount: Decimal }>('Invoice'),
        undefined,
        {
          fetch: customFetch,
          registry,
          transformOptions: { strict: true },
        },
      ),
    ).rejects.toBeInstanceOf(JsonTransformationError);
  });
});
