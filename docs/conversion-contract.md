# Conversion and compatibility contract

## Heuristic date conversion

The hierarchical converters take a single argument and replace own enumerable
string values in place. Matching and traversal are shared through the
dependency-free `hierarchical-convert-core` package (`visitStrings`,
`parseIsoDateTime`, `parseIsoDuration`, and related helpers); date, duration,
Decimal, and UUID construction remains backend-specific.

Traversal rules (11.0.0):

- Only arrays and plain objects are entered. A plain object has
  `Object.prototype` (from any realm) or `null` as its prototype, which covers
  everything `JSON.parse` and `Response.json()` produce. Class instances, `Map`,
  `Set`, `Date`, Buffers and typed arrays, streams, and backend values such as
  Moment, Luxon, Day.js, js-joda, Temporal, and Decimal objects are left
  untouched. Running a converter twice is therefore a no-op on values it has
  already converted.
- Arrays and objects are walked with `Object.keys`, so sparse-array holes require
  no per-index work and only own
  enumerable string keys are visited; own `__proto__`, `constructor`, and
  `prototype` keys are skipped and never entered.
- Shared references and cycles are visited once. The root plus 100 nested levels
  are converted; deeper values are left unchanged.
- Frozen objects and arrays are entered (their children may still be mutable)
  but their own string values are not replaced. For other objects, a
  non-writable data property or an accessor keeps its original value;
  the write is skipped instead of throwing, so conversion of the remaining
  properties continues. Getters and setters are not called. Sparse-array holes
  and non-enumerable array elements are skipped.

Date recognition accepts `YYYY-MM-DDTHH:mm:ss`, an optional fraction of one to nine
digits, and an optional `Z` or `±HH:mm` offset. Calendar dates and clock/offset
components are checked before parsing. Impossible dates such as February 30,
24:00, and leap-second notation remain strings. Date-only strings remain strings.

| Backend                                      | Fractional precision      | Timestamp without offset                             |
| -------------------------------------------- | ------------------------- | ---------------------------------------------------- |
| Native Date, date-fns, Day.js, Moment, Luxon | Truncated to milliseconds | Local system timezone                                |
| js-joda                                      | Up to nanoseconds         | Preserved as a string; ZonedDateTime needs an offset |
| Temporal                                     | Up to nanoseconds         | Temporal.PlainDateTime                               |

Explicit offsets preserve the instant. A backend may display it in its default
timezone; preserving the original textual offset is not guaranteed. Day.js,
Moment, and Luxon always produce local-mode objects, whether the wire value
ends in `Z` or a numeric offset. (Before 11.0.0, Day.js produced a UTC-mode
object for a trailing `Z` and a local-mode object for `+00:00`.)

The common duration syntax supports integer years/months/weeks/days/hours/minutes,
fractional seconds (up to nine digits, with `.` or the ISO 8601 decimal comma
`,`), and an optional leading minus sign. Bare `P`, `PT`, trailing `T`, and
fractions on any component other than seconds are rejected and remain strings.
When a backend rejects or throws on a recognised duration, the value also
remains a string.

| Backend     | Result                                      | `PT1.5S` / `PT1,5S`                                                                   | Weeks (`P1W2D`, `P1Y2W`)                                         | `PT0.123456789S`                                                   | `-PT1.5S`                       | `P99999999999999999999Y`                      |
| ----------- | ------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------- | --------------------------------------------- |
| Native Date | String                                      | String                                                                                | String                                                           | String                                                             | String                          | String                                        |
| js-joda     | String                                      | String                                                                                | String                                                           | String                                                             | String                          | String                                        |
| date-fns    | Plain `Duration` object with all seven keys | `seconds: 1.5`                                                                        | Kept (`weeks: 1, days: 2`)                                       | `seconds: 0.123456789`                                             | String                          | `years: 1e20` (imprecise)                     |
| Day.js      | `Duration`                                  | 1500 ms; the comma is normalized in core first because Day.js parses `PT1,5S` as zero | `weeks()` kept, but `toISOString()` gives days (`P9D`, `P1Y14D`) | Kept as 123.456789 ms                                              | String; Day.js ignores the sign | Converted, imprecise (about 1e20 years)       |
| Moment      | `Duration`                                  | 1500 ms; comma accepted natively                                                      | Folded into days (`P9D`, `P1Y14D`)                               | `toISOString()` gives `PT0.123S`; `asMilliseconds()` is 123.456789 | -1500 ms                        | Converted, imprecise (about 1e20 years)       |
| Luxon       | `Duration`                                  | 1500 ms; comma accepted natively                                                      | Kept (`P1W2D`)                                                   | Truncated to 123 ms (`PT0.123S`)                                   | -1500 ms                        | Converted, imprecise (about 1e20 years)       |
| Temporal    | `Temporal.Duration`                         | 1500 ms; comma accepted natively                                                      | Kept (`P1W2D`)                                                   | Exact to the nanosecond                                            | -1500 ms                        | String; Temporal rejects years of 2³² or more |

