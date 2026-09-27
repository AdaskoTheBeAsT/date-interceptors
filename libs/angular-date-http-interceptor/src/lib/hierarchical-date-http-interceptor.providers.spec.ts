import { hierarchicalConvertToDate } from '@adaskothebeast/hierarchical-convert-to-date';
import {
  HttpClient,
  provideHttpClient,
  withFetch,
  withInterceptorsFromDi,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { EnvironmentProviders, Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AngularDateHttpInterceptorModule } from './angular-date-http-interceptor.module';
import {
  provideHierarchicalDateConverter,
  withHierarchicalDateHttpInterceptor,
} from './with-hierarchical-date-http-interceptor';

const wire = { createdAt: '2026-07-21T12:34:56.000Z' };
const expected = new Date('2026-07-21T12:34:56.000Z');

function setup(
  providers: (Provider | EnvironmentProviders)[],
  imports: unknown[] = [],
) {
  TestBed.configureTestingModule({
    imports: imports as never[],
    providers: [...providers, provideHttpClientTesting()],
  });
  return {
    http: TestBed.inject(HttpClient),
    backend: TestBed.inject(HttpTestingController),
  };
}

function request(http: HttpClient, backend: HttpTestingController) {
  const next = jest.fn();
  const error = jest.fn();
  http.get('/value').subscribe({ next, error });
  const pending = backend.match('/value');
  pending.forEach((req) =>
    req.flush(wire, { headers: { 'Content-Type': 'application/json' } }),
  );
  return { next, error };
}

describe('date interceptor providers', () => {
  it('binds a converter passed to withHierarchicalDateHttpInterceptor without a DI token', () => {
    const { http, backend } = setup([
      provideHttpClient(
        withFetch(),
        withHierarchicalDateHttpInterceptor(hierarchicalConvertToDate),
      ),
    ]);
    const { next } = request(http, backend);
    expect(next).toHaveBeenCalledWith({ createdAt: expected });
    backend.verify();
  });

  it('reads the converter registered with provideHierarchicalDateConverter', () => {
    const { http, backend } = setup([
      provideHttpClient(withHierarchicalDateHttpInterceptor()),
      provideHierarchicalDateConverter(hierarchicalConvertToDate),
    ]);
    const { next } = request(http, backend);
    expect(next).toHaveBeenCalledWith({ createdAt: expected });
  });

  it('registers the class-based interceptor and converter through forRoot', () => {
    const { http, backend } = setup(
      [provideHttpClient(withInterceptorsFromDi())],
      [AngularDateHttpInterceptorModule.forRoot(hierarchicalConvertToDate)],
    );
    const { next } = request(http, backend);
    expect(next).toHaveBeenCalledWith({ createdAt: expected });
  });

  it.each([
    [
      'functional',
      () => [provideHttpClient(withHierarchicalDateHttpInterceptor())],
      [] as unknown[],
    ],
    [
      'class-based',
      () => [provideHttpClient(withInterceptorsFromDi())],
      [AngularDateHttpInterceptorModule] as unknown[],
    ],
  ])(
    'explains how to fix a missing converter (%s)',
    (_, providers, imports) => {
      const { http, backend } = setup(providers(), imports);
      const { next, error } = request(http, backend);
      expect(next).not.toHaveBeenCalled();
      expect(error).toHaveBeenCalledTimes(1);
      expect(error.mock.calls[0][0]).toEqual(
        expect.objectContaining({
          message: expect.stringContaining(
            'withHierarchicalDateHttpInterceptor(converter)',
          ),
        }),
      );
    },
  );
});
