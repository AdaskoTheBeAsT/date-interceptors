import {
  HTTP_INTERCEPTORS,
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import { EnvironmentProviders, Provider } from '@angular/core';

import { ClassTransformerHttpInterceptor } from './class-transformer-http.interceptor';
import { ClassTransformerSerializeInterceptor } from './class-transformer-serialize.interceptor';

export function provideTypedHttpClient(): (Provider | EnvironmentProviders)[] {
  return [
    provideHttpClient(withInterceptorsFromDi()),
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
  ];
}
