import { CommonModule } from '@angular/common';
import { HTTP_INTERCEPTORS, HttpClientModule } from '@angular/common/http';
import { NgModule } from '@angular/core';

import { ClassTransformerHttpInterceptor } from './class-transformer-http-interceptor';

@NgModule({
  imports: [CommonModule, HttpClientModule],
  providers: [
    {
      provide: HTTP_INTERCEPTORS,
      useClass: ClassTransformerHttpInterceptor,
      multi: true,
    },
  ],
})
export class TypedHttpClientModule {}
