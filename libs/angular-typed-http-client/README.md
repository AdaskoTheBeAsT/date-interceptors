# 🅰️ Angular Typed HTTP Client

`@adaskothebeast/angular-typed-http-client` adds class-aware request serialization and response hydration to Angular `HttpClient`, using `class-transformer`. `TypedHttpClient` is a small wrapper that accepts the response class explicitly, so responses can be returned as class instances rather than plain JSON objects.

## 📦 Install

```bash
npm install @adaskothebeast/angular-typed-http-client class-transformer reflect-metadata
```

Import `reflect-metadata` once in your application entry point when your model decorators require it.

## ⚙️ Configure Angular

For a standalone application, add `provideTypedHttpClient()` to the application providers. It configures Angular's XHR client and registers the serialization and hydration interceptors.

```ts
import { provideTypedHttpClient } from '@adaskothebeast/angular-typed-http-client';

export const appConfig = {
  providers: [provideTypedHttpClient()],
};
```

For an NgModule-based application, import `TypedHttpClientModule` instead.

```ts
@NgModule({
  imports: [TypedHttpClientModule],
})
export class AppModule {}
```

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
}
```

`get`, `post`, `put`, `patch`, and `delete` return the transformed body. Their `getResponse`, `postResponse`, `putResponse`, `patchResponse`, and `deleteResponse` counterparts return `HttpResponse<T>` when status and headers are needed.

## 📤 Serialize request instances

Requests made through `TypedHttpClient` serialize non-GET, non-native bodies with `instanceToPlain` by default. This honors your `class-transformer` decorators and adds `Content-Type: application/json; charset=utf-8` when the request did not specify a content type.

```ts
class CreateCustomer {
  @Expose({ name: 'display_name' })
  displayName!: string;
}

this.http.post('/api/customers', { displayName: 'Ada' }, Customer);
```

Use the `serialize` request option to turn this off or supply `class-transformer` options:

```ts
this.http.post('/api/customers', body, Customer, { serialize: false });
this.http.post('/api/customers', body, Customer, {
  serialize: { strategy: 'excludeAll' },
});
```

> 💡 `FormData`, `Blob`, `ArrayBuffer`, `URLSearchParams`, and `ReadableStream` bodies are passed through without serialization.
