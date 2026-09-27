import { hierarchicalConvertToLuxon } from '@adaskothebeast/hierarchical-convert-to-luxon';
import { DateTime } from 'luxon';

import { AxiosInstanceManager } from '../index';

describe('AxiosInstanceManager integration', () => {
  it('should call convertToDateFunc with response data', async () => {
    const responseData = { date: '2024-01-05T20:42:33.719+01:00' };

    const convertToDateFunc = jest.fn();
    const instance = AxiosInstanceManager.createInstance(convertToDateFunc);

    // Perform a GET request to trigger the interceptor
    instance.defaults.adapter = async (config) => ({
      data: responseData,
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    });
    await instance.get('/test');

    expect(convertToDateFunc).toHaveBeenCalledWith(responseData);
  });

  it('handles errors in the response interceptor', async () => {
    const convertToDateFunc = jest.fn();
    const instance = AxiosInstanceManager.createInstance(convertToDateFunc);

    instance.defaults.adapter = async () => {
      throw new Error('Network Error');
    };
    await expect(instance.get('/test')).rejects.toThrow('Network Error');
  });

  it('should convert date strings to Luxon DateTime objects in the response', async () => {
    const responseData = { date: '2024-01-05T20:42:33.719+01:00' };

    const instance = AxiosInstanceManager.createInstance(
      hierarchicalConvertToLuxon,
    );

    instance.defaults.adapter = async (config) => ({
      data: responseData,
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    });
    const response = await instance.get('/test');

    expect(response.data.date).toBeInstanceOf(DateTime);
    expect(new Date(response.data.date.toISO())).toEqual(
      new Date(responseData.date),
    );
  });
});
