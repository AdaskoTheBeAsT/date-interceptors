# 🧮 @adaskothebeast/hierarchical-convert-to-decimal

**Deep, in-place conversion of numeric strings inside JSON payloads into arbitrary precision `Decimal` instances, part of [date-interceptors](https://github.com/AdaskoTheBeAsT/date-interceptors).**

[![npm](https://img.shields.io/npm/v/%40adaskothebeast%2Fhierarchical-convert-to-decimal?color=cb3837&logo=npm)](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-decimal)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

Peer dependency: `decimal.js` (types ship with it, no companion `@types` needed). Runtime dependency: the dependency-free `@adaskothebeast/hierarchical-convert-core`.

---

## 📦 Install

```bash
npm i @adaskothebeast/hierarchical-convert-to-decimal decimal.js
```

---

## 🎯 What it does

Money and quantities are transported as JSON strings precisely because `JSON.parse` would round them into a double. This package closes the last gap: it walks a parsed payload, finds strings that are plain numeric literals, and replaces them with `new Decimal(value)` so the digits survive into your domain model.

```text
{ "total": "12345678901234567890.1234567890123456789" }
  -> total.toString() === '12345678901234567890.1234567890123456789'
```

The traversal is the same hardened walk used by the sibling date converters (shared through `hierarchical-convert-core`): arrays and plain objects only, own enumerable properties only, `__proto__` / `constructor` / `prototype` skipped, the root plus 100 nested levels, cycles visited once, frozen or read-only properties left alone. Conversion happens in place and the function returns `void`. The full traversal rules are in the repository [conversion contract](https://github.com/AdaskoTheBeAsT/date-interceptors/blob/main/docs/conversion-contract.md#heuristic-date-conversion).

Recognition is **content driven, not key driven**. There is no allow-list of field names and no path list, so any string that looks like a number becomes a `Decimal`. That is fast and zero-config, and it is also the reason the schema-driven [`@adaskothebeast/typewriter-runtime`](https://www.npmjs.com/package/@adaskothebeast/typewriter-runtime) path exists: only a schema can tell you that `"42"` is a quantity while `"007"` is a jersey number.

---

## 🧰 API

| Export                         | Signature                | Notes                                   |
| ------------------------------ | ------------------------ | --------------------------------------- |
| `hierarchicalConvertToDecimal` | `(obj: unknown) => void` | Mutates `obj` in place, returns `void`. |

Non-object inputs (`null`, numbers, strings, `undefined`) are accepted and ignored, so you can call it on any deserialized body without a guard. (Before 11.0.0 the signature also exposed internal `depth` and `visited` parameters.)

---

## ⚡ Usage

```ts
import { hierarchicalConvertToDecimal } from '@adaskothebeast/hierarchical-convert-to-decimal';
import Decimal from 'decimal.js';

const payload = {
  order: {
    reference: 'ORD-2023-07',
    total: '1999.99',
    lines: [
      { sku: 'A-1', unitPrice: '9.995', quantity: '3' },
      { sku: 'A-2', unitPrice: '0.005', quantity: '1' },
    ],
  },
};

hierarchicalConvertToDecimal(payload);

Decimal.isDecimal(payload.order.total); // true
payload.order.lines[0].unitPrice.times(3).toString(); // '29.985'
payload.order.reference; // 'ORD-2023-07' (unchanged)
```

As a `fetch` post-processing step:

```ts
async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const data = (await response.json()) as T;
  hierarchicalConvertToDecimal(data);
  return data;
}
```

Combined with a date converter, order does not matter because the two recognisers cannot claim the same string:

```ts
import { hierarchicalConvertToDate } from '@adaskothebeast/hierarchical-convert-to-date';

hierarchicalConvertToDate(payload);
hierarchicalConvertToDecimal(payload);
```

---

## 🎛️ Options and configuration

None. The only knob is which strings match, and that is fixed:

1. **Full match** against `^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$`.
2. **Construction** via `new Decimal(value)`, wrapped in a `try` / `catch` that silently leaves the string in place if construction throws.

| Accepted        | Rejected     |
| --------------- | ------------ |
| `123.45`        | `''`         |
| `-0.001`        | `' '`        |
| `+42`           | `'1 000'`    |
| `.5`            | `'1,000.00'` |
| `1.25e+8`       | `'NaN'`      |
| `42`            | `'Infinity'` |
| `7.`            | `'0x10'`     |
| `0000000000042` | `'1.2.3'`    |
|                 | `'1e'`       |

Global `decimal.js` configuration (`Decimal.set({ precision, rounding })`) is respected because the values are ordinary `Decimal` instances; it affects arithmetic, not the digits captured at construction time.

---

## 📤 Output examples

```ts
const input = {
  amount: '123.45',
  negative: '-0.001',
  signed: '+42',
  bare: '.5',
  exponential: '1.25e+8',
  huge: '12345678901234567890.1234567890123456789',
  thousands: '1,000.00',
  text: 'adam',
  alreadyNumber: 42,
};

hierarchicalConvertToDecimal(input);
```

```text
amount        -> Decimal 123.45
negative      -> Decimal -0.001
signed        -> Decimal 42
bare          -> Decimal 0.5
exponential   -> Decimal 125000000
huge          -> Decimal 12345678901234567890.1234567890123456789
thousands     -> '1,000.00'  (unchanged)
text          -> 'adam'      (unchanged)
alreadyNumber -> 42          (untouched, numbers are never wrapped)
```

Top-level arrays work as well: `['123.45', '-0.001']` becomes `[new Decimal('123.45'), new Decimal('-0.001')]`.

---

## ⚠️ Edge cases

- **Plain integers are converted.** `"42"`, `"007"` and `"+48123456789"` all match the regex, so string-encoded identifiers, postal codes, phone numbers, version strings like `"1.0"` and ordering keys become `Decimal` instances. This is the main false-positive risk; if your payload carries such fields, hydrate through a schema with [`@adaskothebeast/typewriter-runtime`](https://www.npmjs.com/package/@adaskothebeast/typewriter-runtime) instead, or run this converter on a narrowed subtree.
- **Leading zeros and trailing dots are normalised away.** `"007"` becomes `Decimal 7` and `"7."` becomes `Decimal 7`. If the original literal has to round-trip byte for byte, keep the string.
- **Numbers already parsed by `JSON.parse` are not touched.** Only strings are candidates, so precision lost before this function runs (an unquoted `1.005` in the JSON text) cannot be recovered here. Ask the server to quote the field.
- **Construction is lossless, arithmetic is not.** `new Decimal(...)` keeps every digit you pass, but `decimal.js` operations round to `Decimal.precision` (default 20 significant digits). Call `Decimal.set({ precision: 40 })` once at startup when you compute on 39-digit values.
- **Invalid input never throws out of the walk.** `new Decimal` throwing is caught silently and the string is preserved. In practice the regex makes this unreachable, since `decimal.js` accepts everything the regex accepts.
- **`NaN`, `Infinity` and `-Infinity` strings are rejected on purpose.** `decimal.js` would happily construct them; converting them silently would turn a data error into a poisoned computation.
- **Prototype pollution is blocked.** Own `__proto__`, `constructor` and `prototype` keys are skipped, so a hostile payload cannot reach `Object.prototype`. The side effect is that a nested object stored under a key literally named `constructor` or `prototype` is never traversed either.
- **Only arrays and plain objects are entered (11.0.0).** Class instances, `Map`, `Set`, Buffers, and existing `Decimal` values are left untouched, so running the converter twice is a no-op. Before 11.0.0 every non-null object was entered.
- **Frozen or read-only values stay strings.** Frozen objects, non-writable properties, and getter-only properties are skipped instead of throwing mid-walk.
- **Depth is capped.** The root plus 100 nested levels are walked; deeper strings stay strings. This is DoS protection against adversarially nested JSON.
- **Circular graphs are safe.** Visited objects are recorded, so `input.self = input` converts once and does not loop.
- **A converted value is no longer JSON-serializable as a number.** `JSON.stringify` on a `Decimal` yields a quoted string (`decimal.js` defines `toJSON`), so a round trip produces `"12.5"`, not `12.5`. Serialize explicitly (`value.toString()`, `value.toFixed(2)`) when the wire format matters.
- **Strings are terminal.** When a value is a string the walker does not recurse (a string has no children), so a non-matching string simply stays as it is.

---

## 🔗 Related packages

- Other value kinds: [`hierarchical-convert-to-uuid`](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-uuid), [`hierarchical-convert-to-date`](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-date), [`-date-fns`](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-date-fns), [`-dayjs`](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-dayjs), [`-luxon`](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-luxon), [`-moment`](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-moment), [`-js-joda`](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-js-joda), [`-temporal`](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-temporal)
- Transports: [`angular-date-http-interceptor`](https://www.npmjs.com/package/@adaskothebeast/angular-date-http-interceptor), [`axios-interceptor`](https://www.npmjs.com/package/@adaskothebeast/axios-interceptor), [`react-redux-toolkit-hierarchical-date-hook`](https://www.npmjs.com/package/@adaskothebeast/react-redux-toolkit-hierarchical-date-hook)
- Schema stack, for payloads where guessing is not acceptable: [`typewriter-schema`](https://www.npmjs.com/package/@adaskothebeast/typewriter-schema), [`typewriter-runtime`](https://www.npmjs.com/package/@adaskothebeast/typewriter-runtime), [`typewriter-http-angular`](https://www.npmjs.com/package/@adaskothebeast/typewriter-http-angular), [`typewriter-http-axios`](https://www.npmjs.com/package/@adaskothebeast/typewriter-http-axios), [`typewriter-http-fetch`](https://www.npmjs.com/package/@adaskothebeast/typewriter-http-fetch)

Full matrix and adapter recipes: [main README](https://github.com/AdaskoTheBeAsT/date-interceptors#readme).

---

## 📄 License

[MIT](./LICENSE) © Adam Pluciński