`tools/testing/package-contracts.mjs` asserts the `PT1.5S`, `PT1,5S`, `P1Y2W`,
`PT0.123456789S`, and out-of-range rows of this table against the packed
packages.

Schema date backends retain their explicitly typed codec contracts. Use schemas
when date-looking strings must remain strings or fields need precise semantics.

## Schema objects

The HTTP adapters default to strict transformation and serialization in v11.
Pass `strict: false` in their transform/serialize options to opt out. Direct
`transformJson` and `serializeJson` calls retain their tolerant default.

Hydration and serialization use the same descriptor normalization, including
property/variant arrays, UUID version sets, null/void, and named custom adapters.
Descriptors and lazy factories are cached by identity and must be treated as
immutable after use. Create a new descriptor or registry entry to change a schema.
Custom codec context calls advance depth and accept an optional child path segment.

Property renames are staged before they are applied, so overlapping wire names
(including swaps) preserve all mapped values. Serialization leaves the input
object unchanged. Unmapped properties continue to pass through.

In strict mode, missing properties are validated as `undefined` against their
schemas. Wrap a property in `schema.optional(...)` to permit absence.
`schema.nullable(...)` permits `null`, not absence. Schemas such as
`schema.unknown()` intentionally accept `undefined`. Tolerant mode still skips
missing properties. Error paths use wire names during transformation and model
names during serialization. This is schema-directed conversion and validation;
it does not reject unknown object keys or enforce arbitrary application rules.
Strict serialization requires model property names. Tolerant serialization also
accepts wire aliases when they cannot be confused with another model property.

Custom transformers that replace shared objects reuse their result for the same
input object and schema, including an `undefined` result. Cyclic object/array data
continues to work. Schema-reference cycles that do not descend into data are
rejected with a path-aware error in strict mode and preserved in tolerant mode;
they cannot bypass `maxDepth` by overflowing the stack.
Unknown or invalid union discriminators preserve the original object in tolerant
mode. Strict-mode errors still identify the discriminator's path and value.

## Fetch

Both `fetchJson` helpers return `Promise<T | undefined>`. HTTP 204/205 and empty or
whitespace-only successful bodies produce `undefined`, including empty HEAD
responses. Nonempty bodies must contain valid JSON. The native-date helper rejects
malformed JSON with `SyntaxError`; the typewriter helper uses
`TypewriterJsonParseError`, retaining the response, body text, and original
`SyntaxError` as `cause`. Valid JSON `null` is distinct from an empty body.

`serializeJsonBody` returns a JSON string or throws. An absent root value (such as
`undefined` under an optional schema) throws `TypeError`; omit `RequestInit.body`
explicitly when no request body is wanted. Optional object properties can still be
omitted, and a `null` root produces the JSON string `"null"`.

HTTP failures retain their original, unconsumed `Response` as `error.response`.
A `TypewriterJsonParseError` instead has an already-read response and exposes its
text as `error.body`:

```ts
try {
  const invoice = await fetchJson('/invoices/1', InvoiceSchema);
  if (invoice === undefined) return;
  // Use the hydrated invoice.
} catch (error) {
  if (error instanceof TypewriterFetchError) {
    const requestId = error.response?.headers.get('x-request-id');
    const body = await error.response?.text();
    // The caller chooses how to interpret the server's error body.
  }
  throw error;
}
```

## React query conversion

The hook memoizes converted data by the original `data`/`currentData` reference and converter
reference. Status changes still propagate without cloning data again. Follow
React's immutable-data convention and keep the converter stable (module scope or
`useCallback`). No-data and primitive results pass through unchanged.

Query flags, structured errors, and method signatures are preserved. Existing
mutating converters may return `void`. To infer a different hydrated model type,
return that model from the converter, for example a schema transformer:

```ts
const hydrateInvoice = (value: object) => transformJson(value, InvoiceSchema, apiTypeRegistry, { strict: true });

function useInvoice() {
  return useAdjustUseQueryHookResultWithHierarchicalDateConverter(useGetInvoiceQuery(), hydrateInvoice);
}
```

## JSON Problem Details

All HTTP adapters recognize `application/problem+json`, case-insensitively and
with optional media-type parameters. Recognition happens before success-schema,
class, or heuristic date conversion, including when the server sends HTTP 200 or
Axios `validateStatus` accepts an error status. Ordinary JSON objects are never
classified as problems merely because they have `title`, `type`, or `status` fields.

Import `isProblemDetailsError` from the HTTP adapter you use. It narrows any
recognized failure to a shared interface:

```ts
if (isProblemDetailsError(error)) {
  const status = error.httpStatus; // Actual HTTP status, including 200.
  const title = error.problem?.title;
  const validationErrors = error.problem?.['errors']; // An extension: unknown.
  const traceId = error.problem?.['traceId'];
  const originalBody = error.body;
}
```

