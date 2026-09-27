import { runInNewContext } from 'node:vm';

import { isJsonContainer, visitStrings } from '../index';

describe('JSON container detection', () => {
  it.each([
    ['plain objects', {}],
    ['arrays', []],
    ['null-prototype objects', Object.create(null)],
    ['cross-realm objects', runInNewContext('({})')],
    ['cross-realm arrays', runInNewContext('[]')],
  ])('recognizes %s through the public export', (_name, value) => {
    expect(isJsonContainer(value)).toBe(true);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['strings', 'input'],
    ['numbers', 42],
    ['booleans', true],
    ['functions', () => undefined],
    ['dates', new Date(0)],
    ['maps', new Map()],
    ['sets', new Set()],
    ['typed arrays', new Uint8Array()],
    ['custom prototypes', Object.create({ value: 'input' })],
  ])('rejects %s through the public export', (_name, value) => {
    expect(isJsonContainer(value)).toBe(false);
  });
});

describe('shared traversal', () => {
  it('only visits populated entries in very sparse arrays', () => {
    const values: string[] = [];
    values[1_000_000] = 'input';
    const descriptor = jest.fn(Reflect.getOwnPropertyDescriptor);
    const array = new Proxy(values, { getOwnPropertyDescriptor: descriptor });
    const convert = jest.fn(() => 'converted');
    visitStrings(array, convert);
    expect(convert).toHaveBeenCalledTimes(1);
    // Enumeration, reading, and writing only inspect the populated entry.
    expect(descriptor.mock.calls.length).toBeLessThan(10);
    expect(values[1_000_000]).toBe('converted');
  });
  it('visits arrays and aliased objects once and preserves cycles', () => {
    const child = { value: 'input' };
    const root = { first: child, second: child, array: ['input'], self: {} };
    root.self = root;
    const convert = jest.fn(() => 'converted');
    visitStrings(root, convert);
    expect(convert).toHaveBeenCalledTimes(2);
    expect(root.first).toBe(root.second);
    expect(root.self).toBe(root);
    expect(root.array).toEqual(['converted']);
  });

  it('ignores primitives and leaves unconverted strings in place', () => {
    const convert = jest.fn((value: string) => value);
    expect(() => {
      visitStrings(null, convert);
      visitStrings(undefined, convert);
      visitStrings('input', convert);
      visitStrings(42, convert);
    }).not.toThrow();
    expect(convert).not.toHaveBeenCalled();
    const root = { value: 'input', items: ['input', 1, null] };
    visitStrings(root, convert);
    expect(root).toEqual({ value: 'input', items: ['input', 1, null] });
    expect(convert).toHaveBeenCalledTimes(2);
  });

  it('skips own __proto__, constructor, and prototype keys without changing prototypes', () => {
    const root = JSON.parse(
      '{"own":"input","__proto__":"input","constructor":"input","prototype":"input","nested":{"__proto__":{"value":"input"},"value":"input"}}',
    );
    const convert = jest.fn(() => 'converted');
    visitStrings(root, convert);
    expect(Object.hasOwn(root, '__proto__')).toBe(true);
    expect(Object.getPrototypeOf(root)).toBe(Object.prototype);
    expect(Object.getPrototypeOf(root.nested)).toBe(Object.prototype);
    expect(Object.getOwnPropertyDescriptor(root, '__proto__')?.value).toBe(
      'input',
    );
    expect(
      Object.getOwnPropertyDescriptor(root.nested, '__proto__')?.value,
    ).toEqual({ value: 'input' });
    expect(root.constructor).toBe('input');
    expect(root.prototype).toBe('input');
    expect(root.own).toBe('converted');
    expect(root.nested.value).toBe('converted');
    expect(convert).toHaveBeenCalledTimes(2);
    expect(({} as Record<string, unknown>)['value']).toBeUndefined();
  });

  it('enters only arrays and plain objects', () => {
    class Holder {
      value = 'input';
    }
    const inherited = Object.create({ inherited: 'input' }) as {
      own: string;
    };
    inherited.own = 'input';
    const nullPrototype = Object.assign(Object.create(null), {
      value: 'input',
    }) as { value: string };
    const map = new Map([['value', 'input']]);
    const set = new Set(['input']);
    const buffer = Buffer.from('input');
    const bytes = new Uint8Array([1, 2, 3]);
    const date = new Date(0);
    Object.assign(date, { value: 'input' });
    const holder = new Holder();
    const root = {
      holder,
      inherited,
      nullPrototype,
      map,
      set,
      buffer,
      bytes,
      date,
    };
    visitStrings(root, () => 'converted');
    expect(holder.value).toBe('input');
    expect(inherited.own).toBe('input');
    expect(nullPrototype.value).toBe('converted');
    expect(map.get('value')).toBe('input');
    expect([...set]).toEqual(['input']);
    expect(buffer.toString()).toBe('input');
    expect([...bytes]).toEqual([1, 2, 3]);
    expect((date as unknown as { value: string }).value).toBe('input');
  });

  it('enters plain objects and arrays created in another realm', () => {
    const root = runInNewContext(
      '({ value: "input", items: ["input"], nested: { value: "input" } })',
    ) as { value: unknown; items: unknown[]; nested: { value: unknown } };
    visitStrings(root, () => 'converted');
    expect(root.value).toBe('converted');
    expect(root.items[0]).toBe('converted');
    expect(root.nested.value).toBe('converted');
  });

  it('does not treat custom null-rooted prototypes as plain objects', () => {
    const prototype = Object.assign(Object.create(null), {
      constructor: () => undefined,
    });
    const value = Object.assign(Object.create(prototype), { value: 'input' });
    const noConstructor = Object.assign(Object.create(Object.create(null)), {
      value: 'input',
    });
    visitStrings({ value, noConstructor }, () => 'converted');
    expect(value.value).toBe('input');
    expect(noConstructor.value).toBe('input');
  });

  it('skips accessors, sparse array holes, and non-enumerable elements', () => {
    const getter = jest.fn(() => {
      throw new Error('must not read');
    });
    const object = Object.defineProperty({ value: 'input' }, 'computed', {
      get: getter,
      set() {
        throw new Error('must not write');
      },
      enumerable: true,
    });
    const array = new Array(3);
    Object.defineProperty(array, '1', { value: 'input', enumerable: false });
    array[2] = 'input';
    visitStrings({ object, array }, () => 'converted');
    expect(getter).not.toHaveBeenCalled();
    expect(object.value).toBe('converted');
    expect(Object.hasOwn(array, 0)).toBe(false);
    expect(array[1]).toBe('input');
    expect(array[2]).toBe('converted');
  });

  it('leaves frozen containers and non-writable properties unchanged without throwing', () => {
    const frozenChild = Object.freeze({
      value: 'input',
      nested: { value: 'input' },
    });
    const frozenArray = Object.freeze(['input']);
    const sealed = Object.seal({ value: 'input' });
    const readOnly: Record<string, unknown> = { after: 'input' };
    Object.defineProperty(readOnly, 'fixed', {
      value: 'input',
      enumerable: true,
      writable: false,
    });
    Object.defineProperty(readOnly, 'computed', {
      get: () => 'input',
      enumerable: true,
    });
    const root = { frozenChild, frozenArray, sealed, readOnly };
    const convert = jest.fn(() => 'converted');
    expect(() => visitStrings(root, convert)).not.toThrow();
    expect(frozenChild.value).toBe('input');
    expect(frozenChild.nested.value).toBe('converted');
    expect(frozenArray[0]).toBe('input');
    expect(sealed.value).toBe('converted');
    expect(readOnly['fixed']).toBe('input');
    expect(readOnly['computed']).toBe('input');
    expect(readOnly['after']).toBe('converted');
  });

  it('converts the root plus 100 nested levels and leaves deeper values untouched', () => {
    const root: Record<string, unknown> = { value: 'input' };
    let current = root;
    for (let level = 1; level <= 101; level++) {
      const next: Record<string, unknown> = { value: 'input' };
      current['child'] = next;
      current = next;
    }
    visitStrings(root, () => 'converted');
    let node: Record<string, unknown> = root;
    for (let level = 0; level <= 100; level++) {
      expect(node['value']).toBe('converted');
      node = node['child'] as Record<string, unknown>;
    }
    expect(node['value']).toBe('input');
  });

  it('is a no-op when run again over already converted values', () => {
    class Converted {
      constructor(readonly source: string) {}
    }
    const root = { value: '2024-01-01T00:00:00Z', items: ['x'] };
    const convert = (value: string) => new Converted(value);
    visitStrings(root, convert);
    const first = root.value;
    const firstItem = root.items[0];
    const spy = jest.fn(convert);
    visitStrings(root, spy);
    expect(spy).not.toHaveBeenCalled();
    expect(root.value).toBe(first);
    expect(root.items[0]).toBe(firstItem);
    expect((root.value as unknown as Converted).source).toBe(
      '2024-01-01T00:00:00Z',
    );
  });
});
