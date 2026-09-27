import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpInterceptorFn,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { HIERARCHICAL_DATE_ADJUST_FUNCTION } from './hierarchical-date-adjust-symbol';
import { handleProblemDetails } from './problem-details';

type DateAdjustFunction = (obj: unknown) => void;

/** Matches application/json and structured-syntax suffixes such as application/vnd.api+json. */
function isJsonContentType(contentType: string | null): boolean {
  const mediaType = (contentType ?? '').split(';', 1)[0].trim().toLowerCase();
  return (
    mediaType === 'application/json' ||
    (mediaType.startsWith('application/') && mediaType.endsWith('+json'))
  );
}

function adjustResponseDates(
  request: HttpRequest<unknown>,
  event: HttpEvent<unknown>,
  adjustDates: DateAdjustFunction,
): HttpEvent<unknown> {
  if (
    !(event instanceof HttpResponse) ||
    request.responseType !== 'json' ||
    event.body == null ||
    !isJsonContentType(event.headers.get('Content-Type'))
  ) {
    return event;
  }

  // structuredClone keeps the cached/original body intact but drops class
  // prototypes, so this interceptor must see the response before
  // class-transformer hydration does (see README, "Interceptor order").
  const cloned = structuredClone(event.body);
  adjustDates(cloned);
  return event.clone({ body: cloned });
}

function injectConverter(): DateAdjustFunction {
  const converter = inject(HIERARCHICAL_DATE_ADJUST_FUNCTION, {
    optional: true,
  });
  if (converter === null) {
    throw new Error(
      'No hierarchical date converter is configured. Pass one to ' +
        'withHierarchicalDateHttpInterceptor(converter) or register it with ' +
        'provideHierarchicalDateConverter(converter).',
    );
  }
  return converter;
}

/** Creates a functional interceptor bound to `converter`, bypassing DI lookup. */
export function createHierarchicalDateHttpInterceptorFn(
  converter: DateAdjustFunction,
): HttpInterceptorFn {
  return (request, next) =>
    next(request).pipe(
      handleProblemDetails(),
      map((event) => adjustResponseDates(request, event, converter)),
    );
}

/** Reads the converter from {@link HIERARCHICAL_DATE_ADJUST_FUNCTION}. */
export const hierarchicalDateHttpInterceptorFn: HttpInterceptorFn = (
  request,
  next,
) => createHierarchicalDateHttpInterceptorFn(injectConverter())(request, next);

/**
 * HttpInterceptor that converts ISO 8601 date strings in JSON response bodies.
 * Prefer `provideHttpClient(withHierarchicalDateHttpInterceptor(converter))`.
 *
 * ```ts
 * import { hierarchicalConvertToDate } from '@adaskothebeast/hierarchical-convert-to-date';
 *
 * @NgModule({
 *   imports: [AngularDateHttpInterceptorModule.forRoot(hierarchicalConvertToDate)],
 *   providers: [provideHttpClient(withInterceptorsFromDi())],
 * })
 * export class AppModule {}
 * ```
 */
@Injectable()
export class HierarchicalDateHttpInterceptor implements HttpInterceptor {
  private readonly adjustDates = injectConverter();

  intercept(
    req: HttpRequest<unknown>,
    next: HttpHandler,
  ): Observable<HttpEvent<unknown>> {
    return next.handle(req).pipe(
      handleProblemDetails(),
      map((event) => adjustResponseDates(req, event, this.adjustDates)),
    );
  }
}
