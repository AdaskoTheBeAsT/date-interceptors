import {
  JsonSerializationError,
  JsonTransformationError,
} from '@adaskothebeast/typewriter-runtime';
import { defineTypeRegistry, schema } from '@adaskothebeast/typewriter-schema';
import axios, { AxiosError } from 'axios';
import type { AxiosAdapter, AxiosInstance, AxiosRequestConfig } from 'axios';
import Decimal from 'decimal.js';
import { parse as parseUuid, v4 as uuidV4 } from 'uuid';

import {
  ejectTypewriterAxiosInterceptor,
  ejectTypewriterAxiosRequestInterceptor,
  installTypewriterAxiosInterceptor,
  installTypewriterAxiosRequestInterceptor,
  requestWithResponseSchema,
  requestWithSchema,
  requestWithSchemas,
} from './typewriter-http-axios';

interface RawResponse {
  readonly data: unknown;
  readonly status?: number;
  readonly headers?: Record<string, string>;
}

function createRawInstance(
  raw: RawResponse,
  onRequest?: (config: AxiosRequestConfig) => void,
): AxiosInstance {
  const adapter: AxiosAdapter = async (config) => {
    onRequest?.(config);
    return {
      config,
      data: raw.data,
      headers: raw.headers ?? { 'content-type': 'application/json' },
      status: raw.status ?? 200,
      statusText: 'OK',
    };
  };
  const instance = axios.create({ adapter });
  installTypewriterAxiosRequestInterceptor(instance);
  installTypewriterAxiosInterceptor(instance);
  return instance;
}

function createInstance(value: unknown): AxiosInstance {
  return createRawInstance({ data: JSON.stringify(value) });
}

const amountSchema = schema.object<{ amount: Decimal }>({
  amount: schema.property(schema.decimal<Decimal>('string')),
});

describe('typewriter Axios interceptor', () => {
  it('replaces a root scalar with its transformed value', async () => {
    const instance = createInstance('123.45');

    const response = await instance.get('/amount', {
      typewriter: { responseSchema: schema.decimal('string') },
    });

    expect(response.data.constructor.name).toBe('Decimal');
    expect(response.data.toString()).toBe('123.45');
  });

  it('transforms nested rich values', async () => {
    const instance = createInstance({
      amount: '42.75',
      createdAt: '2026-07-16T12:34:56Z',
      id: '550e8400-e29b-41d4-a716-446655440000',
      nested: { elapsed: 'PT1H30M' },
    });

    const response = await instance.get('/record', {
      typewriter: {
        responseSchema: schema.object({
          amount: schema.property(schema.decimal('string')),
          createdAt: schema.property(schema.instant()),
          id: schema.property(schema.uuid()),
          nested: schema.property(
            schema.object({
              elapsed: schema.property(schema.duration()),
            }),
          ),
        }),
      },
    });

    expect(response.data.amount.constructor.name).toBe('Decimal');
    expect(response.data.createdAt.constructor.name).toBe('Instant');
    expect(response.data.id).toBeInstanceOf(Uint8Array);
    expect(response.data.nested.elapsed.constructor.name).toBe('Duration');
  });

  it('leaves responses without a schema unchanged', async () => {
    const payload = { amount: '123.45' };
    const instance = createInstance(payload);

    const response = await instance.get('/amount');

    expect(response.data).toEqual(payload);
  });

  it('stops transforming after ejection', async () => {
    const adapter: AxiosAdapter = async (config) => ({
      config,
      data: config.data ?? JSON.stringify('123.45'),
      headers: { 'content-type': 'application/json' },
      status: 200,
      statusText: 'OK',
    });
    const instance = axios.create({ adapter });
    const responseId = installTypewriterAxiosInterceptor(instance);
    const requestId = installTypewriterAxiosRequestInterceptor(instance);
    ejectTypewriterAxiosInterceptor(instance, responseId);
    ejectTypewriterAxiosRequestInterceptor(instance, requestId);

    const response = await instance.get('/amount', {
      typewriter: { responseSchema: schema.decimal('string') },
    });

    expect(response.data).toBe('123.45');
  });

  it('preserves response errors', async () => {
    const expected = new Error('request failed');
    const adapter: AxiosAdapter = async () => {
      throw expected;
    };
    const instance = axios.create({ adapter });
    installTypewriterAxiosInterceptor(instance);

    await expect(instance.get('/error')).rejects.toBe(expected);
  });

  it('serializes request data using its request schema', async () => {
    const id = uuidV4();
    let receivedData: unknown;
    const instance = createRawInstance({ data: '{}' }, (config) => {
      receivedData = config.data;
    });

    await instance.post(
      '/invoice',
      {
        id: parseUuid(id),
        amount: new Decimal('42.75'),
        displayName: 'Invoice',
      },
      {
        typewriter: {
          requestSchema: schema.object({
            id: schema.property(schema.uuid()),
            amount: schema.property(schema.decimal<Decimal>('string')),
            displayName: schema.property(schema.string(), 'display_name'),
          }),
        },
      },
    );

    expect(JSON.parse(receivedData as string)).toEqual({
      id,
      amount: '42.75',
      display_name: 'Invoice',
    });
  });
});

