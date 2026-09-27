# 🗓️ @adaskothebeast/hierarchical-convert-to-date-fns

**The date-fns binding of [date-interceptors](https://github.com/AdaskoTheBeAsT/date-interceptors): hydrates ISO 8601 strings in JSON payloads into `Date` and date-fns `Duration` values, and plugs date-fns into the typewriter runtime.**

[![npm](https://img.shields.io/npm/v/%40adaskothebeast%2Fhierarchical-convert-to-date-fns?color=cb3837&logo=npm)](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-date-fns)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

Peer dependencies: `date-fns` and, for the backend export only, `@adaskothebeast/typewriter-runtime`. Runtime dependency: the dependency-free `@adaskothebeast/hierarchical-convert-core`.

---

## 📦 Install

```bash
npm i @adaskothebeast/hierarchical-convert-to-date-fns date-fns
```

The runtime peer is only needed for the `dateFnsDateBackend` export. If you use the schema stack, add it:

```bash
npm i @adaskothebeast/typewriter-runtime
```

---

## 🎯 What it does

Two independent tools ship in this package.

**1. A blind traversal.** `hierarchicalConvertToDateFns` walks the arrays and plain objects of a parsed JSON graph and, without any schema, rewrites recognized strings in place: ISO date-times become `Date` (through date-fns `parseISO`), non-negative ISO durations become date-fns `Duration` objects. Prototype keys are skipped, cycles are visited once, and recursion is depth limited, so it is safe on untrusted bodies.

**2. A schema-driven backend.** `dateFnsDateBackend` is a `DateBackend` (the interface from `@adaskothebeast/typewriter-runtime`): a `name` plus a map of `DateCodec` objects keyed by `DateSchemaKind`. Pass it as the `dateBackend` option to the typewriter runtime and every date-shaped schema node is hydrated and serialized with date-fns, with real errors on malformed wire values instead of silent guessing.

---

## 🧰 API

### `hierarchicalConvertToDateFns(obj)`

`(obj: unknown) => void`

Mutates `obj` and returns nothing. (Before 11.0.0 the signature also exposed internal `depth` and `visited` parameters.)

### `dateFnsDateBackend`

Declared `satisfies DateBackend`, so `name` is `'date-fns'` and the `codecs` record is exactly:

| Schema kind       | Value type | `parse` accepts                                    | `serialize` emits            |
| ----------------- | ---------- | -------------------------------------------------- | ---------------------------- |
| `instant`         | `Date`     | `YYYY-MM-DDTHH:mm[:ss[.sss]]` plus `Z` or `±HH:MM` | `toISOString()` (always UTC) |
| `plain-date`      | `Date`     | `YYYY-MM-DD`                                       | `yyyy-MM-dd` (local fields)  |
| `plain-date-time` | `Date`     | `YYYY-MM-DDTHH:mm[:ss[.sss]]`, no zone allowed     | `yyyy-MM-dd'T'HH:mm:ss.SSS`  |
| `duration`        | `Duration` | ISO 8601 duration, fractions allowed (`.` or `,`)  | `P…T…`, `PT0S` when empty    |
| `period`          | `Duration` | same codec object as `duration`                    | same as `duration`           |

Every codec also exposes `is(value)`: the three date codecs use date-fns `isDate` plus `isValid`, the duration codec accepts a plain object whose keys are a subset of `years`, `months`, `weeks`, `days`, `hours`, `minutes`, `seconds` and whose values are finite non-negative numbers.

`plain-time`, `zoned-date-time`, `plain-year-month` and `plain-month-day` are intentionally absent, because a native `Date` cannot carry those semantics. The runtime falls back to its own handling for kinds a backend does not advertise.

---

## ⚡ Usage

Blind hydration of a response body:

```ts
import { hierarchicalConvertToDateFns } from '@adaskothebeast/hierarchical-convert-to-date-fns';
import type { Duration } from 'date-fns';

interface Booking {
  startsAt: Date;
  stay: Duration;
}

const raw: unknown = JSON.parse(text);
hierarchicalConvertToDateFns(raw);
const booking = raw as Booking;
booking.stay.days; // 4
```

Schema-driven hydration with the typewriter runtime:

```ts
import { dateFnsDateBackend } from '@adaskothebeast/hierarchical-convert-to-date-fns';
import { createJsonSerializer, createJsonTransformer } from '@adaskothebeast/typewriter-runtime';

const toBooking = createJsonTransformer(bookingSchema, undefined, {
  dateBackend: dateFnsDateBackend,
  mode: 'strict',
});
const toWire = createJsonSerializer(bookingSchema, undefined, {
  dateBackend: dateFnsDateBackend,
});

const booking = toBooking(await response.json());
const body = toWire(booking);
```

Using a single codec directly, for example in a form adapter:

```ts
const { instant } = dateFnsDateBackend.codecs;
instant.parse('2024-02-29T12:34:56.789+01:00'); // Date
instant.serialize(new Date('2024-02-29T11:34:56.789Z')); // '2024-02-29T11:34:56.789Z'
```

---

## 🎛️ Options and configuration

`hierarchicalConvertToDateFns` has no configuration. Recognition and traversal are shared with the other converters through `hierarchical-convert-core`; the full rules and a per-backend duration precision table are in the repository [conversion contract](https://github.com/AdaskoTheBeAsT/date-interceptors/blob/main/docs/conversion-contract.md#heuristic-date-conversion). In short:

- Date-times: `YYYY-MM-DDTHH:mm:ss`, an optional one-to-nine-digit fraction (truncated to milliseconds), and an optional `Z` or `±HH:MM`, with calendar and clock validation.
- Durations: integer `Y`, `M`, `W`, `D`, `H`, `M` components and seconds with up to nine fraction digits (`.` or `,`). Negative durations stay strings because date-fns `Duration` has no sign.
- Only arrays and plain objects are entered, and the root plus 100 nested levels are walked.

The backend is configured entirely through the runtime option object (`dateBackend`), and `mode: 'strict'` is what turns codec `RangeError`s into reported failures rather than preserved raw values.

---

## 📤 Output examples

`hierarchicalConvertToDateFns`:

| Input                                       | After conversion                                                                             |
| ------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `{ date: '2023-07-17T23:06:00.000Z' }`      | `{ date: Date('2023-07-17T23:06:00.000Z') }`                                                 |
| `{ date: '2023-07-17T23:06:00.000+01:00' }` | `{ date: Date('2023-07-17T23:06:00.000+01:00') }`                                            |
| `{ duration: 'P0D' }`                       | `{ duration: { years: 0, months: 0, weeks: 0, days: 0, hours: 0, minutes: 0, seconds: 0 } }` |
| `{ duration: 'P4W' }`                       | `{ duration: { ..., weeks: 4, ... } }` (other fields `0`)                                    |
| `{ duration: 'P1Y2M4DT2H3M2S' }`            | `{ duration: { years: 1, months: 2, weeks: 0, days: 4, hours: 2, minutes: 3, seconds: 2 } }` |
| `['P1Y2M4DT2H3M2S', 'P1Y2M4DT2H3M2S']`      | both elements become `Duration` objects                                                      |
| `{ text: 'adam' }`                          | untouched                                                                                    |

`dateFnsDateBackend` codecs:

```text
instant          '2024-02-29T12:34:56.789+01:00' -> Date  -> '2024-02-29T11:34:56.789Z'
plain-date       '2024-02-29'                    -> Date  -> '2024-02-29'
plain-date-time  '2024-02-29T12:34:56.789'       -> Date  -> '2024-02-29T12:34:56.789'
duration         'P1Y2M3W4DT5H6M7.25S'           -> { years: 1, months: 2, weeks: 3, days: 4, hours: 5, minutes: 6, seconds: 7.25 }
duration         'P0D'                           -> { days: 0 }              -> 'P0D'
duration         {}                              ->                             'PT0S'
```

---

## ⚠️ Edge cases

- **Mutation in place.** The traversal returns `void` and rewrites your object; clone first (`structuredClone`) if you need the original strings.
- **Only arrays and plain objects are entered (11.0.0).** Class instances, `Map`, `Set`, `Date`, and typed arrays are left untouched, so running the converter twice is a no-op. Frozen objects and read-only properties keep their strings instead of throwing.
- **Prototype pollution is blocked.** Own `__proto__`, `constructor` and `prototype` keys are skipped and never entered.
- **Cycles are safe**; shared references and cycles are visited once. Past the root plus 100 nested levels nothing is converted, silently.
- **The traversal and the backend disagree about fractions on larger units.** Both accept fractional seconds (`PT7.25S`, `PT7,25S`), but only `dateFnsDateBackend.codecs.duration` accepts fractions on other components such as `P1.5D`; the traversal leaves those as strings.
- **The traversal fills all seven duration fields with `0`**, while the codec sets only the components present on the wire (`P0D` becomes `{ days: 0 }`, not a full record). Do not compare the two shapes with strict deep equality.
- **Degenerate durations stay strings.** Bare `P`, `PT`, and a trailing `T` such as `P1DT` are rejected. Human text starting with `P` is safe because it fails the pattern.
- **Offset-less date-times use the local timezone**, matching the plain [`-date`](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-date) package.
- **Invalid dates stay strings.** Impossible calendar or clock values such as `2023-02-30T00:00:00Z` are rejected before date-fns sees them.
- **Date-only strings are not touched by the traversal.** Use the schema stack with `plain-date` if your payload carries calendar dates.
- **Negative durations are rejected by the backend.** `duration.parse('-P1D')` throws `RangeError: date-fns Duration does not support negative values`, `is({ days: -1 })` is `false` and `serialize({ days: -1 })` throws. date-fns has no sign on `Duration`.
- **`duration.is({})` is `true`** (an empty key set satisfies the check) and `serialize({})` yields `PT0S`, so a stray empty object in a duration slot round-trips as a zero duration rather than failing.
- **`instant` requires a zone, `plain-date-time` forbids one.** `instant.parse('2024-02-29T12:34:56')` and `plainDateTime.parse('2024-02-29T12:34:56Z')` both throw `RangeError`. `plain-date` rejects impossible calendar days such as `2024-02-30`. Bare `'P'` is rejected as a duration.
- **`plain-date` and `plain-date-time` serialize local calendar fields** via date-fns `format`, so a `Date` created in one zone and formatted in another shifts. Keep those values as wall-clock data and never mix them with `instant`.
- **`period` is the very same codec object as `duration`**, so a `period` node produces a date-fns `Duration`, not a calendar-only structure.

---

## 🔗 Related packages

- Same traversal, other date libraries: [`-date`](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-date), [`-dayjs`](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-dayjs), [`-luxon`](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-luxon), [`-moment`](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-moment), [`-js-joda`](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-js-joda), [`-temporal`](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-temporal)
- Other value kinds: [`-decimal`](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-decimal), [`-uuid`](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-uuid)
- Schema stack: [`typewriter-schema`](https://www.npmjs.com/package/@adaskothebeast/typewriter-schema), [`typewriter-runtime`](https://www.npmjs.com/package/@adaskothebeast/typewriter-runtime), [`typewriter-http-angular`](https://www.npmjs.com/package/@adaskothebeast/typewriter-http-angular), [`typewriter-http-axios`](https://www.npmjs.com/package/@adaskothebeast/typewriter-http-axios), [`typewriter-http-fetch`](https://www.npmjs.com/package/@adaskothebeast/typewriter-http-fetch)
- Transports: [`angular-date-http-interceptor`](https://www.npmjs.com/package/@adaskothebeast/angular-date-http-interceptor), [`axios-interceptor`](https://www.npmjs.com/package/@adaskothebeast/axios-interceptor), [`react-redux-toolkit-hierarchical-date-hook`](https://www.npmjs.com/package/@adaskothebeast/react-redux-toolkit-hierarchical-date-hook)

Full matrix and recipes: [main README](https://github.com/AdaskoTheBeAsT/date-interceptors#readme).

---

## 📄 License

[MIT](./LICENSE) © Adam Pluciński
