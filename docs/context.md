# conversation

## 1. what are alternatives to luxon moment date-fns js-joda dayjs

Beyond **Luxon, Moment, date-fns, js-joda, and Day.js**, these are the most relevant alternatives:

| Option                        | Best for                                            | Notes                                                                                                                                                                                                                                  |
| ----------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Temporal API**              | New applications, correct time-zone handling        | Immutable, strongly structured types such as `PlainDate`, `Instant`, and `ZonedDateTime`. Use a polyfill for unsupported browsers. This is my first choice for new TypeScript code. ([developer.mozilla.org][1])                       |
| **Native `Date` + `Intl`**    | Formatting according to user regional settings      | No dependency. `Intl.DateTimeFormat` is widely supported and automatically handles regional formatting. `Intl.DurationFormat` is also available in modern browsers. ([developer.mozilla.org][2])                                       |
| **`@internationalized/date`** | Date pickers, calendars, international applications | Immutable date objects, time zones, multiple calendar systems, and separate `CalendarDate`, `CalendarDateTime`, and `ZonedDateTime` types. Particularly useful with React Aria and headless UI components. ([react-aria.adobe.com][3]) |
| **iso-fns**                   | Functional TypeScript applications                  | ISO-oriented types represented as strings, pure functions, durations, dates, instants, and zoned date-times. Similar philosophy to date-fns but without depending directly on mutable JavaScript `Date` objects. ([GitHub][4])         |
| **Qrono**                     | Small single-time-zone applications                 | Immutable, compact API with explicit handling of daylight-saving-time ambiguity. It is intentionally aimed at applications operating mainly in one time zone. ([GitHub][5])                                                            |
| **Spacetime**                 | Lightweight time-zone conversion                    | Focused on working with local and remote time zones on both frontend and backend. ([GitHub][6])                                                                                                                                        |
| **TimezoneComplete**          | Complex schedules, periods and DST                  | Provides aware and unaware date-times, durations, periods, time zones and DST-aware calculations. More extensive and object-oriented. ([GitHub][7])                                                                                    |
| **Fecha**                     | Only formatting and strict parsing                  | Very small and simple. It formats and parses native `Date` objects using explicit format strings, but does not provide advanced date arithmetic or time-zone models. ([GitHub][8])                                                     |
| **Chrono / chrono-node**      | Parsing natural-language dates                      | Understands expressions such as “tomorrow”, “last Friday”, “in two weeks”, and date ranges. It complements another date library rather than replacing one. ([GitHub][9])                                                               |

## My recommendation

For a modern frontend:

```text
Date calculations and time zones: Temporal
Regional formatting:              Intl.DateTimeFormat
Date-picker internal values:      @internationalized/date
Natural-language input:           chrono-node
```

Example using native regional formatting:

```ts
const formatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "short",
  timeStyle: "short",
});

console.log(formatter.format(new Date()));
```

Using `undefined` tells the browser to use the user’s current locale.

For Temporal with broad browser compatibility:

```bash
npm install @js-temporal/polyfill
```

```ts
import { Temporal } from "@js-temporal/polyfill";

const now = Temporal.Now.zonedDateTimeISO();

const warsaw = now.withTimeZone("Europe/Warsaw");

console.log(warsaw.toString());
```

For your previous use case—**date pickers following the user’s regional settings**—I would use **native `Intl.DateTimeFormat` for display** and either **Temporal** or **`@internationalized/date` for the internal value model**, rather than introducing another Moment-style wrapper.

[1]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal?utm_source=chatgpt.com "Temporal - JavaScript - MDN Web Docs"
[2]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat?utm_source=chatgpt.com "Intl.DateTimeFormat - JavaScript - MDN Web Docs"
[3]: https://react-aria.adobe.com/internationalized/date/?utm_source=chatgpt.com "Internationalized Date | React Aria"
[4]: https://github.com/rubber-duck-software/iso-fns?utm_source=chatgpt.com "rubber-duck-software/iso-fns"
[5]: https://github.com/urin/qrono?utm_source=chatgpt.com "urin/qrono: 🕥 A tiny JavaScript date library with 100+ APIs ..."
[6]: https://github.com/spencermountain/spacetime?utm_source=chatgpt.com "spencermountain/spacetime: A lightweight javascript ..."
[7]: https://github.com/rogierschouten/timezonecomplete?utm_source=chatgpt.com "rogierschouten/timezonecomplete: Extensive date/time ..."
[8]: https://github.com/taylorhakes/fecha?utm_source=chatgpt.com "taylorhakes/fecha - Lightweight Date Formatting and Parsing"
[9]: https://github.com/wanasit/chrono?utm_source=chatgpt.com "wanasit/chrono: A natural language date parser in Javascript"

## 2. axios has interceptors - what has fetch?

Native **`fetch()` has no built-in interceptor system** like Axios. Usually you create a wrapper around it.

## TypeScript fetch wrapper

```ts
type FetchInterceptor = {
  onRequest?: (
    input: RequestInfo | URL,
    init: RequestInit
  ) => Promise<[RequestInfo | URL, RequestInit]> | [RequestInfo | URL, RequestInit];

  onResponse?: (response: Response) => Promise<Response> | Response;

  onError?: (error: unknown) => Promise<never> | never;
};

export function createFetch(interceptors: FetchInterceptor[]) {
  return async function interceptedFetch(
    input: RequestInfo | URL,
    init: RequestInit = {}
  ): Promise<Response> {
    try {
      let currentInput = input;
      let currentInit = init;

      for (const interceptor of interceptors) {
        if (interceptor.onRequest) {
          [currentInput, currentInit] =
            await interceptor.onRequest(currentInput, currentInit);
        }
      }

      let response = await fetch(currentInput, currentInit);

      for (const interceptor of interceptors) {
        if (interceptor.onResponse) {
          response = await interceptor.onResponse(response);
        }
      }

      return response;
    } catch (error) {
      for (const interceptor of interceptors) {
        if (interceptor.onError) {
          await interceptor.onError(error);
        }
      }

      throw error;
    }
  };
}
```

### Authentication interceptor

```ts
const authInterceptor: FetchInterceptor = {
  onRequest: async (input, init) => {
    const token = localStorage.getItem("access_token");

    const headers = new Headers(init.headers);

    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    headers.set("Accept", "application/json");

    return [
      input,
      {
        ...init,
        headers,
      },
    ];
  },
};
```

### HTTP error interceptor

Unlike Axios, `fetch()` does **not** reject the promise for HTTP responses such as `404` or `500`; you must inspect `response.ok` or `response.status`. ([developer.mozilla.org][1])

```ts
const errorInterceptor: FetchInterceptor = {
  onResponse: async response => {
    if (response.status === 401) {
      // Redirect, refresh token, dispatch logout, etc.
      console.warn("Unauthorized");
    }

    if (!response.ok) {
      const body = await response.clone().text();

      throw new HttpError(
        response.status,
        response.statusText,
        body
      );
    }

    return response;
  },
};

class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly body?: string
  ) {
    super(`HTTP ${status}: ${statusText}`);
  }
}
```

### Creating the client

```ts
export const apiFetch = createFetch([
  authInterceptor,
  errorInterceptor,
]);
```

```ts
const response = await apiFetch("/api/users");
const users = await response.json();
```

## A more practical API client

For application code, I usually wrap JSON handling too:

```ts
type ApiRequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
};

export async function apiRequest<T>(
  url: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const headers = new Headers(options.headers);
  const token = localStorage.getItem("access_token");

  headers.set("Accept", "application/json");

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...options,
    headers,
    body:
      options.body === undefined
        ? undefined
        : JSON.stringify(options.body),
  });

  if (!response.ok) {
    throw new HttpError(
      response.status,
      response.statusText,
      await response.text()
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
```

Usage:

```ts
interface User {
  id: number;
  name: string;
}

const users = await apiRequest<User[]>("/api/users");

const created = await apiRequest<User>("/api/users", {
  method: "POST",
  body: {
    name: "Adam",
  },
});
```

## Other interception approaches

A **Service Worker** can intercept browser network requests through its `fetch` event and provide a modified or cached response. This is more appropriate for offline support, caching, mocks, and request routing than ordinary authentication handling. ([developer.mozilla.org][2])

You can also overwrite `window.fetch`, but this modifies global behavior and can interfere with third-party libraries:

```ts
const originalFetch = window.fetch.bind(window);

window.fetch = async (input, init = {}) => {
  console.log("Before request", input);

  const response = await originalFetch(input, init);

  console.log("After response", response.status);

  return response;
};
```

For most applications, use one of these:

```text
Axios interceptor equivalent   → custom fetch wrapper
Whole-browser interception     → Service Worker
Testing and API mocking        → MSW
Ready-made fetch client        → ky or ofetch
```

A wrapper is generally the cleanest solution because it keeps interception limited to your API client rather than changing global `fetch`.

[1]: https://developer.mozilla.org/en-US/?utm_source=chatgpt.com "MDN Web Docs - Mozilla"
[2]: https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerGlobalScope/fetch_event?utm_source=chatgpt.com "ServiceWorkerGlobalScope: fetch event - Web APIs | MDN"

## 3. I want to extend this adaskothebeast/date-interceptors with decimal.js uuid and temporal functrionality and also fetch interceptors

This is a natural next step, but I would **refactor the repository around generic JSON value transformers first** instead of copying the recursive traversal into another three packages.

The repository currently has separate traversal implementations for each date library, while the Axios integration already accepts one or multiple functions shaped like `(data: unknown) => void`. ([GitHub][1])

## Recommended package structure

```text
libs/
  hierarchical-transform-core/
  hierarchical-convert-to-date/
  hierarchical-convert-to-luxon/
  hierarchical-convert-to-temporal/
  hierarchical-convert-to-decimal/
  hierarchical-convert-to-uuid/
  axios-interceptor/
  fetch-interceptor/
```

Keep the existing packages and public functions for backward compatibility, but implement them using `hierarchical-transform-core`.

## 1. Create a common transformer engine

