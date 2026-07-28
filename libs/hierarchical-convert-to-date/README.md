# 📅 @adaskothebeast/hierarchical-convert-to-date

**The zero-dependency core of [date-interceptors](https://github.com/AdaskoTheBeAsT/date-interceptors): walks a parsed JSON graph and replaces ISO 8601 date strings with native `Date` instances in place.**

[![npm](https://img.shields.io/npm/v/%40adaskothebeast%2Fhierarchical-convert-to-date?color=cb3837&logo=npm)](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-date)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

Only peer dependency is `tslib` (`^2.8.1`); no date library, no framework. Built with `tsc` to CommonJS plus `.d.ts` declarations.

---

## 📦 Install

```bash
npm i @adaskothebeast/hierarchical-convert-to-date
```

---

## 🎯 What it does

`JSON.parse` gives you strings where your API meant instants. This package fixes that after the fact: it walks every own enumerable property of every nested object and array, recognizes ISO 8601 date strings, and assigns a `Date` back into the same slot.

```ts
const payload = { createdAt: '2023-07-17T23:06:00.000Z' };
hierarchicalConvertToDate(payload);
payload.createdAt instanceof Date; // true
```

The traversal is deliberately defensive: `__proto__`, `constructor` and `prototype` keys are never written to, inherited properties are skipped via `Object.hasOwn`, already visited objects are tracked in a `WeakSet` so cycles terminate, and recursion stops past a fixed depth. That makes it safe to point at untrusted response bodies.

`fetchJson` is a thin convenience wrapper: one `fetch` call, status handling, `response.json()`, then the conversion.

---

## 🧰 API

### Conversion

| Symbol                                              | Signature                                                       | Notes                                                                              |
| --------------------------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `hierarchicalConvertToDate(obj, depth?, visited?)`   | `(obj: unknown, depth?: number, visited?: WeakSet<object>) => void` | Mutates `obj` and returns nothing. `depth` defaults to `0`, `visited` to a fresh `WeakSet` |

Both optional parameters exist for the recursive calls, but they are usable: pass a higher `depth` to shrink the remaining budget, or share a `visited` set across several calls so an object graph is only walked once.

### Fetch helper

| Symbol                                    | Signature                                                                                   | Notes                                                       |
| ----------------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `fetchJson<T>(input, init?, options?)`     | `(input: RequestInfo \| URL, init?: RequestInit, options?: FetchJsonOptions) => Promise<T>` | Resolves with converted, typed data                          |
| `FetchJsonOptions`                        | `{ readonly fetch?: typeof globalThis.fetch }`                                              | Inject a custom `fetch` (tests, polyfills, instrumented client) |
| `FetchJsonError`                          | `class FetchJsonError extends Error`                                                        | `name: 'FetchJsonError'`, plus readonly `status` and `statusText` |

`FetchJsonError` is constructed as `new FetchJsonError(status, statusText)` and its message reads `HTTP request failed with status 503 Service Unavailable`.

---

## ⚡ Usage

Convert a payload you already have:

```ts
import { hierarchicalConvertToDate } from '@adaskothebeast/hierarchical-convert-to-date';

interface Order {
  id: string;
  createdAt: Date;
  lines: { shippedAt: Date | null }[];
}

const raw: unknown = JSON.parse(text);
hierarchicalConvertToDate(raw);
const order = raw as Order;
```

Fetch and convert in one step:

```ts
import { FetchJsonError, fetchJson } from '@adaskothebeast/hierarchical-convert-to-date';

try {
  const order = await fetchJson<Order>('/api/orders/1');
  console.log(order.createdAt.getFullYear());
} catch (e) {
  if (e instanceof FetchJsonError) {
    console.error(e.status, e.statusText);
  }
}
```

Inject a `fetch` implementation:

```ts
await fetchJson<Order>('/api/orders/1', { method: 'GET' }, { fetch: myInstrumentedFetch });
```

---

## 🎛️ Options and configuration

There is nothing to configure globally; behaviour is fixed by design so the hot path stays cheap.

**Recognized shape.** A string is only considered when it is at least 20 characters long and has `-` at index 4, `-` at index 7 and `T` at index 10. Those four checks run before any regular expression. Survivors must then match:

```text
^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|([+-]\d{2}:\d{2}))?$
```

So milliseconds are optional but must be exactly three digits, and the zone is optional (`Z` or `±HH:MM`).

**Depth budget.** The guard is `depth > 100`, so the root object plus 100 nested levels are walked and anything deeper is left as strings.

**Parsing** is done by the platform: `new Date(value)`, kept only when `getTime()` is not `NaN`.

---

## 📤 Output examples

| Input                                                | After conversion                                          |
| ---------------------------------------------------- | --------------------------------------------------------- |
| `{ date: '2023-07-17T23:06:00.000Z' }`               | `{ date: Date('2023-07-17T23:06:00.000Z') }`              |
| `{ date: '2023-07-17T23:06:00.000+01:00' }`          | `{ date: Date('2023-07-17T23:06:00.000+01:00') }`         |
| `{ nested: { date: '2023-07-17T23:06:00.000Z' } }`   | `{ nested: { date: Date(...) } }`                         |
| `['2023-07-17T23:06:00.000Z']`                       | `[Date(...)]`                                             |
| `[{ date: '...Z' }, { date: '...Z' }]`               | both elements converted                                   |
| `{ text: 'adam', number: 42, flag: true, n: null }`  | untouched                                                 |
| `{ d: '2023/07/17 23:06:00' }`                       | untouched (wrong format)                                  |
| `{ d: 'Monday, July 17, 2023' }`                     | untouched                                                 |
| `{ d: '2023-99-99T99:99:99.000Z' }`                  | untouched (matched the pattern, parsed to an invalid date) |

```text
// fetchJson
200 + body   -> resolved value with Date instances in place of ISO strings
204          -> resolves to undefined
503          -> rejects with FetchJsonError { status: 503, statusText: 'Service Unavailable' }
```

---

## ⚠️ Edge cases

- **Mutation in place.** The function returns `void` and rewrites your object. Clone first (`structuredClone`) if the caller needs the original strings. `fetchJson` mutates the value it just parsed, which nobody else holds.
- **Prototype pollution is blocked.** `__proto__`, `constructor` and `prototype` keys are skipped entirely, so a payload carrying them cannot reach `Object.prototype` through this traversal. Non-own (inherited) enumerable properties are skipped too.
- **Cycles are safe.** Visited objects go into a `WeakSet`, so `input.self = input` or `input.nested.circular = input` completes without throwing. The same object shared in two branches is therefore only walked once, which is harmless because conversion happens in place.
- **Past depth 100 nothing changes.** Dates nested deeper than 101 object levels stay strings; no error, no warning.
- **Invalid dates stay strings.** `2023-99-99T99:99:99.000Z` matches the pattern but `new Date` yields `NaN`, so the original string is preserved. You never get an `Invalid Date` object out of this package.
- **The 20 character floor rejects `2023-07-17T23:06:00`.** It is 19 characters, so a second-precision timestamp with no zone and no milliseconds is not converted even though the regular expression would accept it. `2023-07-17T23:06:00Z` (20) and `2023-07-17T23:06:00.000` (23) both are.
- **Offset-less values are local time**, because that is what `new Date('2023-07-17T23:06:00.000')` does for date-time forms. Values with `Z` or an explicit offset are exact instants. Nothing here normalizes to UTC.
- **Date-only strings are never touched.** `2023-07-17` fails the length check, which avoids the classic "plain date silently became midnight UTC" bug.
- **Durations are not handled.** `P1Y2M3D` stays a string; use the `-date-fns`, `-dayjs`, `-luxon`, `-moment`, `-js-joda` or `-temporal` packages if your payload carries ISO durations.
- **Values inside `Map` and `Set` are invisible**, since `for...in` sees no own enumerable entries on them. `Date` instances already present are traversed harmlessly and left alone.
- `hierarchicalConvertToDate` on a primitive, `null` or `undefined` is a no-op, so it is safe to call on any `unknown`.
- **`fetchJson` only special-cases 204.** A `200` with an empty body rejects with the `SyntaxError` from `response.json()`. Any non-`ok` response rejects with `FetchJsonError` before the body is read.

---

## 🔗 Related packages

- Same traversal, other date libraries: [`-date-fns`](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-date-fns), [`-dayjs`](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-dayjs), [`-luxon`](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-luxon), [`-moment`](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-moment), [`-js-joda`](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-js-joda), [`-temporal`](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-temporal)
- Other value kinds: [`-decimal`](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-decimal), [`-uuid`](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-uuid)
- Transports: [`angular-date-http-interceptor`](https://www.npmjs.com/package/@adaskothebeast/angular-date-http-interceptor), [`axios-interceptor`](https://www.npmjs.com/package/@adaskothebeast/axios-interceptor), [`react-redux-toolkit-hierarchical-date-hook`](https://www.npmjs.com/package/@adaskothebeast/react-redux-toolkit-hierarchical-date-hook)
- Schema-driven alternative: [`typewriter-schema`](https://www.npmjs.com/package/@adaskothebeast/typewriter-schema), [`typewriter-runtime`](https://www.npmjs.com/package/@adaskothebeast/typewriter-runtime)

Full matrix and recipes: [main README](https://github.com/AdaskoTheBeAsT/date-interceptors#readme).

---

## 📄 License

[MIT](./LICENSE) © Adam Pluciński
