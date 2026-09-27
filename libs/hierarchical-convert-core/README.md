# Hierarchical converter core

Dependency-free implementation utilities shared by the hierarchical converters and HTTP adapters. Applications normally use a backend-specific converter (for example `@adaskothebeast/hierarchical-convert-to-date`) or an HTTP adapter instead of importing this package directly.

The full recognition and traversal rules, including per-backend precision, are documented in [docs/conversion-contract.md](../../docs/conversion-contract.md).

## Traversal

| Export                         | Purpose                                                                                                                               |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `visitStrings(value, convert)` | Replaces own enumerable string values of arrays and plain objects in place with `convert(value)`. Returning the same string keeps it. |
| `StringConverter` (type)       | `(value: string) => unknown`                                                                                                          |
| `isJsonContainer(value)`       | Cross-realm guard for plain objects and arrays; shared by traversal and HTTP adapters. |

Traversal enumerates populated entries rather than array length, so very sparse
arrays do not cause an unbounded per-index scan. Accessors are never invoked.

## Backend types

`DateBackend`, `DateCodec`, and `DateSchemaKind` are shared type-only contracts.
Standalone converters can expose typed backends without depending on the
typewriter runtime. That runtime re-exports these types for compatibility.

`visitStrings` only enters arrays and plain objects (prototype is `Object.prototype` from any realm, or `null`). Class instances, `Map`, `Set`, `Date`, Buffers, typed arrays, and backend objects such as Moment or Luxon values are left untouched, so running a converter twice is a no-op. Cycles and shared references are visited once, own `__proto__`, `constructor`, and `prototype` keys are skipped, and the root plus 100 nested levels are walked. Frozen objects, non-writable properties, and getter-only properties keep their values instead of throwing mid-walk.

## ISO 8601 helpers

| Export                        | Purpose                                                                                                                                                                      |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `parseIsoDateTime(value)`     | Recognises `YYYY-MM-DDTHH:mm:ss[.f{1,9}][Z\|±HH:MM]` with calendar validation (leap years, days per month, clock and offset ranges). Returns `{ hasOffset }` or `undefined`. |
| `isIsoDateTime(value)`        | `parseIsoDateTime(value) !== undefined`.                                                                                                                                     |
| `parseIsoDuration(value)`     | Parses `[-]P[nY][nM][nW][nD][T[nH][nM][n[.,]fS]]` into `{ negative, components: { years, months, weeks, days, hours, minutes, seconds } }` or `undefined`.                   |
| `isIsoDuration(value)`        | Tests the same duration syntax without allocating components.                                                                                                                |
| `normalizeIsoDuration(value)` | Rewrites the ISO decimal comma (`PT1,5S`) to a decimal point for parsers that only accept `.`.                                                                               |
| `millisecondDateTime(value)`  | Truncates a timestamp fraction to three digits (never rounds into the next second) for millisecond-precision backends.                                                       |

## JSON Problem Details helpers

Shared by every HTTP adapter so they recognise and report `application/problem+json` responses identically ([RFC 9457](https://www.rfc-editor.org/rfc/rfc9457.html)):

- Types: `ProblemDetails`, `ProblemDetailsFailure`, `ProblemDetailsResponseLike`, `HeaderLookup`.
- Guards and detection: `isProblemDetailsError`, `isProblemDetailsContentType`, `isProblemDetailsResponse`, `getResponseContentType`.
- Parsing: `parseProblemDetails`, `decodeProblemDetailsBody`, `readProblemDetailsResponse`.
- Errors: `ProblemDetailsError`, `withProblemDetails`, `attachProblemDetails`, `problemFailureFrom`, `throwIfProblemDetails`.

See the "JSON Problem Details" section of the conversion contract for adapter behaviour.

## Changes in 11.0.0

- `visitStrings(value, convert)` no longer accepts `depth` and `visited` arguments.
- Traversal enters only arrays and plain objects; previously every non-null object (including class instances, `Map`, `Date`, and backend values) was entered.
- Frozen objects and non-writable or getter-only properties are skipped instead of throwing.
- New exports: `parseIsoDateTime`, `parseIsoDuration`, `normalizeIsoDuration`, and the `IsoDateTimeInfo`, `IsoDuration`, `IsoDurationComponents`, and `StringConverter` types.
