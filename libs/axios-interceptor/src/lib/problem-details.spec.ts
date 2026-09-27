import { isProblemDetailsError } from '@adaskothebeast/hierarchical-convert-core';
import axios, { AxiosError } from 'axios';

import { AxiosInstanceManager } from '../index';

describe.each([false, true])(
  'legacy Axios Problem Details (multiple: %s)',
  (multiple) => {
    const problem = {
      title: 'Validation failed',
      status: 400,
      errors: { field: ['required'] },
      traceId: 'trace',
      timestamp: '2026-01-01T00:00:00Z',
    };
    it.each([
      [200, false],
      [422, false],
      [422, true],
      [500, false],
    ])(
      'preserves problems for HTTP %s (accept errors: %s)',
      async (status, acceptErrors) => {
        const convert = jest.fn();
        const instance = multiple
          ? AxiosInstanceManager.createInstanceWithMultipleInterceptors([
              convert,
            ])
          : AxiosInstanceManager.createInstance(convert);
        instance.defaults.validateStatus = acceptErrors
          ? () => true
          : (code) => code >= 200 && code < 300;
        instance.defaults.adapter = async (config) => {
          const response = {
            config,
            status,
            statusText: 'Response',
            headers: {
              'content-type': 'Application/Problem+Json; charset=utf-8',
            },
            data: JSON.stringify(problem),
          };
          if (status >= 400 && !acceptErrors)
            throw new AxiosError(
              'HTTP failure',
              'ERR_BAD_RESPONSE',
              config,
              undefined,
              response,
            );
          return response;
        };
        const error = await instance
          .get('/problem', {})
          .catch((failure: unknown) => failure);
        expect(axios.isAxiosError(error)).toBe(true);
        if (!axios.isAxiosError(error) || !isProblemDetailsError(error))
          throw new Error('Expected Problem Details');
        expect(error.httpStatus).toBe(status);
        expect(error.problem).toEqual({ ...problem, type: 'about:blank' });
        expect(error.body).toEqual(problem);
        expect(error.response?.data).toEqual(problem);
        expect(convert).not.toHaveBeenCalled();
      },
    );
    it('preserves network errors without classifying them as problems', async () => {
      const convert = jest.fn();
      const instance = multiple
        ? AxiosInstanceManager.createInstanceWithMultipleInterceptors([convert])
        : AxiosInstanceManager.createInstance(convert);
      const original = new AxiosError('Network failure', 'ERR_NETWORK');
      instance.defaults.adapter = async () => {
        throw original;
      };
      await expect(instance.get('/network')).rejects.toBe(original);
      expect(isProblemDetailsError(original)).toBe(false);
    });
  },
);