```ts
export type TransformPath = readonly (string | number)[];

export interface TransformContext {
  readonly key: string | number | undefined;
  readonly path: TransformPath;
  readonly parent: object | undefined;
}

export interface ValueTransformer {
  readonly name: string;

  canTransform(
    value: unknown,
    context: TransformContext
  ): boolean;

  transform(
    value: unknown,
    context: TransformContext
  ): unknown;
}

export interface HierarchicalTransformOptions {
  readonly maxDepth?: number;
  readonly onTransformError?: (
    error: unknown,
    transformer: ValueTransformer,
    value: unknown,
    context: TransformContext
  ) => void;
}

const dangerousKeys = new Set([
  "__proto__",
  "constructor",
  "prototype",
]);

export function hierarchicalTransform(
  value: unknown,
  transformers: readonly ValueTransformer[],
  options: HierarchicalTransformOptions = {},
): unknown {
  const visited = new WeakSet<object>();
  const maxDepth = options.maxDepth ?? 100;

  function visit(
    current: unknown,
    path: TransformPath,
    key: string | number | undefined,
    parent: object | undefined,
    depth: number,
  ): unknown {
    const context: TransformContext = {
      key,
      path,
      parent,
    };

    for (const transformer of transformers) {
      try {
        if (transformer.canTransform(current, context)) {
          return transformer.transform(current, context);
        }
      } catch (error) {
        options.onTransformError?.(
          error,
          transformer,
          current,
          context,
        );
      }
    }

    if (
      typeof current !== "object" ||
      current === null ||
      depth >= maxDepth
    ) {
      return current;
    }

    if (visited.has(current)) {
      return current;
    }

    visited.add(current);

    if (Array.isArray(current)) {
      for (let index = 0; index < current.length; index++) {
        current[index] = visit(
          current[index],
          [...path, index],
          index,
          current,
          depth + 1,
        );
      }

      return current;
    }

    const record = current as Record<string, unknown>;

    for (const property of Object.keys(record)) {
      if (dangerousKeys.has(property)) {
        continue;
      }

      record[property] = visit(
        record[property],
        [...path, property],
        property,
        record,
        depth + 1,
      );
    }

    return record;
  }

  return visit(value, [], undefined, undefined, 0);
}
```

Then existing converters become wrappers:

```ts
export function hierarchicalConvertToDate(value: unknown): void {
  hierarchicalTransform(value, [dateTransformer]);
}
```

This removes duplicated circular-reference, depth, path, array, and prototype-pollution handling. The current implementations already contain depth limiting, circular-reference tracking, dangerous-key filtering, and fast string rejection, so these protections belong in one shared core. ([GitHub][2])

---

## 2. Decimal.js functionality

### Important design problem

Do **not** convert every numeric-looking string:

```json
{
  "price": "123.45",
  "phone": "48123456789",
  "postalCode": "80123",
  "customerId": "000123"
}
```

All four are decimal-compatible strings, but only `price` should become `Decimal`.

Require either:

* a path/key selector;
* explicit tagged JSON;
* generated metadata from OpenAPI/JSON Schema.

### Decimal transformer

```ts
import Decimal from "decimal.js";

export type DecimalSelector = (
  value: string,
  context: TransformContext,
) => boolean;

export interface DecimalTransformerOptions {
  readonly select: DecimalSelector;
  readonly DecimalConstructor?: typeof Decimal;
}

const decimalPattern =
  /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

export function createDecimalTransformer(
  options: DecimalTransformerOptions,
): ValueTransformer {
  const DecimalConstructor =
    options.DecimalConstructor ?? Decimal;

  return {
    name: "decimal",

    canTransform(value, context): boolean {
      return (
        typeof value === "string" &&
        decimalPattern.test(value) &&
        options.select(value, context)
      );
    },

    transform(value): Decimal {
      return new DecimalConstructor(value as string);
    },
  };
}
```

Usage:

```ts
const decimalTransformer = createDecimalTransformer({
  select: (_value, context) => {
    const key = String(context.key ?? "");

    return (
      key === "price" ||
      key === "amount" ||
      key === "balance" ||
      key.endsWith("Amount") ||
      key.endsWith("Price")
    );
  },
});
```

Decimal.js supports creating independently configured constructors, so accepting an injected constructor lets consumers control precision and rounding without changing the global Decimal configuration. ([GitHub][3])

```ts
const MoneyDecimal = Decimal.clone({
  precision: 40,
  rounding: Decimal.ROUND_HALF_EVEN,
});

const decimalTransformer = createDecimalTransformer({
  DecimalConstructor: MoneyDecimal,
  select: (_value, context) =>
    String(context.key).endsWith("Amount"),
});
```

Suggested package:

```text
@adaskothebeast/hierarchical-convert-to-decimal
```

---

## 3. UUID functionality

The `uuid` package does not provide a rich UUID domain object. Its main relevant operations are validation, version detection, conversion to bytes, and conversion back to a string. ([GitHub][4])

You therefore need to decide what “conversion” means.

### Best option: a UUID value object

```ts
import {
  parse as parseUuid,
  stringify as stringifyUuid,
  validate as validateUuid,
  version as uuidVersion,
} from "uuid";

export class Uuid {
  readonly #bytes: Uint8Array;

  private constructor(bytes: Uint8Array) {
    this.#bytes = new Uint8Array(bytes);
  }

  static parse(value: string): Uuid {
    if (!validateUuid(value)) {
      throw new TypeError(`Invalid UUID: ${value}`);
    }

    return new Uuid(parseUuid(value));
  }

  static tryParse(value: string): Uuid | undefined {
    return validateUuid(value)
      ? new Uuid(parseUuid(value))
      : undefined;
  }

  get version(): number {
    return uuidVersion(this.toString());
  }

  toBytes(): Uint8Array {
    return new Uint8Array(this.#bytes);
  }

  equals(other: Uuid): boolean {
    const otherBytes = other.#bytes;

    return this.#bytes.every(
      (value, index) => value === otherBytes[index],
    );
  }

  toString(): string {
    return stringifyUuid(this.#bytes);
  }

  toJSON(): string {
    return this.toString();
  }
}
```

Transformer:

```ts
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createUuidTransformer(
  select: (
    value: string,
    context: TransformContext,
  ) => boolean = () => true,
): ValueTransformer {
  return {
    name: "uuid",

    canTransform(value, context): boolean {
      return (
        typeof value === "string" &&
        uuidPattern.test(value) &&
        select(value, context)
      );
    },

    transform(value): Uuid {
      return Uuid.parse(value as string);
    },
  };
}
```

Usage:

```ts
const uuidTransformer = createUuidTransformer(
  (_value, context) => {
    const key = String(context.key ?? "");

    return (
      key === "id" ||
      key.endsWith("Id") ||
      key.endsWith("Uuid")
    );
  },
);
```

Suggested package:

```text
@adaskothebeast/hierarchical-convert-to-uuid
```

You could additionally export a validation-only transformer that leaves the value as a string and throws or reports invalid UUIDs.

---

## 4. Temporal functionality

Temporal requires more than one output type:

| JSON shape                                 | Temporal type            |
| ------------------------------------------ | ------------------------ |
| `2026-07-16T10:30:00Z`                     | `Temporal.Instant`       |
| `2026-07-16T10:30:00+02:00`                | `Temporal.Instant`       |
| `2026-07-16T10:30:00+02:00[Europe/Warsaw]` | `Temporal.ZonedDateTime` |
| `2026-07-16T10:30:00`                      | `Temporal.PlainDateTime` |
| `2026-07-16`                               | `Temporal.PlainDate`     |
| `10:30:00`                                 | `Temporal.PlainTime`     |
| `P3DT4H`                                   | `Temporal.Duration`      |

`Instant` represents an exact point in time, `PlainDateTime` represents wall-clock time without a time zone, and `ZonedDateTime` combines an instant with a named time zone. These types should not be treated interchangeably. ([developer.mozilla.org][5])

### Temporal transformer

```ts
import { Temporal } from "@js-temporal/polyfill";

const zonedDateTimePattern =
  /^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})\[[^\]]+\](?:\[u-ca=[^\]]+\])?$/;

const instantPattern =
  /^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/;

const plainDateTimePattern =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?$/;

const plainDatePattern =
  /^\d{4}-\d{2}-\d{2}$/;

const plainTimePattern =
  /^\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?$/;

const durationPattern = /^[-+]?P/;

export interface TemporalTransformerOptions {
  readonly instant?: boolean;
  readonly zonedDateTime?: boolean;
  readonly plainDateTime?: boolean;
  readonly plainDate?: boolean;
  readonly plainTime?: boolean;
  readonly duration?: boolean;
  readonly select?: (
    value: string,
    context: TransformContext,
  ) => boolean;
}

export function createTemporalTransformer(
  options: TemporalTransformerOptions = {},
): ValueTransformer {
  const enabled = {
    instant: options.instant ?? true,
    zonedDateTime: options.zonedDateTime ?? true,
    plainDateTime: options.plainDateTime ?? true,
    plainDate: options.plainDate ?? true,
    plainTime: options.plainTime ?? false,
    duration: options.duration ?? true,
  };

  return {
    name: "temporal",

    canTransform(value, context): boolean {
      if (typeof value !== "string") {
        return false;
      }

      if (options.select && !options.select(value, context)) {
        return false;
      }

      return (
        (enabled.zonedDateTime &&
          zonedDateTimePattern.test(value)) ||
        (enabled.instant &&
          instantPattern.test(value)) ||
        (enabled.plainDateTime &&
          plainDateTimePattern.test(value)) ||
        (enabled.plainDate &&
          plainDatePattern.test(value)) ||
        (enabled.plainTime &&
          plainTimePattern.test(value)) ||
        (enabled.duration &&
          durationPattern.test(value))
      );
    },

    transform(value): unknown {
      const text = value as string;

      if (
        enabled.zonedDateTime &&
        zonedDateTimePattern.test(text)
      ) {
        return Temporal.ZonedDateTime.from(text);
      }

      if (
        enabled.instant &&
        instantPattern.test(text)
      ) {
        return Temporal.Instant.from(text);
      }

      if (
        enabled.plainDateTime &&
        plainDateTimePattern.test(text)
      ) {
        return Temporal.PlainDateTime.from(text);
      }

      if (
        enabled.plainDate &&
        plainDatePattern.test(text)
      ) {
        return Temporal.PlainDate.from(text);
      }

      if (
        enabled.plainTime &&
        plainTimePattern.test(text)
      ) {
        return Temporal.PlainTime.from(text);
      }

      if (
        enabled.duration &&
        durationPattern.test(text)
      ) {
        return Temporal.Duration.from(text);
      }

      return value;
    },
  };
}
```

The official polyfill is imported as:

```ts
import { Temporal } from "@js-temporal/polyfill";
```

It intentionally does not install a global `Temporal`, which makes an explicit import appropriate for a library package. ([GitHub][6])

Suggested package:

```text
@adaskothebeast/hierarchical-convert-to-temporal
```

Temporal objects also serialize back to string representations through `toJSON()`, which is useful for request bodies. ([developer.mozilla.org][7])

---

## 5. Compose transformations

```ts
const apiTransformers: ValueTransformer[] = [
  createTemporalTransformer(),
  createUuidTransformer(),
  createDecimalTransformer({
    select: (_value, context) => {
      const key = String(context.key ?? "");

      return (
        key.endsWith("Amount") ||
        key.endsWith("Price") ||
        key === "balance"
      );
    },
  }),
];

export function transformApiResponse(data: unknown): void {
  hierarchicalTransform(data, apiTransformers, {
    onTransformError: (
      error,
      transformer,
      value,
      context,
    ) => {
      console.warn(
        `Transformer ${transformer.name} failed at ${context.path.join(".")}`,
        value,
        error,
      );
    },
  });
}
```

