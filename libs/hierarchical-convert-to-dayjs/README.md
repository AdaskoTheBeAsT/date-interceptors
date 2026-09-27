# 📆 @adaskothebeast/hierarchical-convert-to-dayjs

**The Day.js binding of [date-interceptors](https://github.com/AdaskoTheBeAsT/date-interceptors): hydrates ISO 8601 strings in JSON payloads into `Dayjs` and Day.js `Duration` values, and plugs Day.js into the typewriter runtime.**

[![npm](https://img.shields.io/npm/v/%40adaskothebeast%2Fhierarchical-convert-to-dayjs?color=cb3837&logo=npm)](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-dayjs)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

Peer dependencies: `dayjs` and, for the backend export only, `@adaskothebeast/typewriter-runtime`. Runtime dependency: the dependency-free `@adaskothebeast/hierarchical-convert-core`. Importing it registers Day.js plugins, so it is **not** side-effect free.

---

## 📦 Install

```bash
npm i @adaskothebeast/hierarchical-convert-to-dayjs dayjs
```

No plugin packages to add: the required `utc`, `duration` and `customParseFormat` plugins are pulled in and registered by this package itself.

The runtime peer is only needed for the `dayjsDateBackend` export:

```bash
npm i @adaskothebeast/typewriter-runtime
```

---

## 🎯 What it does

Two independent tools ship in this package.

**1. A blind traversal.** `hierarchicalConvertToDayjs` walks the arrays and plain objects of a parsed JSON graph and, without any schema, rewrites recognized strings in place: ISO date-times become local-mode `Dayjs` objects, non-negative ISO durations become `dayjs.duration` objects. Prototype keys are skipped, cycles are visited once, and recursion is depth limited, so it is safe on untrusted bodies.

**2. A schema-driven backend.** `dayjsDateBackend` is a `DateBackend` (the interface from `@adaskothebeast/typewriter-runtime`): a `name` plus a map of `DateCodec` objects keyed by `DateSchemaKind`. Pass it as the `dateBackend` option to the typewriter runtime and every date-shaped schema node is hydrated and serialized with Day.js, with `RangeError`s on malformed wire values instead of Day.js's usual lenient guessing.

Both modules call `dayjs.extend(...)` at module load (the traversal registers `duration`; the backend registers `utc`, `duration` and `customParseFormat`), and the package entry point loads both, so the plugins are always registered before any code here runs.

---

## 🧰 API

### `hierarchicalConvertToDayjs(obj)`

`(obj: unknown) => void`

Mutates `obj` and returns nothing. (Before 11.0.0 the signature also exposed internal `depth` and `visited` parameters.)

### `dayjsDateBackend`

Declared `satisfies DateBackend`, so `name` is `'dayjs'` and the `codecs` record is exactly:

| Schema kind       | Value type | `parse` accepts                                       | `parse` produces   | `serialize` emits         |
| ----------------- | ---------- | ----------------------------------------------------- | ------------------ | ------------------------- |
| `instant`         | `Dayjs`    | `YYYY-MM-DDTHH:mm[:ss[.s..sss]]` plus `Z` or `±HH:MM` | UTC-mode `Dayjs`   | `.utc().toISOString()`    |
| `plain-date`      | `Dayjs`    | `YYYY-MM-DD`                                          | local-mode `Dayjs` | `YYYY-MM-DD`              |
| `plain-date-time` | `Dayjs`    | `YYYY-MM-DDTHH:mm[:ss[.sss]]`, no zone allowed        | local-mode `Dayjs` | `YYYY-MM-DDTHH:mm:ss.SSS` |
| `duration`        | `Duration` | ISO 8601 duration, optional sign, fractions allowed   | `dayjs.duration`   | `.toISOString()`          |
| `period`          | `Duration` | same codec object as `duration`                       | `dayjs.duration`   | `.toISOString()`          |

Every codec also exposes `is(value)`: the three date codecs use `dayjs.isDayjs` directly, the duration codec uses `dayjs.isDuration`. Parsing is strict, done with `customParseFormat` for the plain kinds so `2024-13-01` cannot slide through.

`plain-time`, `zoned-date-time`, `plain-year-month` and `plain-month-day` are intentionally absent, because `Dayjs` cannot preserve those semantics. The runtime falls back to its own handling for kinds a backend does not advertise.

---

## ⚡ Usage

Blind hydration of a response body:

```ts
import { hierarchicalConvertToDayjs } from '@adaskothebeast/hierarchical-convert-to-dayjs';
import type dayjs from 'dayjs';

interface Booking {
  startsAt: dayjs.Dayjs;
  stay: ReturnType<typeof dayjs.duration>;
}

const raw: unknown = JSON.parse(text);
hierarchicalConvertToDayjs(raw);
const booking = raw as Booking;
booking.startsAt.format(); // rendered in the machine's local zone
booking.stay.asHours();
```

Schema-driven hydration with the typewriter runtime:

```ts
import { dayjsDateBackend } from '@adaskothebeast/hierarchical-convert-to-dayjs';
import { createJsonSerializer, createJsonTransformer } from '@adaskothebeast/typewriter-runtime';

const toBooking = createJsonTransformer(bookingSchema, undefined, {
  dateBackend: dayjsDateBackend,
  mode: 'strict',
});
const toWire = createJsonSerializer(bookingSchema, undefined, {
  dateBackend: dayjsDateBackend,
});

const booking = toBooking(await response.json());
const body = toWire(booking);
```

Using a single codec directly, for example in a form adapter:

```ts
const { instant } = dayjsDateBackend.codecs;
const value = instant.parse('2024-01-02T03:04:05.678+02:00');
value.isUTC(); // true
instant.serialize(value); // '2024-01-02T01:04:05.678Z'
```

---

## 🎛️ Options and configuration

`hierarchicalConvertToDayjs` has no configuration. Recognition and traversal are shared with the other converters through `hierarchical-convert-core`; the full rules and a per-backend duration precision table are in the repository [conversion contract](https://github.com/AdaskoTheBeAsT/date-interceptors/blob/main/docs/conversion-contract.md#heuristic-date-conversion). In short:

- Date-times: `YYYY-MM-DDTHH:mm:ss`, an optional one-to-nine-digit fraction (truncated to milliseconds), and an optional `Z` or `±HH:MM`, with calendar and clock validation. Every date-time is parsed with `dayjs(value)`, so the result is always a local-mode `Dayjs`.
- Durations: integer `Y`, `M`, `W`, `D`, `H`, `M` components and seconds with up to nine fraction digits. A decimal comma (`PT1,5S`) is normalized to a point first, because Day.js would otherwise parse it as zero. Negative durations stay strings because Day.js ignores the sign.
- Only arrays and plain objects are entered, and the root plus 100 nested levels are walked.

The backend is configured entirely through the runtime option object (`dateBackend`), and `mode: 'strict'` is what turns codec `RangeError`s into reported failures rather than preserved raw values.

---

## 📤 Output examples

`hierarchicalConvertToDayjs`:

| Input                                       | After conversion                                                                     |
| ------------------------------------------- | ------------------------------------------------------------------------------------ |
| `{ date: '2023-07-17T23:06:00.000Z' }`      | `dayjs('2023-07-17T23:06:00.000Z')` (local mode)                                     |
| `{ date: '2023-07-17T23:06:00.000+01:00' }` | `dayjs('2023-07-17T23:06:00.000+01:00')` (local mode)                                |
| `{ nested: { date: '...Z' } }`              | converted at any depth                                                               |
| `['...Z', '...Z']`                          | every array element converted                                                        |
| `{ duration: 'P0D' }`                       | `dayjs.duration('P0D')` (every component zero)                                       |
| `{ duration: 'P4W' }`                       | `dayjs.duration({ weeks: 4 })`                                                       |
| `{ duration: 'P1Y2M4DT2H3M2S' }`            | `dayjs.duration({ years: 1, months: 2, days: 4, hours: 2, minutes: 3, seconds: 2 })` |
| `{ text: 'adam' }`                          | untouched                                                                            |
| `{ d: '2023-02-30T00:00:00Z' }`             | untouched (impossible calendar date)                                                 |

`dayjsDateBackend` codecs (unlike the traversal, the `instant` codec deliberately returns UTC-mode values):

```text
instant          '2024-01-02T03:04:05.678+02:00' -> UTC Dayjs   -> '2024-01-02T01:04:05.678Z'
plain-date       '2024-01-02'                    -> local Dayjs -> '2024-01-02'
plain-date-time  '2024-01-02T03:04:05.678'       -> local Dayjs -> '2024-01-02T03:04:05.678'
duration         'P1Y2M3DT4H5M6.7S'              -> Duration    -> 'P1Y2M3DT4H5M6.7S'
```

---

## ⚠️ Edge cases

- **Importing this package mutates the shared Day.js instance.** `dayjs.extend(utc)`, `dayjs.extend(duration)` and (for the backend) `dayjs.extend(customParseFormat)` run at module load. That is what makes the code work regardless of import order, but it also means the package cannot be treated as side-effect free by a bundler, and your own `dayjs.duration(...)` calls still need your own `dayjs.extend(duration)` for the typings.
- **The traversal always produces local-mode objects (11.0.0).** `Z`, `+00:00`, and any other offset all yield a local-mode `Dayjs` for the same instant, matching the Moment and Luxon converters; `.format()` renders the machine zone. Call `.utc()` explicitly when you need UTC rendering. Before 11.0.0 a trailing `Z` produced a UTC-mode object while a numeric offset produced a local-mode one.
- **Offset-less date-times are read as local time.**
- **Only arrays and plain objects are entered (11.0.0).** Class instances, `Map`, `Set`, and existing `Dayjs` or `Duration` values are left untouched, so running the converter twice is a no-op. Frozen objects and read-only properties keep their strings instead of throwing.
- **Mutation in place.** The traversal returns `void` and rewrites your object; clone first (`structuredClone`) if you need the original strings. The hydrated `Dayjs` and `Duration` values are themselves immutable, so they are safe to share afterwards.
- **Prototype pollution is blocked.** Own `__proto__`, `constructor` and `prototype` keys are skipped and never entered.
- **Cycles are safe**; shared references and cycles are visited once. Past the root plus 100 nested levels nothing is converted, silently.
- **Invalid dates stay strings.** Impossible calendar or clock values such as `2023-02-30T00:00:00Z` are rejected before Day.js sees them.
- **The traversal and the backend disagree about fractions and signs.** The traversal accepts fractional seconds only and leaves negative durations such as `-P1D` as strings, while `dayjsDateBackend.codecs.duration` parses signs and fractions on any component (unlike the date-fns backend, which rejects negatives outright).
- **Weeks are serialized as days** by Day.js: `dayjs.duration('P1W2D').toISOString()` is `P9D`. See the precision table in the conversion contract.
- **Degenerate durations stay strings.** Bare `P`, `PT`, and a trailing `T` such as `P1DT` are rejected. Human text starting with `P` is safe because it fails the pattern.
- **Date-only strings are not touched by the traversal.** Use the schema stack with `plain-date` if your payload carries calendar dates.
- **`is` does not check validity.** `instant.is(dayjs('nope'))` is `true` because it is just `dayjs.isDayjs`; the validity check happens in `parse` and `serialize`, which throw `RangeError: Invalid instant value`. Filter with `.isValid()` before serializing.
- **`instant` requires a zone, `plain-date-time` forbids one.** `instant.parse('2024-01-02T03:04:05')` and `plainDateTime.parse('2024-01-02T03:04:05Z')` both throw. The `plain-date-time` pattern also insists on exactly three fractional digits when they are present, so `2024-01-02T03:04:05.6` is rejected.
- **`plain-date` and `plain-date-time` stay in local mode** on purpose (no zone shift on round-trip), so never mix those values with `instant` values in the same arithmetic.
- **`period` is the very same codec object as `duration`**, so a `period` node produces a Day.js `Duration`, not a calendar-only structure.
- **Weeks and days are separate slots in Day.js.** `dayjs.duration('P4W')` reports `days()` as `0`; read `.asDays()` or `.weeks()` when you need a total.

---

## 🔗 Related packages

- Same traversal, other date libraries: [`-date`](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-date), [`-date-fns`](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-date-fns), [`-luxon`](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-luxon), [`-moment`](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-moment), [`-js-joda`](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-js-joda), [`-temporal`](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-temporal)
- Other value kinds: [`-decimal`](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-decimal), [`-uuid`](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-uuid)
- Schema stack: [`typewriter-schema`](https://www.npmjs.com/package/@adaskothebeast/typewriter-schema), [`typewriter-runtime`](https://www.npmjs.com/package/@adaskothebeast/typewriter-runtime), [`typewriter-http-angular`](https://www.npmjs.com/package/@adaskothebeast/typewriter-http-angular), [`typewriter-http-axios`](https://www.npmjs.com/package/@adaskothebeast/typewriter-http-axios), [`typewriter-http-fetch`](https://www.npmjs.com/package/@adaskothebeast/typewriter-http-fetch)
- Transports: [`angular-date-http-interceptor`](https://www.npmjs.com/package/@adaskothebeast/angular-date-http-interceptor), [`axios-interceptor`](https://www.npmjs.com/package/@adaskothebeast/axios-interceptor), [`react-redux-toolkit-hierarchical-date-hook`](https://www.npmjs.com/package/@adaskothebeast/react-redux-toolkit-hierarchical-date-hook)

Full matrix and recipes: [main README](https://github.com/AdaskoTheBeAsT/date-interceptors#readme).

---

## 📄 License

[MIT](./LICENSE) © Adam Pluciński
