import {
  defineTypeRegistry,
  schema,
} from '@adaskothebeast/typewriter-schema';
import { JsonTransformationError } from '@adaskothebeast/typewriter-runtime';
import axios, { type AxiosAdapter, type AxiosInstance } from 'axios';
import Decimal from 'decimal.js';
import { parse as parseUuid, v4 as uuidV4 } from 'uuid';

import {
  ejectTypewriterAxiosRequestInterceptor,
  ejectTypewriterAxiosInterceptor,
  installTypewriterAxiosRequestInterceptor,
  installTypewriterAxiosInterceptor,
  requestWithSchema,
} from './typewriter-http-axios';

function createInstance(value: unknown): AxiosInstance {
  const adapter: AxiosAdapter = async (config) => ({
    config,
    data: JSON.stringify(value),
    headers: { 'content-type': 'application/json' },
    status: 200,
    statusText: 'OK',
  });

  return axios.create({ adapter });
}

describe('typewriter Axios interceptor', () => {
  it('replaces a root scalar with its transformed value', async () => {
    const instance = createInstance('123.45');
    installTypewriterAxiosInterceptor(instance);

    const response = await instance.get('/amount', {
      responseSchema: schema.decimal('string'),
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
    installTypewriterAxiosInterceptor(instance);

    const response = await instance.get('/record', {
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
    });

    expect(response.data.amount.constructor.name).toBe('Decimal');
    expect(response.data.createdAt.constructor.name).toBe('Instant');
    expect(response.data.id).toBeInstanceOf(Uint8Array);
    expect(response.data.nested.elapsed.constructor.name).toBe('Duration');
  });

  it('leaves responses without a schema unchanged', async () => {
    const payload = { amount: '123.45' };
    const instance = createInstance(payload);
    installTypewriterAxiosInterceptor(instance);

    const response = await instance.get('/amount');

    expect(response.data).toEqual(payload);
  });

  it('stops transforming responses after ejection', async () => {
    const instance = createInstance('123.45');
    const id = installTypewriterAxiosInterceptor(instance);
    ejectTypewriterAxiosInterceptor(instance, id);

    const response = await instance.get('/amount', {
      responseSchema: schema.decimal('string'),
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
    const adapter: AxiosAdapter = async (config) => {
      receivedData = config.data;
      return {
        config,
        data: '{}',
        headers: { 'content-type': 'application/json' },
        status: 200,
        statusText: 'OK',
      };
    };
    const instance = axios.create({ adapter });
    const interceptorId = installTypewriterAxiosRequestInterceptor(instance);

    await instance.post(
      '/invoice',
      {
        id: parseUuid(id),
        amount: new Decimal('42.75'),
        displayName: 'Invoice',
      },
      {
        requestSchema: schema.object({
          id: schema.property(schema.uuid()),
          amount: schema.property(schema.decimal<Decimal>('string')),
          displayName: schema.property(schema.string(), 'display_name'),
        }),
      },
    );

    expect(JSON.parse(receivedData as string)).toEqual({
      id,
      amount: '42.75',
      display_name: 'Invoice',
    });

    ejectTypewriterAxiosRequestInterceptor(instance, interceptorId);
  });

  it('provides a schema-typed request helper', async () => {
    const instance = createInstance({ amount: '9.5' });
    installTypewriterAxiosInterceptor(instance);

    const response = await requestWithSchema(
      instance,
      schema.object<{ amount: Decimal }>({
        amount: schema.property(schema.decimal<Decimal>('string')),
      }),
      { method: 'GET', url: '/amount' },
    );

    expect(response.data.amount).toBeInstanceOf(Decimal);
    expect(response.data.amount.toString()).toBe('9.5');
  });

  it('forwards schema registries and strict transformation options', async () => {
    const instance = createInstance({ amount: 'invalid' });
    const registry = defineTypeRegistry({
      Invoice: schema.object<{ amount: Decimal }>({
        amount: schema.property(schema.decimal<Decimal>('string')),
      }),
    });
    installTypewriterAxiosInterceptor(instance);

    await expect(
      instance.get('/invoice', {
        responseSchema: schema.reference('Invoice'),
        responseSchemaRegistry: registry,
        responseTransformOptions: { strict: true },
      }),
    ).rejects.toBeInstanceOf(JsonTransformationError);
  });
});
