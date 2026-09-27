import { isProblemDetailsError } from '@adaskothebeast/hierarchical-convert-core';
import {
  JsonSerializationError,
  JsonTransformationError,
} from '@adaskothebeast/typewriter-runtime';
import { defineTypeRegistry, schema } from '@adaskothebeast/typewriter-schema';
import Decimal from 'decimal.js';
import { parse as parseUuid, v4 as uuidV4 } from 'uuid';

import {
  TypewriterFetchError,
  TypewriterJsonParseError,
  fetchJson,
  sendJson,
  serializeJsonBody,
} from './typewriter-http-fetch';

const amountSchema = schema.object<{ amount: Decimal }>({
  amount: schema.property(schema.decimal<Decimal>('string')),
});

describe('strict defaults', () => {
  it('rejects invalid response values unless strictness is disabled', async () => {
    const customFetch = jest.fn(
      async () => new Response(JSON.stringify({ amount: 'invalid' })),
    );

    await expect(
      fetchJson('/amount', amountSchema, undefined, { fetch: customFetch }),
    ).rejects.toBeInstanceOf(JsonTransformationError);
    await expect(
      fetchJson('/amount', amountSchema, undefined, {
        fetch: customFetch,
        transformOptions: { strict: false },
      }),
    ).resolves.toEqual({ amount: 'invalid' });
  });

  it('rejects invalid request values unless strictness is disabled', () => {
    const invalid = { amount: 'invalid' } as unknown as { amount: Decimal };
    expect(() => serializeJsonBody(invalid, amountSchema)).toThrow(
      JsonSerializationError,
    );
    expect(
      serializeJsonBody(invalid, amountSchema, {
        serializeOptions: { strict: false },
      }),
    ).toBe('{"amount":"invalid"}');
  });
});

