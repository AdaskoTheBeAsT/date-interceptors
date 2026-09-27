import {
  ProblemDetailsError,
  attachProblemDetails,
  decodeProblemDetailsBody,
  getResponseContentType,
  isProblemDetailsContentType,
  isProblemDetailsError,
  isProblemDetailsResponse,
  parseProblemDetails,
  problemFailureFrom,
  readProblemDetailsResponse,
  throwIfProblemDetails,
  withProblemDetails,
} from '../index';

describe('framework-neutral Problem Details helpers', () => {
  const problemHeaders = (name: string) =>
    name === 'content-type' ? 'application/problem+json' : null;
  const wire = JSON.stringify({ title: 'Failed', status: 422 });

  it('reads content types through header lookup functions', () => {
    expect(getResponseContentType(problemHeaders)).toBe(
      'application/problem+json',
    );
    expect(isProblemDetailsResponse({ headers: problemHeaders })).toBe(true);
    expect(isProblemDetailsResponse({ headers: () => null })).toBe(false);
    expect(isProblemDetailsResponse({ headers: undefined })).toBe(false);
  });

  it('creates a standalone failure only for problem responses', () => {
    const failure = problemFailureFrom({
      status: 200,
      headers: { 'Content-Type': 'application/problem+json' },
      body: wire,
    });
    expect(failure).toBeInstanceOf(ProblemDetailsError);
    expect(failure?.httpStatus).toBe(200);
    expect(failure?.problem).toEqual({
      title: 'Failed',
      status: 422,
      type: 'about:blank',
    });
    expect(
      problemFailureFrom({ status: 500, headers: {}, body: wire }),
    ).toBeUndefined();
  });

  it('decorates native errors in place for problem responses only', () => {
    const native = new Error('HTTP failure');
    const response = { status: 422, headers: problemHeaders, body: wire };
    expect(attachProblemDetails(native, response)).toBe(native);
    expect(isProblemDetailsError(native)).toBe(true);

    const ordinary = new Error('HTTP failure');
    attachProblemDetails(ordinary, { ...response, headers: {} });
    attachProblemDetails(ordinary, undefined);
    attachProblemDetails(ordinary, null);
    expect(isProblemDetailsError(ordinary)).toBe(false);
  });

  it('does not decode an already decorated error a second time', () => {
    const error = withProblemDetails(new Error('HTTP failure'), 200, wire);
    const problem = error.problem;
    attachProblemDetails(error, {
      status: 500,
      headers: problemHeaders,
      body: '{}',
    });
    expect(error.problem).toBe(problem);
    expect(error.httpStatus).toBe(200);
  });

  it('throws the adapter error for success responses carrying a problem', () => {
    const native = new Error('Problem Details response');
    const response = { status: 200, headers: problemHeaders, body: wire };
    expect(() => throwIfProblemDetails(response, () => native)).toThrow(native);
    expect(isProblemDetailsError(native)).toBe(true);
    const create = jest.fn(() => new Error('unused'));
    throwIfProblemDetails({ ...response, headers: {} }, create);
    expect(create).not.toHaveBeenCalled();
  });
});

describe('Problem Details contract', () => {
  it('reads content types from native headers and case-insensitive records', () => {
    expect(
      getResponseContentType(
        new Headers({ 'content-type': 'application/problem+json' }),
      ),
    ).toBe('application/problem+json');
    expect(getResponseContentType({ 'Content-Type': 'application/json' })).toBe(
      'application/json',
    );
    expect(getResponseContentType({})).toBeUndefined();
    expect(getResponseContentType(null)).toBeUndefined();
  });

  it('reads a response clone without consuming the original', async () => {
    const response = new Response('{"title":"Failure"}');
    expect(await readProblemDetailsResponse(response)).toEqual({
      body: '{"title":"Failure"}',
    });
    expect(response.bodyUsed).toBe(false);
    expect(await response.json()).toEqual({ title: 'Failure' });
  });

  it('does not decode a JSON string document a second time', () => {
    const wire = JSON.stringify(
      JSON.stringify({ title: 'not a problem object' }),
    );
    const error = withProblemDetails(new Error('HTTP failure'), 500, wire);
    expect(error.problem).toBeUndefined();
    expect(error.body).toBe(JSON.stringify({ title: 'not a problem object' }));
  });
  it.each([
    'application/problem+json',
    ' Application/Problem+Json ; charset=utf-8',
  ])('recognizes %s', (contentType) => {
    expect(isProblemDetailsContentType(contentType)).toBe(true);
  });
  it.each([
    null,
    undefined,
    'application/json',
    'application/problem+json-seq',
    'text/plain',
  ])('rejects unrelated media type %s', (contentType) => {
    expect(isProblemDetailsContentType(contentType)).toBe(false);
  });
  it('ignores invalid standard members and keeps extensions without mutating the input', () => {
    const body = {
      type: 3,
      title: [],
      detail: null,
      instance: false,
      status: '422',
      errors: { field: ['required'] },
      traceId: '123',
    };
    expect(parseProblemDetails(body)).toEqual({
      type: 'about:blank',
      errors: body.errors,
      traceId: '123',
    });
    expect(body.status).toBe('422');
  });
  it('preserves explicit problem types and valid standard members without mutating the input', () => {
    const body = Object.freeze({
      type: 'https://example.com/problems/validation',
      title: 'Validation failed',
      status: 422,
      detail: 'The name field is required',
      instance: '/requests/123',
      errors: { name: ['required'] },
    });
    const problem = parseProblemDetails(body);
    expect(problem).toEqual(body);
    expect(problem).not.toBe(body);
    expect(problem?.['errors']).toBe(body.errors);
  });
  it.each([100, 599])('preserves the valid status boundary %s', (status) => {
    expect(parseProblemDetails({ status })).toEqual({
      type: 'about:blank',
      status,
    });
  });
  it.each([99, 600, 422.5, NaN, Infinity, '422', null])(
    'omits the invalid status %s while retaining extensions',
    (status) => {
      expect(parseProblemDetails({ status, traceId: '123' })).toEqual({
        type: 'about:blank',
        traceId: '123',
      });
    },
  );
  it('preserves native errors and keeps HTTP status distinct from advisory status', () => {
    const original = new Error('HTTP failure');
    const error = withProblemDetails(original, 200, {
      title: 'Failed',
      status: 422,
    });
    expect(error).toBe(original);
    expect(isProblemDetailsError(error)).toBe(true);
    expect(error.httpStatus).toBe(200);
    expect(error.problem?.status).toBe(422);
  });
  it('keeps dangerous-looking extension keys as data without changing prototypes', () => {
    const problem = parseProblemDetails(
      JSON.parse('{"__proto__":{"polluted":true},"title":"Failed"}'),
    );
    expect(Object.getPrototypeOf(problem)).toBe(Object.prototype);
    expect(Object.hasOwn(problem ?? {}, '__proto__')).toBe(true);
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
  });
  it('preserves malformed content and does not manufacture a problem object', () => {
    expect(decodeProblemDetailsBody('not-json')).toBe('not-json');
    expect(parseProblemDetails('not-json')).toBeUndefined();
    expect(new ProblemDetailsError(502, 'not-json').httpStatus).toBe(502);
  });
  it('reports body-read failures without replacing the HTTP failure', async () => {
    const response = new Response('already consumed');
    await response.text();
    const result = await readProblemDetailsResponse(response);
    expect(result.body).toBeUndefined();
    expect(result.cause).toMatchObject({ name: 'TypeError' });
  });
});
