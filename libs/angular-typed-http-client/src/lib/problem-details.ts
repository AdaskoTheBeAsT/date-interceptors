import {
  attachProblemDetails,
  throwIfProblemDetails,
} from '@adaskothebeast/hierarchical-convert-core';
import { HttpErrorResponse, HttpResponse } from '@angular/common/http';
import type { HttpEvent } from '@angular/common/http';
import { catchError, map, throwError } from 'rxjs';
import type { MonoTypeOperatorFunction } from 'rxjs';

/** Runs before success conversion and preserves Angular's native error contract. */
export function handleProblemDetails(): MonoTypeOperatorFunction<
  HttpEvent<unknown>
> {
  return (source) =>
    source.pipe(
      map((event) => {
        if (event instanceof HttpResponse)
          throwIfProblemDetails(
            { status: event.status, headers: event.headers, body: event.body },
            () =>
              new HttpErrorResponse({
                error: event.body,
                status: event.status,
                headers: event.headers,
                url: event.url ?? undefined,
              }),
          );
        return event;
      }),
      catchError((error: unknown) => {
        if (error instanceof HttpErrorResponse)
          attachProblemDetails(error, {
            status: error.status,
            headers: error.headers,
            body: error.error,
          });
        return throwError(() => error);
      }),
    );
}
