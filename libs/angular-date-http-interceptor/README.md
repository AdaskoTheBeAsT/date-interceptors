# 🅰️ Angular Date HTTP Interceptor

`@adaskothebeast/angular-date-http-interceptor` converts date-like values in Angular `HttpClient` JSON responses. Supply any hierarchical converter—for example, the native-Date, Day.js, Luxon, or Temporal converter packages.

## 📦 Install

```bash
npm install @adaskothebeast/angular-date-http-interceptor @adaskothebeast/hierarchical-convert-to-date
```

## ⚙️ Standalone configuration

Pass the converter to `withHierarchicalDateHttpInterceptor(converter)`. No separate provider is needed.

```ts
import { withHierarchicalDateHttpInterceptor } from '@adaskothebeast/angular-date-http-interceptor';
import { hierarchicalConvertToDate } from '@adaskothebeast/hierarchical-convert-to-date';
import { provideHttpClient, withFetch } from '@angular/common/http';

export const appConfig = {
  providers: [provideHttpClient(withFetch(), withHierarchicalDateHttpInterceptor(hierarchicalConvertToDate))],
};
```

When the converter should come from dependency injection instead (for example, to replace it in tests), call `withHierarchicalDateHttpInterceptor()` without an argument and register the converter with `provideHierarchicalDateConverter(converter)`, which provides `HIERARCHICAL_DATE_ADJUST_FUNCTION`:

```ts
providers: [
  provideHierarchicalDateConverter(hierarchicalConvertToDate),
  provideHttpClient(withHierarchicalDateHttpInterceptor()),
],
```

If neither is configured, the first request fails with an error that names both options (instead of Angular's generic `NullInjectorError`).

The functional interceptor works with Angular's Fetch backend, XHR configuration, and `httpResource()`.

## 🧱 NgModule configuration

For applications that use class-based interceptors, import `AngularDateHttpInterceptorModule.forRoot(converter)`. The module registers the interceptor through `HTTP_INTERCEPTORS`, so the application must enable DI interceptors with `withInterceptorsFromDi()`.

```ts
@NgModule({
  imports: [AngularDateHttpInterceptorModule.forRoot(hierarchicalConvertToDate)],
  providers: [provideHttpClient(withInterceptorsFromDi())],
})
export class AppModule {}
```

Importing `AngularDateHttpInterceptorModule` without `forRoot` still works when `HIERARCHICAL_DATE_ADJUST_FUNCTION` is provided separately.

## 🔍 Behavior

The interceptor converts an `HttpResponse` only when all of the following hold:

- the request's `responseType` is `'json'` (Angular's default); `arraybuffer`, `blob`, and `text` responses are never touched, even when the server labels them as JSON;
- the `Content-Type` media type is `application/json` or any structured JSON suffix type such as `application/vnd.api+json`, `application/hal+json`, or `application/ld+json` (case-insensitive, parameters such as `charset` ignored);
- the body is not `null`.

Responses without a `Content-Type` header are passed through unconverted. Angular may still parse such bodies as JSON, but without the header the interceptor cannot tell JSON from other payloads, so it leaves the decision to the server's labelling.

For a matching response, the interceptor clones the body with `structuredClone`, invokes the converter, and returns a cloned response containing the adjusted body. This leaves the original response body untouched. Non-response events pass through unchanged.

> 💡 The converter is responsible for deciding which values to transform. For native `Date` instances, use `hierarchicalConvertToDate`; substitute a converter from another `hierarchical-convert-to-*` package when your application uses a different date type.

## ⚠️ Interceptor order with class-transformer

`structuredClone` does not preserve class prototypes. When you combine this interceptor with class-based hydration (for example `@adaskothebeast/angular-typed-http-client`), the date interceptor must see the response **before** hydration. Angular passes responses through interceptors in reverse registration order, so register the hydrating interceptor first:

```ts
provideHttpClient(
  withFetch(),
  withTypedHttpClient(), // hydrates second
  withHierarchicalDateHttpInterceptor(hierarchicalConvertToDate), // converts first
);
```

With `HTTP_INTERCEPTORS`, register `ClassTransformerHttpInterceptor` before `HierarchicalDateHttpInterceptor`. In the reverse order the hydrated instances are cloned back into plain objects and their methods are lost.

## Problem Details

JSON Problem Details (`application/problem+json`) bypass success conversion, including HTTP 200 responses. Use the exported `isProblemDetailsError(error)` guard to read `httpStatus`, typed `problem` members, and the original decoded `body`. Extension members such as `errors` and `traceId` are preserved. See the repository [conversion contract](https://github.com/AdaskoTheBeAsT/date-interceptors/blob/main/docs/conversion-contract.md#json-problem-details) for transport-specific behavior.
