/**
 * @jest-environment node
 *
 * fetchBaseQuery needs the Fetch API globals (Request, Response), which jsdom lacks.
 */

import { isProblemDetailsError } from '@adaskothebeast/hierarchical-convert-core';
import { hierarchicalConvertToDate } from '@adaskothebeast/hierarchical-convert-to-date';
import { configureStore } from '@reduxjs/toolkit';
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query';

import {
  createHierarchicalDateTransformResponse,
  hierarchicalDateSerializableCheck,
  withHierarchicalDateConversion,
} from './rtk-query-date-conversion';

interface User {
  name: string;
  createdAt: Date;
}

const problem = { title: 'Validation failed', status: 422, traceId: 'trace' };
const user = { name: 'Ada', createdAt: '2026-07-21T12:34:56.000Z' };

function reply(status: number, contentType: string, body: unknown) {
  return jest.fn(
    async () =>
      new Response(typeof body === 'string' ? body : JSON.stringify(body), {
        status,
        headers: { 'Content-Type': contentType },
      }),
  );
}

type Setup = {
  fetchFn: ReturnType<typeof reply>;
  mode: 'baseQuery' | 'transformResponse' | 'none';
  serializableCheck?: ReturnType<typeof hierarchicalDateSerializableCheck>;
};

function createStore({ fetchFn, mode, serializableCheck }: Setup) {
  const rawBaseQuery = fetchBaseQuery({
    baseUrl: 'https://example.test',
    fetchFn,
  });
  const convertingBaseQuery = withHierarchicalDateConversion(
    rawBaseQuery,
    hierarchicalConvertToDate,
  );
  const baseQuery: typeof convertingBaseQuery =
    mode === 'baseQuery' ? convertingBaseQuery : rawBaseQuery;
  const api = createApi({
    reducerPath: 'usersApi',
    baseQuery,
    endpoints: (build) => ({
      getUser: build.query<User, void>({
        query: () => '/user',
        transformResponse:
          mode === 'transformResponse'
            ? createHierarchicalDateTransformResponse<User>(
                hierarchicalConvertToDate,
              )
            : undefined,
      }),
      renameUser: build.mutation<User, string>({
        query: (name) => ({ url: '/user', method: 'PUT', body: { name } }),
      }),
    }),
  });
  const store = configureStore({
    reducer: { [api.reducerPath]: api.reducer },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware(
        serializableCheck === undefined ? undefined : { serializableCheck },
      ).concat(api.middleware),
  });
  return { api, store };
}

function nonSerializableWarnings(spy: jest.SpyInstance): unknown[][] {
  return spy.mock.calls.filter((call) =>
    String(call[0]).includes('non-serializable'),
  );
}

describe('RTK Query store integration', () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => consoleError.mockRestore());

  describe('Problem Details', () => {
    it.each([200, 422])(
      'keeps httpStatus/problem on the cached error through the base query wrapper (HTTP %s)',
      async (status) => {
        const { api, store } = createStore({
          fetchFn: reply(status, 'application/problem+json', problem),
          mode: 'baseQuery',
        });
        const result = await store.dispatch(api.endpoints.getUser.initiate());
        expect(result.data).toBeUndefined();
        expect(isProblemDetailsError(result.error)).toBe(true);
        expect(result.error).toMatchObject({
          status,
          httpStatus: status,
          problem: { ...problem, type: 'about:blank' },
          body: problem,
        });
        expect(nonSerializableWarnings(consoleError)).toEqual([]);
      },
    );

    it('keeps the PARSING_ERROR discriminant for malformed problem bodies', async () => {
      const { api, store } = createStore({
        fetchFn: reply(
          502,
          'application/problem+json',
          '<html>bad gateway</html>',
        ),
        mode: 'baseQuery',
      });
      const result = await store.dispatch(api.endpoints.getUser.initiate());
      expect(result.error).toMatchObject({
        status: 'PARSING_ERROR',
        originalStatus: 502,
        httpStatus: 502,
        problem: undefined,
        body: '<html>bad gateway</html>',
      });
    });

    it('does not throw from transformResponse, so RTK Query never reports an unhandled error', async () => {
      const { api, store } = createStore({
        fetchFn: reply(200, 'application/problem+json', problem),
        mode: 'transformResponse',
      });
      const result = await store.dispatch(api.endpoints.getUser.initiate());
      expect(result.error).toBeUndefined();
      expect(result.data).toEqual(problem);
      expect(
        consoleError.mock.calls.some((call) =>
          String(call[0]).includes('unhandled error'),
        ),
      ).toBe(false);
    });
  });

  describe('serializable check', () => {
    it('warns about Dates stored by the base query wrapper with default middleware', async () => {
      const { api, store } = createStore({
        fetchFn: reply(200, 'application/json', user),
        mode: 'baseQuery',
      });
      const result = await store.dispatch(api.endpoints.getUser.initiate());
      expect(result.data?.createdAt).toBeInstanceOf(Date);
      expect(nonSerializableWarnings(consoleError).length).toBeGreaterThan(0);
    });

    it.each(['baseQuery', 'transformResponse'] as const)(
      'is silenced by hierarchicalDateSerializableCheck (%s)',
      async (mode) => {
        const { api, store } = createStore({
          fetchFn: reply(200, 'application/json', user),
          mode,
          serializableCheck: hierarchicalDateSerializableCheck('usersApi'),
        });
        const query = await store.dispatch(api.endpoints.getUser.initiate());
        expect(query.data?.createdAt).toBeInstanceOf(Date);
        const mutation = await store.dispatch(
          api.endpoints.renameUser.initiate('Ada'),
        );
        expect('data' in mutation).toBe(true);
        store.dispatch(
          api.util.upsertQueryEntries([
            {
              endpointName: 'getUser',
              arg: undefined,
              value: { name: 'Bob', createdAt: new Date() },
            },
          ]),
        );
        store.dispatch(
          api.util.updateQueryData('getUser', undefined, (draft) => {
            draft.createdAt = new Date();
          }),
        );
        expect(nonSerializableWarnings(consoleError)).toEqual([]);
      },
    );

    it('keeps the store serializable when conversion is left to the hook', async () => {
      const { api, store } = createStore({
        fetchFn: reply(200, 'application/json', user),
        mode: 'none',
      });
      const result = await store.dispatch(api.endpoints.getUser.initiate());
      expect(result.data).toEqual(user);
      expect(nonSerializableWarnings(consoleError)).toEqual([]);
    });
  });
});
