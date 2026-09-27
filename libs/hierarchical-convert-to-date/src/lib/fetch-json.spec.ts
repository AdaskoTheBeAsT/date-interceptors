import { isProblemDetailsError } from '@adaskothebeast/hierarchical-convert-core';

import { FetchJsonError, fetchJson } from '../index';

describe('fetchJson', () => {
  it('converts dates before returning JSON data', async () => {
    const customFetch = jest.fn(
      async () =>
        new Response(
          JSON.stringify({
            createdAt: '2026-07-21T12:34:56.000Z',
            nested: {
              updatedAt: '2026-07-22T08:00:00.000Z',
            },
          }),
          { status: 200 },
        ),
    );

    const result = await fetchJson<{
      createdAt: Date;
      nested: { updatedAt: Date };
    }>('/users/1', undefined, { fetch: customFetch });

    expect(result?.createdAt).toBeInstanceOf(Date);
    expect(result?.nested.updatedAt).toBeInstanceOf(Date);
    expect(customFetch).toHaveBeenCalledWith('/users/1', undefined);
  });

  it('forwards request initialization', async () => {
    const customFetch = jest.fn(
      async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    const init: RequestInit = { method: 'POST' };

    await fetchJson('/users', init, { fetch: customFetch });

    expect(customFetch).toHaveBeenCalledWith('/users', init);
  });

  it('returns undefined for empty successful responses', async () => {
    const customFetch = jest.fn(
      async () => new Response(null, { status: 204 }),
    );

    await expect(
      fetchJson<void>('/users/1', undefined, { fetch: customFetch }),
    ).resolves.toBeUndefined();
  });

  it('throws a typed error for unsuccessful responses', async () => {
    const customFetch = jest.fn(
      async () =>
        new Response('failure', {
          status: 503,
          statusText: 'Service Unavailable',
        }),
    );

    await expect(
      fetchJson('/users', undefined, { fetch: customFetch }),
    ).rejects.toMatchObject<Partial<FetchJsonError>>({
      name: 'FetchJsonError',
      status: 503,
      statusText: 'Service Unavailable',
    });
  });
});

describe('HTTP response contract', () => {
  it.each([204, 205, 200])(
    'returns undefined for an empty %s response',
    async (status) => {
      const customFetch = jest.fn(async () => new Response(null, { status }));
      await expect(
        fetchJson('/empty', undefined, { fetch: customFetch }),
      ).resolves.toBeUndefined();
    },
  );

  it('rejects a nonempty malformed JSON response', async () => {
    const customFetch = jest.fn(
      async () => new Response('<html>error</html>', { status: 200 }),
    );
    await expect(
      fetchJson('/empty', undefined, { fetch: customFetch }),
    ).rejects.toBeInstanceOf(SyntaxError);
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
    const error = await fetchJson('/empty', undefined, {
      fetch: customFetch,
    }).catch((failure: unknown) => failure);
    expect(error).toBeInstanceOf(FetchJsonError);
    const failure = error as FetchJsonError;
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
      const error = await fetchJson('/problem', undefined, {
        fetch: customFetch,
      }).catch((failure: unknown) => failure);
      expect(error).toBeInstanceOf(FetchJsonError);
      expect(isProblemDetailsError(error)).toBe(true);
      if (!(error instanceof FetchJsonError) || !isProblemDetailsError(error))
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
    const error = await fetchJson('/problem', undefined, {
      fetch: customFetch,
    }).catch((failure: unknown) => failure);
    expect(error).toBeInstanceOf(FetchJsonError);
    if (!(error instanceof FetchJsonError) || !isProblemDetailsError(error))
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
      fetchJson('/normal', undefined, { fetch: customFetch }),
    ).resolves.toEqual({ title: 'Report', status: 200 });
  });
});
