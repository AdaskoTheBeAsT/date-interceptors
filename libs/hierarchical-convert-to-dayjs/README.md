# 📆 @adaskothebeast/hierarchical-convert-to-dayjs

**The Day.js binding of [date-interceptors](https://github.com/AdaskoTheBeAsT/date-interceptors): hydrates ISO 8601 strings in JSON payloads into `Dayjs` and Day.js `Duration` values, and plugs Day.js into the typewriter runtime.**

[![npm](https://img.shields.io/npm/v/%40adaskothebeast%2Fhierarchical-convert-to-dayjs?color=cb3837&logo=npm)](https://www.npmjs.com/package/@adaskothebeast/hierarchical-convert-to-dayjs)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

Peer dependencies: `dayjs` (`^1.11.21`), `@adaskothebeast/typewriter-runtime` (`10.0.0`) and `tslib` (`^2.8.1`). Built with `tsc` to CommonJS plus `.d.ts` declarations. Importing it registers Day.js plugins, so it is **not** side-effect free.

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

**1. A blind traversal.** `hierarchicalConvertToDayjs` walks a parsed JSON graph and, without any schema, rewrites recognized strings in place: ISO date-times become `Dayjs` objects, ISO durations become `dayjs.duration` objects. Prototype keys are skipped, cycles are tracked in a `WeakSet` and recursion is depth limited, so it is safe on untrusted bodies.

**2. A schema-driven backend.** `dayjsDateBackend` is a `DateBackend` (the interface from `@adaskothebeast/typewriter-runtime`): a `name` plus a map of `DateCodec` objects keyed by `DateSchemaKind`. Pass it as the `dateBackend` option to the typewriter runtime and every date-shaped schema node is hydrated and serialized with Day.js, with `RangeError`s on malformed wire values instead of Day.js's usual lenient guessing.

Both entry points call `dayjs.extend(...)` at module load, so the plugins are always registered before any code here runs.

---

## 🧰 API

### `hierarchicalConvertToDayjs(obj, depth?, visited?)`

`(obj: unknown, depth?: number, visited?: WeakSet<object>) => void`

Mutates `obj` and returns nothing. `depth` defaults to `0`, `visited` to a fresh `WeakSet`. Both optional parameters exist for the recursive calls but are usable: a higher `depth` shrinks the remaining budget, a shared `visited` set prevents re-walking the same graph.

### `dayjsDateBackend`

Declared `satisfies DateBackend`, so `name` is `'dayjs'` and the `codecs` record is exactly:

| Schema kind       | Value type   | `parse` accepts                                      | `parse` produces        | `serialize` emits             |
| ----------------- | ------------ | ---------------------------------------------------- | ----------------------- | ----------------------------- |
| `instant`         | `Dayjs`      | `YYYY-MM-DDTHH:mm[:ss[.s..sss]]` plus `Z` or `±HH:MM` | UTC-mode `Dayjs`        | `.utc().toISOString()`        |
| `plain-date`      | `Dayjs`      | `YYYY-MM-DD`                                          | local-mode `Dayjs`      | `YYYY-MM-DD`                  |
| `plain-date-time` | `Dayjs`      | `YYYY-MM-DDTHH:mm[:ss[.sss]]`, no zone allowed        | local-mode `Dayjs`      | `YYYY-MM-DDTHH:mm:ss.SSS`     |
| `duration`        | `Duration`   | ISO 8601 duration, optional sign, fractions allowed   | `dayjs.duration`        | `.toISOString()`              |
| `period`          | `Duration`   | same codec object as `duration`                       | `dayjs.duration`        | `.toISOString()`              |

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
booking.startsAt.format(); // rendered in UTC when the wire value ended with Z
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

`hierarchicalConvertToDayjs` has no configuration. What it recognizes is fixed:

```text
date (UTC)    ^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$
date (offset) ^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?([+-]\d{2}:\d{2})?$
duration      ^P(nY)?(nM)?(nW)?(nD)?(T(nH)?(nM)?(nS)?)$   with integer n only
```

The first pattern wins and is parsed with `dayjs.utc(value)`; anything matching only the second is parsed with `dayjs(value)` in local mode. Date candidates are pre-filtered by four cheap checks (length at least 20, `-` at index 4, `-` at index 7, `T` at index 10); duration candidates by length at least 2 and a leading `P`. The depth guard is `depth > 100`, so the root plus 100 nested levels are walked.

The backend is configured entirely through the runtime option object (`dateBackend`), and `mode: 'strict'` is what turns codec `RangeError`s into reported failures rather than preserved raw values.

---

## 📤 Output examples

`hierarchicalConvertToDayjs`:

| Input                                       | After conversion                                       |
| ------------------------------------------- | ------------------------------------------------------ |
| `{ date: '2023-07-17T23:06:00.000Z' }`      | `dayjs.utc('2023-07-17T23:06:00.000Z')` (UTC mode)     |
| `{ date: '2023-07-17T23:06:00.000+01:00' }` | `dayjs('2023-07-17T23:06:00.000+01:00')` (local mode)  |
| `{ nested: { date: '...Z' } }`              | converted at any depth                                 |
| `['...Z', '...Z']`                          | every array element converted                           |
| `{ duration: 'P0D' }`                       | `dayjs.duration('P0D')` (every component zero)          |
| `{ duration: 'P4W' }`                       | `dayjs.duration({ weeks: 4 })`                          |
| `{ duration: 'P1Y2M4DT2H3M2S' }`            | `dayjs.duration({ years: 1, months: 2, days: 4, hours: 2, minutes: 3, seconds: 2 })` |
| `{ text: 'adam' }`                          | untouched                                               |
| `{ d: '2023-99-99T99:99:99.000Z' }`         | untouched (matched the pattern, parsed invalid)         |

`dayjsDateBackend` codecs:

```text
instant          '2024-01-02T03:04:05.678+02:00' -> UTC Dayjs   -> '2024-01-02T01:04:05.678Z'
plain-date       '2024-01-02'                    -> local Dayjs -> '2024-01-02'
plain-date-time  '2024-01-02T03:04:05.678'       -> local Dayjs -> '2024-01-02T03:04:05.678'
duration         'P1Y2M3DT4H5M6.7S'              -> Duration    -> 'P1Y2M3DT4H5M6.7S'
```

---

## ⚠️ Edge cases

- **Importing this package mutates the shared Day.js instance.** `dayjs.extend(utc)`, `dayjs.extend(duration)` and (for the backend) `dayjs.extend(customParseFormat)` run at module load. That is what makes the code work regardless of import order, but it also means the package cannot be treated as side-effect free by a bundler, and your own `dayjs.duration(...)` calls still need your own `dayjs.extend(duration)` for the typings.
- **`Z` and `+00:00` produce different objects.** A trailing `Z` yields a UTC-mode `Dayjs` (`.format()` renders UTC), while an explicit numeric offset yields a local-mode `Dayjs` (`.format()` renders the machine zone). Same instant, different rendering. Call `.local()` or `.utc()` explicitly if you need one of them consistently.
- **Offset-less date-times are read as local time** by the second pattern, since the offset group is optional and `dayjs(value)` is used.
- **Mutation in place.** The traversal returns `void` and rewrites your object; clone first (`structuredClone`) if you need the original strings. The hydrated `Dayjs` and `Duration` values are themselves immutable, so they are safe to share afterwards.
- **Prototype pollution is blocked.** `__proto__`, `constructor` and `prototype` keys are skipped, and non-own enumerable properties are ignored via `Object.hasOwn`.
- **Cycles are safe**, tracked in a `WeakSet`, so a self-referencing payload terminates. Past 101 object levels (`depth > 100`) nothing is converted, silently.
- **Invalid but well-shaped dates stay strings.** `2023-99-99T99:99:99.000Z` matches the pattern, fails `isValid()`, and is left alone.
- **The traversal and the backend disagree about fractions and signs.** The traversal's duration pattern accepts integer components only, so `PT6.7S` and `-P1D` stay strings there, while `dayjsDateBackend.codecs.duration` parses both (its pattern allows `[+-]` and `.`/`,` fractions, unlike the date-fns backend which rejects negatives outright).
- **Any `P`-prefixed string of length 2 or more that matches the pattern is converted**, including the degenerate `'PT'`, which becomes a zero duration. Human text starting with `P` is safe because it fails the pattern.
- **Date-only strings are not touched by the traversal.** `2023-07-17` fails the 20 character floor. Use the schema stack with `plain-date` if your payload carries calendar dates.
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