describe('sendJson', () => {
  it('serializes the body, sets JSON headers, and hydrates the response', async () => {
    const customFetch = jest.fn<
      ReturnType<typeof fetch>,
      Parameters<typeof fetch>
    >(
      async () =>
        new Response(JSON.stringify({ amount: '2.5' }), {
          headers: { 'content-type': 'application/json' },
        }),
    );

    const result = await sendJson(
      '/amount',
      { amount: new Decimal('1.5') },
      { requestSchema: amountSchema, responseSchema: amountSchema },
      undefined,
      { fetch: customFetch },
    );

    expect(result?.amount).toBeInstanceOf(Decimal);
    expect(result?.amount.toString()).toBe('2.5');
    const init = customFetch.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Headers;
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"amount":"1.5"}');
    expect(headers.get('content-type')).toBe('application/json');
    expect(headers.get('accept')).toBe(
      'application/json, application/problem+json',
    );
  });

  it('keeps caller headers, method, and direction-specific registries', async () => {
    const customFetch = jest.fn<
      ReturnType<typeof fetch>,
      Parameters<typeof fetch>
    >(async () => new Response(JSON.stringify({ amount: '3' })));
    const shared = defineTypeRegistry({ Amount: schema.unknown() });
    const typed = defineTypeRegistry({ Amount: amountSchema });

    const result = await sendJson(
      '/amount',
      { amount: new Decimal('4') },
      {
        requestSchema: schema.reference<{ amount: Decimal }>('Amount'),
        responseSchema: schema.reference<{ amount: Decimal }>('Amount'),
      },
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/vnd.api+json',
          Accept: 'application/vnd.api+json',
        },
      },
      {
        fetch: customFetch,
        registry: shared,
        requestRegistry: typed,
        responseRegistry: typed,
      },
    );

    expect(result?.amount).toBeInstanceOf(Decimal);
    const init = customFetch.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Headers;
    expect(init.method).toBe('PUT');
    expect(init.body).toBe('{"amount":"4"}');
    expect(headers.get('content-type')).toBe('application/vnd.api+json');
    expect(headers.get('accept')).toBe('application/vnd.api+json');
  });

  it('uses the method and headers of a Request input', async () => {
    const customFetch = jest.fn<
      ReturnType<typeof fetch>,
      Parameters<typeof fetch>
    >(async () => new Response(null, { status: 204 }));
    const request = new Request('http://localhost/amount', {
      method: 'PATCH',
      headers: { 'x-request-id': '42' },
    });

    await expect(
      sendJson(
        request,
        { amount: new Decimal('1') },
        { requestSchema: amountSchema, responseSchema: schema.unknown() },
        undefined,
        { fetch: customFetch, registry: defineTypeRegistry({}) },
      ),
    ).resolves.toBeUndefined();
    const init = customFetch.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Headers;
    expect(init.method).toBe('PATCH');
    expect(headers.get('x-request-id')).toBe('42');
    expect(headers.get('content-type')).toBe('application/json');
  });

  it('uses the global fetch by default', async () => {
    const spy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify('9.5')));

    const result = await sendJson('/amount', 'ignored', {
      requestSchema: schema.string(),
      responseSchema: schema.decimal<Decimal>('string'),
    });

    expect(result?.toString()).toBe('9.5');
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});

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

    expect(result?.amount.constructor.name).toBe('Decimal');
    expect(result?.amount.toString()).toBe('123.45');
  });

  it('uses a custom fetch implementation', async () => {
    const customFetch = jest.fn(
      async () => new Response(JSON.stringify('6.25'), { status: 200 }),
    );

    const result = await fetchJson<Decimal>(
      '/custom',
      schema.decimal<Decimal>('string'),
      undefined,
      { fetch: customFetch },
    );

    expect(result?.toString()).toBe('6.25');
    expect(customFetch).toHaveBeenCalledTimes(1);
  });

  it('forwards request initialization to fetch', async () => {
    const customFetch = jest.fn(
      async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    const init: RequestInit = {
      headers: { authorization: 'Bearer token' },
      method: 'POST',
    };

    await fetchJson('/items', schema.unknown(), init, { fetch: customFetch });

    expect(customFetch).toHaveBeenCalledWith('/items', init);
  });

  it('throws a typed error for non-ok responses', async () => {
    const customFetch = jest.fn(
      async () =>
        new Response('failure', {
          status: 503,
          statusText: 'Service Unavailable',
        }),
    );

    const result = fetchJson('/unavailable', schema.unknown(), undefined, {
      fetch: customFetch,
    });

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
    const customFetch = jest.fn(
      async () =>
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

describe('JSON request body contract', () => {
  it('rejects an absent root while retaining optional object properties', () => {
    expect(() =>
      serializeJsonBody(undefined, schema.optional(schema.string())),
    ).toThrow(TypeError);
    expect(
      serializeJsonBody(
        {},
        schema.object<{ name?: string }>({
          name: schema.property(schema.optional(schema.string())),
        }),
      ),
    ).toBe('{}');
  });

  it('distinguishes null and empty strings from an absent body', () => {
    expect(serializeJsonBody(null, schema.nullable(schema.string()))).toBe(
      'null',
    );
    expect(serializeJsonBody('', schema.string())).toBe('""');
  });
});

describe('HTTP response contract', () => {
  it.each([204, 205, 200])(
    'returns undefined for an empty %s response',
    async (status) => {
      const customFetch = jest.fn(async () => new Response(null, { status }));
      await expect(
        fetchJson('/empty', schema.unknown(), undefined, {
          fetch: customFetch,
        }),
      ).resolves.toBeUndefined();
    },
  );

  it('rejects a nonempty malformed JSON response with its response', async () => {
    const response = new Response('<html>error</html>', { status: 200 });
    const customFetch = jest.fn(async () => response);
    const error = await fetchJson('/empty', schema.unknown(), undefined, {
      fetch: customFetch,
    }).catch((failure: unknown) => failure);
    expect(error).toBeInstanceOf(TypewriterJsonParseError);
    expect(error).toBeInstanceOf(TypewriterFetchError);
    const failure = error as TypewriterJsonParseError;
    expect(failure.name).toBe('TypewriterJsonParseError');
    expect(failure.message).toBe('Response body is not valid JSON (HTTP 200)');
    expect(failure.response).toBe(response);
    expect(failure.status).toBe(200);
    expect(failure.body).toBe('<html>error</html>');
    expect(failure.cause).toBeInstanceOf(SyntaxError);
  });

  it('keeps the unconsumed HTTP error response available to callers', async () => {
    const response = new Response(
      JSON.stringify({ message: 'invalid input' }),
      {
        status: 422,
        headers: { 'content-type': 'application/json', 'x-request-id': '123' },
      },
    );
    const customFetch = jest.fn(async () => response);
    const error = await fetchJson('/empty', schema.unknown(), undefined, {
      fetch: customFetch,
    }).catch((failure: unknown) => failure);
    expect(error).toBeInstanceOf(TypewriterFetchError);
    const failure = error as TypewriterFetchError;
    expect(failure.response?.headers.get('x-request-id')).toBe('123');
    expect(failure.response?.bodyUsed).toBe(false);
    await expect(failure.response?.json()).resolves.toEqual({
      message: 'invalid input',
    });
  });
});

describe('Problem Details', () => {
  const problem = {
    type: '/problems/validation',
    title: 'Validation failed',
    status: 400,
    detail: 'Invalid request',
    instance: '/requests/123',
    errors: { createdAt: ['Invalid date'] },
    traceId: 'trace-123',
    createdAt: '2026-01-01T00:00:00Z',
  };

  it.each([200, 422, 500])(
    'rejects HTTP %s problem responses before success conversion',
    async (status) => {
      const response = new Response(JSON.stringify(problem), {
        status,
        headers: {
          'Content-Type': 'Application/Problem+Json; charset=utf-8',
          'x-request-id': '123',
        },
      });
      const customFetch = jest.fn(async () => response);
      const error = await fetchJson(
        '/problem',
        schema.object({ required: schema.property(schema.string()) }),
        undefined,
        { fetch: customFetch, transformOptions: { strict: true } },
      ).catch((failure: unknown) => failure);
      expect(error).toBeInstanceOf(TypewriterFetchError);
      expect(isProblemDetailsError(error)).toBe(true);
      if (
        !(error instanceof TypewriterFetchError) ||
        !isProblemDetailsError(error)
      )
        throw new Error('Expected Problem Details');
      expect(error.httpStatus).toBe(status);
      expect(error.problem).toEqual(problem);
      expect(error.body).toEqual(problem);
      const original = error.response;
      expect(original).toBe(response);
      expect(original?.bodyUsed).toBe(false);
      await expect(original?.json()).resolves.toEqual(problem);
    },
  );

  it.each([
    '<html>proxy failure</html>',
    '',
    'null',
    '[]',
    JSON.stringify(JSON.stringify({ title: 'not a problem object' })),
  ])('preserves malformed or non-object problem content %s', async (body) => {
    const customFetch = jest.fn(
      async () =>
        new Response(body, {
          status: 502,
          headers: { 'content-type': 'application/problem+json' },
        }),
    );
    const error = await fetchJson(
      '/problem',
      schema.object({ required: schema.property(schema.string()) }),
      undefined,
      { fetch: customFetch, transformOptions: { strict: true } },
    ).catch((failure: unknown) => failure);
    expect(error).toBeInstanceOf(TypewriterFetchError);
    if (
      !(error instanceof TypewriterFetchError) ||
      !isProblemDetailsError(error)
    )
      throw new Error('Expected Problem Details');
    expect(error.httpStatus).toBe(502);
    expect(error.problem).toBeUndefined();
  });

  it('does not classify a successful application/json payload by field names', async () => {
    const customFetch = jest.fn(
      async () =>
        new Response(JSON.stringify({ title: 'Report', status: 200 }), {
          headers: { 'content-type': 'application/json' },
        }),
    );
    await expect(
      fetchJson('/normal', schema.unknown(), undefined, { fetch: customFetch }),
    ).resolves.toEqual({ title: 'Report', status: 200 });
  });
});
