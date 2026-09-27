# ⏳ @adaskothebeast/hierarchical-convert-to-temporal

**Deep, in-place conversion of ISO 8601 strings inside JSON payloads into `Temporal` values, plus a ready-made `Temporal` backend for the schema-driven typewriter runtime, part of [date-interceptors](https://github.com/AdaskoTheBeAsT/date-interceptors).**

[![npm](https://img.shields.io/npm/v/%40adaskothebeast%2Fhierarchical-convert-to-temporal?color=cb3837&logo=npm)](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-temporal)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

Peer dependencies: `@js-temporal/polyfill` and `@adaskothebeast/typewriter-runtime` (types only, used by the backend export). Runtime dependency: the dependency-free `@adaskothebeast/hierarchical-convert-core`.

---

## 📦 Install

```bash
npm i @adaskothebeast/hierarchical-convert-to-temporal @js-temporal/polyfill @adaskothebeast/typewriter-runtime
```

`@js-temporal/polyfill` is imported directly by this package (`import { Temporal } from '@js-temporal/polyfill'`), so it is required even on runtimes that already ship a native `Temporal`.

---

## 🎯 What it does

Give it a parsed JSON response and it walks the own enumerable properties of every nested array and plain object, replacing matching strings with `Temporal` instances. Nothing is returned; the input graph is mutated in place.

| String shape                        | Becomes                  |
| ----------------------------------- | ------------------------ |
| `2023-07-17T23:06:00.000Z`          | `Temporal.Instant`       |
| `2023-07-17T23:06:00.000+01:00`     | `Temporal.Instant`       |
| `2023-07-17T23:06:00` (no offset)   | `Temporal.PlainDateTime` |
| `P1Y2M4DT2H3M2S`, `-PT1H`, `PT0.5S` | `Temporal.Duration`      |
| anything else                       | left untouched           |

Only three `Temporal` types are ever produced by the walker: `Instant`, `PlainDateTime` and `Duration`. Date-only, time-only, year-month, month-day and zoned (`[Europe/Paris]`) strings are **not** recognised, because a bare JSON string carries no hint about which of those you meant. When you need the full set, use the schema-driven path with `temporalDateBackend` (see below).

---

## 🧰 API

| Export                          | Signature                                                                         | Notes                                                                                            |
| ------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `hierarchicalConvertToTemporal` | `(obj: unknown) => void`                                                          | Mutates `obj` in place, returns `void`.                                                          |
| `temporalDateBackend`           | `DateBackend` (`{ name: 'temporal'; codecs: Record<DateSchemaKind, DateCodec> }`) | Nine codecs for `@adaskothebeast/typewriter-runtime`. `name` is the literal string `'temporal'`. |

Before 11.0.0 the converter signature also exposed internal `depth` and `visited` parameters.

### `temporalDateBackend` codecs

Each codec is a `DateCodec` with `is(value)`, `parse(wire)` and `serialize(value)`; `serialize` is always `value.toString()`.

| Schema kind        | Runtime type              |
| ------------------ | ------------------------- |
| `instant`          | `Temporal.Instant`        |
| `plain-date`       | `Temporal.PlainDate`      |
| `plain-time`       | `Temporal.PlainTime`      |
| `plain-date-time`  | `Temporal.PlainDateTime`  |
| `zoned-date-time`  | `Temporal.ZonedDateTime`  |
| `duration`         | `Temporal.Duration`       |
| `period`           | `Temporal.Duration`       |
| `plain-year-month` | `Temporal.PlainYearMonth` |
| `plain-month-day`  | `Temporal.PlainMonthDay`  |

---

## ⚡ Usage

```ts
import { hierarchicalConvertToTemporal } from '@adaskothebeast/hierarchical-convert-to-temporal';
import { Temporal } from '@js-temporal/polyfill';

const payload = {
  user: {
    name: 'Adam',
    createdAt: '2023-07-17T23:06:00.000Z',
    localReminder: '2023-07-17T23:06:00',
    sessions: [{ length: 'PT1H30M' }, { length: 'P0D' }],
  },
};

hierarchicalConvertToTemporal(payload);

payload.user.createdAt instanceof Temporal.Instant; // true
payload.user.localReminder instanceof Temporal.PlainDateTime; // true
payload.user.sessions[0].length instanceof Temporal.Duration; // true
```

As a `fetch` post-processing step:

```ts
async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const data = (await response.json()) as T;
  hierarchicalConvertToTemporal(data);
  return data;
}
```

Schema-driven hydration, where the shape decides the `Temporal` type instead of a regex:

```ts
import { temporalDateBackend } from '@adaskothebeast/hierarchical-convert-to-temporal';
import { createJsonTransformer } from '@adaskothebeast/typewriter-runtime';

import { userSchema } from './generated/user.schema';

const toUser = createJsonTransformer(userSchema, undefined, {
  dateBackend: temporalDateBackend,
});

const user = toUser(await response.json());
```

`dateBackend` is read by `transformJson` / `serializeJson` (and their `create*` wrappers), which look up `backend.codecs[kind]` for the date kind declared in the schema and throw `Date backend "temporal" does not support <kind>` when a kind is missing.

---

## 🎛️ Options and configuration

There are no options: no key allow-list, no format list, no target-type selection. Recognition and traversal are shared with the other converters through `hierarchical-convert-core`; the full rules and a per-backend duration precision table are in the repository [conversion contract](https://github.com/AdaskoTheBeAsT/date-interceptors/blob/main/docs/conversion-contract.md#heuristic-date-conversion). In short:

1. **Date-times** have the shape `YYYY-MM-DDTHH:mm:ss`, an optional one-to-nine-digit fraction (nanosecond precision survives), and an optional `Z` or `±HH:MM`. Calendar and clock components are validated first, so impossible values never reach Temporal.
2. **Instant or PlainDateTime.** With `Z` or an offset the value becomes `Temporal.Instant.from(value)`; otherwise `Temporal.PlainDateTime.from(value)`.
3. **Durations** use integer `Y`, `M`, `W`, `D`, `H`, `M` components, seconds with up to nine fraction digits (`.` or `,`), and an optional leading `-`, yielding `Temporal.Duration.from(value)`. Values Temporal rejects, such as years of 2³² or more, stay strings.

The root plus 100 nested levels are walked; cycles are visited once.

---

## 📤 Output examples

```ts
const input = {
  instant: '2023-07-17T23:06:00.000Z',
  offset: '2023-07-17T23:06:00.000+01:00',
  nanos: '2023-07-17T23:06:00.123456789Z',
  local: '2023-07-17T23:06:00',
  weeks: 'P4W',
  negative: '-PT1H',
  dateOnly: '2023-07-17',
  broken: '2023-99-99T99:99:99.000Z',
};

hierarchicalConvertToTemporal(input);
```

```text
instant   -> Temporal.Instant       2023-07-17T23:06:00Z
offset    -> Temporal.Instant       2023-07-17T22:06:00Z      (offset folded into the exact time)
nanos     -> Temporal.Instant       2023-07-17T23:06:00.123456789Z
local     -> Temporal.PlainDateTime 2023-07-17T23:06:00
weeks     -> Temporal.Duration      P4W
negative  -> Temporal.Duration      -PT1H
dateOnly  -> '2023-07-17'           (unchanged, no time part)
broken    -> '2023-99-99T99:99:99.000Z' (unchanged, rejected by calendar validation)
```

Top-level arrays work too: `['P1Y2M4DT2H3M2S']` becomes `[Temporal.Duration.from('P1Y2M4DT2H3M2S')]`.

---

## ⚠️ Edge cases

- **Prototype pollution is blocked.** Own `__proto__`, `constructor` and `prototype` keys are skipped entirely, so a hostile payload cannot reach `Object.prototype`. The side effect is that legitimate data parked under a key literally named `constructor` or `prototype` is never traversed or converted.
- **Only arrays and plain objects are entered (11.0.0).** Class instances, `Map`, `Set`, and existing Temporal values are left untouched, so running the converter twice is a no-op. Frozen objects and read-only properties keep their strings instead of throwing.
- **Depth is capped.** The root plus 100 nested levels are walked, leaving deeper strings as strings. This is DoS protection against adversarially nested JSON.
- **Circular graphs are safe.** Visited objects are recorded, so `input.self = input` converts once and does not loop.
- **Offset information is lost for exact times.** `2023-07-17T23:06:00.000+01:00` becomes a `Temporal.Instant`, which is UTC based. If you need the original offset or a time zone, use `zoned-date-time` through `temporalDateBackend` instead.
- **Offsetless date-times become `PlainDateTime`,** which has no time zone at all. Comparing a `PlainDateTime` with an `Instant` throws, so a payload mixing both shapes needs explicit conversion (`toZonedDateTime`) before comparison.
- **Malformed strings stay strings, silently.** `2023-99-99T99:99:99.000Z` is rejected by calendar validation before Temporal sees it. If Temporal itself throws (for example on `P99999999999999999999Y`, which exceeds its limits), the error is caught and the string is kept; nothing is logged.
- **`P` alone is not a duration.** `P`, `PT`, `-P`, and a trailing `T` such as `P1DT` are rejected.
- **False positives are possible.** Recognition is content driven, never key driven, so an ISO-looking value in a `note`, `label` or `id` field is converted as well. The schema-driven [`@adaskothebeast/typewriter-runtime`](https://www.npmjs.com/package/@adaskothebeast/typewriter-runtime) path exists exactly for payloads where that matters.
- **The polyfill is mandatory.** Values are `instanceof` the polyfill's classes, not any native `Temporal` global. Mixing polyfill instances with a native `Temporal` implementation in the same process will fail `instanceof` checks.
- **Name collision with the runtime.** `@adaskothebeast/typewriter-runtime` exports its own `temporalDateBackend` with the same nine codecs. Importing both into one module needs an alias (`import { temporalDateBackend as temporalBackend } from ...`). Pick one; they are interchangeable.
- **`period` and `duration` are the same codec pair.** `period` exists so schemas generated from a `java.time.Period` or a .NET `TimeSpan` still resolve, but both map to `Temporal.Duration`.

---

## 🔗 Related packages

- Same traversal, other date libraries: [`hierarchical-convert-to-date`](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-date), [`-date-fns`](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-date-fns), [`-dayjs`](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-dayjs), [`-luxon`](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-luxon), [`-moment`](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-moment), [`-js-joda`](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-js-joda)
- Other value kinds: [`hierarchical-convert-to-decimal`](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-decimal), [`hierarchical-convert-to-uuid`](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-uuid)
- Transports: [`angular-date-http-interceptor`](https://www.npmjs.com/package/@adaskothebeast/angular-date-http-interceptor), [`axios-interceptor`](https://www.npmjs.com/package/@adaskothebeast/axios-interceptor), [`react-redux-toolkit-hierarchical-date-hook`](https://www.npmjs.com/package/@adaskothebeast/react-redux-toolkit-hierarchical-date-hook)
- Schema stack: [`typewriter-schema`](https://www.npmjs.com/package/@adaskothebeast/typewriter-schema), [`typewriter-runtime`](https://www.npmjs.com/package/@adaskothebeast/typewriter-runtime), [`typewriter-http-angular`](https://www.npmjs.com/package/@adaskothebeast/typewriter-http-angular), [`typewriter-http-axios`](https://www.npmjs.com/package/@adaskothebeast/typewriter-http-axios), [`typewriter-http-fetch`](https://www.npmjs.com/package/@adaskothebeast/typewriter-http-fetch)

Full matrix and adapter recipes: [main README](https://github.com/AdaskoTheBeAsT/date-interceptors#readme).

---

## 📄 License

[MIT](./LICENSE) © Adam Pluciński
