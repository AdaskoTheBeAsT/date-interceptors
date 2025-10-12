import {
  HttpClient,
  HttpContext,
  HttpHeaders,
  HttpParams,
  HttpResponse,
} from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { ClassTransformOptions } from 'class-transformer/types/interfaces/class-transformer-options.interface';
import { Observable, filter, map } from 'rxjs';

import { SERIALIZE_REQUEST } from './serialize-token';
import { Ctor, RESPONSE_TYPE_CLASS } from './tokens';

type HeaderInit = HttpHeaders | { [header: string]: string | string[] };
type ParamInit =
  | HttpParams
  | {
      [param: string]:
        | string
        | number
        | boolean
        | ReadonlyArray<string | number | boolean>;
    };

export type RequestOptions = {
  headers?: HeaderInit;
  params?: ParamInit;
  context?: HttpContext;
  withCredentials?: boolean;
  reportProgress?: boolean;
  responseType?: 'json';
  serialize?: boolean | ClassTransformOptions;
};

const isHttpResponse = <K>(e: unknown): e is HttpResponse<K> =>
  e instanceof HttpResponse;

@Injectable({
  providedIn: 'root',
})
export class TypedHttpClient {
  private readonly httpClient: HttpClient = inject(HttpClient);

  getResponse<K>(
    url: string,
    ctor: Ctor<K>,
    options: RequestOptions = {},
  ): Observable<HttpResponse<K>> {
    return this.requestResponse<K>('GET', url, undefined, ctor, options);
  }

  postResponse<T, K>(
    url: string,
    body: T,
    ctor: Ctor<K>,
    options: RequestOptions = {},
  ): Observable<HttpResponse<K>> {
    return this.requestResponse<K>('POST', url, body, ctor, options);
  }

  putResponse<T, K>(
    url: string,
    body: T,
    ctor: Ctor<K>,
    options: RequestOptions = {},
  ): Observable<HttpResponse<K>> {
    return this.requestResponse<K>('PUT', url, body, ctor, options);
  }

  patchResponse<T, K>(
    url: string,
    body: T,
    ctor: Ctor<K>,
    options: RequestOptions = {},
  ): Observable<HttpResponse<K>> {
    return this.requestResponse<K>('PATCH', url, body, ctor, options);
  }

  deleteResponse<K>(
    url: string,
    ctor: Ctor<K>,
    options: RequestOptions = {},
  ): Observable<HttpResponse<K>> {
    return this.requestResponse<K>('DELETE', url, undefined, ctor, options);
  }

  // -------------------
  // Existing body-only methods (now built on top of *Response)
  // -------------------
  get<K>(
    url: string,
    ctor: Ctor<K>,
    options: RequestOptions = {},
  ): Observable<K> {
    return this.getResponse<K>(url, ctor, options).pipe(
      map((r) => r.body as K),
    );
  }

  post<T, K>(
    url: string,
    body: T,
    ctor: Ctor<K>,
    options: RequestOptions = {},
  ): Observable<K> {
    return this.postResponse<T, K>(url, body, ctor, options).pipe(
      map((r) => r.body as K),
    );
  }

  put<T, K>(
    url: string,
    body: T,
    ctor: Ctor<K>,
    options: RequestOptions = {},
  ): Observable<K> {
    return this.putResponse<T, K>(url, body, ctor, options).pipe(
      map((r) => r.body as K),
    );
  }

  patch<T, K>(
    url: string,
    body: T,
    ctor: Ctor<K>,
    options: RequestOptions = {},
  ): Observable<K> {
    return this.patchResponse<T, K>(url, body, ctor, options).pipe(
      map((r) => r.body as K),
    );
  }

  delete<K>(
    url: string,
    ctor: Ctor<K>,
    options: RequestOptions = {},
  ): Observable<K> {
    return this.deleteResponse<K>(url, ctor, options).pipe(
      map((r) => r.body as K),
    );
  }

  private requestResponse<K>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    url: string,
    body: unknown | undefined,
    ctor: Ctor<K>,
    options: RequestOptions,
  ): Observable<HttpResponse<K>> {
    const context = (options.context ?? new HttpContext())
      .set(RESPONSE_TYPE_CLASS, ctor)
      .set(SERIALIZE_REQUEST, options.serialize ?? true);

    return this.httpClient
      .request<K>(method, url, {
        ...options,
        body,
        context,
        observe: 'response',
      })
      .pipe(filter(isHttpResponse<K>));
  }
}
