import {
  HTTP_INTERCEPTORS,
  HttpFeature,
  HttpFeatureKind,
  provideHttpClient,
  withInterceptors,
  withInterceptorsFromDi,
  withXhr,
} from '@angular/common/http';
import { EnvironmentProviders, Provider } from '@angular/core';

import {
  ClassTransformerHttpInterceptor,
  classTransformerHttpInterceptorFn,
} from './class-transformer-http.interceptor';
import {
  ClassTransformerSerializeInterceptor,
  classTransformerSerializeInterceptorFn,
} from './class-transformer-serialize.interceptor';

/**
 * Adds request serialization and response hydration to `provideHttpClient`,
 * leaving the backend (fetch, XHR) and other features to the application.
 *
 * ```ts
 * provideHttpClient(withFetch(), withTypedHttpClient());
 * ```
 */
export function withTypedHttpClient(): HttpFeature<HttpFeatureKind.Interceptors> {
  return withInterceptors([
    classTransformerSerializeInterceptorFn,
    classTransformerHttpInterceptorFn,
  ]);
}

/**
 * @deprecated Use `provideHttpClient(withTypedHttpClient())`. This helper
 * calls `provideHttpClient(withXhr(), withInterceptorsFromDi())` itself, which
 * forces the XHR backend and replaces the application's own HttpClient setup.
 */
export function provideTypedHttpClient(): (Provider | EnvironmentProviders)[] {
  return [
    provideHttpClient(withXhr(), withInterceptorsFromDi()),
    {
      provide: HTTP_INTERCEPTORS,
      useClass: ClassTransformerSerializeInterceptor,
      multi: true,
    },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: ClassTransformerHttpInterceptor,
      multi: true,
    },
  ];
}