describe('typewriter Axios request helpers', () => {
  it('hydrates responses with requestWithResponseSchema', async () => {
    const instance = createInstance({ amount: '9.5' });

    const response = await requestWithResponseSchema(instance, amountSchema, {
      method: 'GET',
      url: '/amount',
    });

    expect(response.data.amount).toBeInstanceOf(Decimal);
    expect(response.data.amount.toString()).toBe('9.5');
  });

  it('keeps the deprecated requestWithSchema alias', async () => {
    const instance = createInstance({ amount: '1.25' });

    const response = await requestWithSchema(instance, amountSchema, {
      url: '/amount',
    });

    expect(response.data.amount.toString()).toBe('1.25');
  });

  it('serializes and hydrates with requestWithSchemas', async () => {
    let receivedData: unknown;
    const registry = defineTypeRegistry({ Amount: amountSchema });
    const instance = createRawInstance(
      { data: JSON.stringify({ amount: '3.5' }) },
      (config) => {
        receivedData = config.data;
      },
    );

    const response = await requestWithSchemas(
      instance,
      {
        requestSchema: schema.reference<{ amount: Decimal }>('Amount'),
        responseSchema: schema.reference<{ amount: Decimal }>('Amount'),
      },
      {
        method: 'POST',
        url: '/amount',
        data: { amount: new Decimal('2.5') },
        typewriter: { registry },
      },
    );

    expect(JSON.parse(receivedData as string)).toEqual({ amount: '2.5' });
    expect(response.data.amount).toBeInstanceOf(Decimal);
    expect(response.data.amount.toString()).toBe('3.5');
  });

  it('keeps schemas already present in the config', async () => {
    const instance = createInstance({ amount: '4.5' });

    const response = await requestWithSchemas<{ amount: Decimal }>(
      instance,
      {},
      { url: '/amount', typewriter: { responseSchema: amountSchema } },
    );

    expect(response.data.amount).toBeInstanceOf(Decimal);
  });
});

