import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { Injectable } from '@angular/core';
import { plainToInstance } from 'class-transformer';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { RESPONSE_TYPE_CLASS } from './tokens';

@Injectable()
export class ClassTransformerHttpInterceptor implements HttpInterceptor {
  intercept(
    req: HttpRequest<unknown>,
    next: HttpHandler,
  ): Observable<HttpEvent<unknown>> {
    const ctor = req.context.get(RESPONSE_TYPE_CLASS);

    return next.handle(req).pipe(
      map((event) => {
        if (!(event instanceof HttpResponse)) {
          return event;
        }

        if (!ctor || event.body == null) {
          return event;
        }

        const transformed = plainToInstance(ctor, event.body);
        return event.clone({ body: transformed });
      }),
    );
  }
}
