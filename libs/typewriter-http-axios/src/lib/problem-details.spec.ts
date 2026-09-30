import { isProblemDetailsError } from '@adaskothebeast/hierarchical-convert-core';
import { schema } from '@adaskothebeast/typewriter-schema';
import axios, { AxiosError } from 'axios';
import type { AxiosAdapter } from 'axios';

import { rejectProblemDetails } from './problem-details';
import { installTypewriterAxiosInterceptor } from './typewriter-http-axios';

it('rejects with the original non-Axios error without throwing synchronously', async () => {
  const original = new Error('Unexpected failure');
  const rejection = rejectProblemDetails(original);
  await expect(rejection).rejects.toBe(original);
});

describe('schema Axios Problem Details', () => {
  const problem = {
    title: 'Validation failed',
    status: 400,
    errors: { field: ['required'] },
    traceId: 'trace',
    timestamp: '2026-01-01T00:00:00Z',
  };
  // The root custom schema routes every conversion through `convert`.
  const probe = (convert: jest.Mock) => ({
    responseSchema: schema.custom('probe'),
    responseTransformOptions: { customTransformers: { probe: convert } },
  });
  const respondWith =
    (status: number, contentType: string, data: unknown): AxiosAdapter =>
    async (config) => ({
      config,
      status,
      statusText: 'Response',
      headers: { 'content-type': contentType },
      data,
    });

  it('runs the wired converter for ordinary JSON responses', async () => {
    const convert = jest.fn((value: unknown) => value);
    const instance = axios.create();
    installTypewriterAxiosInterceptor(instance);
    instance.defaults.adapter = respondWith(200, 'application/json', {
      ok: true,
    });
    const response = await instance.get('/ok', probe(convert));
    expect(convert).toHaveBeenCalledTimes(1);
    expect(convert.mock.calls[0][0]).toEqual({ ok: true });
    expect(response.data).toEqual({ ok: true });
  });

  it.each([
    [200, false],
    [422, false],
    [422, true],
    [500, false],
  ])(
    'preserves problems for HTTP %s (accept errors: %s)',
    async (status, acceptErrors) => {
      const convert = jest.fn((value: unknown) => value);
      const instance = axios.create();
      installTypewriterAxiosInterceptor(instance);
      instance.defaults.validateStatus = acceptErrors
        ? () => true
        : (code) => code >= 200 && code < 300;
      instance.defaults.adapter = async (config) => {
        const response = await respondWith(
          status,
          'Application/Problem+Json; charset=utf-8',
          JSON.stringify(problem),
        )(config);
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
        .get('/problem', probe(convert))
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
    const convert = jest.fn((value: unknown) => value);
    const instance = axios.create();
    installTypewriterAxiosInterceptor(instance);
    const original = new AxiosError('Network failure', 'ERR_NETWORK');
    instance.defaults.adapter = async () => {
      throw original;
    };
    await expect(instance.get('/network', probe(convert))).rejects.toBe(
      original,
    );
    expect(isProblemDetailsError(original)).toBe(false);
    expect(convert).not.toHaveBeenCalled();
  });
});