Axios remains almost unchanged:

```ts
export const api =
  AxiosInstanceManager.createInstance(transformApiResponse);
```

---

## 6. Fetch interceptors

A true Fetch replacement needs special handling because `Response` contains a body stream. Once the body is consumed using `json()`, `text()`, or another body reader, it cannot simply be consumed again; `Response.clone()` exists specifically for duplicating response streams. ([developer.mozilla.org][8])

More importantly, converting JSON into `Decimal`, `Uuid`, or Temporal instances cannot be represented inside a normal `Response`. A `Response` contains bytes—not an object graph.

Therefore, do not rebuild a `Response` after transformation. Provide a Fetch client with separate raw and JSON APIs.

### Fetch interceptor contracts

```ts
export interface FetchRequestContext {
  readonly input: RequestInfo | URL;
  readonly init: RequestInit;
}

export interface FetchRequestInterceptor {
  onRequest(
    context: FetchRequestContext,
  ):
    | FetchRequestContext
    | Promise<FetchRequestContext>;
}

export interface FetchResponseInterceptor {
  onResponse(
    response: Response,
    request: FetchRequestContext,
  ): Response | Promise<Response>;
}

export interface FetchErrorInterceptor {
  onError(
    error: unknown,
    request: FetchRequestContext,
  ): unknown | Promise<unknown>;
}

export interface JsonResponseInterceptor {
  onJson(
    data: unknown,
    response: Response,
    request: FetchRequestContext,
  ): unknown | Promise<unknown>;
}
```

### Fetch client

```ts
export interface FetchClientOptions {
  readonly fetch?: typeof globalThis.fetch;
  readonly requestInterceptors?: readonly FetchRequestInterceptor[];
  readonly responseInterceptors?: readonly FetchResponseInterceptor[];
  readonly jsonInterceptors?: readonly JsonResponseInterceptor[];
  readonly errorInterceptors?: readonly FetchErrorInterceptor[];
}

export class FetchClient {
  readonly #fetch: typeof globalThis.fetch;
  readonly #requestInterceptors:
    readonly FetchRequestInterceptor[];
  readonly #responseInterceptors:
    readonly FetchResponseInterceptor[];
  readonly #jsonInterceptors:
    readonly JsonResponseInterceptor[];
  readonly #errorInterceptors:
    readonly FetchErrorInterceptor[];

  constructor(options: FetchClientOptions = {}) {
    this.#fetch =
      options.fetch ?? globalThis.fetch.bind(globalThis);

    this.#requestInterceptors =
      options.requestInterceptors ?? [];

    this.#responseInterceptors =
      options.responseInterceptors ?? [];

    this.#jsonInterceptors =
      options.jsonInterceptors ?? [];

    this.#errorInterceptors =
      options.errorInterceptors ?? [];
  }

  async fetch(
    input: RequestInfo | URL,
    init: RequestInit = {},
  ): Promise<Response> {
    let request: FetchRequestContext = {
      input,
      init,
    };

    try {
      for (const interceptor of this.#requestInterceptors) {
        request = await interceptor.onRequest(request);
      }

      let response = await this.#fetch(
        request.input,
        request.init,
      );

      for (const interceptor of this.#responseInterceptors) {
        response = await interceptor.onResponse(
          response,
          request,
        );
      }

      return response;
    } catch (initialError) {
      let error: unknown = initialError;

      for (const interceptor of this.#errorInterceptors) {
        error = await interceptor.onError(error, request);
      }

      throw error;
    }
  }

  async json<T>(
    input: RequestInfo | URL,
    init: RequestInit = {},
  ): Promise<T> {
    const request: FetchRequestContext = {
      input,
      init,
    };

    const response = await this.fetch(input, init);

    if (!response.ok) {
      throw new FetchHttpError(response);
    }

    let data: unknown = await response.json();

    for (const interceptor of this.#jsonInterceptors) {
      data = await interceptor.onJson(
        data,
        response,
        request,
      );
    }

    return data as T;
  }
}

export class FetchHttpError extends Error {
  constructor(readonly response: Response) {
    super(
      `HTTP ${response.status}: ${response.statusText}`,
    );

    this.name = "FetchHttpError";
  }
}
```

### JSON transformation interceptor

```ts
export function createHierarchicalJsonInterceptor(
  transformers: readonly ValueTransformer[],
): JsonResponseInterceptor {
  return {
    onJson(data): unknown {
      return hierarchicalTransform(data, transformers);
    },
  };
}
```

Usage:

```ts
export const api = new FetchClient({
  requestInterceptors: [
    {
      onRequest({ input, init }) {
        const headers = new Headers(init.headers);
        const token = localStorage.getItem("access_token");

        headers.set("Accept", "application/json");

        if (token) {
          headers.set("Authorization", `Bearer ${token}`);
        }

        return {
          input,
          init: {
            ...init,
            headers,
          },
        };
      },
    },
  ],

  jsonInterceptors: [
    createHierarchicalJsonInterceptor(apiTransformers),
  ],
});
```

```ts
interface Invoice {
  id: Uuid;
  totalAmount: Decimal;
  createdAt: Temporal.Instant;
  settlementDate: Temporal.PlainDate;
}

const invoice = await api.json<Invoice>(
  "/api/invoices/123",
);

invoice.totalAmount.plus("10.00");
invoice.createdAt.epochMilliseconds;
invoice.id.toString();
```

Suggested package:

```text
@adaskothebeast/fetch-interceptor
```

## Public API I would expose

```ts
import {
  FetchClient,
  createHierarchicalJsonInterceptor,
} from "@adaskothebeast/fetch-interceptor";

import { createDecimalTransformer } from
  "@adaskothebeast/hierarchical-convert-to-decimal";

import { createUuidTransformer } from
  "@adaskothebeast/hierarchical-convert-to-uuid";

import { createTemporalTransformer } from
  "@adaskothebeast/hierarchical-convert-to-temporal";
```

## Recommended implementation order

1. Extract `hierarchical-transform-core`.
2. Migrate one existing converter to verify backward compatibility.
3. Add Temporal.
4. Add Decimal with mandatory selection rules.
5. Add the UUID value object and transformer.
6. Refactor Axios to use the shared transformer terminology.
7. Add `FetchClient.fetch()` and `FetchClient.json<T>()`.
8. Add mixed-payload tests containing dates, decimals, UUIDs, Temporal durations, arrays, circular references, and dangerous keys.

The repository can retain the name **date-interceptors**, but after these additions its more accurate long-term identity would be something like **JSON Type Interceptors** or **Typed JSON Interceptors**.

[1]: https://github.com/AdaskoTheBeAsT/date-interceptors/tree/main/libs "date-interceptors/libs at main · AdaskoTheBeAsT/date-interceptors · GitHub"
[2]: https://github.com/AdaskoTheBeAsT/date-interceptors/blob/main/libs/hierarchical-convert-to-date/src/lib/hierarchical-convert-to-date.ts "date-interceptors/libs/hierarchical-convert-to-date/src/lib/hierarchical-convert-to-date.ts at main · AdaskoTheBeAsT/date-interceptors · GitHub"
[3]: https://github.com/MikeMcl/decimal.js/blob/master/README.md?utm_source=chatgpt.com "decimal.js/README.md at master · MikeMcl ..."
[4]: https://github.com/uuidjs/uuid?utm_source=chatgpt.com "uuidjs/uuid: Generate RFC-compliant UUIDs in JavaScript"
[5]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal/ZonedDateTime?utm_source=chatgpt.com "Temporal.ZonedDateTime - JavaScript - MDN Web Docs"
[6]: https://github.com/js-temporal/temporal-polyfill?utm_source=chatgpt.com "js-temporal/temporal-polyfill"
[7]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal/PlainDateTime/toJSON?utm_source=chatgpt.com "Temporal.PlainDateTime.prototype.toJSON() - JavaScript | MDN"
[8]: https://developer.mozilla.org/en-US/docs/Web/API/Response/clone?utm_source=chatgpt.com "Response: clone() method - Web APIs | MDN"

## 4. I would use also https://github.com/adaskothebeast/typewriter and https://github.com/AdaskoTheBeAsT/NetCoreTypewriterRecipes - maybe I should generate some kind of attributes in properties and have ability to use attributes when traversing tree and convert?


Yes—**schema-aware traversal generated by Typewriter is the right direction**. It removes the biggest weakness of heuristic conversion: the interceptor no longer has to guess whether `"123.45"` is a decimal, whether `"2026-07-16"` is a date, or whether a string is merely UUID-shaped.

I would, however, generate **runtime type descriptors as the primary mechanism**, with property decorators as an optional facade.

Typewriter already exposes Roslyn attributes and configurable mappings for dates, `Guid`, and `decimal`. Your recipes also already inspect attributes such as `JsonIgnore`, `JsonDerivedType`, and `JsonPolymorphic`, including property-level attributes, so extending this approach fits the existing architecture well. ([GitHub][1])

## Recommended architecture

```text
C# DTO
   ↓
Typewriter
   ↓
TypeScript interface/class
   +
generated runtime descriptor
   ↓
Axios/fetch typed JSON interceptor
   ↓
schema-guided tree transformation
```

## 1. Generate runtime schemas, not only decorators

For this C# model:

```csharp
[GenerateFrontendType]
public sealed class InvoiceDto
{
    public Guid Id { get; init; }

    public decimal TotalAmount { get; init; }

    public DateTimeOffset CreatedAt { get; init; }

    public DateOnly DueDate { get; init; }

    public CustomerDto? Customer { get; init; }

    public IReadOnlyCollection<InvoiceLineDto> Lines { get; init; } = [];
}
```

Typewriter could generate:

```ts
import Decimal from "decimal.js";
import type { UUID } from "@adaskothebeast/uuid";
import { Temporal } from "@js-temporal/polyfill";

export interface InvoiceDto {
  id: UUID;
  totalAmount: Decimal;
  createdAt: Temporal.Instant;
  dueDate: Temporal.PlainDate;
  customer: CustomerDto | null;
  lines: InvoiceLineDto[];
}
```

And, importantly, also:

```ts
export const InvoiceDtoSchema = objectSchema<InvoiceDto>({
  id: uuidSchema(),
  totalAmount: decimalSchema(),
  createdAt: temporalInstantSchema(),
  dueDate: temporalPlainDateSchema(),

  customer: nullable(
    referenceSchema("Contracts.CustomerDto"),
  ),

  lines: arraySchema(
    referenceSchema("Contracts.InvoiceLineDto"),
  ),
});
```

