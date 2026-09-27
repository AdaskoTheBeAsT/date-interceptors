/** RFC 9457 members plus application-specific extensions, such as errors or traceId. */
export interface ProblemDetails {
  readonly type?: string;
  readonly title?: string;
  readonly status?: number;
  readonly detail?: string;
  readonly instance?: string;
  readonly [extension: string]: unknown;
}

export interface ProblemDetailsFailure {
  readonly problemDetails: true;
  /** Actual HTTP status, even when the server sends a problem with HTTP 200. */
  readonly httpStatus: number;
  /** Undefined for malformed JSON or a non-object problem document. */
  readonly problem: ProblemDetails | undefined;
  /** Decoded JSON, or the original body when it cannot be decoded. */
  readonly body: unknown;
}

export function isProblemDetailsContentType(contentType: unknown): boolean {
  return (
    typeof contentType === 'string' &&
    contentType.split(';', 1)[0].trim().toLowerCase() ===
      'application/problem+json'
  );
}

export function decodeProblemDetailsBody(body: unknown): unknown {
  if (typeof body !== 'string') return body;
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return body;
  }
}

export function parseProblemDetails(body: unknown): ProblemDetails | undefined {
  return problemDetailsFromValue(decodeProblemDetailsBody(body));
}

function problemDetailsFromValue(value: unknown): ProblemDetails | undefined {
  if (
    typeof value !== 'object' ||
    value === null ||
    Object.prototype.toString.call(value) !== '[object Object]'
  )
    return undefined;
  const record = value as Record<string, unknown>;
  // Ignore invalid standard members while retaining extension members verbatim.
  const result = Object.fromEntries(
    Object.entries(record).filter(([key, item]) => {
      if (['type', 'title', 'detail', 'instance'].includes(key))
        return typeof item === 'string';
      if (key === 'status')
        return (
          typeof item === 'number' &&
          Number.isInteger(item) &&
          item >= 100 &&
          item <= 599
        );
      return true;
    }),
  );
  if (result['type'] === undefined) result['type'] = 'about:blank';
  return result;
}

/** Decorates an existing transport error without replacing its prototype or response. */
export function withProblemDetails<T extends object>(
  error: T,
  httpStatus: number,
  body: unknown,
): T & ProblemDetailsFailure {
  const decoded = decodeProblemDetailsBody(body);
  return Object.assign(error, {
    problemDetails: true as const,
    httpStatus,
    problem: problemDetailsFromValue(decoded),
    body: decoded,
  });
}

export function isProblemDetailsError(
  error: unknown,
): error is ProblemDetailsFailure {
  return (
    typeof error === 'object' &&
    error !== null &&
    'problemDetails' in error &&
    error.problemDetails === true &&
    'httpStatus' in error &&
    typeof error.httpStatus === 'number'
  );
}

/** Used by response-only transforms, which have no native transport error to preserve. */
export class ProblemDetailsError
  extends Error
  implements ProblemDetailsFailure
{
  readonly problemDetails = true;
  readonly problem: ProblemDetails | undefined;
  readonly body: unknown;

  constructor(
    readonly httpStatus: number,
    body: unknown,
  ) {
    const decoded = decodeProblemDetailsBody(body);
    const problem = problemDetailsFromValue(decoded);
    super(problem?.title ?? `Problem Details response (HTTP ${httpStatus})`);
    this.name = 'ProblemDetailsError';
    this.problem = problem;
    this.body = decoded;
  }
}

/** Reads a clone so consumers retain access to the original response body. */
export async function readProblemDetailsResponse(
  response: Response,
): Promise<{ body: unknown; cause?: unknown }> {
  try {
    return { body: await response.clone().text() };
  } catch (cause) {
    return { body: undefined, cause };
  }
}

/**
 * Supports header lookup functions, Fetch/Angular/Axios Headers and plain
 * header records in custom adapters.
 */
export function getResponseContentType(headers: unknown): unknown {
  if (typeof headers === 'function') return headers('content-type');
  if (typeof headers !== 'object' || headers === null) return undefined;
  const record = headers as Record<string, unknown>;
  if (typeof record['get'] === 'function') return record['get']('content-type');
  const key = Object.keys(record).find(
    (name) => name.toLowerCase() === 'content-type',
  );
  return key === undefined ? undefined : record[key];
}

export type HeaderLookup = (name: string) => string | null | undefined;

/** The transport-neutral view of a response that the adapters share. */
export interface ProblemDetailsResponseLike {
  readonly status: number;
  /** A lookup function, a Headers-like object with `get`, or a plain record. */
  readonly headers: HeaderLookup | object | null | undefined;
  readonly body: unknown;
}

export function isProblemDetailsResponse(response: {
  readonly headers: unknown;
}): boolean {
  return isProblemDetailsContentType(getResponseContentType(response.headers));
}

/** For transports without a native error type to decorate. */
export function problemFailureFrom(
  response: ProblemDetailsResponseLike,
): ProblemDetailsError | undefined {
  return isProblemDetailsResponse(response)
    ? new ProblemDetailsError(response.status, response.body)
    : undefined;
}

/**
 * Decorates a native transport error when its response is a Problem Details
 * document. An error that is already decorated is returned untouched, so a
 * failure raised by an adapter's own success path is not decoded twice.
 */
export function attachProblemDetails<T extends object>(
  error: T,
  response: ProblemDetailsResponseLike | null | undefined,
): T {
  if (
    response != null &&
    !isProblemDetailsError(error) &&
    isProblemDetailsResponse(response)
  )
    withProblemDetails(error, response.status, response.body);
  return error;
}

/**
 * Rejects Problem Details documents that arrive with a success status. The
 * adapter supplies its native error so its error contract stays intact.
 */
export function throwIfProblemDetails(
  response: ProblemDetailsResponseLike,
  createError: () => object,
): void {
  if (isProblemDetailsResponse(response))
    throw withProblemDetails(createError(), response.status, response.body);
}
