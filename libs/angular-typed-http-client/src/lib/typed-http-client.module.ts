import { CommonModule } from '@angular/common';
import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { NgModule } from '@angular/core';

import { ClassTransformerHttpInterceptor } from './class-transformer-http-interceptor';

@NgModule({ imports: [CommonModule], providers: [
        {
            provide: HTTP_INTERCEPTORS,
            useClass: ClassTransformerHttpInterceptor,
            multi: true,
        },
        provideHttpClient(withInterceptorsFromDi()),
    ] })
export class TypedHttpClientModule {}