Now the converter knows exactly what each property means.

```ts
const invoice = transformJson(
  responseData,
  InvoiceDtoSchema,
);
```

There is no regex-based guessing.

---

## 2. Why descriptors are better than TypeScript decorators

You could generate this:

```ts
export class InvoiceDto {
  @JsonUuid()
  id!: UUID;

  @JsonDecimal()
  totalAmount!: Decimal;

  @JsonTemporalInstant()
  createdAt!: Temporal.Instant;
}
```

But it has several disadvantages:

* decorators cannot be added to interfaces;
* generated responses are still plain JSON objects, not `InvoiceDto` instances;
* a global interceptor still needs to know that the root response is an `InvoiceDto`;
* decorator behavior depends on compiler and bundler configuration;
* emitted type metadata requires legacy decorator settings and `reflect-metadata`, and automatic metadata has known limitations with circular and forward references. ([npm][2])

A generated descriptor is ordinary JavaScript:

```ts
export const InvoiceDtoSchema = {
  kind: "object",
  properties: {
    id: { kind: "uuid" },
    totalAmount: { kind: "decimal" },
    createdAt: { kind: "temporal-instant" },
  },
} as const;
```

It works with:

* interfaces;
* classes;
* Axios;
* Fetch;
* React;
* Angular;
* Vite;
* webpack;
* esbuild;
* Node.js;
* browser applications;
* tests without special compiler configuration.

You could still generate decorators as an optional convenience layer that internally references the same descriptors.

---

## 3. Use C# attributes only for ambiguous or overridden semantics

You do not need attributes on every property. Most mappings can be inferred directly from the C# type.

### Automatic mappings

| C# type                  | Generated runtime type                             |
| ------------------------ | -------------------------------------------------- |
| `Guid`                   | UUID or branded UUID string                        |
| `decimal`                | `Decimal`                                          |
| `DateOnly`               | `Temporal.PlainDate`                               |
| `TimeOnly`               | `Temporal.PlainTime`                               |
| `DateTimeOffset`         | `Temporal.Instant`                                 |
| `TimeSpan`               | `Temporal.Duration`, with a compatible wire format |
| `NodaTime.Instant`       | `Temporal.Instant`                                 |
| `NodaTime.LocalDate`     | `Temporal.PlainDate`                               |
| `NodaTime.LocalDateTime` | `Temporal.PlainDateTime`                           |
| collection               | array descriptor                                   |
| dictionary               | record descriptor                                  |
| nullable property        | nullable descriptor                                |

### Attributes for ambiguous cases

`DateTime` is the clearest example because the CLR type alone does not tell the frontend whether the value represents:

* an exact UTC instant;
* a local wall-clock date and time;
* a value that should be interpreted in a particular time zone.

You could introduce:

```csharp
public enum FrontendRuntimeType
{
    Auto,
    Decimal,
    Uuid,
    TemporalInstant,
    TemporalPlainDate,
    TemporalPlainTime,
    TemporalPlainDateTime,
    TemporalZonedDateTime,
    TemporalDuration,
    String
}

[AttributeUsage(
    AttributeTargets.Property |
    AttributeTargets.Field |
    AttributeTargets.Parameter)]
public sealed class FrontendRuntimeTypeAttribute(
    FrontendRuntimeType type) : Attribute
{
    public FrontendRuntimeType Type { get; } = type;

    public string? WireFormat { get; init; }

    public string? TimeZoneProperty { get; init; }
}
```

Usage:

```csharp
public sealed class AppointmentDto
{
    [FrontendRuntimeType(
        FrontendRuntimeType.TemporalInstant)]
    public DateTime CreatedAt { get; init; }

    [FrontendRuntimeType(
        FrontendRuntimeType.TemporalPlainDateTime)]
    public DateTime AppointmentTime { get; init; }

    [FrontendRuntimeType(
        FrontendRuntimeType.String)]
    public Guid ExternalReference { get; init; }
}
```

For positional records, explicitly target the generated property:

```csharp
public sealed record PaymentDto(
    [property: FrontendRuntimeType(
        FrontendRuntimeType.Decimal)]
    decimal Amount);
```

I would also provide:

```csharp
[FrontendNoTransform]
public string DateLookingIdentifier { get; init; } = "";
```

That gives you an escape hatch for unusual APIs.

---

## 4. Generate a central descriptor registry

Individual schemas importing each other can cause circular module imports:

```text
CustomerDtoSchema → OrderDtoSchema
OrderDtoSchema → CustomerDtoSchema
```

Use string references and a registry:

```ts
export const apiTypeRegistry = defineTypeRegistry({
  "Contracts.InvoiceDto": {
    kind: "object",
    properties: {
      id: {
        kind: "uuid",
      },

      totalAmount: {
        kind: "decimal",
      },

      createdAt: {
        kind: "temporal-instant",
      },

      customer: {
        kind: "nullable",
        value: {
          kind: "reference",
          typeName: "Contracts.CustomerDto",
        },
      },

      lines: {
        kind: "array",
        element: {
          kind: "reference",
          typeName: "Contracts.InvoiceLineDto",
        },
      },
    },
  },

  "Contracts.CustomerDto": {
    kind: "object",
    properties: {
      id: {
        kind: "uuid",
      },

      name: {
        kind: "string",
      },
    },
  },
});
```

The traverser resolves references through the registry:

```ts
const result = transformJson(
  data,
  referenceSchema("Contracts.InvoiceDto"),
  apiTypeRegistry,
);
```

This avoids JavaScript import cycles and supports recursive models.

---

## 5. The schema model

A practical descriptor type could look like this:

```ts
export type JsonSchema<T = unknown> =
  | StringSchema
  | NumberSchema
  | BooleanSchema
  | DecimalSchema
  | UuidSchema
  | TemporalSchema
  | ArraySchema
  | ObjectSchema
  | RecordSchema
  | NullableSchema
  | OptionalSchema
  | ReferenceSchema
  | UnionSchema;

export interface DecimalSchema {
  readonly kind: "decimal";
}

export interface UuidSchema {
  readonly kind: "uuid";
  readonly versions?: readonly number[];
}

export interface TemporalSchema {
  readonly kind:
    | "temporal-instant"
    | "temporal-plain-date"
    | "temporal-plain-time"
    | "temporal-plain-date-time"
    | "temporal-zoned-date-time"
    | "temporal-duration";
}

export interface ArraySchema {
  readonly kind: "array";
  readonly element: JsonSchema;
}

export interface ObjectSchema {
  readonly kind: "object";
  readonly properties: Readonly<
    Record<string, JsonSchema>
  >;
}

export interface ReferenceSchema {
  readonly kind: "reference";
  readonly typeName: string;
}
```

For JSON property names, store both names when necessary:

```ts
export interface PropertySchema {
  readonly propertyName: string;
  readonly serializedName: string;
  readonly schema: JsonSchema;
}
```

That allows Typewriter to honor:

```csharp
[JsonPropertyName("total_amount")]
public decimal TotalAmount { get; init; }
```

Generated metadata:

```ts
{
  propertyName: "totalAmount",
  serializedName: "total_amount",
  schema: decimalSchema(),
}
```

---

## 6. Schema-aware traversal

```ts
export function transformJson<T>(
  value: unknown,
  schema: JsonSchema<T>,
  registry: TypeRegistry,
): T {
  switch (schema.kind) {
    case "decimal":
      return new Decimal(assertString(value)) as T;

    case "uuid":
      return parseUuid(assertString(value)) as T;

    case "temporal-instant":
      return Temporal.Instant.from(
        assertString(value),
      ) as T;

    case "temporal-plain-date":
      return Temporal.PlainDate.from(
        assertString(value),
      ) as T;

    case "temporal-plain-time":
      return Temporal.PlainTime.from(
        assertString(value),
      ) as T;

    case "temporal-plain-date-time":
      return Temporal.PlainDateTime.from(
        assertString(value),
      ) as T;

    case "temporal-zoned-date-time":
      return Temporal.ZonedDateTime.from(
        assertString(value),
      ) as T;

    case "temporal-duration":
      return Temporal.Duration.from(
        assertString(value),
      ) as T;

    case "nullable":
      return (
        value === null
          ? null
          : transformJson(
              value,
              schema.value,
              registry,
            )
      ) as T;

    case "array": {
      if (!Array.isArray(value)) {
        throw new JsonTransformationError(
          "Expected an array",
        );
      }

      return value.map(item =>
        transformJson(
          item,
          schema.element,
          registry,
        ),
      ) as T;
    }

    case "object":
      return transformObject(
        value,
        schema,
        registry,
      ) as T;

    case "reference":
      return transformJson(
        value,
        registry.get(schema.typeName),
        registry,
      ) as T;

    default:
      return value as T;
  }
}
```

Unlike your current date traversal, this version does not need to inspect every string against every possible parser. It only invokes the correct parser at a known property.

---

## 7. Generated Axios services should pass response metadata

A global interceptor cannot recover this:

```ts
axios.get<InvoiceDto>("/api/invoices/1");
```

The generic `InvoiceDto` exists only for TypeScript checking. It is not available to the running JavaScript interceptor.

Generate:

```ts
return api.get<InvoiceDto>(
  `/api/invoices/${id}`,
  {
    responseSchema: InvoiceDtoSchema,
  },
);
```

Add Axios module augmentation:

```ts
declare module "axios" {
  interface AxiosRequestConfig {
    responseSchema?: JsonSchema<unknown>;
  }

  interface InternalAxiosRequestConfig {
    responseSchema?: JsonSchema<unknown>;
  }
}
```

The response interceptor becomes:

```ts
axiosInstance.interceptors.response.use(
  response => {
    const schema =
      response.config.responseSchema;

    if (schema && response.data !== undefined) {
      response.data = transformJson(
        response.data,
        schema,
        apiTypeRegistry,
      );
    }

    return response;
  },
);
```

This is significantly safer than:

```ts
hierarchicalConvertToDecimal(response.data);
hierarchicalConvertToUuid(response.data);
hierarchicalConvertToTemporal(response.data);
```

---

## 8. Fetch integration becomes straightforward

```ts
export async function fetchJson<T>(
  input: RequestInfo | URL,
  schema: JsonSchema<T>,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(input, init);

  if (!response.ok) {
    throw new FetchHttpError(response);
  }

  const json: unknown = await response.json();

  return transformJson(
    json,
    schema,
    apiTypeRegistry,
  );
}
```

Generated Typewriter service:

```ts
export function getInvoice(
  id: UUID,
): Promise<InvoiceDto> {
  return fetchJson(
    `/api/invoices/${id}`,
    InvoiceDtoSchema,
  );
}
```

You can put request, response, authentication, retry, and logging interceptors around this client separately.

---

## 9. Handle generics with descriptor factories

