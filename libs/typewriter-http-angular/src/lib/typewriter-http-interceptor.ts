import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import {
  serializeJson,
  transformJson,
} from '@adaskothebeast/typewriter-runtime';
import { map } from 'rxjs';

import {
  TYPEWRITER_REQUEST_SCHEMA,
  TYPEWRITER_RESPONSE_SCHEMA,
  TYPEWRITER_SERIALIZE_OPTIONS,
  TYPEWRITER_SCHEMA_REGISTRY,
  TYPEWRITER_TRANSFORM_OPTIONS,
} from './typewriter-http-context';

export const typewriterHttpInterceptor: HttpInterceptorFn = (
  request,
  next,
) => {
  const requestSchema = request.context.get(TYPEWRITER_REQUEST_SCHEMA);
  const responseSchema = request.context.get(TYPEWRITER_RESPONSE_SCHEMA);

  const registry = request.context.get(TYPEWRITER_SCHEMA_REGISTRY);
  const serializeOptions = request.context.get(TYPEWRITER_SERIALIZE_OPTIONS);
  const transformOptions = request.context.get(
    TYPEWRITER_TRANSFORM_OPTIONS,
  );
  const outgoingRequest =
    requestSchema === undefined || request.body === null
      ? request
      : request.clone({
          body: serializeJson(
            request.body,
            requestSchema,
            registry,
            serializeOptions,
          ),
        });

  if (responseSchema === undefined) {
    return next(outgoingRequest);
  }

  return next(outgoingRequest).pipe(
    map((event) => {
      if (!(event instanceof HttpResponse)) {
        return event;
      }

      return event.clone({
        body: transformJson(
          event.body,
          responseSchema,
          registry,
          transformOptions,
        ),
      });
    }),
  );
};
