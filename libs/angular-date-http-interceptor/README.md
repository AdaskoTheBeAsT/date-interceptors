# 🅰️ Angular Date HTTP Interceptor

`@adaskothebeast/angular-date-http-interceptor` converts date-like values in Angular `HttpClient` JSON responses. Supply any hierarchical converter through Angular dependency injection—for example, the native-Date, Day.js, Luxon, or Temporal converter packages.

## 📦 Install

```bash
npm install @adaskothebeast/angular-date-http-interceptor @adaskothebeast/hierarchical-convert-to-date
```

## ⚙️ Standalone configuration

Register a converter for `HIERARCHICAL_DATE_ADJUST_FUNCTION`, then add the functional interceptor via `withHierarchicalDateHttpInterceptor()`.

```ts
import { HIERARCHICAL_DATE_ADJUST_FUNCTION, withHierarchicalDateHttpInterceptor } from '@adaskothebeast/angular-date-http-interceptor';
import { hierarchicalConvertToDate } from '@adaskothebeast/hierarchical-convert-to-date';
import { provideHttpClient } from '@angular/common/http';

export const appConfig = {
  providers: [
    {
      provide: HIERARCHICAL_DATE_ADJUST_FUNCTION,
      useValue: hierarchicalConvertToDate,
    },
    provideHttpClient(withHierarchicalDateHttpInterceptor()),
  ],
};
```

The functional interceptor works with Angular's Fetch backend, XHR configuration, and `httpResource()`.

## 🧱 NgModule configuration

For applications that use class-based interceptors, import `AngularDateHttpInterceptorModule` and provide the same conversion function.

```ts
@NgModule({
  imports: [AngularDateHttpInterceptorModule],
  providers: [
    {
      provide: HIERARCHICAL_DATE_ADJUST_FUNCTION,
      useValue: hierarchicalConvertToDate,
    },
  ],
})
export class AppModule {}
```

## 🔍 Behavior

On every `HttpResponse` whose `Content-Type` is `application/json`, the interceptor clones the non-null body with `structuredClone`, invokes the injected converter, and returns a cloned response containing the adjusted body. This leaves the original response body untouched. Non-response events, empty bodies, and non-JSON content types pass through unchanged.

> 💡 The converter is responsible for deciding which values to transform. For native `Date` instances, use `hierarchicalConvertToDate`; substitute a converter from another `hierarchical-convert-to-*` package when your application uses a different date type.
