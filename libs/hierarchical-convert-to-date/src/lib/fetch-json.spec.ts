import {
  FetchJsonError,
  fetchJson,
} from './fetch-json';

describe('fetchJson', () => {
  it('converts dates before returning JSON data', async () => {
    const customFetch = jest.fn(async () =>
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

    expect(result.createdAt).toBeInstanceOf(Date);
    expect(result.nested.updatedAt).toBeInstanceOf(Date);
    expect(customFetch).toHaveBeenCalledWith('/users/1', undefined);
  });

  it('forwards request initialization', async () => {
    const customFetch = jest.fn(async () =>
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    const init: RequestInit = { method: 'POST' };

    await fetchJson('/users', init, { fetch: customFetch });

    expect(customFetch).toHaveBeenCalledWith('/users', init);
  });

  it('returns undefined for empty successful responses', async () => {
    const customFetch = jest.fn(async () =>
      new Response(null, { status: 204 }),
    );

    await expect(
      fetchJson<void>('/users/1', undefined, { fetch: customFetch }),
    ).resolves.toBeUndefined();
  });

  it('throws a typed error for unsuccessful responses', async () => {
    const customFetch = jest.fn(async () =>
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
