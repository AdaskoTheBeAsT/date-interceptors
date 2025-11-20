import axios from 'axios';

import { AxiosInstanceManager } from './axios-instance-manager';

jest.mock('axios');

describe('AxiosInstanceManager', () => {
  let mockResponseUse: jest.Mock;
  let mockCreate: jest.Mock;

  beforeEach(() => {
    mockResponseUse = jest.fn();
    mockCreate = jest.fn().mockImplementation(() => ({
      interceptors: {
        response: { use: mockResponseUse },
      },
    }));
    (axios.create as jest.Mock) = mockCreate;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should create a new Axios instance with single interceptor', () => {
    const convertToDateFunc = jest.fn();
    AxiosInstanceManager.createInstance(convertToDateFunc);

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockResponseUse).toHaveBeenCalledTimes(1);
  });

  it('should create a new Axios instance with multiple interceptors', () => {
    const convertToDateFunc = jest.fn();
    AxiosInstanceManager.createInstanceWithMultipleInterceptors([
      convertToDateFunc,
    ]);

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockResponseUse).toHaveBeenCalledTimes(1);
  });

  it('should create different instances on multiple calls', () => {
    const convertToDateFunc = jest.fn();
    const firstInstance =
      AxiosInstanceManager.createInstance(convertToDateFunc);
    const secondInstance =
      AxiosInstanceManager.createInstance(convertToDateFunc);

    expect(firstInstance).not.toBe(secondInstance);
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it('should allow creating instances with different interceptor functions', () => {
    const convertFunc1 = jest.fn();
    const convertFunc2 = jest.fn();
    
    const instance1 = AxiosInstanceManager.createInstance(convertFunc1);
    const instance2 = AxiosInstanceManager.createInstance(convertFunc2);

    expect(instance1).not.toBe(instance2);
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it('should not call interceptor function when response data is null', () => {
    const convertFunc = jest.fn();
    AxiosInstanceManager.createInstance(convertFunc);

    // Get the response interceptor handler
    const responseInterceptor = mockResponseUse.mock.calls[0][0];

    // Simulate response with null data
    const response = { data: null, status: 200 };
    responseInterceptor(response);

    expect(convertFunc).not.toHaveBeenCalled();
  });

  it('should call interceptor function when response data is present', () => {
    const convertFunc = jest.fn();
    AxiosInstanceManager.createInstance(convertFunc);

    // Get the response interceptor handler
    const responseInterceptor = mockResponseUse.mock.calls[0][0];

    // Simulate response with data
    const responseData = { date: '2023-01-01T00:00:00.000Z' };
    const response = { data: responseData, status: 200 };
    responseInterceptor(response);

    expect(convertFunc).toHaveBeenCalledWith(responseData);
    expect(convertFunc).toHaveBeenCalledTimes(1);
  });

  it('should call multiple interceptors in order', () => {
    const interceptor1 = jest.fn();
    const interceptor2 = jest.fn();
    const interceptor3 = jest.fn();
    
    AxiosInstanceManager.createInstanceWithMultipleInterceptors([
      interceptor1,
      interceptor2,
      interceptor3,
    ]);

    // Get the response interceptor handler
    const responseInterceptor = mockResponseUse.mock.calls[0][0];

    // Simulate response with data
    const responseData = { date: '2023-01-01T00:00:00.000Z' };
    const response = { data: responseData, status: 200 };
    responseInterceptor(response);

    expect(interceptor1).toHaveBeenCalledWith(responseData);
    expect(interceptor2).toHaveBeenCalledWith(responseData);
    expect(interceptor3).toHaveBeenCalledWith(responseData);
    
    // Verify order of execution
    const order = [
      interceptor1.mock.invocationCallOrder[0],
      interceptor2.mock.invocationCallOrder[0],
      interceptor3.mock.invocationCallOrder[0],
    ];
    expect(order[0]).toBeLessThan(order[1]);
    expect(order[1]).toBeLessThan(order[2]);
  });

  it('should handle errors and reject the promise', () => {
    const convertFunc = jest.fn();
    AxiosInstanceManager.createInstance(convertFunc);

    // Get the error interceptor handler
    const errorInterceptor = mockResponseUse.mock.calls[0][1];

    const error = new Error('Network error');
    const result = errorInterceptor(error);

    expect(result).rejects.toBe(error);
    expect(convertFunc).not.toHaveBeenCalled();
  });
});
