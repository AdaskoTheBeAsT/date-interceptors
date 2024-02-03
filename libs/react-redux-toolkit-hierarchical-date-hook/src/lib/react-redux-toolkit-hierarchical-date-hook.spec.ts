import { hierarchicalConvertToDate } from '@adaskothebeast/hierarchical-convert-to-date';
import { renderHook } from '@testing-library/react';

import { useAdjustUseQueryHookResultWithHierarchicalDateConverter } from './react-redux-toolkit-hierarchical-date-hook';

// A mock of your useQueryFunction
const useQueryFunctionMock = jest.fn();

class SampleInputResult {
  date: string;
  constructor(date: string) {
    this.date = date;
  }
}

class SampleExpectedResult {
  date: Date;
  constructor(date: Date) {
    this.date = date;
  }
}

const initialData: SampleInputResult = {
  date: '2023-07-22T15:36:00.000Z',
};

const expectedData: SampleExpectedResult = {
  date: new Date(Date.UTC(2023, 6, 22, 15, 36, 0, 0)),
};

describe('useGenericFunction', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return the same result if data does not exist', () => {
    // Arrange
    const mockRefetch = (): unknown => ({
      arg: {},
      requestId: '',
      abort: jest.fn(),
      unsubscribe: jest.fn(),
      promise: new Promise((resolve, reject) => {
        // noop
      }),
    });

    const initialResult = {
      // The structure of your useQueryFunction hook result without data
      data: initialData,
      isError: false,
      isLoading: false,
      isSuccess: true,
      isUninitialized: false,
      isFetching: false,
      refetch: mockRefetch,
      error: null,
      requestId: '',
    };

    const expectedResult = {
      // The structure of your useQueryFunction hook result without data
      data: expectedData,
      isError: false,
      isLoading: false,
      isSuccess: true,
      isUninitialized: false,
      isFetching: false,
      refetch: mockRefetch,
      error: null,
      requestId: '',
    };

    useQueryFunctionMock.mockReturnValue(initialResult);

    // Act
    const { result } = renderHook(() =>
      useAdjustUseQueryHookResultWithHierarchicalDateConverter(
        useQueryFunctionMock(),
        hierarchicalConvertToDate,
      ),
    );

    // Assert
    expect(result.current).toEqual(expectedResult);
  });
});
