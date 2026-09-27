import { isProblemDetailsError } from '@adaskothebeast/hierarchical-convert-core';
import type { BaseQueryFn } from '@reduxjs/toolkit/query';

import {
  createHierarchicalDateTransformResponse,
  withHierarchicalDateConversion,
} from './rtk-query-date-conversion';

describe('RTK Query Problem Details', () => {
  const body = {
    title: 'Validation failed',
    status: 400,
    errors: { field: ['required'] },
    traceId: 'trace',
    timestamp: '2026-01-01T00:00:00Z',
  };
  const meta = (status: number) => ({
    response: {
      status,
      headers: { 'Content-Type': 'Application/Problem+Json; charset=utf-8' },
    },
  });

  it.each([200, 422, 500])(
    'returns serializable errors for HTTP %s',
    async (status) => {
      const metadata = meta(status);
      const base: BaseQueryFn<
        string,
        unknown,
        unknown,
        object,
        ReturnType<typeof meta>
      > = jest.fn(async () =>
        status === 200
          ? { data: body, meta: metadata }
          : { error: { status, data: body }, meta: metadata },
      );
      const convert = jest.fn();
      const wrapped = withHierarchicalDateConversion(base, convert);
      const result = await wrapped(
        '/problem',
        {} as Parameters<typeof wrapped>[1],
        {},
      );
      expect(convert).not.toHaveBeenCalled();
      expect(result.data).toBeUndefined();
      expect(result.meta).toBe(metadata);
      expect(isProblemDetailsError(result.error)).toBe(true);
      expect(result.error).toEqual({
        status,
        data: body,
        body,
        problemDetails: true,
        httpStatus: status,
        problem: { ...body, type: 'about:blank' },
      });
      expect(JSON.parse(JSON.stringify(result.error))).toEqual(result.error);
    },
  );

  it('preserves malformed problem content when the base query reports a parsing error', async () => {
    const base: BaseQueryFn<
      string,
      unknown,
      unknown,
      object,
      ReturnType<typeof meta>
    > = jest.fn(async () => ({
      error: {
        status: 'PARSING_ERROR',
        originalStatus: 502,
        data: '<html>bad gateway</html>',
        error: 'SyntaxError',
      },
      meta: meta(502),
    }));
    const wrapped = withHierarchicalDateConversion(base, jest.fn());
    const result = await wrapped(
      '/problem',
      {} as Parameters<typeof wrapped>[1],
      {},
    );
    expect(result.error).toMatchObject({
      status: 'PARSING_ERROR',
      httpStatus: 502,
      body: '<html>bad gateway</html>',
      problem: undefined,
      originalStatus: 502,
    });
  });

  it('endpoint transforms return problem documents unconverted instead of throwing', () => {
    const convert = jest.fn();
    const transform = createHierarchicalDateTransformResponse(convert);
    expect(transform(body, meta(200))).toBe(body);
    expect(convert).not.toHaveBeenCalled();
  });

  it('wraps primitive error values from custom base queries', async () => {
    const base: BaseQueryFn<
      string,
      unknown,
      string,
      object,
      ReturnType<typeof meta>
    > = jest.fn(async () => ({ error: 'raw failure', meta: meta(500) }));
    const wrapped = withHierarchicalDateConversion(base, jest.fn());
    const result = await wrapped(
      '/problem',
      {} as Parameters<typeof wrapped>[1],
      {},
    );
    expect(result.error).toEqual({
      status: 500,
      data: 'raw failure',
      body: 'raw failure',
      problemDetails: true,
      httpStatus: 500,
      problem: undefined,
    });
  });

  it('does not infer problem details from success payload field names', async () => {
    const base: BaseQueryFn<string, unknown, unknown> = jest.fn(async () => ({
      data: body,
    }));
    const convert = jest.fn();
    const wrapped = withHierarchicalDateConversion(base, convert);
    const result = await wrapped(
      '/ordinary',
      {} as Parameters<typeof wrapped>[1],
      {},
    );
    expect(result.error).toBeUndefined();
    expect(convert).toHaveBeenCalledTimes(1);
  });
});
