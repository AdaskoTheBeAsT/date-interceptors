import { hierarchicalConvertToLuxon } from '@adaskothebeast/hierarchical-convert-to-luxon';
import axios from 'axios';
import * as MockAdapter from 'axios-mock-adapter';
import { DateTime } from 'luxon';

import { AxiosInstanceManager } from './axios-instance-manager';

describe('AxiosInstanceManager integration', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    // Create a new instance of axios-mock-adapter for each test
    mock = new MockAdapter(axios);
  });

  afterEach(() => {
    // Restore the original axios instance after each test
    mock.restore();
  });

  it('should call convertToDateFunc with response data', async () => {
    const responseData = { date: '2024-01-05T20:42:33.719+01:00' };

    // Mock any GET request to return the test data
    mock.onGet().reply(200, responseData);

    const convertToDateFunc = jest.fn();
    const instance = AxiosInstanceManager.createInstance(convertToDateFunc);

    // Perform a GET request to trigger the interceptor
    await instance.get('/test');

    expect(convertToDateFunc).toHaveBeenCalledWith(responseData);
  });

  it('handles errors in the response interceptor', async () => {
    // Mock a GET request to return an error
    mock.onGet().networkError();

    const convertToDateFunc = jest.fn();
    const instance = AxiosInstanceManager.createInstance(convertToDateFunc);

    await expect(instance.get('/test')).rejects.toThrow('Network Error');
  });

  it('should convert date strings to Luxon DateTime objects in the response', async () => {
    const responseData = { date: '2024-01-05T20:42:33.719+01:00' };

    // Mock any GET request to return the test data
    mock.onGet().reply(200, responseData);

    const instance = AxiosInstanceManager.createInstance(
      hierarchicalConvertToLuxon,
    );

    const response = await instance.get('/test');

    expect(response.data.date).toBeInstanceOf(DateTime);
    expect(new Date(response.data.date.toISO())).toEqual(
      new Date(responseData.date),
    );
  });
});
