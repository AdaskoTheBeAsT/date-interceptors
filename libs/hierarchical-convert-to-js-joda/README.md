# 🕰️ @adaskothebeast/hierarchical-convert-to-js-joda

**js-joda bindings for [date-interceptors](https://github.com/AdaskoTheBeAsT/date-interceptors): walk a parsed JSON payload and turn ISO 8601 date-times into `ZonedDateTime` values, plus a schema-driven js-joda backend that covers every date kind with its own dedicated type.**

[![npm](https://img.shields.io/npm/v/%40adaskothebeast%2Fhierarchical-convert-to-js-joda?color=cb3837&logo=npm)](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-js-joda)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

Peer dependencies: `@adaskothebeast/typewriter-runtime` (`10.0.0`), `@js-joda/core` (`^6.1.0`), `@js-joda/timezone` (`^2.25.2`), `tslib` (`^2.8.1`). Published as CommonJS with `.d.ts` declarations, target ES2022.

---

## 📦 Install

```bash
npm i @adaskothebeast/hierarchical-convert-to-js-joda @js-joda/core @js-joda/timezone @adaskothebeast/typewriter-runtime
```

`@js-joda/timezone` is **not optional**: both modules in this package `require('@js-joda/timezone')` at load time so that named IANA zones such as `[Europe/Paris]` resolve. That is a load-time side effect, so a bundler must not treat these modules as side-effect free, and the zone database ends up in your bundle.

js-joda ships its own typings, so no `@types/*` package is needed.

---

## 🎯 What it does

The package ships two independent pieces.

`hierarchicalConvertToJsJoda` is the **schema-less** path. It walks an already-parsed JSON value depth first and replaces every string that looks like an ISO 8601 date-time with a `ZonedDateTime`, **mutating the input in place** and returning `void`. Nothing is cloned. Unlike the Luxon and Moment siblings it converts dates only; ISO duration strings such as `P1Y2M4D` are left untouched, because js-joda splits that space into `Duration` and `Period` and the traversal has no way to pick one. Traversal skips `__proto__`, `constructor` and `prototype` keys so a hostile payload cannot reach `Object.prototype`, uses `Object.hasOwn` so inherited enumerable properties are ignored, tracks visited objects in a `WeakSet` so circular graphs terminate, and gives up below a depth of 100.

`jsJodaDateBackend` is the **schema-driven** path. It is a plain object (`{ name: 'js-joda', codecs }`) that satisfies the `DateBackend` contract from `@adaskothebeast/typewriter-runtime`, so you can hand it to `transformJson`, `createJsonTransformer`, `serializeJson` or `createJsonSerializer` as `options.dateBackend`. It is the most faithful backend in the workspace: every schema kind maps to a distinct js-joda class, so `instant`, `plain-date` and `period` can never be confused with each other, and nanosecond precision survives a round trip.

---

## 🧰 API

| Export                                                                                | Signature / shape                                                                                                                               | Notes                                                                                        |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `hierarchicalConvertToJsJoda(obj: unknown, depth?: number, visited?: WeakSet): void`   | Mutates `obj` in place. `depth` defaults to `0`, `visited` to a fresh `WeakSet`; both are recursion bookkeeping and you normally pass only `obj`. | Returns `undefined`. Non-objects and `null` are ignored. Dates only, no durations.            |
| `jsJodaDateBackend`                                                                   | `{ readonly name: 'js-joda'; readonly codecs: Record<DateSchemaKind, DateCodec> }`                                                               | Declared with `satisfies DateBackend`, so it is a value, not a class. Nothing to instantiate. |

`jsJodaDateBackend.codecs` covers every `DateSchemaKind`, and every `serialize` is simply `value.toString()`:

| Kind               | js-joda type    | `parse`                | Example wire value                            |
| ------------------ | --------------- | ---------------------- | --------------------------------------------- |
| `instant`          | `Instant`       | `Instant.parse`        | `2024-01-02T03:04:05.123456789Z`              |
| `plain-date`       | `LocalDate`     | `LocalDate.parse`      | `2024-07-21`                                  |
| `plain-time`       | `LocalTime`     | `LocalTime.parse`      | `12:34:56.123456789`                          |
| `plain-date-time`  | `LocalDateTime` | `LocalDateTime.parse`  | `2024-07-21T12:34:56.123456789`               |
| `zoned-date-time`  | `ZonedDateTime` | `ZonedDateTime.parse`  | `2024-01-02T03:04:05+01:00[Europe/Paris]`     |
| `duration`         | `Duration`      | `Duration.parse`       | `PT26H3M4.005S`                               |
| `period`           | `Period`        | `Period.parse`         | `P1Y2M3D`                                     |
| `plain-year-month` | `YearMonth`     | `YearMonth.parse`      | `2024-07`                                     |
| `plain-month-day`  | `MonthDay`      | `MonthDay.parse`       | `--07-21`                                     |

`is` is an `instanceof` check against the matching class, so it is exact for all nine kinds.

---

## ⚡ Usage

Schema-less, over an Axios response:

```ts
import { AxiosInstanceManager } from '@adaskothebeast/axios-interceptor';
import { hierarchicalConvertToJsJoda } from '@adaskothebeast/hierarchical-convert-to-js-joda';

const api = AxiosInstanceManager.createInstance(hierarchicalConvertToJsJoda);

const { data } = await api.get('/orders/42');
// data.createdAt is a ZonedDateTime; data.slaWindow is still the raw 'PT1H30M' string
```

Schema-less, over an Angular `HttpClient` response:

```ts
import { HIERARCHICAL_DATE_ADJUST_FUNCTION } from '@adaskothebeast/angular-date-http-interceptor';
import { hierarchicalConvertToJsJoda } from '@adaskothebeast/hierarchical-convert-to-js-joda';

providers: [
  { provide: HIERARCHICAL_DATE_ADJUST_FUNCTION, useValue: hierarchicalConvertToJsJoda },
];
```

Direct call on any parsed payload:

```ts
import { hierarchicalConvertToJsJoda } from '@adaskothebeast/hierarchical-convert-to-js-joda';

const payload = JSON.parse(body) as unknown;
hierarchicalConvertToJsJoda(payload);
```

Schema-driven, through the typewriter runtime (this is the only way to get durations, periods and plain types):

```ts
import { jsJodaDateBackend } from '@adaskothebeast/hierarchical-convert-to-js-joda';
import { schema } from '@adaskothebeast/typewriter-schema';
import { createJsonTransformer } from '@adaskothebeast/typewriter-runtime';
import type { Duration, Instant, LocalDate, Period } from '@js-joda/core';

const orderSchema = schema.object<{
  createdAt: Instant;
  dueOn: LocalDate;
  slaWindow: Duration;
  retention: Period;
}>({
  createdAt: schema.instant(),
  dueOn: schema.plainDate(),
  slaWindow: schema.duration(),
  retention: schema.period(),
});

const toOrder = createJsonTransformer(orderSchema, undefined, {
  mode: 'strict',
  dateBackend: jsJodaDateBackend,
});

const order = toOrder({
  createdAt: '2024-01-02T03:04:05.123456789Z',
  dueOn: '2024-07-21',
  slaWindow: 'PT1H30M',
  retention: 'P1Y2M3D',
});
```

---

## 🎛️ Options and configuration

`hierarchicalConvertToJsJoda` has no options. The `depth` and `visited` parameters exist for the recursive calls; passing your own `visited` set lets you share cycle tracking across several payloads, and passing a `depth` above `100` makes the call a no-op.

`jsJodaDateBackend` has no options either. It is a singleton value and is safe to share between transformers. Everything else is decided by the runtime:

- `mode: 'strict'` makes an unparsable value throw `JsonTransformationError` (with the js-joda parse error as its `cause`); the default tolerant mode leaves the raw string in place.
- `maxDepth` (runtime option, default `100`) caps schema recursion independently of the traversal cap above.
- Omit `dateBackend` and the runtime falls back to its built-in `temporalDateBackend`.

---

## 📤 Output examples

`hierarchicalConvertToJsJoda`:

| Input value                       | Result                                                              |
| --------------------------------- | ------------------------------------------------------------------- |
| `'2023-07-17T23:06:00.000Z'`      | `ZonedDateTime.parse('2023-07-17T23:06:00.000Z')` (zone `Z`)         |
| `'2023-07-17T23:06:00.000+01:00'` | `ZonedDateTime.parse('2023-07-17T23:06:00.000+01:00')` (offset kept)  |
| `'2023-07-17T23:06:00'`           | unchanged string (19 characters, below the length gate)              |
| `'P1Y2M4DT2H3M2S'`                | unchanged string (durations are never converted here)                |
| `'adam'`                          | unchanged                                                            |

```text
in : { someNewObj: { text: 'adam', date: '2023-07-17T23:06:00.000Z' } }
out: { someNewObj: { text: 'adam', date: ZonedDateTime } }   // same object, mutated
```

`jsJodaDateBackend` round trips (all asserted by the unit tests):

```text
instant          '2024-01-02T03:04:05.123456789Z'            -> Instant       -> identical string
plain-time       '12:34:56.123456789'                        -> LocalTime     -> identical string
zoned-date-time  '2024-01-02T03:04:05+01:00[Europe/Paris]'   -> ZonedDateTime -> identical string
duration         'PT26H3M4.005S'                             -> Duration      -> identical string
period           'P1Y2M3D'                                   -> Period        -> identical string
plain-month-day  '--07-21'                                   -> MonthDay      -> identical string
```

---

## ⚠️ Edge cases

- **In-place mutation.** The traversal rewrites your object graph and returns nothing. Clone the payload first if the caller must keep the raw strings.
- **Prototype-pollution keys are skipped.** `__proto__`, `constructor` and `prototype` are never read or written, and only own properties (`Object.hasOwn`) are visited.
- **Depth cap of 100.** Once `depth > 100`, the branch is returned untouched with no error, so extremely deep payloads are silently left partly unconverted.
- **Cycles are visited once.** The shared `WeakSet` means a repeated object reference is skipped on the second encounter.
- **No duration or period conversion in the traversal.** There is no duration regex in `hierarchicalConvertToJsJoda` at all, so `PT1H`, `P1Y2M3D` and friends stay strings. Convert them yourself with `Duration.parse` / `Period.parse`, or use `jsJodaDateBackend` with a schema, which distinguishes the two.
- **Date strings must be at least 20 characters** and have `-`, `-`, `T` at indices 4, 7, 10. `2023-07-17T23:06:00` (19 characters) therefore stays a string, which also happens to match js-joda's own requirement that a `ZonedDateTime` carry an offset. Fractional seconds must be exactly three digits, so `…T23:06:00.123456789Z` is not picked up by the traversal even though `ZonedDateTime.parse` would accept it.
- **Parse failures are swallowed.** `ZonedDateTime.parse` throwing is caught, logged with `console.warn('Failed to parse date string: …')`, and the original string is kept. Nothing is thrown out of the traversal.
- **Offsets are preserved, not normalized.** `ZonedDateTime.parse('…+01:00')` keeps a fixed `ZoneOffset` and `…Z` keeps zone `Z`, so the wire representation survives verbatim. This differs from the Luxon and Moment traversals, which reinterpret the instant in the local or UTC zone. Nothing in the traversal converts an offset into a named IANA zone; only a bracketed `[Region/City]` payload produces one, and only through the `zoned-date-time` codec.
- **Codec errors are js-joda errors.** The backend does no pre-validation with regexes, so `parse` surfaces `DateTimeParseException` (and `DateTimeException` for impossible values) rather than the `RangeError` the Luxon and Moment backends raise. In strict mode the runtime wraps it in `JsonTransformationError`.
- **`duration` and `period` are not interchangeable.** `Duration.parse` accepts time-based amounts only (`PT…`, plus a day component), and `Period.parse` accepts date-based amounts only (`P1Y2M3D`). Sending `P1Y` to a `duration` node or `PT1H` to a `period` node throws.
- **Nanosecond precision is real** for `Instant`, `LocalTime`, `LocalDateTime` and `ZonedDateTime`. Values that round-trip here lose precision the moment you hand them to a `Date`, Luxon or Moment based backend.
- **`instant` is not `zoned-date-time`.** Because `is` uses `instanceof`, an `Instant` fails a `zoned-date-time` node and a `ZonedDateTime` fails an `instant` node; use `atZone` / `toInstant` to move between them yourself.
- **Named zones need the loaded zone database.** Both modules `require('@js-joda/timezone')` themselves, so this works out of the box, but a bundler configured to tree-shake that require will make `[Europe/Paris]` throw at parse time.

---

## 🔗 Related packages

- Same job, other libraries: [`hierarchical-convert-to-date`](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-date), [`-date-fns`](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-date-fns), [`-dayjs`](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-dayjs), [`-luxon`](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-luxon), [`-moment`](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-moment), [`-temporal`](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-temporal)
- Other value kinds: [`-decimal`](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-decimal), [`-uuid`](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-uuid)
- Transports: [`angular-date-http-interceptor`](https://www.npmjs.com/package/@adaskothebeast/angular-date-http-interceptor), [`axios-interceptor`](https://www.npmjs.com/package/@adaskothebeast/axios-interceptor), [`react-redux-toolkit-hierarchical-date-hook`](https://www.npmjs.com/package/@adaskothebeast/react-redux-toolkit-hierarchical-date-hook)
- Schema stack: [`typewriter-schema`](https://www.npmjs.com/package/@adaskothebeast/typewriter-schema), [`typewriter-runtime`](https://www.npmjs.com/package/@adaskothebeast/typewriter-runtime), [`typewriter-http-angular`](https://www.npmjs.com/package/@adaskothebeast/typewriter-http-angular), [`typewriter-http-axios`](https://www.npmjs.com/package/@adaskothebeast/typewriter-http-axios), [`typewriter-http-fetch`](https://www.npmjs.com/package/@adaskothebeast/typewriter-http-fetch)

Full matrix and adapter recipes: [main README](https://github.com/AdaskoTheBeAsT/date-interceptors#readme).

---

## 📄 License

[MIT](./LICENSE) © Adam Pluciński
