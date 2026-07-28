# 🔖 @adaskothebeast/hierarchical-convert-to-uuid

**Deep, in-place conversion of canonical UUID strings inside JSON payloads into 16 byte `Uint8Array` values, part of [date-interceptors](https://github.com/AdaskoTheBeAsT/date-interceptors).**

[![npm](https://img.shields.io/npm/v/%40adaskothebeast%2Fhierarchical-convert-to-uuid?color=cb3837&logo=npm)](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-uuid)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

Single peer dependency: `uuid ^14.0.1` (its `parse` does the validation and the hex decoding). ESM build, version `10.0.0`.

---

## 📦 Install

```bash
npm i @adaskothebeast/hierarchical-convert-to-uuid uuid
```

---

## 🎯 What it does

Walks a parsed JSON payload and replaces every canonical, RFC valid UUID string with its 16 byte binary form:

```text
{ "id": "550e8400-e29b-41d4-a716-446655440000" }
  -> id === Uint8Array [ 85, 14, 132, 0, 226, 155, 65, 212, 167, 22, 68, 102, 85, 68, 0, 0 ]
```

Bytes, not a normalised string. That is the whole point: byte form is compact, comparable and directly usable when you re-encode identifiers for a binary protocol, a `Uint8Array` backed cache key or a database driver that wants raw bytes. If you wanted lowercase strings you would not need a converter at all.

The traversal is the same hardened walk used by the sibling date converters: own enumerable properties only, arrays included, `__proto__` / `constructor` / `prototype` skipped, depth capped at 100, circular references tracked with a `WeakSet`. Conversion happens in place and the function returns `void`.

Recognition is **content driven, not key driven**. There is no allow-list of field names, so a UUID-shaped value in a `note` field is converted just like the one in `id`. Where that is unacceptable, hydrate through a schema with [`@adaskothebeast/typewriter-runtime`](https://www.npmjs.com/package/@adaskothebeast/typewriter-runtime) instead.

---

## 🧰 API

| Export                      | Signature                                                          | Notes                                                                                                    |
| --------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `hierarchicalConvertToUuid` | `(obj: unknown, depth?: number, visited?: WeakSet<object>) => void` | Mutates `obj` in place, returns `void`. `depth` defaults to `0`, `visited` defaults to a fresh `WeakSet`. |

Non-object inputs (`null`, numbers, strings, `undefined`) are accepted and ignored, so you can call it on any deserialized body without a guard.

`depth` and `visited` are recursion plumbing. Passing a non-zero `depth` shrinks the remaining budget (the walk stops once `depth > 100`); passing a pre-populated `visited` set makes those objects be skipped.

---

## ⚡ Usage

```ts
import { hierarchicalConvertToUuid } from '@adaskothebeast/hierarchical-convert-to-uuid';
import { stringify } from 'uuid';

const payload = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  name: 'Adam',
  children: [{ id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8' }],
};

hierarchicalConvertToUuid(payload);

payload.id instanceof Uint8Array; // true
payload.id.length; // 16
stringify(payload.id); // '550e8400-e29b-41d4-a716-446655440000'
payload.name; // 'Adam' (unchanged)
```

As a `fetch` post-processing step:

```ts
async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const data = (await response.json()) as T;
  hierarchicalConvertToUuid(data);
  return data;
}
```

Comparing two identifiers after conversion, since `Uint8Array` has no value equality:

```ts
function sameUuid(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((byte, index) => byte === b[index]);
}
```

---

## 🎛️ Options and configuration

None. The recogniser is fixed and runs in two stages:

1. **Fast rejection.** The value must be a string of exactly 36 characters with `-` at indexes 8, 13, 18 and 23. Anything else skips the regex entirely.
2. **Validation and decoding** via `parse` from `uuid`, which accepts only

   ```text
   /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}
      |00000000-0000-0000-0000-000000000000
      |ffffffff-ffff-ffff-ffff-ffffffffffff)$/i
   ```

   so the version nibble must be `1` to `8` and the variant nibble must be `8`, `9`, `a` or `b`, with the nil and max UUIDs allowed as explicit exceptions. A `TypeError` from `parse` is swallowed and the original string is left in place.

| Input                                    | Result                                       |
| ---------------------------------------- | -------------------------------------------- |
| `550e8400-e29b-41d4-a716-446655440000`   | 16 bytes (v4)                                |
| `6ba7b810-9dad-11d1-80b4-00c04fd430c8`   | 16 bytes (v1)                                |
| `550E8400-E29B-41D4-A716-446655440000`   | 16 bytes, same bytes as the lowercase form   |
| `00000000-0000-0000-0000-000000000000`   | 16 zero bytes (nil UUID)                     |
| `ffffffff-ffff-ffff-ffff-ffffffffffff`   | 16 `0xff` bytes (max UUID)                   |
| `550e8400-e29b-91d4-a716-446655440000`   | unchanged (version `9` is not valid)         |
| `550e8400e29b41d4a716446655440000`       | unchanged (no hyphens, 32 characters)        |
| `{550e8400-e29b-41d4-a716-446655440000}` | unchanged (braced form, 38 characters)       |
| `urn:uuid:550e8400-...`                  | unchanged (URN form)                         |

---

## 📤 Output examples

```ts
const input = {
  v4: '550e8400-e29b-41d4-a716-446655440000',
  upper: '550E8400-E29B-41D4-A716-446655440000',
  nil: '00000000-0000-0000-0000-000000000000',
  badVersion: '550e8400-e29b-91d4-a716-446655440000',
  truncated: '550e8400-e29b-41d4-a716-44665544000',
  text: 'not-a-uuid',
};

hierarchicalConvertToUuid(input);
```

```text
v4         -> Uint8Array(16) [85, 14, 132, 0, 226, 155, 65, 212, 167, 22, 68, 102, 85, 68, 0, 0]
upper      -> Uint8Array(16) [85, 14, 132, 0, 226, 155, 65, 212, 167, 22, 68, 102, 85, 68, 0, 0]
nil        -> Uint8Array(16) [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
badVersion -> '550e8400-e29b-91d4-a716-446655440000'  (unchanged)
truncated  -> '550e8400-e29b-41d4-a716-44665544000'   (unchanged, 35 characters)
text       -> 'not-a-uuid'                            (unchanged)
```

Top-level arrays work as well: `['550e8400-e29b-41d4-a716-446655440000']` becomes an array holding one `Uint8Array`.

---

## ⚠️ Edge cases

- **The result is bytes, so it is no longer JSON friendly.** `JSON.stringify` turns a `Uint8Array` into `{"0":85,"1":14,...}`, not a UUID string. Re-encode with `stringify` from `uuid` before sending the object back, or keep a converted copy separate from the outbound payload.
- **`Uint8Array` has no value equality.** `a === b` is false for two equal identifiers, `Map` and `Set` keys will not dedupe, and `JSON.stringify` comparisons are misleading. Compare byte by byte (see the helper above) or convert back to a string for keys.
- **Version and variant are enforced.** `550e8400-e29b-91d4-a716-446655440000` (version `9`) stays a string, so non-RFC identifiers are not silently accepted. The nil UUID and the max UUID are accepted as special cases.
- **Only the canonical hyphenated form is recognised.** The 32-character no-dash form, the braced `{...}` .NET "B" form and the `urn:uuid:` form all fail the length and hyphen-position gate, and any other 36-character string fails the regex.
- **Case is normalised into bytes.** Uppercase input produces exactly the same bytes as lowercase input, so the original casing is lost. If a backend echoes identifiers case-sensitively, keep the string.
- **Byte order is RFC 9562 network order,** the same order `uuid`'s `stringify` expects. .NET `Guid.ToByteArray()` uses a mixed-endian layout for the first three fields, so a service doing `new Guid(bytes)` on these bytes sees a different identifier unless it re-orders them (or uses `Guid.Parse` on a re-encoded string).
- **Failures are silent.** Unlike the date and decimal converters, an invalid UUID string produces no `console.warn`; the `TypeError` from `parse` is caught and ignored, and the value is left as it was.
- **False positives are possible.** Any 36-character string that satisfies the RFC layout is converted regardless of the field name, so a UUID pasted into a free-text field becomes bytes too. The schema-driven [`@adaskothebeast/typewriter-runtime`](https://www.npmjs.com/package/@adaskothebeast/typewriter-runtime) path exists for payloads where that matters.
- **Prototype pollution is blocked.** The keys `__proto__`, `constructor` and `prototype` are skipped, so a hostile payload cannot reach `Object.prototype`. The side effect is that a nested object stored under a key literally named `constructor` or `prototype` is never traversed either.
- **Inherited properties are ignored,** every key passes an `Object.hasOwn` check.
- **Depth is capped at 100.** Once `depth > 100` the walk returns and deeper strings stay strings; this is DoS protection against adversarially nested JSON.
- **Circular graphs are safe.** A `WeakSet` records visited objects, so `input.self = input` converts once and does not loop.
- **Running the converter twice is harmless.** An already converted value is a `Uint8Array`, and although the walk does descend into it, its indexed properties hold numbers rather than strings, so nothing is converted a second time.

---

## 🔗 Related packages

- Other value kinds: [`hierarchical-convert-to-decimal`](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-decimal), [`hierarchical-convert-to-date`](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-date), [`-date-fns`](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-date-fns), [`-dayjs`](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-dayjs), [`-luxon`](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-luxon), [`-moment`](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-moment), [`-js-joda`](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-js-joda), [`-temporal`](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-temporal)
- Transports: [`angular-date-http-interceptor`](https://www.npmjs.com/package/@adaskothebeast/angular-date-http-interceptor), [`axios-interceptor`](https://www.npmjs.com/package/@adaskothebeast/axios-interceptor), [`react-redux-toolkit-hierarchical-date-hook`](https://www.npmjs.com/package/@adaskothebeast/react-redux-toolkit-hierarchical-date-hook)
- Schema stack, for payloads where guessing is not acceptable: [`typewriter-schema`](https://www.npmjs.com/package/@adaskothebeast/typewriter-schema), [`typewriter-runtime`](https://www.npmjs.com/package/@adaskothebeast/typewriter-runtime), [`typewriter-http-angular`](https://www.npmjs.com/package/@adaskothebeast/typewriter-http-angular), [`typewriter-http-axios`](https://www.npmjs.com/package/@adaskothebeast/typewriter-http-axios), [`typewriter-http-fetch`](https://www.npmjs.com/package/@adaskothebeast/typewriter-http-fetch)

Full matrix and adapter recipes: [main README](https://github.com/AdaskoTheBeAsT/date-interceptors#readme).

---

## 📄 License

[MIT](./LICENSE) © Adam Pluciński