For:

```csharp
public sealed class PagedResult<T>
{
    public IReadOnlyCollection<T> Items { get; init; } = [];
    public int TotalCount { get; init; }
}
```

Generate:

```ts
export interface PagedResult<T> {
  items: T[];
  totalCount: number;
}

export function PagedResultSchema<T>(
  itemSchema: JsonSchema<T>,
): JsonSchema<PagedResult<T>> {
  return objectSchema({
    items: arraySchema(itemSchema),
    totalCount: numberSchema(),
  });
}
```

Then generated service code can use:

```ts
return fetchJson(
  "/api/invoices",
  PagedResultSchema(InvoiceDtoSchema),
);
```

---

## 10. Include polymorphism in the schema

Your recipes already inspect `JsonPolymorphic` and `JsonDerivedType`. The same information should be included in runtime metadata. ([GitHub][3])

C#:

```csharp
[JsonPolymorphic(
    TypeDiscriminatorPropertyName = "$type")]
[JsonDerivedType(typeof(CardPaymentDto), "card")]
[JsonDerivedType(typeof(CashPaymentDto), "cash")]
public abstract class PaymentDto;
```

Generated schema:

```ts
export const PaymentDtoSchema =
  discriminatedUnionSchema<PaymentDto>({
    discriminator: "$type",

    mappings: {
      card: referenceSchema(
        "Contracts.CardPaymentDto",
      ),

      cash: referenceSchema(
        "Contracts.CashPaymentDto",
      ),
    },
  });
```

The traverser reads `$type` and applies the matching derived schema.

---

## 11. Critical decimal wire-format issue

For `decimal.js`, the server should serialize decimals as **JSON strings**, not JSON numbers:

```json
{
  "totalAmount": "12345678901234567890.123456789"
}
```

Not:

```json
{
  "totalAmount": 12345678901234567890.123456789
}
```

Once `JSON.parse()` has converted the latter to a JavaScript `number`, precision may already have been lost, and wrapping the result in `Decimal` cannot restore the original value. JavaScript numbers have finite binary precision, and JSON numbers outside the safely representable range may be corrupted when parsed. ([GitHub][4])

On the .NET side, use a converter that writes decimal values as strings:

```csharp
public sealed class DecimalAsStringConverter
    : JsonConverter<decimal>
{
    public override decimal Read(
        ref Utf8JsonReader reader,
        Type typeToConvert,
        JsonSerializerOptions options)
    {
        return reader.TokenType switch
        {
            JsonTokenType.String =>
                decimal.Parse(
                    reader.GetString()!,
                    CultureInfo.InvariantCulture),

            JsonTokenType.Number =>
                reader.GetDecimal(),

            _ => throw new JsonException()
        };
    }

    public override void Write(
        Utf8JsonWriter writer,
        decimal value,
        JsonSerializerOptions options)
    {
        writer.WriteStringValue(
            value.ToString(
                CultureInfo.InvariantCulture));
    }
}
```

The schema can specify the expected wire representation:

```ts
totalAmount: decimalSchema({
  wireType: "string",
});
```

---

## 12. Suggested package split

```text
@adaskothebeast/json-type-core
@adaskothebeast/json-type-transformer
@adaskothebeast/json-type-axios
@adaskothebeast/json-type-fetch
@adaskothebeast/json-type-decimal
@adaskothebeast/json-type-temporal
@adaskothebeast/json-type-uuid
```

Your current packages can remain as compatibility packages:

```text
@adaskothebeast/hierarchical-convert-to-date
@adaskothebeast/hierarchical-convert-to-luxon
@adaskothebeast/hierarchical-convert-to-dayjs
```

They could internally use the common conversion engine.

## Final recommendation

Use all three layers:

```text
C# attributes
    Optional semantic overrides

Typewriter-generated descriptors
    Primary runtime metadata

Optional TypeScript decorators
    Convenience API for class-oriented users
```

The most important API should look like:

```ts
api.get(
  "/api/invoices/1",
  InvoiceDtoSchema,
);
```

rather than:

```ts
api.get<InvoiceDto>(
  "/api/invoices/1",
);
```

because the first version carries both compile-time typing and runtime transformation knowledge.

[1]: https://github.com/adaskothebeast/typewriter "GitHub - AdaskoTheBeAsT/Typewriter: Automatic TypeScript template generation from C# source files · GitHub"
[2]: https://www.npmjs.com/package/reflect-metadata?utm_source=chatgpt.com "reflect-metadata"
[3]: https://github.com/AdaskoTheBeAsT/NetCoreTypewriterRecipes/blob/master/Angular/System.Text.Json/models/_AutogeneratedModels.tst "NetCoreTypewriterRecipes/Angular/System.Text.Json/models/_AutogeneratedModels.tst at master · AdaskoTheBeAsT/NetCoreTypewriterRecipes · GitHub"
[4]: https://github.com/MikeMcl/decimal.js/?utm_source=chatgpt.com "MikeMcl/decimal.js: An arbitrary-precision ..."

## 5. where my ecosystem of typewriter schema transformers would fit in? it is valuable set of libs extensions?

Yes—**it is a valuable ecosystem**, but its strongest positioning is not “a collection of interceptor libraries.”

It fits into a more important category:

> **A .NET-to-TypeScript runtime contract and JSON hydration system.**

The individual libraries—date converters, Axios interceptors, Fetch interceptors, Decimal, UUID, and Temporal support—are implementation pieces of that larger system.

## Where it fits

```text
C# contracts
    │
    ▼
Typewriter + Roslyn metadata
    │
    ├── TypeScript types
    ├── runtime schemas
    ├── generated API clients
    └── serialization metadata
             │
             ▼
     Runtime transformer
             │
    ┌────────┼─────────┐
    ▼        ▼         ▼
 Decimal   Temporal   UUID
    │        │         │
    └────────┼─────────┘
             ▼
 Axios / Fetch / Angular / RTK Query
             ▼
 Correctly hydrated TypeScript objects
```

Typewriter is already well suited to act as the compiler layer because it exposes Roslyn metadata including attributes, nullability, records, generics, tuples and documentation, while also supporting CLI, CI, watch mode and multiple editors. ([GitHub][1])

Your recipes already represent the next layer: generating frontend models and services from .NET controllers and models, including polymorphic `System.Text.Json` contracts. ([GitHub][2])

Your date-interceptors repository already provides the runtime and integration layer across multiple date libraries, Angular, Axios and Redux Toolkit. ([GitHub][3])

The missing piece is to formally connect these repositories through a **generated runtime schema format**.

# The best description of your ecosystem

I would describe it as:

> **Typewriter Runtime compiles .NET API contracts into TypeScript types, executable schemas and HTTP clients that hydrate ordinary JSON into rich runtime types such as Temporal, Decimal and UUID.**

That is much stronger than:

> Date conversion interceptors for Axios and Angular.

## Your ecosystem layers

### 1. Contract compiler

This is Typewriter.

It reads:

```csharp
public sealed class InvoiceDto
{
    public Guid Id { get; init; }

    public decimal Amount { get; init; }

    public DateTimeOffset CreatedAt { get; init; }

    public DateOnly DueDate { get; init; }
}
```

And generates the compile-time model:

```ts
export interface InvoiceDto {
  id: UUID;
  amount: Decimal;
  createdAt: Temporal.Instant;
  dueDate: Temporal.PlainDate;
}
```

### 2. Runtime schema compiler

Typewriter additionally generates:

```ts
export const InvoiceDtoSchema =
  objectSchema<InvoiceDto>({
    id: uuidSchema(),
    amount: decimalSchema(),
    createdAt: temporalInstantSchema(),
    dueDate: temporalPlainDateSchema(),
  });
```

This is where your ecosystem becomes differentiated.

The TypeScript interface disappears at runtime, but `InvoiceDtoSchema` remains available to Fetch and Axios.

### 3. Runtime transformation engine

```ts
const result = transformJson(
  json,
  InvoiceDtoSchema,
);
```

It handles:

* nested objects;
* arrays and dictionaries;
* nullable and optional values;
* generic types;
* polymorphism;
* property-name mappings;
* circular schema references;
* Decimal;
* UUID;
* Temporal;
* existing date-library adapters;
* custom user transformers.

### 4. Transport integrations

```ts
const invoice = await client.get(
  "/api/invoices/123",
  InvoiceDtoSchema,
);
```

Or entirely generated:

```ts
export function getInvoice(
  id: UUID,
): Promise<InvoiceDto> {
  return api.get(
    `/api/invoices/${id}`,
    InvoiceDtoSchema,
  );
}
```

The transport implementations become relatively thin:

```text
@typewriter/http-fetch
@typewriter/http-axios
@typewriter/http-angular
```

# How it differs from existing libraries

| Existing category         | What it generally does                              | Your differentiation                                                                                         |
| ------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| OpenAPI Generator / NSwag | Generates TypeScript clients and DTOs               | Direct Roslyn metadata, custom C# attributes, executable hydration schemas and extensible rich runtime types |
| Zod                       | Defines and parses runtime schemas in TypeScript    | Generates schemas from C# so developers do not duplicate contracts                                           |
| class-transformer         | Converts plain objects to decorated class instances | Works with interfaces, descriptors, generated contracts and arbitrary value types                            |
| SuperJSON                 | Transmits additional metadata alongside JSON        | Uses ordinary API JSON with schema metadata generated at build time                                          |
| Date interceptors         | Heuristically detects date strings                  | Schema-guided conversion with no guessing                                                                    |

OpenAPI Generator currently offers multiple TypeScript targets, including Fetch and Axios, while NSwag can generate TypeScript clients and perform date conversion when generating DTO classes. ([openapi-generator.tech][4])

However, that is not identical to generating an extensible runtime contract capable of converting `decimal`, Temporal types, UUIDs, domain value objects and user-defined types according to property-level C# metadata.

Zod is primarily a TypeScript-first schema declaration and runtime parsing library. Your system could generate Zod schemas, but users would not need to manually reproduce their C# DTO definitions in Zod. ([Zod][5])

Class-transformer focuses on converting plain objects to class instances and commonly uses decorators. Your descriptors could work with both generated interfaces and classes without requiring decorator metadata. ([GitHub][6])

SuperJSON solves a related serialization problem by transmitting JSON together with metadata identifying special values. Your model would instead keep standard JSON on the wire and generate the metadata from the .NET source code. ([GitHub][7])

# Where the real value is

## 1. Exact numeric handling

This is a serious enterprise use case.

A generated schema knows:

```ts
amount: decimalSchema({
  wireType: "string",
});
```

Without the schema, `"123.45"` might be:

* money;
* an identifier;
* a version;
* a measurement;
* an ordinary string.

With generated metadata, no heuristic is needed.

## 2. Correct date and time semantics

