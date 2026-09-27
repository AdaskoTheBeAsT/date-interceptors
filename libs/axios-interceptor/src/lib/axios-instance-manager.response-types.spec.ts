import { Readable } from 'stream';

import { hierarchicalConvertToDate } from '@adaskothebeast/hierarchical-convert-to-date';
import axios from 'axios';
import type { AxiosAdapter, ResponseType } from 'axios';

import { AxiosInstanceManager, attachHierarchicalConverter } from '../index';

const respond =
  (data: unknown, contentType?: string): AxiosAdapter =>
  async (config) => ({
    config,
    status: 200,
    statusText: 'OK',
    headers: contentType === undefined ? {} : { 'content-type': contentType },
    data,
  });

describe('AxiosInstanceManager response type handling', () => {
  const wire = JSON.stringify({ date: '2024-01-05T20:42:33.719Z' });

  it.each<[string, ResponseType, () => unknown]>([
    ['arraybuffer', 'arraybuffer', () => Buffer.from(wire)],
    ['stream', 'stream', () => Readable.from([wire])],
    ['blob', 'blob', () => new Blob([wire])],
    ['text', 'text', () => wire],
    ['document', 'document', () => ({ date: '2024-01-05T20:42:33.719Z' })],
  ])(
    'skips %s responses even when labelled as JSON',
    async (_, responseType, data) => {
      const convert = jest.fn();
      const instance = AxiosInstanceManager.createInstance(convert);
      instance.defaults.adapter = respond(data(), 'application/json');
      await instance.get('/binary', { responseType });
      expect(convert).not.toHaveBeenCalled();
    },
  );

  it('skips non-plain data that a custom adapter returns without a response type', async () => {
    const convert = jest.fn();
    const instance = AxiosInstanceManager.createInstance(convert);
    instance.defaults.adapter = respond(Buffer.from(wire), 'application/json');
    const response = await instance.get('/buffer');
    expect(Buffer.isBuffer(response.data)).toBe(true);
    expect(convert).not.toHaveBeenCalled();
  });

  it.each([
    ['application/vnd.api+json', undefined],
    ['application/problem-free+json; charset=utf-8', 'json'],
    ['application/json', 'json'],
  ] as const)(
    'converts parsed %s responses (responseType %s)',
    async (contentType, responseType) => {
      const instance = AxiosInstanceManager.createInstance(
        hierarchicalConvertToDate,
      );
      instance.defaults.adapter = respond(wire, contentType);
      const response = await instance.get('/json', { responseType });
      expect(response.data.date).toBeInstanceOf(Date);
    },
  );

  it('converts parsed arrays', async () => {
    const convert = jest.fn();
    const instance = AxiosInstanceManager.createInstance(convert);
    instance.defaults.adapter = respond(`[${wire}]`, 'application/json');
    await instance.get('/list');
    expect(convert).toHaveBeenCalledWith([
      { date: '2024-01-05T20:42:33.719Z' },
    ]);
  });

  it('converts null-prototype objects produced by custom adapters', async () => {
    const convert = jest.fn();
    const instance = AxiosInstanceManager.createInstance(convert);
    const data = Object.assign(Object.create(null) as object, { a: 1 });
    instance.defaults.adapter = respond(data, 'application/json');
    await instance.get('/null-prototype');
    expect(convert).toHaveBeenCalledWith(data);
  });
});

describe('AxiosInstanceManager configuration', () => {
  it.each([false, true])(
    'passes axios defaults to the created instance (multiple: %s)',
    (multiple) => {
      const config = { baseURL: 'https://example.test/api', timeout: 1234 };
      const instance = multiple
        ? AxiosInstanceManager.createInstanceWithMultipleInterceptors(
            [jest.fn()],
            config,
          )
        : AxiosInstanceManager.createInstance(jest.fn(), config);
      expect(instance.defaults.baseURL).toBe(config.baseURL);
      expect(instance.defaults.timeout).toBe(config.timeout);
    },
  );
});

describe('attachHierarchicalConverter', () => {
  const wire = JSON.stringify({ date: '2024-01-05T20:42:33.719Z' });

  it('attaches to an existing instance and can be ejected', async () => {
    const instance = axios.create({ baseURL: 'https://example.test' });
    instance.defaults.adapter = respond(wire, 'application/json');
    const eject = attachHierarchicalConverter(
      instance,
      hierarchicalConvertToDate,
    );

    const converted = await instance.get('/converted');
    expect(converted.data.date).toBeInstanceOf(Date);

    eject();
    const raw = await instance.get('/raw');
    expect(raw.data.date).toBe('2024-01-05T20:42:33.719Z');
  });

  it('runs an array of converters in order', async () => {
    const calls: string[] = [];
    const instance = axios.create();
    instance.defaults.adapter = respond(wire, 'application/json');
    attachHierarchicalConverter(instance, [
      () => calls.push('first'),
      () => calls.push('second'),
    ]);
    await instance.get('/ordered');
    expect(calls).toEqual(['first', 'second']);
  });

  it('snapshots the converter list when attaching', async () => {
    const convert = jest.fn();
    const converters = [convert];
    const instance = axios.create();
    instance.defaults.adapter = respond(wire, 'application/json');
    attachHierarchicalConverter(instance, converters);
    converters.push(
      jest.fn(() => {
        throw new Error('not attached');
      }),
    );
    await instance.get('/snapshot');
    expect(convert).toHaveBeenCalledTimes(1);
  });
});