describe('typewriter Axios options', () => {
  it('is strict by default for responses and requests', async () => {
    const instance = createInstance({ amount: 'invalid' });

    await expect(
      instance.get('/amount', { typewriter: { responseSchema: amountSchema } }),
    ).rejects.toBeInstanceOf(JsonTransformationError);
    await expect(
      instance.post(
        '/amount',
        { amount: 'invalid' },
        { typewriter: { requestSchema: amountSchema } },
      ),
    ).rejects.toBeInstanceOf(JsonSerializationError);
  });

  it('preserves invalid values when strictness is disabled', async () => {
    const instance = createInstance({ amount: 'invalid' });

    const response = await instance.post(
      '/amount',
      { amount: 'still invalid' },
      {
        typewriter: {
          requestSchema: amountSchema,
          responseSchema: amountSchema,
          serializeOptions: { strict: false },
          transformOptions: { mode: 'tolerant' },
        },
      },
    );

    expect(response.data).toEqual({ amount: 'invalid' });
  });

  it('uses direction-specific registries before the shared registry', async () => {
    let receivedData: unknown;
    const instance = createRawInstance(
      { data: JSON.stringify({ amount: '1.5' }) },
      (config) => {
        receivedData = config.data;
      },
    );
    const shared = defineTypeRegistry({ Amount: schema.unknown() });
    const typed = defineTypeRegistry({ Amount: amountSchema });

    const response = await instance.post(
      '/amount',
      { amount: new Decimal('2') },
      {
        typewriter: {
          requestSchema: schema.reference('Amount'),
          responseSchema: schema.reference('Amount'),
          registry: shared,
          requestRegistry: typed,
          responseRegistry: typed,
        },
      },
    );

    expect(JSON.parse(receivedData as string)).toEqual({ amount: '2' });
    expect(response.data.amount).toBeInstanceOf(Decimal);
  });

  it('supports the deprecated flat configuration names', async () => {
    let receivedData: unknown;
    const instance = createRawInstance(
      { data: JSON.stringify({ amount: 'invalid' }) },
      (config) => {
        receivedData = config.data;
      },
    );
    const registry = defineTypeRegistry({ Amount: amountSchema });

    await expect(
      instance.post(
        '/amount',
        { amount: new Decimal('5') },
        {
          requestSchema: schema.reference('Amount'),
          requestSchemaRegistry: registry,
          requestSerializeOptions: { strict: true },
          responseSchema: schema.reference('Amount'),
          responseSchemaRegistry: registry,
          responseTransformOptions: { strict: true },
        },
      ),
    ).rejects.toBeInstanceOf(JsonTransformationError);
    expect(JSON.parse(receivedData as string)).toEqual({ amount: '5' });
  });
});

describe('typewriter Axios response bodies', () => {
  it.each([
    [204, ''],
    [205, ''],
    [200, ''],
    [200, '   '],
    [200, null],
    [200, undefined],
  ])('skips hydration for a %s response with body %p', async (status, data) => {
    const instance = createRawInstance({ data, status });

    const response = await instance.get('/empty', {
      typewriter: { responseSchema: amountSchema },
    });

    expect(response.data).toBe(data);
  });

  it.each([
    ['text', 'plain text'],
    ['arraybuffer', new ArrayBuffer(4)],
    ['blob', new Blob(['x'])],
  ] as const)(
    'skips hydration for responseType %s',
    async (responseType, data) => {
      const instance = createRawInstance({ data });

      const response = await instance.get('/raw', {
        responseType,
        typewriter: { responseSchema: amountSchema },
      });

      expect(response.data).toBe(data);
    },
  );

  it.each([new Uint8Array(2), new ArrayBuffer(2), new Blob(['x'])])(
    'skips hydration for binary data %p without a responseType',
    async (data) => {
      const instance = createRawInstance({ data });

      const response = await instance.get('/raw', {
        typewriter: { responseSchema: amountSchema },
      });

      expect(response.data).toBe(data);
    },
  );

  it('rejects unparsed text bodies with a clear error', async () => {
    const instance = createRawInstance({
      data: '<html>proxy error</html>',
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });

    const error = await instance
      .get('/html', { typewriter: { responseSchema: amountSchema } })
      .catch((failure: unknown) => failure);

    expect(error).toBeInstanceOf(AxiosError);
    expect((error as AxiosError).code).toBe(AxiosError.ERR_BAD_RESPONSE);
    expect((error as AxiosError).message).toContain('text/html');
    expect((error as AxiosError).response?.data).toBe(
      '<html>proxy error</html>',
    );
  });

  it.each<Record<string, string>>([
    {},
    { 'content-type': 'application/vnd.api+json' },
  ])('hydrates JSON string roots with headers %p', async (headers) => {
    const instance = createRawInstance({
      data: JSON.stringify('7.5'),
      headers,
    });

    const response = await instance.get('/amount', {
      typewriter: { responseSchema: schema.decimal('string') },
    });

    expect(response.data).toBeInstanceOf(Decimal);
  });
});