Most generators reduce everything to `Date` or `string`.

Your mapping could retain the actual meaning:

```text
DateOnly        → Temporal.PlainDate
TimeOnly        → Temporal.PlainTime
DateTimeOffset  → Temporal.Instant
DateTime        → configurable
TimeSpan        → Temporal.Duration
NodaTime.Instant → Temporal.Instant
```

That is especially valuable for financial, scheduling, international and enterprise applications.

## 3. C# attributes become frontend behavior

```csharp
[FrontendType(FrontendRuntimeType.TemporalPlainDateTime)]
public DateTime LocalAppointmentTime { get; init; }

[FrontendType(FrontendRuntimeType.String)]
public Guid ExternalReference { get; init; }
```

Typewriter turns those decisions into executable TypeScript metadata.

That provides one source of truth:

```text
C# property
    ↓
JSON serialization
    ↓
TypeScript type
    ↓
runtime transformation
```

## 4. Generated polymorphic hydration

Your recipes already process polymorphic information. That can become:

```ts
export const PaymentSchema =
  discriminatedUnionSchema({
    discriminator: "$type",

    mappings: {
      card: CardPaymentSchema,
      transfer: BankTransferSchema,
      cash: CashPaymentSchema,
    },
  });
```

This is more valuable than merely converting dates because it reconstructs complete domain-shaped frontend data.

## 5. Custom domain value objects

The ecosystem should not stop at Decimal, Temporal and UUID.

Users should be able to register:

```ts
registerTransformer("money", {
  fromJson(value, schema) {
    return new Money(
      new Decimal(value.amount),
      value.currency,
    );
  },

  toJson(value) {
    return {
      amount: value.amount.toString(),
      currency: value.currency,
    };
  },
});
```

C#:

```csharp
[FrontendType("money")]
public Money Total { get; init; }
```

This makes the architecture extensible rather than a fixed collection of converters.

# What could reduce its value

## Too many disconnected packages

A package for every combination becomes difficult to understand:

```text
hierarchical-convert-to-date
hierarchical-convert-to-luxon
hierarchical-convert-to-dayjs
hierarchical-convert-to-decimal
hierarchical-convert-to-temporal
fetch-interceptor
axios-interceptor
```

Users may see isolated utility packages instead of a coherent platform.

Keep small adapter packages, but introduce an umbrella:

```text
@typewriter/runtime
@typewriter/schema
@typewriter/http
```

Then optional integrations:

```text
@typewriter/transform-decimal
@typewriter/transform-temporal
@typewriter/transform-luxon
@typewriter/http-axios
@typewriter/http-fetch
@typewriter/zod
```

## Relying primarily on heuristic traversal

Heuristic date detection is convenient:

```ts
hierarchicalConvertToDate(data);
```

But Decimal, UUID and Temporal reveal its limitations.

The long-term primary API should be:

```ts
transformJson(data, InvoiceDtoSchema);
```

Heuristic traversal can remain as a compatibility and convenience feature.

## Relying only on decorators

Decorators would restrict the ecosystem toward generated classes and particular compiler settings.

The main representation should be plain generated descriptors:

```ts
export const InvoiceSchema = {
  kind: "object",
  properties: {
    amount: {
      kind: "decimal",
    },
  },
} as const;
```

Decorators can write to or reference the same metadata registry.

## Trying to replace validation libraries

Do not position the runtime as another Zod competitor.

Separate the concepts:

```text
Hydration:
"123.45" → Decimal

Validation:
amount must be positive

Business validation:
amount must not exceed credit limit
```

Your core strength is **contract generation and hydration**.

Validation should be pluggable:

```text
Typewriter schema
    ├── lightweight runtime validator
    ├── Zod generator
    ├── Valibot generator
    └── JSON Schema generator
```

# Recommended product structure

```text
Typewriter
├── Compiler
│   ├── Roslyn metadata
│   ├── templates
│   └── custom attributes
│
├── Generated artifacts
│   ├── TypeScript types
│   ├── runtime schemas
│   ├── clients
│   └── optional validators
│
├── Runtime
│   ├── schema traversal
│   ├── serialization
│   ├── deserialization
│   ├── registry
│   └── diagnostics
│
├── Value adapters
│   ├── Temporal
│   ├── Decimal.js
│   ├── UUID
│   ├── Date
│   ├── Luxon
│   ├── Day.js
│   └── custom types
│
└── Transport adapters
    ├── Fetch
    ├── Axios
    ├── Angular HttpClient
    ├── RTK Query
    └── React Query
```

# The strongest public API

Generated model:

```ts
export interface InvoiceDto {
  id: UUID;
  amount: Decimal;
  createdAt: Temporal.Instant;
}
```

Generated schema:

```ts
export const InvoiceDtoSchema =
  schema.object<InvoiceDto>({
    id: schema.uuid(),
    amount: schema.decimal(),
    createdAt: schema.temporal.instant(),
  });
```

Generated client:

```ts
export class InvoiceClient {
  constructor(
    private readonly http: TypedHttpClient,
  ) {}

  getInvoice(id: UUID): Promise<InvoiceDto> {
    return this.http.get(
      `/api/invoices/${id}`,
      InvoiceDtoSchema,
    );
  }
}
```

User-defined extension:

```ts
runtime.register("money", moneyTransformer);
```

# My assessment

Your ecosystem has **real technical and practical value**, particularly for:

* .NET backends with Angular or React frontends;
* enterprise applications;
* financial systems using `decimal`;
* scheduling systems needing accurate time semantics;
* large DTO models where frontend/backend drift is expensive;
* systems using polymorphism and generated API clients.

Its differentiation will not come primarily from having more date-library adapters. Its defensible value is:

> **Using complete C# compiler metadata to generate both compile-time TypeScript contracts and runtime behavior.**

That is the part NSwag-style generation, handwritten Zod schemas, class-transformer and generic JSON serializers do not combine in the same way.

The next architectural step should therefore be **Typewriter Runtime Schema**, with the current date-interceptor libraries becoming adapters within that larger ecosystem.

[1]: https://github.com/adaskothebeast/typewriter "GitHub - AdaskoTheBeAsT/Typewriter: Automatic TypeScript template generation from C# source files · GitHub"
[2]: https://github.com/AdaskoTheBeAsT/NetCoreTypewriterRecipes "GitHub - AdaskoTheBeAsT/NetCoreTypewriterRecipes · GitHub"
[3]: https://github.com/adaskothebeast/date-interceptors "GitHub - AdaskoTheBeAsT/date-interceptors: Automatically converts ISO 8601 date strings in JSON responses into native Date objects — deeply, safely, and blazingly fast. · GitHub"
[4]: https://openapi-generator.tech/docs/generators/?utm_source=chatgpt.com "Generators List"
[5]: https://zod.dev/?utm_source=chatgpt.com "Zod: Intro"
[6]: https://github.com/typestack/class-transformer?utm_source=chatgpt.com "typestack/class-transformer: Decorator-based ..."
[7]: https://github.com/flightcontrolhq/superjson "GitHub - flightcontrolhq/superjson: Safely serialize JavaScript expressions to a superset of JSON, which includes Dates, BigInts, and more. · GitHub"

## 6. what were ways of communicating with api in angular 2 until angular 22

There were **not 21 completely different Angular APIs**. The evolution can be divided into several major generations.

## 1. Angular 2–4.2: `@angular/http`

The original Angular HTTP package used:

* `HttpModule`
* `Http`
* `Response`
* `Headers`
* `RequestOptions`
* `JsonpModule` / `Jsonp`

```ts
import { Http, Response } from '@angular/http';

constructor(private http: Http) {}

loadUsers() {
  return this.http
    .get('/api/users')
    .map((response: Response) => response.json());
}
```

Important characteristics:

* Requests returned RxJS `Observable<Response>`.
* JSON generally had to be extracted manually with `response.json()`.
* It used `XMLHttpRequest` internally.
* JSONP was provided as a separate Angular module.
* Developers could convert the Observable into a Promise when desired. ([v2.angular.io][1])

The package was deprecated in Angular 5 and removed in Angular 8. ([GitHub][2])

---

## 2. Angular 4.3–14: `HttpClient`

Angular 4.3 introduced the modern `HttpClient` API in `@angular/common/http`. ([GitHub][3])

Configuration:

```ts
import { HttpClientModule } from '@angular/common/http';

@NgModule({
  imports: [HttpClientModule]
})
export class AppModule {}
```

Usage:

```ts
import { HttpClient } from '@angular/common/http';

interface User {
  id: number;
  name: string;
}

constructor(private http: HttpClient) {}

loadUsers() {
  return this.http.get<User[]>('/api/users');
}
```

Compared with the old package, it provided:

* automatic JSON parsing;
* generic response typing;
* request and response interceptors;
* progress events;
* full response access;
* easier headers and query parameters;
* built-in XSRF support;
* dedicated testing utilities;
* support for JSON, text, blobs and array buffers.

`HttpClient` Observables are **cold**: the request starts when subscribed, and every subscription can send another request. Its TypeScript generic is a compile-time assertion rather than runtime validation. ([Angular][4])

Typical styles included:

### Direct subscription

```ts
this.http.get<User[]>('/api/users').subscribe(users => {
  this.users = users;
});
```

### Observable exposed to template

```ts
users$ = this.http.get<User[]>('/api/users');
```

```html
@for (user of users$ | async; track user.id) {
  <div>{{ user.name }}</div>
}
```

### Promise conversion

```ts
import { firstValueFrom } from 'rxjs';

const users = await firstValueFrom(
  this.http.get<User[]>('/api/users')
);
```

The Promise is only a different consumption style. The underlying Angular request is still made by `HttpClient`.

---

## 3. Angular 4.3–14 interceptors: class-based DI interceptors

The original interceptor style was class-based:

```ts
@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  intercept(
    request: HttpRequest<unknown>,
    next: HttpHandler
  ): Observable<HttpEvent<unknown>> {
    const modified = request.clone({
      setHeaders: {
        Authorization: `Bearer ${getToken()}`
      }
    });

    return next.handle(modified);
  }
}
```

Registration:

```ts
providers: [
  {
    provide: HTTP_INTERCEPTORS,
    useClass: AuthInterceptor,
    multi: true
  }
]
```

This became the standard way to handle authentication, logging, retries, error mapping, correlation IDs and global headers.

---

## 4. Angular 15–17: standalone providers and functional interceptors

Angular 15 introduced `provideHttpClient()` as the modern alternative to importing `HttpClientModule`. It works with standalone applications and is more configurable and tree-shakable. ([GitHub][5])

```ts
bootstrapApplication(AppComponent, {
  providers: [
    provideHttpClient()
  ]
});
```

Functional interceptors became the recommended style:

