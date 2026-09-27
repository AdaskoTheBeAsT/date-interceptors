import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpInterceptorFn,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { Injectable } from '@angular/core';
import { plainToInstance } from 'class-transformer';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { handleProblemDetails } from './problem-details';
import { RESPONSE_TYPE_CLASS } from './tokens';

function hydrate(
  request: HttpRequest<unknown>,
  response$: Observable<HttpEvent<unknown>>,
): Observable<HttpEvent<unknown>> {
  const ctor = request.context.get(RESPONSE_TYPE_CLASS);
  return response$.pipe(
    handleProblemDetails(),
    map((event) =>
      !(event instanceof HttpResponse) || !ctor || event.body == null
        ? event
        : event.clone({ body: plainToInstance(ctor, event.body) }),
    ),
  );
}

/** Hydrates response bodies into the class carried by {@link RESPONSE_TYPE_CLASS}. */
export const classTransformerHttpInterceptorFn: HttpInterceptorFn = (
  request,
  next,
) => hydrate(request, next(request));

@Injectable()
export class ClassTransformerHttpInterceptor implements HttpInterceptor {
  intercept(
    req: HttpRequest<unknown>,
    next: HttpHandler,
  ): Observable<HttpEvent<unknown>> {
    return hydrate(req, next.handle(req));
  }
}
