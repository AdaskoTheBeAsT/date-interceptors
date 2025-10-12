import {
  HttpEvent,
  HttpHandler,
  HttpHeaders,
  HttpInterceptor,
  HttpRequest,
} from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ClassTransformOptions, instanceToPlain } from 'class-transformer';
import { Observable } from 'rxjs';

import { SERIALIZE_REQUEST } from './serialize-token';

function isNativeBody(b: unknown): boolean {
  return (
    b == null ||
    b instanceof FormData ||
    b instanceof Blob ||
    b instanceof ArrayBuffer ||
    b instanceof URLSearchParams ||
    (typeof ReadableStream !== 'undefined' && b instanceof ReadableStream)
  );
}

function ensureJson(headers: HttpHeaders): HttpHeaders {
  if (headers.has('Content-Type')) return headers;
  return headers.set('Content-Type', 'application/json; charset=utf-8');
}

@Injectable()
export class ClassTransformerSerializeInterceptor implements HttpInterceptor {
  intercept(
    req: HttpRequest<unknown>,
    next: HttpHandler,
  ): Observable<HttpEvent<unknown>> {
    const opt = req.context.get(SERIALIZE_REQUEST);
    if (!opt || req.method === 'GET' || isNativeBody(req.body)) {
      return next.handle(req);
    }

    const options: ClassTransformOptions | undefined =
      opt === true ? undefined : opt;
    const plain = instanceToPlain(req.body, options);

    return next.handle(
      req.clone({
        body: plain,
        headers: ensureJson(req.headers),
      }),
    );
  }
}