The standard `type`, `title`, `status`, `detail`, and `instance` members are typed.
Extension members, including ASP.NET validation `errors` and `traceId`, are retained
without conversion. Invalid standard-member types are ignored in the parsed
`problem`; the original decoded document is retained in `body`. Missing `type`
defaults to `about:blank`. URI members are retained without fetching their URLs.
The body's `problem.status` is advisory and never replaces `httpStatus`.
These rules follow the JSON model in [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457.html).

| Adapter                                                        | Error behavior                                                                                                                                                       |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fetch, both helpers                                            | Keeps `FetchJsonError` / `TypewriterFetchError` and the original unconsumed `response`; problem parsing reads a clone                                                |
| Axios, legacy and schema interceptors                          | Keeps existing `AxiosError` instances, `response`, config, and code; an accepted problem response creates an `AxiosError` with code `ERR_PROBLEM_DETAILS`            |
| Angular, functional/class date and class/schema transformation | Keeps `HttpErrorResponse` and its original `.error` body; a successful problem response is turned into a native `HttpErrorResponse`                                  |
| RTK Query base-query wrapper                                   | Returns a plain `ProblemDetailsQueryError` under `error`, with numeric `status`, original problem `data`, and shared fields; keeps `meta` and bypasses the converter |

Malformed JSON or non-object bodies advertised as Problem Details still fail as
problems; `problem` is `undefined` and `body` retains the undecodable content.
Already-decoded objects and text bodies are supported. Binary/stream bodies remain
available through the native error and are not automatically consumed by Axios or
Angular. Non-problem HTTP/network failures keep their previous behavior.

For RTK Query, prefer `withHierarchicalDateConversion(fetchBaseQuery(...), converter)`.
The wrapper reads HTTP headers/status from `meta.response` and returns a serializable
error rather than throwing. Custom base queries must expose equivalent response
metadata to enable detection. The standalone `createHierarchicalDateTransformResponse`
also accepts `meta` and leaves problem responses untouched. It does not throw a
Problem Details error, because RTK Query strips custom fields from errors thrown
by a response transform. Use the base-query wrapper when those fields must reach
query error state. For malformed JSON, the wrapper preserves the original
`status: 'PARSING_ERROR'` discriminant; `httpStatus` remains numeric. The React hook
preserves errors from the base query and does not guess response types from data.

The RTK base-query wrapper converts successful data in place before the cache
freezes it. Use it only with base queries that return newly owned mutable data.
Endpoint transforms and the hook clone before conversion. Caching dates requires
the documented `hierarchicalDateSerializableCheck` configuration; prefer the hook
when the Redux store must stay serializable.

## Migration and release validation

These changes tighten behavior: invalid dates no longer normalize, offset-free
date-fns timestamps use the local timezone, strict schemas reject missing required
fields, and Fetch callers must handle an empty result. The React hook infers its
query and output types; callers using its former explicit data generic should
remove that generic and use a typed converter. Review these changes before
upgrading to 11.0.0. See [the v11 migration guide](migration-v11.md).

`yarn test:packages` packs every built library, installs the tarballs and their
consumer peers in a fresh temporary directory, checks public imports, runs shared
date/schema/Fetch contracts under UTC and Europe/Warsaw, and compiles a strict
TypeScript consumer with both bundler and NodeNext module resolution, plus CommonJS
runtime and `.cts` type consumers. Tarballs must include LICENSE and public exports.
It does not publish anything.
The temporary directory is printed and retained for debugging. Run `yarn build:all`
first. CI and the publishing workflow require this check and successful linting.

`yarn test:packages:minimum` repeats those checks using the lowest peer versions
that satisfy all package manifests, including React 18 and the minimum Angular and
Axios releases. The default profile uses the versions installed in the workspace.
CI runs the workspace and packed-consumer checks on Node 22.22.3, 24, and 26;
the minimum-peer profile also runs on Node 24 and before publishing.

All libraries collect coverage from their production TypeScript sources, including
untested files, into `.reports/libs/<library>/coverage`. JUnit and Sonar test reports
use the same per-library directory. `tools/testing/coverage-thresholds.json` contains
separate statement, branch, function, and line minimums for every library, rounded
down from its measured baseline. Keep those minimums when adding code and raise
them as tests improve; do not regenerate or lower them just to pass CI.
Run `yarn coverage:report` after the tests to print coverage for each library and
the aggregate totals, weighted by executable statements/branches/functions/lines.

Rollup builds normalize relative declaration imports to explicit `.js` paths,
including generated entry points on Windows. This follows
[TypeScript's NodeNext resolution rules](https://www.typescriptlang.org/docs/handbook/modules/reference.html#the-moduleresolution-compiler-option)
and is validated against packed artifacts with `skipLibCheck: false`.
