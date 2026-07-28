# 🌞 @adaskothebeast/hierarchical-convert-to-luxon

**Luxon bindings for [date-interceptors](https://github.com/AdaskoTheBeAsT/date-interceptors): walk a parsed JSON payload and turn ISO 8601 strings into `DateTime` and `Duration` values, plus a schema-driven Luxon backend for the typewriter runtime.**

[![npm](https://img.shields.io/npm/v/%40adaskothebeast%2Fhierarchical-convert-to-luxon?color=cb3837&logo=npm)](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-luxon)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

Peer dependencies: `@adaskothebeast/typewriter-runtime` (`10.0.0`), `luxon` (`^3.7.2`), `tslib` (`^2.8.1`). Published as CommonJS with `.d.ts` declarations, target ES2022.

---

## 📦 Install

```bash
npm i @adaskothebeast/hierarchical-convert-to-luxon luxon @adaskothebeast/typewriter-runtime
```

TypeScript users also need the community typings, because Luxon ships none of its own:

```bash
npm i -D @types/luxon
```

No time zone data package is required. Luxon reads IANA zones from the runtime `Intl` data, and `IANAZone.isValidZone` (used by the zoned codec) relies on it.

The runtime peer is only needed for `luxonDateBackend`. If you use nothing but `hierarchicalConvertToLuxon`, `luxon` alone is enough.

---

## 🎯 What it does

The package ships two independent pieces.

`hierarchicalConvertToLuxon` is the **schema-less** path. It walks an already-parsed JSON value depth first and replaces every string that looks like an ISO 8601 date-time or an ISO 8601 duration with a Luxon object, **mutating the input in place** and returning `void`. Nothing is cloned, so the object identity your caller holds stays the same. Traversal skips `__proto__`, `constructor` and `prototype` keys so a hostile payload cannot reach `Object.prototype`, uses `Object.hasOwn` so inherited enumerable properties are ignored, tracks visited objects in a `WeakSet` so circular graphs terminate, and gives up below a depth of 100.

`luxonDateBackend` is the **schema-driven** path. It is a plain object (`{ name: 'luxon', codecs }`) that satisfies the `DateBackend` contract from `@adaskothebeast/typewriter-runtime`, so you can hand it to `transformJson`, `createJsonTransformer`, `serializeJson` or `createJsonSerializer` as `options.dateBackend` and every date-ish schema node hydrates into Luxon instead of the default `Temporal` types.

---

## 🧰 API

| Export                                                                              | Signature / shape                                                                                                                                  | Notes                                                                                            |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `hierarchicalConvertToLuxon(obj: unknown, depth?: number, visited?: WeakSet): void`  | Mutates `obj` in place. `depth` defaults to `0`, `visited` to a fresh `WeakSet`; both are recursion bookkeeping and you normally pass only `obj`.    | Returns `undefined`. Non-objects and `null` are ignored.                                         |
| `luxonDateBackend`                                                                  | `{ readonly name: 'luxon'; readonly codecs: Record<DateSchemaKind, DateCodec> }`                                                                    | Declared with `satisfies DateBackend`, so it is a value, not a class. Nothing to instantiate.     |

`luxonDateBackend.codecs` covers every `DateSchemaKind`:

| Kind               | Luxon type | Wire form accepted by `parse`                                | `serialize` output                |
| ------------------ | ---------- | ------------------------------------------------------------ | --------------------------------- |
| `instant`          | `DateTime` | `2024-02-29T12:34:56.789+01:00`, offset or `Z` **required**   | `value.toUTC().toISO()`           |
| `plain-date`       | `DateTime` | `2024-02-29`                                                 | `value.toISODate()`               |
| `plain-time`       | `DateTime` | `12:34`, `12:34:56`, `12:34:56.789`                          | `toISOTime({ includeOffset: false })` |
| `plain-date-time`  | `DateTime` | `2024-02-29T12:34:56.789` (no offset)                        | `toISO({ includeOffset: false })` |
| `zoned-date-time`  | `DateTime` | `2024-07-01T12:34:56.789+02:00[Europe/Paris]`                | same bracketed form               |
| `duration`         | `Duration` | any ISO duration Luxon accepts, including `-P1Y2M3DT4H5M6.789S` | `value.toISO()`                |
| `period`           | `Duration` | identical to `duration` (the same codec object is reused)     | `value.toISO()`                   |
| `plain-year-month` | `DateTime` | `2024-02`                                                    | `toFormat('yyyy-MM')`             |
| `plain-month-day`  | `DateTime` | `--02-29`                                                    | `toFormat("'--'MM-dd")`           |

Every codec exposes `is`, `parse` and `serialize`. `parse` throws `RangeError` on anything it cannot represent; `is` returns `true` only for a Luxon value whose `isValid` is `true`.

---

## ⚡ Usage

Schema-less, over an Axios response:

```ts
import { AxiosInstanceManager } from '@adaskothebeast/axios-interceptor';
import { hierarchicalConvertToLuxon } from '@adaskothebeast/hierarchical-convert-to-luxon';

const api = AxiosInstanceManager.createInstance(hierarchicalConvertToLuxon);

const { data } = await api.get('/orders/42');
// data.createdAt is a luxon DateTime, data.slaWindow is a luxon Duration
```

Schema-less, over an Angular `HttpClient` response:

```ts
import { HIERARCHICAL_DATE_ADJUST_FUNCTION } from '@adaskothebeast/angular-date-http-interceptor';
import { hierarchicalConvertToLuxon } from '@adaskothebeast/hierarchical-convert-to-luxon';

providers: [
  { provide: HIERARCHICAL_DATE_ADJUST_FUNCTION, useValue: hierarchicalConvertToLuxon },
];
```

Direct call on any parsed payload:

```ts
import { hierarchicalConvertToLuxon } from '@adaskothebeast/hierarchical-convert-to-luxon';

const payload = JSON.parse(body) as unknown;
hierarchicalConvertToLuxon(payload);
```

Schema-driven, through the typewriter runtime:

```ts
import { luxonDateBackend } from '@adaskothebeast/hierarchical-convert-to-luxon';
import { schema } from '@adaskothebeast/typewriter-schema';
import { createJsonTransformer } from '@adaskothebeast/typewriter-runtime';
import type { DateTime, Duration } from 'luxon';

const orderSchema = schema.object<{ createdAt: DateTime; slaWindow: Duration }>({
  createdAt: schema.instant(),
  slaWindow: schema.duration(),
});

const toOrder = createJsonTransformer(orderSchema, undefined, {
  mode: 'strict',
  dateBackend: luxonDateBackend,
});

const order = toOrder({ createdAt: '2024-02-29T12:34:56.789+01:00', slaWindow: 'PT1H30M' });
// order.createdAt is a UTC DateTime, order.slaWindow is a Duration
```

---

## 🎛️ Options and configuration

`hierarchicalConvertToLuxon` has no options. The `depth` and `visited` parameters exist for the recursive calls; passing your own `visited` set lets you share cycle tracking across several payloads, and passing a `depth` above `100` makes the call a no-op.

`luxonDateBackend` has no options either. It is a stateless singleton value and is safe to share between transformers. Everything else is decided by the runtime:

- `mode: 'strict'` makes an unparsable value throw `JsonTransformationError`; the default tolerant mode leaves the raw string in place.
- `maxDepth` (runtime option, default `100`) caps schema recursion independently of the traversal cap above.
- Omit `dateBackend` and the runtime falls back to its built-in `temporalDateBackend`.

---

## 📤 Output examples

`hierarchicalConvertToLuxon`:

| Input value                    | Result                                                      |
| ------------------------------ | ----------------------------------------------------------- |
| `'2023-07-17T23:06:00.000Z'`   | `DateTime.fromISO('2023-07-17T23:06:00.000Z')` (local zone)  |
| `'2023-07-17T23:06:00.000+01:00'` | `DateTime.fromISO('2023-07-17T23:06:00.000+01:00')`       |
| `'2023-07-17T23:06:00'`        | unchanged string (19 characters, below the length gate)      |
| `'P0D'`                        | `Duration.fromObject({ days: 0 })`                          |
| `'P4W'`                        | `Duration.fromObject({ weeks: 4 })`                         |
| `'P1Y2M4DT2H3M2S'`             | `Duration.fromObject({ years: 1, months: 2, days: 4, hours: 2, minutes: 3, seconds: 2 })` |
| `'adam'`                       | unchanged                                                   |

```text
in : { someNewObj: { text: 'adam', date: '2023-07-17T23:06:00.000Z' } }
out: { someNewObj: { text: 'adam', date: DateTime } }     // same object, mutated
```

`luxonDateBackend`:

```text
instant          '2024-02-29T12:34:56.789+01:00' -> serialize -> '2024-02-29T11:34:56.789Z'
plain-time       '12:34:56.789'                  -> DateTime on 2000-01-01 -> '12:34:56.789'
zoned-date-time  '2024-07-01T12:34:56.789+02:00[Europe/Paris]' round-trips verbatim
duration         'P1DT2H' -> Duration { days: 1, hours: 2 }
```

---

## ⚠️ Edge cases

- **In-place mutation.** The traversal rewrites your object graph and returns nothing. Clone first (`structuredClone`, but note it cannot clone the Luxon objects afterwards) if the caller must keep the raw strings.
- **Prototype-pollution keys are skipped.** `__proto__`, `constructor` and `prototype` are never read or written, and only own properties (`Object.hasOwn`) are visited.
- **Depth cap of 100.** Once `depth > 100`, the branch is returned untouched with no error, so extremely deep payloads are silently left partly unconverted.
- **Cycles are visited once.** The shared `WeakSet` means a repeated object reference is skipped on the second encounter, so a node reachable through two paths is converted exactly once (which is fine, since conversion is idempotent per node).
- **Date strings must be at least 20 characters** and have `-`, `-`, `T` at indices 4, 7, 10. `2023-07-17T23:06:00` (no offset, 19 characters) therefore stays a string even though the regex would allow it, and so does `2023-07-17T23:06`.
- **Fractional seconds must be exactly three digits.** `2024-01-01T00:00:00.1Z` and `...000000Z` do not match, so they are left as strings.
- **The traversal duration regex is stricter than Luxon.** It accepts only unsigned integer components (`P…Y M W D T H M S`), so `PT1.5S`, `-P1D` and `PT1,5S` are not converted by `hierarchicalConvertToLuxon`, while `luxonDateBackend.codecs.duration` happily parses all of them.
- **Invalid values stay strings.** A matched date is assigned only when `DateTime.isValid`, a matched duration only when `Duration.isValid`. A string that matched the date shape returns early, so it is never retried as a duration.
- **Zones collapse to the system zone.** The traversal calls `DateTime.fromISO(v)` with no options, so an offset in the payload is honoured for the instant but the resulting `DateTime` is in the local zone. Call `.setZone('utc')` yourself if you need UTC, or use `luxonDateBackend.codecs.instant`, which parses with `setZone: true` and then normalizes with `toUTC()`.
- **`zoned-date-time` is strict about the zone.** `parse` requires the bracketed `…±HH:MM[Zone]` form, rejects a zone that `IANAZone.isValidZone` does not know, and rejects a payload whose offset disagrees with the zone at that instant (`2024-07-01T12:34:56+01:00[Europe/Paris]` throws `RangeError`). `serialize` throws when the `DateTime` carries a fixed offset or a local zone instead of a named IANA zone.
- **Codec `is` cannot tell one `DateTime` kind from another.** All eight `DateTime`-based codecs share the same `DateTime.isDateTime && isValid` guard, so an already-hydrated value passes through whichever kind the schema declares, and a `plain-date` node will accept a `DateTime` that also carries a time.
- **`duration` and `period` are the same codec.** Luxon has one `Duration` type, so a `period` schema node yields a `Duration` and a calendar-only `P1Y2M3D` and a time-only `PT4H` are equally valid for both kinds.
- **`plain-time` values are anchored to 2000-01-01 UTC** and `plain-month-day` to the year 2000, which is why `--02-29` round-trips (2000 was a leap year) while `--02-30` throws.
- Serialization can also fail: Luxon returns `null` from `toISO()` for values it cannot render, and the backend converts that into `RangeError: Unable to serialize …`.

---

## 🔗 Related packages

- Same job, other libraries: [`hierarchical-convert-to-date`](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-date), [`-date-fns`](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-date-fns), [`-dayjs`](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-dayjs), [`-moment`](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-moment), [`-js-joda`](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-js-joda), [`-temporal`](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-temporal)
- Other value kinds: [`-decimal`](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-decimal), [`-uuid`](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-uuid)
- Transports: [`angular-date-http-interceptor`](https://www.npmjs.com/package/@adaskothebeast/angular-date-http-interceptor), [`axios-interceptor`](https://www.npmjs.com/package/@adaskothebeast/axios-interceptor), [`react-redux-toolkit-hierarchical-date-hook`](https://www.npmjs.com/package/@adaskothebeast/react-redux-toolkit-hierarchical-date-hook)
- Schema stack: [`typewriter-schema`](https://www.npmjs.com/package/@adaskothebeast/typewriter-schema), [`typewriter-runtime`](https://www.npmjs.com/package/@adaskothebeast/typewriter-runtime), [`typewriter-http-angular`](https://www.npmjs.com/package/@adaskothebeast/typewriter-http-angular), [`typewriter-http-axios`](https://www.npmjs.com/package/@adaskothebeast/typewriter-http-axios), [`typewriter-http-fetch`](https://www.npmjs.com/package/@adaskothebeast/typewriter-http-fetch)

Full matrix and adapter recipes: [main README](https://github.com/AdaskoTheBeAsT/date-interceptors#readme).

---

## 📄 License

[MIT](./LICENSE) © Adam Pluciński
