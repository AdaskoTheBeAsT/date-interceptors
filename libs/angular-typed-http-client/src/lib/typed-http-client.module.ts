import {
  HTTP_INTERCEPTORS,
  provideHttpClient,
  withInterceptorsFromDi,
  withXhr,
} from '@angular/common/http';
import { NgModule } from '@angular/core';

import { ClassTransformerHttpInterceptor } from './class-transformer-http.interceptor';
import { ClassTransformerSerializeInterceptor } from './class-transformer-serialize.interceptor';

/**
 * @deprecated Use `provideHttpClient(withTypedHttpClient())`. This module
 * calls `provideHttpClient(withXhr(), withInterceptorsFromDi())` itself, which
 * forces the XHR backend and replaces the application's own HttpClient setup.
 */
@NgModule({
  providers: [
    provideHttpClient(withXhr(), withInterceptorsFromDi()),
    {
      provide: HTTP_INTERCEPTORS,
      useClass: ClassTransformerSerializeInterceptor,
      multi: true,
    },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: ClassTransformerHttpInterceptor,
      multi: true,
    },
  ],
})
export class TypedHttpClientModule {}
