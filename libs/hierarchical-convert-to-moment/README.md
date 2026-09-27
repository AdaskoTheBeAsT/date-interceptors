# ⏱️ @adaskothebeast/hierarchical-convert-to-moment

**Moment.js bindings for [date-interceptors](https://github.com/AdaskoTheBeAsT/date-interceptors): walk a parsed JSON payload and turn ISO 8601 strings into `Moment` and `moment.Duration` values, plus a schema-driven Moment backend for the typewriter runtime.**

[![npm](https://img.shields.io/npm/v/%40adaskothebeast%2Fhierarchical-convert-to-moment?color=cb3837&logo=npm)](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-moment)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

Peer dependencies: `moment` and, for the backend export, `@adaskothebeast/typewriter-runtime`. Runtime dependency: the dependency-free `@adaskothebeast/hierarchical-convert-core`.

---

## 📦 Install

```bash
npm i @adaskothebeast/hierarchical-convert-to-moment moment @adaskothebeast/typewriter-runtime
```

Moment ships its own typings, so no `@types/*` package is needed. `moment-timezone` is not used anywhere in this package; add it only if **your** code needs named IANA zones.

The runtime peer is only needed for `momentDateBackend`. If you use nothing but `hierarchicalConvertToMoment`, `moment` alone is enough.

---

## 🎯 What it does

The package ships two independent pieces.

`hierarchicalConvertToMoment` is the **schema-less** path. It walks the arrays and plain objects of an already-parsed JSON value depth first and replaces every ISO 8601 date-time or duration string with a Moment object, **mutating the input in place** and returning `void`. Nothing is cloned. Traversal is shared with the other converters through `hierarchical-convert-core`: own `__proto__`, `constructor` and `prototype` keys are skipped so a hostile payload cannot reach `Object.prototype`, class instances (including existing Moments) are not entered, cycles are visited once, and the root plus 100 nested levels are walked. The full rules and a per-backend duration precision table are in the repository [conversion contract](https://github.com/AdaskoTheBeAsT/date-interceptors/blob/main/docs/conversion-contract.md#heuristic-date-conversion).

`momentDateBackend` is the **schema-driven** path. It is a plain object (`{ name: 'moment', codecs }`) that satisfies the `DateBackend` contract from `@adaskothebeast/typewriter-runtime`, so you can hand it to `transformJson`, `createJsonTransformer`, `serializeJson` or `createJsonSerializer` as `options.dateBackend`. It deliberately advertises **only the four kinds Moment can represent faithfully**, so the runtime reports the rest as unsupported instead of quietly mangling them.

---

## 🧰 API

| Export                                            | Signature / shape                                                                                              | Notes                                                                                         |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `hierarchicalConvertToMoment(obj: unknown): void` | Mutates `obj` in place. (Before 11.0.0 the signature also exposed internal `depth` and `visited` parameters.)  | Returns `undefined`. Non-objects and `null` are ignored.                                      |
| `momentDateBackend`                               | `{ readonly name: 'moment'; readonly codecs: { instant, 'plain-date', 'plain-date-time', duration, period } }` | Declared with `satisfies DateBackend`, so it is a value, not a class. Nothing to instantiate. |

`momentDateBackend.codecs`:

| Kind              | Moment type       | Wire form accepted by `parse`                               | `serialize` output                  |
| ----------------- | ----------------- | ----------------------------------------------------------- | ----------------------------------- |
| `instant`         | `moment.Moment`   | `2024-01-02T03:04:05.678+02:00`, offset or `Z` **required** | `clone().utc().toISOString()`       |
| `plain-date`      | `moment.Moment`   | `2024-01-02` (strict `YYYY-MM-DD`)                          | `format('YYYY-MM-DD')`              |
| `plain-date-time` | `moment.Moment`   | `2024-01-02T03:04`, `…:05`, `…:05.678` (no offset)          | `format('YYYY-MM-DDTHH:mm:ss.SSS')` |
| `duration`        | `moment.Duration` | any signed ISO duration, for example `P1Y2M3DT4H5M6.7S`     | `value.toISOString()`               |
| `period`          | `moment.Duration` | identical to `duration` (the same codec object is reused)   | `value.toISOString()`               |

Not advertised, on purpose: `plain-time`, `zoned-date-time`, `plain-year-month`, `plain-month-day`. The unit tests assert their absence.

`is` is `moment.isMoment` for the three instant-like codecs and `moment.isDuration` for the duration codec. `parse` throws `RangeError` on anything it cannot represent.

---

## ⚡ Usage

Schema-less, over an Axios response:

```ts
import { AxiosInstanceManager } from '@adaskothebeast/axios-interceptor';
import { hierarchicalConvertToMoment } from '@adaskothebeast/hierarchical-convert-to-moment';

const api = AxiosInstanceManager.createInstance(hierarchicalConvertToMoment);

const { data } = await api.get('/orders/42');
// data.createdAt is a Moment, data.slaWindow is a moment.Duration
```

Schema-less, over an Angular `HttpClient` response:

```ts
import { HIERARCHICAL_DATE_ADJUST_FUNCTION } from '@adaskothebeast/angular-date-http-interceptor';
import { hierarchicalConvertToMoment } from '@adaskothebeast/hierarchical-convert-to-moment';

providers: [{ provide: HIERARCHICAL_DATE_ADJUST_FUNCTION, useValue: hierarchicalConvertToMoment }];
```

Direct call on any parsed payload:

```ts
import { hierarchicalConvertToMoment } from '@adaskothebeast/hierarchical-convert-to-moment';

const payload = JSON.parse(body) as unknown;
hierarchicalConvertToMoment(payload);
```

Schema-driven, through the typewriter runtime:

```ts
import { momentDateBackend } from '@adaskothebeast/hierarchical-convert-to-moment';
import { createJsonTransformer } from '@adaskothebeast/typewriter-runtime';
import { schema } from '@adaskothebeast/typewriter-schema';
import type moment from 'moment';

const orderSchema = schema.object<{ createdAt: moment.Moment; slaWindow: moment.Duration }>({
  createdAt: schema.instant(),
  slaWindow: schema.duration(),
});

const toOrder = createJsonTransformer(orderSchema, undefined, {
  mode: 'strict',
  dateBackend: momentDateBackend,
});

const order = toOrder({ createdAt: '2024-01-02T03:04:05.678+02:00', slaWindow: 'PT1H30M' });
// order.createdAt is a Moment already switched to UTC mode
```

---

## 🎛️ Options and configuration

`hierarchicalConvertToMoment` has no options.

`momentDateBackend` has no options either. It is a singleton value and is safe to share between transformers. Everything else is decided by the runtime:

- `mode: 'strict'` makes an unparsable value, or a kind this backend does not advertise, throw `JsonTransformationError`; the default tolerant mode leaves the raw string in place.
- `maxDepth` (runtime option, default `100`) caps schema recursion independently of the traversal cap above.
- Omit `dateBackend` and the runtime falls back to its built-in `temporalDateBackend`.

---

## 📤 Output examples

`hierarchicalConvertToMoment`:

| Input value                       | Result                                                                                |
| --------------------------------- | ------------------------------------------------------------------------------------- |
| `'2023-07-17T23:06:00.000Z'`      | `moment('2023-07-17T23:06:00.000Z')` (local mode)                                     |
| `'2023-07-17T23:06:00.000+01:00'` | `moment('2023-07-17T23:06:00.000+01:00')` (shifted to the local zone)                 |
| `'2023-07-17T23:06:00'`           | `moment('2023-07-17T23:06:00')` (local time)                                          |
| `'2023-02-30T00:00:00Z'`          | unchanged string (impossible calendar date)                                           |
| `'-PT1,5S'`                       | `moment.duration(-1500)` (sign and decimal comma accepted natively)                   |
| `'P0D'`                           | `moment.duration({ days: 0 })`                                                        |
| `'P4W'`                           | `moment.duration({ weeks: 4 })`, stored internally as 28 days                         |
| `'P1Y2M4DT2H3M2S'`                | `moment.duration({ years: 1, months: 2, days: 4, hours: 2, minutes: 3, seconds: 2 })` |
| `'adam'`                          | unchanged                                                                             |

```text
in : { someNewObj: { text: 'adam', date: '2023-07-17T23:06:00.000Z' } }
out: { someNewObj: { text: 'adam', date: Moment } }       // same object, mutated
```

`momentDateBackend`:

```text
instant          '2024-01-02T03:04:05.678+02:00' -> UTC Moment -> '2024-01-02T01:04:05.678Z'
plain-date       '2024-01-02'                    -> local midnight Moment -> '2024-01-02'
plain-date-time  '2024-01-02T03:04:05.678'       -> local Moment -> '2024-01-02T03:04:05.678'
plain-date-time  '2024-01-02T03:04'              -> local Moment -> '2024-01-02T03:04:00.000'
duration         'P1Y2M3DT4H5M6.7S'              -> Duration -> 'P1Y2M3DT4H5M6.7S'
```

---

## ⚠️ Edge cases

- **In-place mutation.** The traversal rewrites your object graph and returns nothing. Clone the payload first if the caller must keep the raw strings.
- **Prototype-pollution keys are skipped.** Own `__proto__`, `constructor` and `prototype` keys are never entered or written, and only own enumerable properties are visited.
- **Only arrays and plain objects are entered (11.0.0).** Class instances, `Map`, `Set`, and existing Moments are left untouched, so running the converter twice is a no-op. Before 11.0.0 a second pass entered each Moment and rewrote its internal `_i` input field into another Moment. Frozen objects and read-only properties keep their strings instead of throwing.
- **Depth cap.** The root plus 100 nested levels are walked; deeper branches are left untouched with no error.
- **Cycles are visited once.** A repeated object reference is skipped on the second encounter.
- **Seconds are required and fractions are truncated.** `2023-07-17T23:06` stays a string. One to nine fraction digits are accepted and truncated (never rounded) to milliseconds.
- **No Moment deprecation warnings from the traversal.** Every candidate is validated by the shared ISO recogniser before `moment(v)` is called, so the library never falls back to `new Date(string)` and never prints the "not in a recognized ISO format" warning. That also means anything Moment could have salvaged loosely (`07/17/2023`, `2023-07-17 23:06`) is intentionally left alone.
- **Durations are not validity checked by the traversal.** A recognised duration string is passed to `moment.duration` and assigned, unlike dates, which are assigned only when `isValid()` is true. The shared duration syntax is strict enough that this is safe in practice.
- **The traversal duration syntax is narrower than Moment's.** Signed durations and fractional seconds with `.` or `,` convert, but fractions on larger units such as `P1.5D` stay strings, while `momentDateBackend.codecs.duration` accepts them. `toISOString()` renders sub-millisecond seconds as milliseconds (`PT0.123456789S` becomes `PT0.123S`).
- **Moment carries units, so duration shapes change.** `moment.duration` normalizes on construction: 90 minutes becomes 1 hour 30 minutes, weeks are stored as days, and `toISOString()` therefore re-serializes `P1W` in day form rather than as weeks. Keep the original string next to the parsed value if the exact authored unit matters.
- **Local versus UTC mode.** The traversal produces local-mode Moments, so `.format()` renders in the machine zone. The `instant` codec explicitly does `parseZone(..., ISO_8601, true).utc()`, so its results are already in UTC mode (`value.isUTC() === true`). `plain-date` and `plain-date-time` are parsed in local mode on purpose so that no zone shift can change the calendar day.
- **`plain-date-time` serialization is asymmetric.** Input may omit seconds and milliseconds, but output is always `YYYY-MM-DDTHH:mm:ss.SSS`, so `2024-01-02T03:04` round-trips to `2024-01-02T03:04:00.000`. Its parse pattern also requires exactly three fractional digits when present, while `instant` accepts one to three.
- **`is` does not check validity.** `moment.isMoment` is `true` for `moment('nope')` and `moment.invalid()`, so an invalid Moment already present in the input is passed through untouched by the runtime, and the failure only surfaces later as `RangeError: Invalid instant value` when you serialize.
- **`is` cannot distinguish the three Moment kinds** from each other, so an `instant` value satisfies a `plain-date` node and vice versa. Only the string parse paths are strict.
- **Four kinds are unsupported by design.** A `plain-time`, `zoned-date-time`, `plain-year-month` or `plain-month-day` schema node produces `Date backend "moment" does not support …`: a thrown `JsonTransformationError` in strict mode, or the untouched string in tolerant mode. Use [`-js-joda`](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-js-joda) or [`-luxon`](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-luxon) if you need them.
- Moment is in maintenance mode upstream. For new code prefer the Luxon, Day.js or js-joda packages; both backends can coexist during a gradual migration because the choice is per transformer.

---

## 🔗 Related packages

- Same job, other libraries: [`hierarchical-convert-to-date`](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-date), [`-date-fns`](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-date-fns), [`-dayjs`](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-dayjs), [`-luxon`](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-luxon), [`-js-joda`](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-js-joda), [`-temporal`](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-temporal)
- Other value kinds: [`-decimal`](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-decimal), [`-uuid`](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-uuid)
- Transports: [`angular-date-http-interceptor`](https://www.npmjs.com/package/@adaskothebeast/angular-date-http-interceptor), [`axios-interceptor`](https://www.npmjs.com/package/@adaskothebeast/axios-interceptor), [`react-redux-toolkit-hierarchical-date-hook`](https://www.npmjs.com/package/@adaskothebeast/react-redux-toolkit-hierarchical-date-hook)
- Schema stack: [`typewriter-schema`](https://www.npmjs.com/package/@adaskothebeast/typewriter-schema), [`typewriter-runtime`](https://www.npmjs.com/package/@adaskothebeast/typewriter-runtime), [`typewriter-http-angular`](https://www.npmjs.com/package/@adaskothebeast/typewriter-http-angular), [`typewriter-http-axios`](https://www.npmjs.com/package/@adaskothebeast/typewriter-http-axios), [`typewriter-http-fetch`](https://www.npmjs.com/package/@adaskothebeast/typewriter-http-fetch)

Full matrix and adapter recipes: [main README](https://github.com/AdaskoTheBeAsT/date-interceptors#readme).

---

## 📄 License

[MIT](./LICENSE) © Adam Pluciński
