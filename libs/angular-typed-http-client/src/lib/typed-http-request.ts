import { HttpContext, HttpHeaders, HttpParams, HttpRequest } from '@angular/common/http';

export class TypedHttpRequest<T, K> extends HttpRequest<unknown> {
  responseTypeClass?: new (...args: unknown[]) => K;

  constructor(
    method: string,
    url: string,
    thirdParam?:
      | T
      | null
      | {
          headers?: HttpHeaders;
          context?: HttpContext;
          reportProgress?: boolean;
          params?: HttpParams;
          responseType?: 'arraybuffer' | 'blob' | 'json' | 'text';
          withCredentials?: boolean;
          transferCache?:
            | {
                includeHeaders?: string[];
              }
            | boolean;
          responseTypeClass?: new (...args: unknown[]) => K;
        },
    fourthParam?: {
      headers?: HttpHeaders;
      context?: HttpContext;
      reportProgress?: boolean;
      params?: HttpParams;
      responseType?: 'arraybuffer' | 'blob' | 'json' | 'text';
      withCredentials?: boolean;
      transferCache?:
        | {
            includeHeaders?: string[];
          }
        | boolean;
      responseTypeClass?: new (...args: unknown[]) => K;
    },
  ) {
    // Determine if the third parameter is the body or init based on method
    let body: unknown = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let init: any = {};

    if (['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
      body = thirdParam;
      init = fourthParam;
    } else {
      init = thirdParam;
    }

    super(method, url, body, init);

    this.responseTypeClass = init?.responseTypeClass;
  }
}
