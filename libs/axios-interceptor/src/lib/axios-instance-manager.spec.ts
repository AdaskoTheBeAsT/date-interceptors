import axios from 'axios';

import { AxiosInstanceManager } from './axios-instance-manager';

jest.mock('axios');

describe('AxiosInstanceManager', () => {
  it('should create a new Axios instance if none is cached', () => {
    // Mock implementation for axios.create
    const mockCreate = jest.fn().mockImplementation(() => ({
      interceptors: {
        response: { use: jest.fn() },
      },
    }));
    (axios.create as jest.Mock) = mockCreate;

    const convertToDateFunc = jest.fn();
    AxiosInstanceManager.resetInstance();
    AxiosInstanceManager.createInstance(convertToDateFunc);

    expect(mockCreate).toHaveBeenCalled();
  });

  it('should create a new Axios instance if none is cached by using array of interceptors', () => {
    // Mock implementation for axios.create
    const mockCreate = jest.fn().mockImplementation(() => ({
      interceptors: {
        response: { use: jest.fn() },
      },
    }));
    (axios.create as jest.Mock) = mockCreate;

    const convertToDateFunc = jest.fn();
    AxiosInstanceManager.resetInstance();
    AxiosInstanceManager.createInstanceWithMultipleInterceptors([
      convertToDateFunc,
    ]);

    expect(mockCreate).toHaveBeenCalled();
  });

  it('should return the cached instance if already created', () => {
    const convertToDateFunc = jest.fn();
    AxiosInstanceManager.resetInstance();
    const firstInstance =
      AxiosInstanceManager.createInstance(convertToDateFunc);
    const secondInstance =
      AxiosInstanceManager.createInstance(convertToDateFunc);

    expect(firstInstance).toBe(secondInstance);
  });
});
