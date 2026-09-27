import { hierarchicalConvertToDate } from '@adaskothebeast/hierarchical-convert-to-date';
import type { BaseQueryFn } from '@reduxjs/toolkit/query';

import {
  createHierarchicalDateTransformResponse,
  hierarchicalDateSerializableCheck,
  withHierarchicalDateConversion,
} from './rtk-query-date-conversion';

interface User {
  createdAt: Date;
}

describe('RTK Query date conversion', () => {
  it('creates an endpoint transformResponse converter', () => {
    const raw = { createdAt: '2026-07-21T12:34:56.000Z' };
    const transformResponse = createHierarchicalDateTransformResponse<User>(
      hierarchicalConvertToDate,
    );

    const result = transformResponse(raw as unknown as User);

    expect(result.createdAt).toBeInstanceOf(Date);
    expect(raw.createdAt).toBe('2026-07-21T12:34:56.000Z');
  });

  it('converts successful base query data before it reaches the cache', async () => {
    const raw = { createdAt: '2026-07-21T12:34:56.000Z' };
    const baseQuery: BaseQueryFn<string, User, string> = jest.fn(async () => ({
      data: raw as unknown as User,
    }));
    const convertedBaseQuery = withHierarchicalDateConversion(
      baseQuery,
      hierarchicalConvertToDate,
    );

    const result = await convertedBaseQuery(
      '/users/1',
      {} as Parameters<typeof convertedBaseQuery>[1],
      {},
    );

    // Freshly parsed base query data is not shared or frozen yet, so it is
    // converted in place instead of being cloned.
    expect('data' in result && result.data).toBe(raw);
    expect(raw.createdAt).toBeInstanceOf(Date);
  });

  it('leaves primitive base query data untouched', async () => {
    const baseQuery: BaseQueryFn<string, string, string> = jest.fn(
      async () => ({
        data: 'plain',
      }),
    );
    const convert = jest.fn();
    const result = await withHierarchicalDateConversion(baseQuery, convert)(
      '/text',
      {} as Parameters<BaseQueryFn>[1],
      {},
    );
    expect(result).toEqual({ data: 'plain' });
    expect(convert).not.toHaveBeenCalled();
  });

  it('returns primitive transformResponse values without cloning', () => {
    const convert = jest.fn();
    expect(createHierarchicalDateTransformResponse<string>(convert)('x')).toBe(
      'x',
    );
    expect(convert).not.toHaveBeenCalled();
  });

  it('defaults hierarchicalDateSerializableCheck to the "api" reducer path and accepts several', () => {
    expect(hierarchicalDateSerializableCheck().ignoredPaths).toEqual([
      'api.queries',
      'api.mutations',
    ]);
    const check = hierarchicalDateSerializableCheck(['a', 'b']);
    expect(check.ignoredPaths).toEqual([
      'a.queries',
      'a.mutations',
      'b.queries',
      'b.mutations',
    ]);
    expect(check.ignoredActions).toContain('b/executeQuery/fulfilled');
  });

  it('preserves base query errors', async () => {
    const expected = { status: 503 };
    const baseQuery: BaseQueryFn<string, User, { status: number }> = jest.fn(
      async () => ({ error: expected }),
    );
    const convertedBaseQuery = withHierarchicalDateConversion(
      baseQuery,
      hierarchicalConvertToDate,
    );

    const result = await convertedBaseQuery(
      '/users/1',
      {} as Parameters<typeof convertedBaseQuery>[1],
      {},
    );

    expect(result).toEqual({ error: expected });
  });
});