```ts
export const authInterceptor: HttpInterceptorFn = (
  request,
  next
) => {
  const token = inject(AuthService).token();

  return next(
    request.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    })
  );
};
```

```ts
bootstrapApplication(AppComponent, {
  providers: [
    provideHttpClient(
      withInterceptors([authInterceptor])
    )
  ]
});
```

Legacy class interceptors remained supported:

```ts
provideHttpClient(
  withInterceptorsFromDi()
)
```

Angular currently recommends functional interceptors because their execution and configuration are more predictable. ([Angular][6])

---

## 5. Angular 18: provider API preferred over modules

Angular 18 deprecated `HttpClientModule` and related module-based configuration. It was not immediately removed, but `provideHttpClient()` became the preferred setup. Angular provided a migration for existing applications. ([GitHub][7])

Old:

```ts
imports: [HttpClientModule]
```

Preferred:

```ts
providers: [
  provideHttpClient()
]
```

By this period, Angular could use two HTTP backends:

```ts
provideHttpClient(withFetch())
```

or the traditional XHR backend.

Fetch was particularly useful for server-side rendering, while XHR remained useful for browser upload-progress events. ([v18.angular.dev][8])

---

## 6. Angular 19–21: experimental Resource APIs

Angular 19 introduced the experimental `resource()` API for loading asynchronous data into signals.

Angular 19.2 added:

* `httpResource()`
* `rxResource()`

These APIs started as experimental and were intended to connect asynchronous data loading with Angular signals. ([Angular Blog][9])

Example:

```ts
userId = signal(1);

user = httpResource<User>(
  () => `/api/users/${this.userId()}`
);
```

Template:

```html
@if (user.isLoading()) {
  <p>Loading...</p>
} @else if (user.error()) {
  <p>Could not load user.</p>
} @else {
  <p>{{ user.value()?.name }}</p>
}
```

---

## 7. Angular 22: Fetch by default and stable Resource APIs

Angular 22 made the Resource family production-ready, including `resource`, `httpResource` and `rxResource`. ([Angular Blog][10])

### `httpResource`

`httpResource` is a signal-oriented wrapper around `HttpClient`:

```ts
search = signal('');

users = httpResource<User[]>(() => {
  const value = this.search().trim();

  return value
    ? `/api/users?search=${encodeURIComponent(value)}`
    : undefined;
});
```

It exposes signal-based state:

```ts
this.users.value();
this.users.isLoading();
this.users.error();
this.users.status();
```

Unlike a normal `HttpClient` Observable, `httpResource` is eager. When its reactive request changes, Angular cancels the previous request and starts the new one. It still goes through Angular interceptors and works with the normal HTTP testing infrastructure. ([Angular][11])

### `rxResource`

`rxResource` is useful when the loader already returns an Observable:

```ts
user = rxResource({
  params: () => this.userId(),
  stream: ({ params }) =>
    this.userService.getUser(params)
});
```

### `resource`

`resource` is not HTTP-specific. It can wrap any Promise-based asynchronous loader:

```ts
configuration = resource({
  params: () => this.environment(),
  loader: ({ params, abortSignal }) =>
    loadConfiguration(params, abortSignal)
});
```

### Fetch is the Angular 22 default

In Angular 22, `provideHttpClient()` uses the Fetch backend by default:

```ts
provideHttpClient()
```

Consequently, explicitly using `withFetch()` is no longer necessary and is deprecated. ([Angular][6])

XHR can still be requested:

```ts
provideHttpClient(
  withXhr()
)
```

This is mainly needed for upload progress because Fetch does not expose upload progress events in the same way as XHR. XHR is not recommended for server-side rendering. ([Angular][12])

---

# Angular 22 practical selection

## Standard REST mutations

Use `HttpClient` for `POST`, `PUT`, `PATCH` and `DELETE`:

```ts
saveUser(user: User) {
  return this.http.post<User>('/api/users', user);
}
```

`httpResource` is primarily intended for reading data rather than performing mutations. ([Angular][11])

## Signal-driven GET requests

Use `httpResource`:

```ts
userId = input.required<number>();

user = httpResource<User>(
  () => `/api/users/${this.userId()}`
);
```

## Complex RxJS pipelines

Use normal `HttpClient`:

```ts
users$ = this.searchControl.valueChanges.pipe(
  debounceTime(300),
  distinctUntilChanged(),
  switchMap(search =>
    this.http.get<User[]>('/api/users', {
      params: { search }
    })
  ),
  shareReplay({
    bufferSize: 1,
    refCount: true
  })
);
```

## File upload with progress

Use `HttpClient` with `withXhr()`:

```ts
provideHttpClient(withXhr());
```

```ts
upload(file: File) {
  const body = new FormData();
  body.append('file', file);

  return this.http.post('/api/files', body, {
    observe: 'events',
    reportProgress: true
  });
}
```

## Promise-based non-HTTP loading

Use `resource()` or ordinary `async`/`await`.

## Existing Observable-based service

Use `rxResource()` or continue exposing the Observable.

---

# APIs that were always available outside Angular

At practically every Angular version, you could also bypass Angular HTTP APIs and use:

* native `XMLHttpRequest`;
* native `fetch`;
* Axios;
* GraphQL clients such as Apollo;
* WebSocket;
* Server-Sent Events;
* SignalR;
* gRPC-Web;
* generated OpenAPI clients.

For example:

```ts
const response = await fetch('/api/users');
const users = await response.json() as User[];
```

These are valid, but plain `fetch` or Axios calls do not automatically participate in Angular’s `HttpClient` interceptor, XSRF and testing pipeline unless you integrate those concerns yourself.

## The key distinction

These concepts describe different layers:

| Layer             | Choices                                                            |
| ----------------- | ------------------------------------------------------------------ |
| Protocol          | REST, GraphQL, WebSocket, SSE, SignalR, gRPC-Web                   |
| Browser transport | XHR, Fetch                                                         |
| Angular API       | old `Http`, `HttpClient`, `httpResource`, `resource`, `rxResource` |
| Consumption model | Observable, Promise, Signal                                        |
| State management  | component state, service, NgRx, Signal Store, query library        |

So the condensed historical path is:

```text
Angular 2–4.2
@angular/http + Http + Observable<Response>

Angular 4.3–14
HttpClientModule + HttpClient + RxJS

Angular 15–17
provideHttpClient + functional interceptors

Angular 18
module setup deprecated, provider setup preferred

Angular 19–21
experimental resource/httpResource/rxResource

Angular 22
Fetch default + stable signal-based Resource APIs
```

For a new Angular 22 application, the most sensible combination is usually **`HttpClient` for commands and mutations, `httpResource` for signal-driven queries, functional interceptors for cross-cutting concerns, and `withXhr()` only when upload progress is required**.

[1]: https://v2.angular.io/docs/ts/latest/guide/server-communication.html "HTTP Client - ts - GUIDE"
[2]: https://github.com/angular/angular/issues/19788?utm_source=chatgpt.com "Deprecated http still used in platform-server · Issue #19788"
[3]: https://github.com/angular/angular/issues/18014?utm_source=chatgpt.com "common/http: expectOne could help to check body and ..."
[4]: https://angular.dev/guide/http/making-requests "Making requests • Angular"
[5]: https://github.com/angular/angular/commit/e47b129070 "feat(http): introduce the `provideHttpClient()` API (#47502) · angular/angular@e47b129 · GitHub"
[6]: https://angular.dev/guide/http/setup "Setting up HttpClient • Angular"
[7]: https://github.com/angular/angular/releases/tag/18.0.0 "Release v18.0.0 · angular/angular · GitHub"
[8]: https://v18.angular.dev/guide/http/setup/?utm_source=chatgpt.com "Setting up HttpClient"
[9]: https://blog.angular.dev/angular-19-2-is-now-available-673ec70aea12?utm_source=chatgpt.com "Angular 19.2 Is Now Available"
[10]: https://blog.angular.dev/announcing-angular-v22-c52bb83a4664 "Medium"
[11]: https://angular.dev/guide/http/http-resource "Reactive data fetching with httpResource • Angular"
[12]: https://angular.dev/api/common/http/withXhr "withXhr • Angular"

## 7. how can I mix 'withXhr' - as I only need upload files in one place in one service - in others fetch based should be used - also when uploading some files I would also send some form data fields - how to have interceptors for all cases - withXhr, withFetch and resource in order to introduce for example https://github.com/adaskothebeast/date-interceptors. can different modules have different providers? maybe separation by module could work.

Yes—**different parts of an Angular application can use differently configured `HttpClient` instances**, but module separation works only when those modules actually have separate injectors.

An eagerly imported `NgModule` normally contributes its providers to the root injector, so its `provideHttpClient(withXhr())` could override the application-wide Fetch configuration. A lazy-loaded module receives a child injector and can have an independent `HttpClient`. Route-level providers offer the same isolation and are usually cleaner in modern Angular. ([Angular][1])

## Recommended architecture

Use:

* root `HttpClient`: default Fetch backend;
* upload route/module `HttpClient`: XHR backend;
* the same interceptor functions registered in both clients;
* `UploadService` scoped to the upload route/module, not root.

In Angular 22, Fetch is already the default, so the root configuration does not need `withFetch()`. XHR is necessary when you need upload progress events. ([Angular][2])

## 1. Shared interceptors

```ts
// shared-http-interceptors.ts

import { HttpInterceptorFn } from '@angular/common/http';

import { authInterceptor } from './auth.interceptor';
import { correlationIdInterceptor } from './correlation-id.interceptor';
import { errorInterceptor } from './error.interceptor';

export const SHARED_HTTP_INTERCEPTORS: HttpInterceptorFn[] = [
  authInterceptor,
  correlationIdInterceptor,
  errorInterceptor,
];
```

## 2. Root client using Fetch

Because your current `date-interceptors` package registers a class-based interceptor through `HTTP_INTERCEPTORS`, include `withInterceptorsFromDi()`.

```ts
// app.config.ts

import {
  ApplicationConfig,
  importProvidersFrom,
} from '@angular/core';

import {
  provideHttpClient,
  withInterceptors,
  withInterceptorsFromDi,
} from '@angular/common/http';

import {
  AngularDateHttpInterceptorModule,
  HIERARCHICAL_DATE_ADJUST_FUNCTION,
} from '@adaskothebeast/angular-date-http-interceptor';

import {
  hierarchicalConvertToDate,
} from '@adaskothebeast/hierarchical-convert-to-date';

import {
  SHARED_HTTP_INTERCEPTORS,
} from './http/shared-http-interceptors';

export const appConfig: ApplicationConfig = {
  providers: [
    {
      provide: HIERARCHICAL_DATE_ADJUST_FUNCTION,
      useValue: hierarchicalConvertToDate,
    },

    importProvidersFrom(AngularDateHttpInterceptorModule),

    provideHttpClient(
      // Fetch is the Angular 22 default.
      withInterceptors(SHARED_HTTP_INTERCEPTORS),

      // Includes HierarchicalDateHttpInterceptor.
      withInterceptorsFromDi(),
    ),
  ],
};
```

