import { hierarchicalConvertToDate } from '@adaskothebeast/hierarchical-convert-to-date';
import { renderHook } from '@testing-library/react';

import { useAdjustUseQueryHookResultWithHierarchicalDateConverter as useConverted } from './react-redux-toolkit-hierarchical-date-hook';

describe('memoized query conversion', () => {
  const raw = { date: '2026-01-01T00:00:00Z' };

  it('keeps converted data stable across query status updates', () => {
    const convert = jest.fn(hierarchicalConvertToDate);
    const refetch = jest.fn(() => Promise.resolve('refetched'));
    const { result, rerender } = renderHook(
      ({ isFetching }) =>
        useConverted({ data: raw, isFetching, refetch }, convert),
      { initialProps: { isFetching: false } },
    );
    const data = result.current.data;
    rerender({ isFetching: true });
    expect(result.current.data).toBe(data);
    expect(result.current.isFetching).toBe(true);
    expect(result.current.refetch).toBe(refetch);
    expect(convert).toHaveBeenCalledTimes(1);
    expect(raw.date).toBe('2026-01-01T00:00:00Z');
  });

  it('reconverts when data or converter changes', () => {
    const convert = jest.fn(hierarchicalConvertToDate);
    const { result, rerender } = renderHook(
      (props) => useConverted({ data: props.data }, props.convert),
      { initialProps: { data: raw, convert } },
    );
    const first = result.current.data;
    rerender({ data: { ...raw }, convert });
    expect(result.current.data).not.toBe(first);
    expect(convert).toHaveBeenCalledTimes(2);
    const nextConvert = jest.fn(hierarchicalConvertToDate);
    rerender({ data: raw, convert: nextConvert });
    expect(nextConvert).toHaveBeenCalledTimes(1);
  });

  it('preserves structured errors and handles data appearing after an error', () => {
    const error = { status: 500, data: { message: 'failed' } };
    const { result, rerender } = renderHook(
      ({ data }: { data?: typeof raw }) =>
        useConverted(
          { data, error, requestId: '123' },
          hierarchicalConvertToDate,
        ),
      { initialProps: {} },
    );
    expect(result.current.error).toBe(error);
    expect(result.current.requestId).toBe('123');
    expect(result.current.data).toBeUndefined();
    rerender({ data: raw });
    expect(result.current.data?.date).toBeInstanceOf(Date);
  });

  it('infers a returned model type while preserving query methods', async () => {
    const query = { data: raw, refetch: () => Promise.resolve('done') };
    const { result } = renderHook(() =>
      useConverted(query, () => ({ date: new Date(raw.date) })),
    );
    // These expressions must also compile against the inferred result type.
    expect(result.current.data.date.getUTCFullYear()).toBe(2026);
    await expect(result.current.refetch()).resolves.toBe('done');
  });

  it('converts currentData and reuses the converted data when both share a reference', () => {
    const convert = jest.fn(hierarchicalConvertToDate);
    const { result } = renderHook(() =>
      useConverted({ data: raw, currentData: raw }, convert),
    );
    expect(result.current.currentData?.date).toBeInstanceOf(Date);
    expect(result.current.currentData).toBe(result.current.data);
    expect(convert).toHaveBeenCalledTimes(1);
  });

  it('converts currentData separately while a new argument is loading', () => {
    const convert = jest.fn(hierarchicalConvertToDate);
    const previous = { date: '2025-01-01T00:00:00Z' };
    type Props = { data?: typeof raw; currentData?: typeof raw };
    const initialProps: Props = { data: previous, currentData: undefined };
    const { result, rerender } = renderHook(
      (props: Props) => useConverted(props, convert),
      { initialProps },
    );
    expect(result.current.data?.date).toBeInstanceOf(Date);
    expect(result.current.currentData).toBeUndefined();
    rerender({ data: previous, currentData: raw });
    expect(result.current.currentData?.date).toEqual(new Date(raw.date));
    expect(result.current.currentData).not.toBe(result.current.data);
    expect(convert).toHaveBeenCalledTimes(2);
  });

  it('infers the returned model type for currentData', () => {
    const query = { data: raw, currentData: raw };
    const { result } = renderHook(() =>
      useConverted(query, () => ({ date: new Date(raw.date) })),
    );
    expect(result.current.currentData.date.getUTCFullYear()).toBe(2026);
  });

  it.each([null, undefined, false, 0, ''])(
    'preserves primitive data %s without calling an object converter',
    (data) => {
      const convert = jest.fn(hierarchicalConvertToDate);
      const query = { data };
      const { result } = renderHook(() => useConverted(query, convert));
      expect(result.current).toBe(query);
      expect(convert).not.toHaveBeenCalled();
    },
  );
});
