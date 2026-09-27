import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { ModuleWithProviders, NgModule } from '@angular/core';

import { HierarchicalDateHttpInterceptor } from './hierarchical-date-http-interceptor';
import { provideHierarchicalDateConverter } from './with-hierarchical-date-http-interceptor';

/** Requires `provideHttpClient(withInterceptorsFromDi())` in the application. */
@NgModule({
  providers: [
    {
      provide: HTTP_INTERCEPTORS,
      useClass: HierarchicalDateHttpInterceptor,
      multi: true,
    },
  ],
})
export class AngularDateHttpInterceptorModule {
  /** Registers the interceptor together with its converter. */
  static forRoot(
    converter: (obj: unknown) => void,
  ): ModuleWithProviders<AngularDateHttpInterceptorModule> {
    return {
      ngModule: AngularDateHttpInterceptorModule,
      providers: [provideHierarchicalDateConverter(converter)],
    };
  }
}
