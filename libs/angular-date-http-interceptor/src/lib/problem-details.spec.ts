import { isProblemDetailsError } from '@adaskothebeast/hierarchical-convert-core';
import {
  HTTP_INTERCEPTORS,
  HttpClient,
  HttpContext,
  HttpErrorResponse,
  HttpHeaders,
  HttpResponse,
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import type { HttpEvent } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, throwError } from 'rxjs';

import { HIERARCHICAL_DATE_ADJUST_FUNCTION } from './hierarchical-date-adjust-symbol';
import { HierarchicalDateHttpInterceptor } from './hierarchical-date-http-interceptor';
import { handleProblemDetails } from './problem-details';
import { withHierarchicalDateHttpInterceptor } from './with-hierarchical-date-http-interceptor';

describe.each([false, true])(
  'date Angular Problem Details (class: %s)',
  (useClass) => {
    let http: HttpClient;
    let backend: HttpTestingController;
    const convert = jest.fn();
    const problem = {
      title: 'Validation failed',
      status: 400,
      errors: { field: ['required'] },
      traceId: 'trace',
      timestamp: '2026-01-01T00:00:00Z',
    };
    beforeEach(() => {
      convert.mockClear();
      TestBed.configureTestingModule({
        providers: [
          provideHttpClient(
            useClass
              ? withInterceptorsFromDi()
              : withHierarchicalDateHttpInterceptor(),
          ),
          {
            provide: HTTP_INTERCEPTORS,
            useClass: HierarchicalDateHttpInterceptor,
            multi: true,
          },
          { provide: HIERARCHICAL_DATE_ADJUST_FUNCTION, useValue: convert },
          provideHttpClientTesting(),
        ],
      });
      http = TestBed.inject(HttpClient);
      backend = TestBed.inject(HttpTestingController);
    });
    afterEach(() => backend.verify());

    it.each([200, 422, 500])(
      'rejects HTTP %s problems before conversion',
      (status) => {
        const success = jest.fn();
        const failure = jest.fn();
        http
          .get('/problem', { context: new HttpContext() })
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
      http.get('/ordinary').subscribe({ error: failure });
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
    });
  },
);

describe('handleProblemDetails operator', () => {
  it('builds URL-less errors and rethrows non-HTTP errors unchanged', async () => {
    const response = new HttpResponse({
      body: { title: 'Failed' },
      status: 200,
      headers: new HttpHeaders({ 'content-type': 'application/problem+json' }),
    });
    const error = await firstValueFrom(
      of<HttpEvent<unknown>>(response).pipe(handleProblemDetails()),
    ).catch((failure: unknown) => failure);
    expect(error).toBeInstanceOf(HttpErrorResponse);
    expect((error as HttpErrorResponse).url).toBeNull();

    const original = new Error('interceptor failure');
    const rethrown = await firstValueFrom(
      throwError(() => original).pipe(handleProblemDetails()),
    ).catch((failure: unknown) => failure);
    expect(rethrown).toBe(original);
    expect(isProblemDetailsError(original)).toBe(false);
  });
});
