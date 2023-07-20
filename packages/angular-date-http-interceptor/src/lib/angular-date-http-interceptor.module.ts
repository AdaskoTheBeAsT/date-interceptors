import { CommonModule } from '@angular/common';
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { NgModule } from '@angular/core';

import { HierarchicalDateHttpInterceptor } from './hierarchical-date-http-interceptor';

@NgModule({
  imports: [CommonModule],
  providers: [
    {
      provide: HTTP_INTERCEPTORS,
      useClass: HierarchicalDateHttpInterceptor,
      multi: true,
    },
  ],
})
export class AngularDateHttpInterceptorModule {}
