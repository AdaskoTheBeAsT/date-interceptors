const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const MAX_DEPTH = 100;

/** Returns the replacement for a string; returning the same string leaves it untouched. */
export type StringConverter = (value: string) => unknown;

/**
 * Replaces own enumerable string values of arrays and plain objects in place.
 *
 * Only arrays and plain objects (prototype is `Object.prototype` of any realm,
 * or `null`) are entered, so class instances, `Map`, `Set`, `Date`, typed
 * arrays, and already-converted backend values are left untouched. Cycles are
 * visited once, `__proto__`/`constructor`/`prototype` keys are skipped, the
 * root plus 100 nested levels are walked, and frozen objects or non-writable
 * properties keep their original values.
 */
export function visitStrings(value: unknown, convert: StringConverter): void {
  visit(value, convert, 0, new WeakSet<object>());
}

/** Recognizes JSON containers across realms, without entering class instances. */
export function isJsonContainer(value: unknown): value is object {
  if (typeof value !== 'object' || value === null) return false;
  if (Array.isArray(value)) {
    return true;
  }
  const prototype: unknown = Object.getPrototypeOf(value);
  // Comparing against the local Object.prototype would reject JSON produced in
  // another realm (e.g. a fetch Response implemented outside a Jest VM context).
  if (prototype === null) return true;
  const constructor = Object.getOwnPropertyDescriptor(
    prototype,
    'constructor',
  )?.value;
  return (
    Object.getPrototypeOf(prototype) === null &&
    typeof constructor === 'function' &&
    Function.prototype.toString.call(constructor) ===
      Function.prototype.toString.call(Object)
  );
}

function visit(
  value: unknown,
  convert: StringConverter,
  depth: number,
  visited: WeakSet<object>,
): void {
  if (
    !isJsonContainer(value) ||
    depth > MAX_DEPTH ||
    visited.has(value)
  ) {
    return;
  }
  visited.add(value);
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!DANGEROUS_KEYS.has(key)) {
      visitEntry(record, key, convert, depth, visited);
    }
  }
}

function visitEntry(
  target: object,
  key: string | number,
  convert: StringConverter,
  depth: number,
  visited: WeakSet<object>,
): void {
  const descriptor = Object.getOwnPropertyDescriptor(target, key);
  // Do not invoke accessors or visit inherited values in sparse arrays.
  if (!descriptor?.enumerable || !('value' in descriptor)) return;
  const item: unknown = descriptor.value;
  if (typeof item !== 'string') {
    visit(item, convert, depth + 1, visited);
    return;
  }
  if (!descriptor.writable) {
    return;
  }
  const converted = convert(item);
  if (converted !== item) {
    Reflect.set(target, key, converted);
  }
}
