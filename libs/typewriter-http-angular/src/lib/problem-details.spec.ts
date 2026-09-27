import {
  isProblemDetailsError,
  withProblemDetails,
} from '@adaskothebeast/hierarchical-convert-core';
import { schema } from '@adaskothebeast/typewriter-schema';
import {
  HttpClient,
  HttpContext,
  HttpErrorResponse,
  HttpHeaders,
  HttpResponse,
  provideHttpClient,
} from '@angular/common/http';
import type { HttpEvent } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, throwError } from 'rxjs';

import { handleProblemDetails } from './problem-details';
import { withTypewriterHttpInterceptor } from './provide-typewriter-http';
import {
  TYPEWRITER_RESPONSE_SCHEMA,
  TYPEWRITER_TRANSFORM_OPTIONS,
} from './typewriter-http-context';

describe('Angular Problem Details', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  const convert = jest.fn((value: unknown) => value);
  const problem = {
    title: 'Validation failed',
    status: 400,
    errors: { field: ['required'] },
    traceId: 'trace',
    timestamp: '2026-01-01T00:00:00Z',
  };
  // The root custom schema routes every conversion through `convert`.
  const probeContext = () =>
    new HttpContext()
      .set(TYPEWRITER_RESPONSE_SCHEMA, schema.custom('probe'))
      .set(TYPEWRITER_TRANSFORM_OPTIONS, {
        customTransformers: { probe: convert },
      });
  beforeEach(() => {
    convert.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withTypewriterHttpInterceptor()),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });
  afterEach(() => backend.verify());

  it('runs the wired converter for ordinary JSON responses', () => {
    const success = jest.fn();
    http.get('/ok', { context: probeContext() }).subscribe(success);
    backend
      .expectOne('/ok')
      .flush({ ok: true }, { headers: { 'content-type': 'application/json' } });
    expect(convert).toHaveBeenCalledTimes(1);
    expect(convert.mock.calls[0][0]).toEqual({ ok: true });
    expect(success).toHaveBeenCalledWith({ ok: true });
  });

  it.each([200, 422, 500])(
    'rejects HTTP %s problems before conversion',
    (status) => {
      const success = jest.fn();
      const failure = jest.fn();
      http
        .get('/problem', { context: probeContext() })
        .subscribe({ next: success, error: failure });
      backend.expectOne('/problem').flush(problem, {
        status,
        statusText: 'Response',
        headers: {
          'Content-Type': 'Application/Problem+Json; charset=utf-8',
        },
      });
      expect(success).not.toHaveBeenCalled();
      expect(convert).not.toHaveBeenCalled();
      expect(failure).toHaveBeenCalledTimes(1);
      const error: unknown = failure.mock.calls[0][0];
      expect(error).toBeInstanceOf(HttpErrorResponse);
      if (
        !(error instanceof HttpErrorResponse) ||
        !isProblemDetailsError(error)
      )
        throw new Error('Expected Problem Details');
      expect(error.httpStatus).toBe(status);
      expect(error.problem).toEqual({ ...problem, type: 'about:blank' });
      expect(error.error).toEqual(problem);
    },
  );

  it('recognizes problem responses even without conversion context', () => {
    const failure = jest.fn();
    http.get('/problem').subscribe({ error: failure });
    backend.expectOne('/problem').flush(problem, {
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/problem+json' },
    });
    expect(isProblemDetailsError(failure.mock.calls[0]?.[0])).toBe(true);
  });

  it('preserves ordinary HTTP errors without classifying them as problems', () => {
    const failure = jest.fn();
    http.get('/ordinary', { context: probeContext() }).subscribe({
      error: failure,
    });
    backend.expectOne('/ordinary').flush(
      { message: 'failure' },
      {
        status: 500,
        statusText: 'Failed',
        headers: { 'content-type': 'application/json' },
      },
    );
    expect(failure.mock.calls[0][0]).toBeInstanceOf(HttpErrorResponse);
    expect(isProblemDetailsError(failure.mock.calls[0][0])).toBe(false);
    expect(convert).not.toHaveBeenCalled();
  });

  it('decodes a problem raised by the success path only once', async () => {
    const response = new HttpResponse({
      body: JSON.stringify(problem),
      status: 200,
      headers: new HttpHeaders({ 'content-type': 'application/problem+json' }),
    });
    const error = await firstValueFrom(
      of<HttpEvent<unknown>>(response).pipe(handleProblemDetails()),
    ).catch((failure: unknown) => failure);
    if (!isProblemDetailsError(error)) throw new Error('Expected a problem');
    expect(error.body).toEqual(problem);

    const decorated = withProblemDetails(
      new HttpErrorResponse({
        error: '{"title":"other"}',
        status: 500,
        headers: new HttpHeaders({
          'content-type': 'application/problem+json',
        }),
      }),
      409,
      problem,
    );
    const originalProblem = decorated.problem;
    const rethrown = await firstValueFrom(
      throwError(() => decorated).pipe(handleProblemDetails()),
    ).catch((failure: unknown) => failure);
    expect(rethrown).toBe(decorated);
    expect(decorated.problem).toBe(originalProblem);
    expect(decorated.httpStatus).toBe(409);
  });

  it('rethrows non-HTTP errors unchanged', async () => {
    const original = new Error('interceptor failure');
    const rethrown = await firstValueFrom(
      throwError(() => original).pipe(handleProblemDetails()),
    ).catch((failure: unknown) => failure);
    expect(rethrown).toBe(original);
    expect(isProblemDetailsError(original)).toBe(false);
  });
});
