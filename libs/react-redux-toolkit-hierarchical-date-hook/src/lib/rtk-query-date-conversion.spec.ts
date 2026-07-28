import { hierarchicalConvertToDate } from '@adaskothebeast/hierarchical-convert-to-date';
import type { BaseQueryFn } from '@reduxjs/toolkit/query';

import {
  createHierarchicalDateTransformResponse,
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

    expect('data' in result && result.data.createdAt).toBeInstanceOf(Date);
    expect(raw.createdAt).toBe('2026-07-21T12:34:56.000Z');
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
