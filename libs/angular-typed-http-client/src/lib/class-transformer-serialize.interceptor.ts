import {
  HttpEvent,
  HttpHandler,
  HttpHeaders,
  HttpInterceptor,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ClassTransformOptions, instanceToPlain } from 'class-transformer';
import { Observable } from 'rxjs';

import { SERIALIZE_REQUEST } from './serialize-token';

function isNativeBody(b: unknown): boolean {
  return (
    b == null ||
    typeof b === 'string' ||
    b instanceof FormData ||
    b instanceof Blob ||
    b instanceof ArrayBuffer ||
    ArrayBuffer.isView(b) ||
    b instanceof URLSearchParams ||
    (typeof ReadableStream !== 'undefined' && b instanceof ReadableStream)
  );
}

function ensureJson(headers: HttpHeaders): HttpHeaders {
  if (headers.has('Content-Type')) return headers;
  return headers.set('Content-Type', 'application/json; charset=utf-8');
}

function serialize(request: HttpRequest<unknown>): HttpRequest<unknown> {
  const opt = request.context.get(SERIALIZE_REQUEST);
  if (!opt || request.method === 'GET' || isNativeBody(request.body)) {
    return request;
  }

  const options: ClassTransformOptions | undefined =
    opt === true ? undefined : opt;
  return request.clone({
    body: instanceToPlain(request.body, options),
    headers: ensureJson(request.headers),
  });
}

/** Serializes request bodies with `instanceToPlain` when {@link SERIALIZE_REQUEST} is set. */
export const classTransformerSerializeInterceptorFn: HttpInterceptorFn = (
  request,
  next,
) => next(serialize(request));

@Injectable()
export class ClassTransformerSerializeInterceptor implements HttpInterceptor {
  intercept(
    req: HttpRequest<unknown>,
    next: HttpHandler,
  ): Observable<HttpEvent<unknown>> {
    return next.handle(serialize(req));
  }
}
