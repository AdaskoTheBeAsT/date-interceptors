# 📅 @adaskothebeast/hierarchical-convert-to-date

**The date-library-free member of [date-interceptors](https://github.com/AdaskoTheBeAsT/date-interceptors): walks a parsed JSON graph and replaces ISO 8601 date strings with native `Date` instances in place.**

[![npm](https://img.shields.io/npm/v/%40adaskothebeast%2Fhierarchical-convert-to-date?color=cb3837&logo=npm)](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-date)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

The only runtime dependency is the dependency-free [`@adaskothebeast/hierarchical-convert-core`](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-core); no date library, no framework.

---

## 📦 Install

```bash
npm i @adaskothebeast/hierarchical-convert-to-date
```

---

## 🎯 What it does

`JSON.parse` gives you strings where your API meant instants. This package fixes that after the fact: it walks the arrays and plain objects of a parsed payload, recognizes ISO 8601 date-time strings, and assigns a `Date` back into the same slot.

```ts
const payload = { createdAt: '2023-07-17T23:06:00.000Z' };
hierarchicalConvertToDate(payload);
payload.createdAt instanceof Date; // true
```

The traversal is deliberately defensive: own `__proto__`, `constructor` and `prototype` keys are skipped, only arrays and plain objects are entered, cycles terminate, frozen or read-only properties are left alone instead of throwing, and recursion stops past a fixed depth. That makes it safe to point at untrusted response bodies.

`fetchJson` is a thin convenience wrapper: one `fetch` call, status and Problem Details handling, JSON parsing, then the conversion.

---

## 🧰 API

### Conversion

| Symbol                           | Signature                | Notes                                   |
| -------------------------------- | ------------------------ | --------------------------------------- |
| `hierarchicalConvertToDate(obj)` | `(obj: unknown) => void` | Mutates `obj` in place; returns nothing |

### Fetch helper

| Symbol                                         | Signature                                                                                                | Notes                                                                          |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `fetchJson<T>(input, init?, options?)`         | `(input: RequestInfo \| URL, init?: RequestInit, options?: FetchJsonOptions) => Promise<T \| undefined>` | Resolves with converted data, or `undefined` for an empty successful response  |
| `FetchJsonOptions`                             | `{ readonly fetch?: typeof globalThis.fetch }`                                                           | Inject a custom `fetch` (tests, polyfills, instrumented client)                |
| `FetchJsonError`                               | `class FetchJsonError extends Error`                                                                     | `name: 'FetchJsonError'`, plus readonly `status`, `statusText`, and `response` |
| `isProblemDetailsError`, `ProblemDetailsError` | Re-exported from core                                                                                    | Narrow and inspect JSON Problem Details failures                               |

`FetchJsonError`'s message reads `HTTP request failed with status 503 Service Unavailable`. The original, unconsumed `Response` is available as `error.response`.

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
  console.log(order?.createdAt.getFullYear());
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

## 🎛️ Recognition rules

There is nothing to configure. Recognition and traversal are shared with the other converters through `hierarchical-convert-core`; the full rules are in the repository [conversion contract](https://github.com/AdaskoTheBeAsT/date-interceptors/blob/main/docs/conversion-contract.md#heuristic-date-conversion). In short:

- A string converts when it has the shape `YYYY-MM-DDTHH:mm:ss`, an optional fraction of one to nine digits, and an optional `Z` or `±HH:MM` offset.
- Calendar and clock components are validated first (leap years, days per month, hours below 24, minutes and seconds below 60, offset hours below 24 and offset minutes below 60), so impossible dates never reach `new Date`.
- Fractions beyond milliseconds are truncated, never rounded into the next second.
- The root plus 100 nested levels are walked.

---

## 📤 Output examples

| Input                                               | After conversion                                  |
| --------------------------------------------------- | ------------------------------------------------- |
| `{ date: '2023-07-17T23:06:00.000Z' }`              | `{ date: Date('2023-07-17T23:06:00.000Z') }`      |
| `{ date: '2023-07-17T23:06:00.000+01:00' }`         | `{ date: Date('2023-07-17T23:06:00.000+01:00') }` |
| `{ date: '2023-07-17T23:06:00' }`                   | `{ date: Date(...) }` in the local timezone       |
| `{ nested: { date: '2023-07-17T23:06:00.000Z' } }`  | `{ nested: { date: Date(...) } }`                 |
| `['2023-07-17T23:06:00.000Z']`                      | `[Date(...)]`                                     |
| `{ text: 'adam', number: 42, flag: true, n: null }` | untouched                                         |
| `{ d: '2023/07/17 23:06:00' }`                      | untouched (wrong format)                          |
| `{ d: '2023-02-30T00:00:00Z' }`                     | untouched (impossible calendar date)              |
| `{ d: '2023-07-17' }`                               | untouched (date-only)                             |

```text
// fetchJson
200 + body                   -> resolved value with Date instances in place of ISO strings
204, 205, or empty body      -> resolves to undefined
503                          -> rejects with FetchJsonError { status: 503, statusText: 'Service Unavailable' }
application/problem+json     -> rejects with a FetchJsonError recognised by isProblemDetailsError, even for HTTP 200
```

---

## ⚠️ Edge cases

- **Mutation in place.** The function returns `void` and rewrites your object. Clone first (`structuredClone`) if the caller needs the original strings.
- **Only arrays and plain objects are entered (11.0.0).** Class instances, `Map`, `Set`, `Date`, Buffers and typed arrays are left untouched, so running the converter twice is a no-op. Before 11.0.0 every non-null object was entered.
- **Prototype pollution is blocked.** Own `__proto__`, `constructor` and `prototype` keys are skipped entirely and never entered.
- **Cycles are safe.** Shared references and cycles are visited once.
- **Frozen or read-only values stay strings.** Frozen objects, non-writable properties, and getter-only properties are skipped rather than throwing mid-walk.
- **Past depth 100 nothing changes.** Deeper values stay strings; no error, no warning.
- **Invalid dates stay strings.** You never get an `Invalid Date` object out of this package.
- **Offset-less values are local time**, because that is what `new Date('2023-07-17T23:06:00')` does. Values with `Z` or an explicit offset are exact instants.
- **Date-only strings are never touched**, which avoids the classic "plain date silently became midnight UTC" bug.
- **Durations are not handled.** `P1Y2M3D` stays a string; use the `-date-fns`, `-dayjs`, `-luxon`, `-moment` or `-temporal` packages if your payload carries ISO durations.
- `hierarchicalConvertToDate` on a primitive, `null` or `undefined` is a no-op, so it is safe to call on any `unknown`.
- **`fetchJson` never converts problem responses.** Non-`ok` responses reject with `FetchJsonError` before the body is read; nonempty bodies must contain valid JSON or the call rejects with `SyntaxError`.

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

JSON Problem Details (`application/problem+json`) bypass success conversion, including HTTP 200 responses. Use the exported `isProblemDetailsError(error)` guard to read `httpStatus`, typed `problem` members, and the original decoded `body`. Extension members such as `errors` and `traceId` are preserved. See the repository [conversion contract](https://github.com/AdaskoTheBeAsT/date-interceptors/blob/main/docs/conversion-contract.md#json-problem-details) for transport-specific behavior.