Your package currently exposes an NgModule that registers `HierarchicalDateHttpInterceptor` through `HTTP_INTERCEPTORS`; consequently, `withInterceptorsFromDi()` is required when configuring `HttpClient` through `provideHttpClient()`. ([GitHub][3])

## 3. Upload route using XHR

Route providers create a separate injector. This route can therefore replace `HttpClient` with an independently configured XHR-based client.

```ts
// app.routes.ts

import { importProvidersFrom } from '@angular/core';
import { Routes } from '@angular/router';

import {
  provideHttpClient,
  withInterceptors,
  withInterceptorsFromDi,
  withXhr,
} from '@angular/common/http';

import {
  AngularDateHttpInterceptorModule,
} from '@adaskothebeast/angular-date-http-interceptor';

import {
  SHARED_HTTP_INTERCEPTORS,
} from './http/shared-http-interceptors';

import { UploadService } from './upload/upload.service';

export const routes: Routes = [
  {
    path: 'upload',

    providers: [
      UploadService,

      // Register the class-based date interceptor
      // in this child injector as well.
      importProvidersFrom(AngularDateHttpInterceptorModule),

      provideHttpClient(
        withXhr(),
        withInterceptors(SHARED_HTTP_INTERCEPTORS),
        withInterceptorsFromDi(),
      ),
    ],

    loadComponent: () =>
      import('./upload/upload.component')
        .then(module => module.UploadComponent),
  },
];
```

The date-adjustment token can remain in the root injector because the child injector can resolve it from its parent. The actual date interceptor must participate in the child `HttpClient` configuration because a locally configured `HttpClient` is independent of its parent by default. ([Angular][4])

## Important: scope `UploadService` correctly

Do not make it root-only:

```ts
// Avoid this for the isolated client:
@Injectable({
  providedIn: 'root',
})
export class UploadService {}
```

Use:

```ts
@Injectable()
export class UploadService {
  private readonly http = inject(HttpClient);
}
```

Then provide it in the upload route as shown above. This ensures its injected `HttpClient` comes from the upload route’s XHR-configured injector.

A root-created service would resolve the root `HttpClient` and would therefore continue using Fetch, even when called from an upload component.

## 4. Upload files and ordinary form fields

`FormData` can contain files, strings, multiple values and JSON stored either as text or as a JSON `Blob`. Angular sends `FormData` as `multipart/form-data`. ([Angular][5])

```ts
// upload.service.ts

import {
  HttpClient,
  HttpEvent,
} from '@angular/common/http';

import {
  inject,
  Injectable,
} from '@angular/core';

import { Observable } from 'rxjs';

export interface UploadCommand {
  title: string;
  categoryId: number;
  description?: string;

  metadata: {
    source: string;
    tags: string[];
  };
}

export interface UploadResult {
  id: string;
  createdAt: Date;
  fileNames: string[];
}

@Injectable()
export class UploadService {
  private readonly http = inject(HttpClient);

  upload(
    files: readonly File[],
    command: UploadCommand,
  ): Observable<HttpEvent<UploadResult>> {
    const body = new FormData();

    body.append('title', command.title);
    body.append('categoryId', command.categoryId.toString());

    if (command.description) {
      body.append('description', command.description);
    }

    // Use this when the backend expects an ordinary text form field.
    body.append('metadata', JSON.stringify(command.metadata));

    for (const file of files) {
      body.append('files', file, file.name);
    }

    return this.http.post<UploadResult>(
      '/api/uploads',
      body,
      {
        observe: 'events',
        reportProgress: true,
      },
    );
  }
}
```

Do not manually add:

```ts
headers: {
  'Content-Type': 'multipart/form-data',
}
```

The browser needs to add the multipart boundary to the header. Setting the header manually commonly produces a body whose boundary does not match the header.

### Sending metadata as a JSON multipart section

Some ASP.NET endpoints expect one multipart section with `application/json`:

```ts
body.append(
  'metadata',
  new Blob(
    [JSON.stringify(command.metadata)],
    { type: 'application/json' },
  ),
);
```

This produces a multipart request containing:

* file sections;
* normal text fields;
* a JSON section.

## 5. Processing upload progress

```ts
import {
  HttpEventType,
} from '@angular/common/http';

this.uploadService
  .upload(files, command)
  .subscribe(event => {
    switch (event.type) {
      case HttpEventType.UploadProgress: {
        const total = event.total ?? event.loaded;

        const percentage = Math.round(
          100 * event.loaded / total,
        );

        console.log(`Uploaded ${percentage}%`);
        break;
      }

      case HttpEventType.Response:
        console.log('Upload completed', event.body);
        break;
    }
  });
```

The default Fetch backend does not emit upload progress, whereas the XHR backend supports `HttpEventType.UploadProgress`. ([Angular][5])

## 6. Do not use `withRequestsMadeViaParent()` here

You might initially consider:

```ts
provideHttpClient(
  withXhr(),
  withRequestsMadeViaParent(),
);
```

That does not provide the desired composition.

`withRequestsMadeViaParent()` delegates the request to the parent `HttpClient` after child interceptors have executed. Because the parent client uses Fetch, the final backend would effectively be the parent’s Fetch chain, defeating the purpose of selecting XHR for upload progress. Therefore, register the shared interceptors explicitly in both clients. ([Angular][4])

Conceptually:

```text
Desired upload pipeline:

UploadService
    ↓
shared interceptors
    ↓
date interceptor
    ↓
XHR backend
```

Not:

```text
UploadService
    ↓
child interceptors
    ↓
parent HttpClient
    ↓
Fetch backend
```

## 7. How `date-interceptors` behaves with multipart uploads

Your current interceptor:

* does not modify outgoing request bodies;
* only processes `HttpResponse`;
* checks that the response content type is exactly `application/json`;
* clones the response body;
* applies the hierarchical conversion;
* returns a cloned response.

Therefore, the outgoing `FormData` is unaffected. When the upload endpoint returns JSON, fields such as `createdAt` will still be converted. ([GitHub][6])

For example:

```json
{
  "id": "66c37546-90fa-4b70-94ef-b223718fe4ea",
  "createdAt": "2026-07-21T10:30:00Z"
}
```

becomes:

```ts
result.createdAt instanceof Date; // true
```

## 8. `httpResource` still uses the interceptors

`httpResource` is built on `HttpClient`, so it passes through the configured HTTP interceptor chain. It should generally remain on the root Fetch client because Angular recommends it primarily for data retrieval rather than mutations such as uploads. ([Angular][7])

```ts
users = httpResource<User[]>(() => '/api/users');
```

That request goes through:

```text
httpResource
    ↓
root HttpClient
    ↓
shared interceptors
    ↓
date interceptor
    ↓
Fetch backend
```

Uploads go through:

```text
UploadService
    ↓
route HttpClient
    ↓
shared interceptors
    ↓
date interceptor
    ↓
XHR backend
```

## Lazy NgModule alternative

Module separation also works, provided the upload module is lazy-loaded:

```ts
@NgModule({
  imports: [
    AngularDateHttpInterceptorModule,
  ],
  providers: [
    UploadService,

    provideHttpClient(
      withXhr(),
      withInterceptors(SHARED_HTTP_INTERCEPTORS),
      withInterceptorsFromDi(),
    ),
  ],
})
export class UploadModule {}
```

```ts
{
  path: 'upload',
  loadChildren: () =>
    import('./upload/upload.module')
      .then(module => module.UploadModule),
}
```

Do not eagerly import this module into `AppModule`, because then its providers would participate in the root injector rather than creating an isolated upload client. ([v18.angular.dev][8])

## Improvement I would make to `date-interceptors`

For Angular 22, I would add and export a functional interceptor:

```ts
export const hierarchicalDateHttpInterceptorFn: HttpInterceptorFn =
  (request, next) => {
    const adjustDates = inject(
      HIERARCHICAL_DATE_ADJUST_FUNCTION,
    );

    return next(request).pipe(
      map(event => {
        if (!(event instanceof HttpResponse)) {
          return event;
        }

        const contentType =
          (event.headers.get('Content-Type') ?? '')
            .toLowerCase()
            .split(';')[0]
            .trim();

        if (
          contentType !== 'application/json' ||
          event.body == null
        ) {
          return event;
        }

        const body = structuredClone(event.body);
        adjustDates(body);

        return event.clone({ body });
      }),
    );
  };
```

Then both clients can use exactly the same interceptor list:

```ts
export const SHARED_HTTP_INTERCEPTORS: HttpInterceptorFn[] = [
  authInterceptor,
  correlationIdInterceptor,
  hierarchicalDateHttpInterceptorFn,
  errorInterceptor,
];
```

That removes:

* `AngularDateHttpInterceptorModule`;
* `HTTP_INTERCEPTORS`;
* `withInterceptorsFromDi()`;
* uncertainty around class-interceptor inheritance;
* duplicated module imports.

Angular recommends functional interceptors because their ordering is more predictable, particularly in configurations involving multiple injectors. ([Angular][9])

The resulting design is:

```ts
// Root — Fetch
provideHttpClient(
  withInterceptors(SHARED_HTTP_INTERCEPTORS),
);

// Upload route — XHR
provideHttpClient(
  withXhr(),
  withInterceptors(SHARED_HTTP_INTERCEPTORS),
);
```

That is the cleanest Angular 22 design for your library ecosystem.

[1]: https://angular.dev/guide/di/defining-dependency-providers?utm_source=chatgpt.com "Defining dependency providers • Angular"
[2]: https://angular.dev/guide/http/setup "Setting up HttpClient • Angular"
[3]: https://raw.githubusercontent.com/AdaskoTheBeAsT/date-interceptors/main/libs/angular-date-http-interceptor/src/lib/angular-date-http-interceptor.module.ts "raw.githubusercontent.com"
[4]: https://angular.dev/api/common/http/withRequestsMadeViaParent "withRequestsMadeViaParent • Angular"
[5]: https://angular.dev/guide/http/making-requests "Making requests • Angular"
[6]: https://raw.githubusercontent.com/AdaskoTheBeAsT/date-interceptors/main/libs/angular-date-http-interceptor/src/lib/hierarchical-date-http-interceptor.ts "raw.githubusercontent.com"
[7]: https://angular.dev/guide/http/http-resource "Reactive data fetching with httpResource • Angular"
[8]: https://v18.angular.dev/guide/ngmodules/faq/?utm_source=chatgpt.com "NgModule FAQs • Angular"
[9]: https://angular.dev/guide/http/interceptors?utm_source=chatgpt.com "Intercepting requests and responses"

