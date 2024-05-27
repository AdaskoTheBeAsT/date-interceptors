import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest, HttpResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { instanceToPlain, plainToInstance } from 'class-transformer';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { TypedHttpRequest } from './typed-http-request';

@Injectable()
export class ClassTransformerHttpInterceptor implements HttpInterceptor {
  intercept(
    req: HttpRequest<unknown>,
    next: HttpHandler,
  ): Observable<HttpEvent<unknown>> {
    let handledRequest = req;

    // Transform the request body for POST and PUT methods
    if (
      ['POST', 'PUT', 'PATCH'].includes(req.method) &&
      req.body) {
      const plainBody = instanceToPlain(req.body);
      handledRequest = req.clone({ body: plainBody });
    }

    return next.handle(handledRequest).pipe(
      map((event: HttpEvent<unknown>) => {
        // Ensure that the request is a TypedHttpRequest and responseTypeClass is defined
        if (event instanceof HttpResponse && isTypedHttpRequest(req)) {
          const responseTypeClass = req.responseTypeClass;
          // This check ensures responseTypeClass is not undefined
          if (responseTypeClass && event.body) {
            const transformedBody = plainToInstance(
              responseTypeClass,
              event.body,
            );
            // Replace the response body with the transformed body
            return event.clone({ body: transformedBody });
          }
        }
        return event;
      }),
    );
  }
}

const isTypedHttpRequest = (
  req: HttpRequest<unknown>,
): req is TypedHttpRequest<unknown, unknown> => {
  return (
    (req as TypedHttpRequest<unknown, unknown>).responseTypeClass !== undefined
  );
};
