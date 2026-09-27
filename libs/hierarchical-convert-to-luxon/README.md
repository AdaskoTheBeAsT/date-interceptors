# 🌞 @adaskothebeast/hierarchical-convert-to-luxon

**Luxon bindings for [date-interceptors](https://github.com/AdaskoTheBeAsT/date-interceptors): walk a parsed JSON payload and turn ISO 8601 strings into `DateTime` and `Duration` values, plus a schema-driven Luxon backend for the typewriter runtime.**

[![npm](https://img.shields.io/npm/v/%40adaskothebeast%2Fhierarchical-convert-to-luxon?color=cb3837&logo=npm)](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-luxon)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

Peer dependencies: `luxon` and, for the backend export, `@adaskothebeast/typewriter-runtime`. Runtime dependency: the dependency-free `@adaskothebeast/hierarchical-convert-core`.

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

`hierarchicalConvertToLuxon` is the **schema-less** path. It walks the arrays and plain objects of an already-parsed JSON value depth first and replaces every ISO 8601 date-time or duration string with a Luxon object, **mutating the input in place** and returning `void`. Nothing is cloned, so the object identity your caller holds stays the same. Traversal is shared with the other converters through `hierarchical-convert-core`: own `__proto__`, `constructor` and `prototype` keys are skipped so a hostile payload cannot reach `Object.prototype`, class instances (including existing Luxon values) are not entered, cycles are visited once, and the root plus 100 nested levels are walked. The full rules and a per-backend duration precision table are in the repository [conversion contract](https://github.com/AdaskoTheBeAsT/date-interceptors/blob/main/docs/conversion-contract.md#heuristic-date-conversion).

`luxonDateBackend` is the **schema-driven** path. It is a plain object (`{ name: 'luxon', codecs }`) that satisfies the `DateBackend` contract from `@adaskothebeast/typewriter-runtime`, so you can hand it to `transformJson`, `createJsonTransformer`, `serializeJson` or `createJsonSerializer` as `options.dateBackend` and every date-ish schema node hydrates into Luxon instead of the default `Temporal` types.

---

## 🧰 API

| Export                                           | Signature / shape                                                                                             | Notes                                                                                         |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `hierarchicalConvertToLuxon(obj: unknown): void` | Mutates `obj` in place. (Before 11.0.0 the signature also exposed internal `depth` and `visited` parameters.) | Returns `undefined`. Non-objects and `null` are ignored.                                      |
| `luxonDateBackend`                               | `{ readonly name: 'luxon'; readonly codecs: Record<DateSchemaKind, DateCodec> }`                              | Declared with `satisfies DateBackend`, so it is a value, not a class. Nothing to instantiate. |

`luxonDateBackend.codecs` covers every `DateSchemaKind`:

| Kind               | Luxon type | Wire form accepted by `parse`                                   | `serialize` output                    |
| ------------------ | ---------- | --------------------------------------------------------------- | ------------------------------------- |
| `instant`          | `DateTime` | `2024-02-29T12:34:56.789+01:00`, offset or `Z` **required**     | `value.toUTC().toISO()`               |
| `plain-date`       | `DateTime` | `2024-02-29`                                                    | `value.toISODate()`                   |
| `plain-time`       | `DateTime` | `12:34`, `12:34:56`, `12:34:56.789`                             | `toISOTime({ includeOffset: false })` |
| `plain-date-time`  | `DateTime` | `2024-02-29T12:34:56.789` (no offset)                           | `toISO({ includeOffset: false })`     |
| `zoned-date-time`  | `DateTime` | `2024-07-01T12:34:56.789+02:00[Europe/Paris]`                   | same bracketed form                   |
| `duration`         | `Duration` | any ISO duration Luxon accepts, including `-P1Y2M3DT4H5M6.789S` | `value.toISO()`                       |
| `period`           | `Duration` | identical to `duration` (the same codec object is reused)       | `value.toISO()`                       |
| `plain-year-month` | `DateTime` | `2024-02`                                                       | `toFormat('yyyy-MM')`                 |
| `plain-month-day`  | `DateTime` | `--02-29`                                                       | `toFormat("'--'MM-dd")`               |

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

providers: [{ provide: HIERARCHICAL_DATE_ADJUST_FUNCTION, useValue: hierarchicalConvertToLuxon }];
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
import { createJsonTransformer } from '@adaskothebeast/typewriter-runtime';
import { schema } from '@adaskothebeast/typewriter-schema';
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

`hierarchicalConvertToLuxon` has no options.

`luxonDateBackend` has no options either. It is a stateless singleton value and is safe to share between transformers. Everything else is decided by the runtime:

- `mode: 'strict'` makes an unparsable value throw `JsonTransformationError`; the default tolerant mode leaves the raw string in place.
- `maxDepth` (runtime option, default `100`) caps schema recursion independently of the traversal cap above.
- Omit `dateBackend` and the runtime falls back to its built-in `temporalDateBackend`.

---

## 📤 Output examples

`hierarchicalConvertToLuxon`:

| Input value                       | Result                                                                                    |
| --------------------------------- | ----------------------------------------------------------------------------------------- |
| `'2023-07-17T23:06:00.000Z'`      | `DateTime.fromISO('2023-07-17T23:06:00.000Z')` (local zone)                               |
| `'2023-07-17T23:06:00.000+01:00'` | `DateTime.fromISO('2023-07-17T23:06:00.000+01:00')`                                       |
| `'2023-07-17T23:06:00'`           | `DateTime` in the local zone                                                              |
| `'2023-02-30T00:00:00Z'`          | unchanged string (impossible calendar date)                                               |
| `'PT1,5S'`                        | `Duration` of 1.5 seconds (Luxon accepts the comma natively)                              |
| `'P0D'`                           | `Duration.fromObject({ days: 0 })`                                                        |
| `'P4W'`                           | `Duration.fromObject({ weeks: 4 })`                                                       |
| `'P1Y2M4DT2H3M2S'`                | `Duration.fromObject({ years: 1, months: 2, days: 4, hours: 2, minutes: 3, seconds: 2 })` |
| `'adam'`                          | unchanged                                                                                 |

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
- **Prototype-pollution keys are skipped.** Own `__proto__`, `constructor` and `prototype` keys are never entered or written, and only own enumerable properties are visited.
- **Only arrays and plain objects are entered (11.0.0).** Class instances, `Map`, `Set`, and existing Luxon values are left untouched, so running the converter twice is a no-op. Frozen objects and read-only properties keep their strings instead of throwing.
- **Depth cap.** The root plus 100 nested levels are walked; deeper branches are left untouched with no error.
- **Cycles are visited once.** A node reachable through two paths is converted exactly once.
- **Seconds are required and fractions are truncated.** `2023-07-17T23:06` stays a string. One to nine fraction digits are accepted and truncated (never rounded) to milliseconds.
- **The traversal duration syntax is narrower than Luxon's.** Signed durations (`-PT1.5S`) and fractional seconds with `.` or `,` convert, but fractions on larger units such as `P1.5D` stay strings, while `luxonDateBackend.codecs.duration` parses them. Sub-millisecond seconds are truncated to milliseconds (`PT0.123456789S` becomes `PT0.123S`); weeks are kept.
- **Invalid values stay strings.** Impossible calendar or clock values are rejected before Luxon sees them, and a date or duration is assigned only when Luxon reports `isValid`.
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
