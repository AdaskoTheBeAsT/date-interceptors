# 🅰️ Angular Typed HTTP Client

`@adaskothebeast/angular-typed-http-client` adds class-aware request serialization and response hydration to Angular `HttpClient`, using `class-transformer`. `TypedHttpClient` is a small wrapper that accepts the response class explicitly, so responses can be returned as class instances rather than plain JSON objects.

## 📦 Install

```bash
npm install @adaskothebeast/angular-typed-http-client class-transformer reflect-metadata
```

`reflect-metadata` is required whenever your models use `@Type` (for nested classes and dates): `class-transformer` reads decorator metadata through the `Reflect` API. Import it once, before any model class is loaded, for example at the top of `main.ts`:

```ts
import 'reflect-metadata';
```

## ⚙️ Configure Angular

Add the `withTypedHttpClient()` feature to your own `provideHttpClient` call. It registers the serialization and hydration interceptors as functional interceptors and leaves the backend choice (`withFetch()`, XHR), SSR, and the transfer cache to your application.

```ts
import { withTypedHttpClient } from '@adaskothebeast/angular-typed-http-client';
import { provideHttpClient, withFetch } from '@angular/common/http';

export const appConfig = {
  providers: [provideHttpClient(withFetch(), withTypedHttpClient())],
};
```

The class-based interceptors (`ClassTransformerSerializeInterceptor`, `ClassTransformerHttpInterceptor`) remain available for applications that register interceptors through `HTTP_INTERCEPTORS` and `withInterceptorsFromDi()`. Their functional counterparts are exported as `classTransformerSerializeInterceptorFn` and `classTransformerHttpInterceptorFn`.

> ⚠️ **Deprecated:** `provideTypedHttpClient()` and `TypedHttpClientModule` still work, but they call `provideHttpClient(withXhr(), withInterceptorsFromDi())` themselves. That forces the XHR backend (disabling `withFetch()`) and duplicates the application's own `provideHttpClient`. Replace them with `provideHttpClient(..., withTypedHttpClient())`.

### Combining with the date interceptor

If you also use `@adaskothebeast/angular-date-http-interceptor`, list `withTypedHttpClient()` **before** the date interceptor:

```ts
provideHttpClient(withFetch(), withTypedHttpClient(), withHierarchicalDateHttpInterceptor(hierarchicalConvertToDate));
```

Angular passes responses through interceptors in reverse registration order, so the date interceptor then converts the plain JSON first and `class-transformer` hydrates the converted values. In the opposite order, the date interceptor's `structuredClone` receives the hydrated class instances and turns them back into plain objects. The same rule applies to `HTTP_INTERCEPTORS` registrations: register `ClassTransformerHttpInterceptor` before `HierarchicalDateHttpInterceptor`.

## 🧬 Request typed responses

Pass the model constructor as the second argument. The response interceptor calls `plainToInstance` with that constructor; the body-only methods return the instance, while the `*Response` methods return the full `HttpResponse`.

```ts
import { TypedHttpClient } from '@adaskothebeast/angular-typed-http-client';
import { Expose, Type } from 'class-transformer';

class Customer {
  @Expose()
  name!: string;

  @Type(() => Date)
  createdAt!: Date;
}

@Injectable({ providedIn: 'root' })
export class CustomersApi {
  private readonly http = inject(TypedHttpClient);

  getCustomer(id: string) {
    return this.http.get(`/api/customers/${id}`, Customer);
  }

  listCustomers() {
    // Observable<Customer[]>; every element is a Customer instance.
    return this.http.getArray('/api/customers', Customer);
  }
}
```

`get`, `post`, `put`, `patch`, and `delete` return the transformed body. Their `getResponse`, `postResponse`, `putResponse`, `patchResponse`, and `deleteResponse` counterparts return `HttpResponse<T>` when status and headers are needed.

For endpoints that return a JSON array, use `getArray` (or `getArrayResponse`), which are typed as `Observable<T[]>` and `Observable<HttpResponse<T[]>>`. `get` is typed for a single object; `plainToInstance` still hydrates array bodies, but `get` would report them as `T`.

## 📤 Serialize request instances

Requests made through `TypedHttpClient` serialize non-GET, non-native bodies with `instanceToPlain` by default. This honors your `class-transformer` decorators and adds `Content-Type: application/json; charset=utf-8` when the request did not specify a content type.

Decorators only apply to class instances. Create the request body as an instance, for example with `plainToInstance`; an object literal would be sent unchanged.

```ts
import { Expose, plainToInstance } from 'class-transformer';

class CreateCustomer {
  @Expose({ name: 'display_name' })
  displayName!: string;
}

const body = plainToInstance(CreateCustomer, { displayName: 'Ada' });
// Sends {"display_name":"Ada"}
this.http.post('/api/customers', body, Customer);
```

Use the `serialize` request option to turn this off or supply `class-transformer` options:

```ts
this.http.post('/api/customers', body, Customer, { serialize: false });
this.http.post('/api/customers', body, Customer, {
  serialize: { strategy: 'excludeAll' },
});
```

> 💡 Strings, `FormData`, `Blob`, `ArrayBuffer`, typed arrays and `DataView`s, `URLSearchParams`, and `ReadableStream` bodies are passed through without serialization or a `Content-Type` change.

## Explicit runtime validation

Hydration creates class instances. It does not check field types or execute
validation decorators. For application rules, install the optional
`class-validator` package and call `validateOrReject` explicitly:

```bash
npm install class-validator
```

```ts
import { TypedHttpClient } from '@adaskothebeast/angular-typed-http-client';
import { IsEmail, validateOrReject } from 'class-validator';
import { mergeMap } from 'rxjs';

class User {
  @IsEmail()
  email!: string;
}

export function getValidatedUser(client: TypedHttpClient) {
  return client.get('/user', User).pipe(
    mergeMap(async (user) => {
      await validateOrReject(user);
      return user;
    }),
  );
}
```

An invalid email now reaches the observable's error channel. Without the explicit
call, it remains on the hydrated instance. Validate request instances before
calling `post`/`put` when the same rules should apply to outgoing data. This flow
is exercised by `validation-example.spec.ts`; `class-validator` is a development
dependency here, not a required dependency of the published client.

## Problem Details

JSON Problem Details (`application/problem+json`) bypass success conversion, including HTTP 200 responses. Use the exported `isProblemDetailsError(error)` guard to read `httpStatus`, typed `problem` members, and the original decoded `body`. Extension members such as `errors` and `traceId` are preserved. See the repository [conversion contract](https://github.com/AdaskoTheBeAsT/date-interceptors/blob/main/docs/conversion-contract.md#json-problem-details) for transport-specific behavior.
