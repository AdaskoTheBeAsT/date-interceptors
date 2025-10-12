import 'reflect-metadata';

import {
  HTTP_INTERCEPTORS,
  HttpClient,
  HttpContext,
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
// class-transformer-http-interceptor.spec.ts
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ClassTransformerHttpInterceptor } from './class-transformer-http.interceptor';
import { ClassTransformerSerializeInterceptor } from './class-transformer-serialize.interceptor';
import { RESPONSE_TYPE_CLASS } from './tokens';
import { TypedHttpClient } from './typed-http-client';

class UserDto {
  name!: string;
  upper(): string {
    return this.name.toUpperCase();
  }
}

describe('ClassTransformerHttpInterceptor', () => {
  let http: HttpClient;
  let typed: TypedHttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        TypedHttpClient,
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
    });

    http = TestBed.inject(HttpClient);
    typed = TestBed.inject(TypedHttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('transforms body into the provided class via TypedHttpClient', (done) => {
    typed.get('/api/user/1', UserDto).subscribe((user) => {
      expect(user instanceof UserDto).toBe(true);
      expect(user.upper()).toBe('ALICE');
      done();
    });

    const req = httpMock.expectOne('/api/user/1');
    req.flush({ name: 'Alice' });
  });

  it('transforms body when using raw HttpClient + context token', (done) => {
    const ctx = new HttpContext().set(RESPONSE_TYPE_CLASS, UserDto);

    http.get<UserDto>('/api/user/2', { context: ctx }).subscribe((user: UserDto) => {
      expect(user instanceof UserDto).toBe(true);
      expect(user.upper()).toBe('BOB');
      done();
    });

    const req = httpMock.expectOne('/api/user/2');
    req.flush({ name: 'Bob' });
  });
});
