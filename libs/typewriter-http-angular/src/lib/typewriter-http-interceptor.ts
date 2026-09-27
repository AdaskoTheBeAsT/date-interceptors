import {
  serializeJson,
  transformJson,
  withStrictDefault,
} from '@adaskothebeast/typewriter-runtime';
import {
  HttpInterceptorFn,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { map } from 'rxjs';

import { handleProblemDetails } from './problem-details';
import {
  TYPEWRITER_REQUEST_REGISTRY,
  TYPEWRITER_REQUEST_SCHEMA,
  TYPEWRITER_RESPONSE_REGISTRY,
  TYPEWRITER_RESPONSE_SCHEMA,
  TYPEWRITER_SCHEMA_REGISTRY,
  TYPEWRITER_SERIALIZE_OPTIONS,
  TYPEWRITER_TRANSFORM_OPTIONS,
} from './typewriter-http-context';

export const typewriterHttpInterceptor: HttpInterceptorFn = (request, next) => {
  const context = request.context;
  const requestSchema = context.get(TYPEWRITER_REQUEST_SCHEMA);
  const responseSchema = context.get(TYPEWRITER_RESPONSE_SCHEMA);
  const sharedRegistry = context.get(TYPEWRITER_SCHEMA_REGISTRY);

  const outgoingRequest =
    requestSchema === undefined || request.body === null
      ? request
      : request.clone({
          body: serializeJson(
            request.body,
            requestSchema,
            context.get(TYPEWRITER_REQUEST_REGISTRY) ?? sharedRegistry,
            withStrictDefault(context.get(TYPEWRITER_SERIALIZE_OPTIONS)),
          ),
        });
  const responseRegistry =
    context.get(TYPEWRITER_RESPONSE_REGISTRY) ?? sharedRegistry;
  const transformOptions = withStrictDefault(
    context.get(TYPEWRITER_TRANSFORM_OPTIONS),
  );

  return next(outgoingRequest).pipe(
    handleProblemDetails(),
    map((event) => {
      if (
        responseSchema === undefined ||
        !(event instanceof HttpResponse) ||
        !hasJsonBody(request, event)
      ) {
        return event;
      }

      // Hydrate a copy: the downstream body may be shared, for example with
      // the HTTP transfer cache, and must stay plain JSON.
      return event.clone({
        body: transformJson(
          structuredClone(event.body),
          responseSchema,
          responseRegistry,
          transformOptions,
        ),
      });
    }),
  );
};

function hasJsonBody(
  request: HttpRequest<unknown>,
  response: HttpResponse<unknown>,
): boolean {
  const body = response.body;
  return (
    request.responseType === 'json' &&
    response.status !== 204 &&
    response.status !== 205 &&
    body !== null &&
    body !== undefined &&
    !(typeof body === 'string' && body.trim() === '')
  );
}
