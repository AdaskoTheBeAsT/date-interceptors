import { HttpClient, HttpResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, filter, map } from 'rxjs';

import { TypedHttpRequest } from './typed-http-request';

@Injectable({
  providedIn: 'root',
})
export class TypedHttpClient {
  constructor(private httpClient: HttpClient) {}

  getResponse<T, K>(
    url: string,
    responseTypeClass: new (...args: unknown[]) => K,
  ): Observable<HttpResponse<K>> {
    const httpRequest = new TypedHttpRequest<T, K>('GET', url, {
      responseTypeClass: responseTypeClass,
    });
    return this.httpClient
      .request<K>(httpRequest)
      .pipe(filter((event) => event instanceof HttpResponse)) as Observable<
      HttpResponse<K>
    >;
  }

  get<T, K>(
    url: string,
    responseTypeClass: new (...args: unknown[]) => K,
  ): Observable<K> {
    const httpRequest = new TypedHttpRequest<T, K>('GET', url, {
      responseTypeClass: responseTypeClass,
    });

    return this.httpClient.request<K>(httpRequest).pipe(
      filter((event) => event instanceof HttpResponse),
      map((event) => (event as HttpResponse<K>).body as K),
    );
  }

  postResponse<T, K>(
    url: string,
    body: T,
    responseTypeClass: new (...args: unknown[]) => K,
  ): Observable<HttpResponse<K>> {
    const httpRequest = new TypedHttpRequest<T, K>('POST', url, body, {
      responseTypeClass: responseTypeClass,
    });
    return this.httpClient
      .request<K>(httpRequest)
      .pipe(filter((event) => event instanceof HttpResponse)) as Observable<
      HttpResponse<K>
    >;
  }

  post<T, K>(
    url: string,
    body: T,
    responseTypeClass: new (...args: unknown[]) => K,
  ): Observable<K> {
    const httpRequest = new TypedHttpRequest<T, K>('POST', url, body, {
      responseTypeClass: responseTypeClass,
    });
    return this.httpClient.request<K>(httpRequest).pipe(
      filter((event) => event instanceof HttpResponse),
      map((event) => (event as HttpResponse<K>).body as K),
    );
  }

  putResponse<T, K>(
    url: string,
    body: T,
    responseTypeClass: new (...args: unknown[]) => K,
  ): Observable<HttpResponse<K>> {
    const httpRequest = new TypedHttpRequest<T, K>('PUT', url, body, {
      responseTypeClass: responseTypeClass,
    });
    return this.httpClient
      .request<K>(httpRequest)
      .pipe(filter((event) => event instanceof HttpResponse)) as Observable<
      HttpResponse<K>
    >;
  }

  put<T, K>(
    url: string,
    body: T,
    responseTypeClass: new (...args: unknown[]) => K,
  ): Observable<K> {
    const httpRequest = new TypedHttpRequest<T, K>('PUT', url, body, {
      responseTypeClass: responseTypeClass,
    });
    return this.httpClient.request<K>(httpRequest).pipe(
      filter((event) => event instanceof HttpResponse),
      map((event) => (event as HttpResponse<K>).body as K),
    );
  }

  patchResponse<T, K>(
    url: string,
    body: T,
    responseTypeClass: new (...args: unknown[]) => K,
  ): Observable<HttpResponse<K>> {
    const httpRequest = new TypedHttpRequest<T, K>('PATCH', url, body, {
      responseTypeClass: responseTypeClass,
    });
    return this.httpClient
      .request<K>(httpRequest)
      .pipe(filter((event) => event instanceof HttpResponse)) as Observable<
      HttpResponse<K>
    >;
  }

  patch<T, K>(
    url: string,
    body: T,
    responseTypeClass: new (...args: unknown[]) => K,
  ): Observable<K> {
    const httpRequest = new TypedHttpRequest<T, K>('PATCH', url, body, {
      responseTypeClass: responseTypeClass,
    });
    return this.httpClient.request<K>(httpRequest).pipe(
      filter((event) => event instanceof HttpResponse),
      map((event) => (event as HttpResponse<K>).body as K),
    );
  }
}
