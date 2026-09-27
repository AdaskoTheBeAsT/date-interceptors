import {
  HttpFeature,
  HttpFeatureKind,
  withInterceptors,
} from '@angular/common/http';
import { Provider } from '@angular/core';

import { HIERARCHICAL_DATE_ADJUST_FUNCTION } from './hierarchical-date-adjust-symbol';
import {
  createHierarchicalDateHttpInterceptorFn,
  hierarchicalDateHttpInterceptorFn,
} from './hierarchical-date-http-interceptor';

/**
 * Adds the date interceptor to `provideHttpClient`. Passing the converter
 * binds it directly; without it the converter is read from
 * {@link HIERARCHICAL_DATE_ADJUST_FUNCTION} (see
 * {@link provideHierarchicalDateConverter}).
 *
 * ```ts
 * provideHttpClient(
 *   withFetch(),
 *   withHierarchicalDateHttpInterceptor(hierarchicalConvertToDate),
 * );
 * ```
 */
export function withHierarchicalDateHttpInterceptor(
  converter?: (obj: unknown) => void,
): HttpFeature<HttpFeatureKind.Interceptors> {
  return withInterceptors([
    converter === undefined
      ? hierarchicalDateHttpInterceptorFn
      : createHierarchicalDateHttpInterceptorFn(converter),
  ]);
}

/** Registers the converter used by DI-based interceptor registrations. */
export function provideHierarchicalDateConverter(
  converter: (obj: unknown) => void,
): Provider {
  return { provide: HIERARCHICAL_DATE_ADJUST_FUNCTION, useValue: converter };
}
