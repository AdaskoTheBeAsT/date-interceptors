import 'reflect-metadata';

import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { IsEmail, validateOrReject } from 'class-validator';
import { firstValueFrom, mergeMap } from 'rxjs';

import { provideTypedHttpClient } from './provide-typed-http-client';
import { TypedHttpClient } from './typed-http-client';
import { TypedHttpClientModule } from './typed-http-client.module';

class User {
  @IsEmail()
  email!: string;
}

describe('explicit validation example', () => {
  let client: TypedHttpClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideTypedHttpClient(), provideHttpClientTesting()],
    });
    client = TestBed.inject(TypedHttpClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('hydrates a class without executing its validation decorators', async () => {
    const response = firstValueFrom(client.get('/user', User));
    http.expectOne('/user').flush({ email: 'invalid' });
    const user = await response;
    expect(user).toBeInstanceOf(User);
    expect(user.email).toBe('invalid');
  });

  it.each(['ada@example.com', 'invalid'])(
    'validates %s explicitly after hydration',
    async (email) => {
      const response = firstValueFrom(
        client.get('/user', User).pipe(
          mergeMap(async (user) => {
            await validateOrReject(user);
            return user;
          }),
        ),
      );
      http.expectOne('/user').flush({ email });
      if (email === 'invalid') {
        await expect(response).rejects.toEqual([
          expect.objectContaining({
            property: 'email',
            constraints: { isEmail: expect.any(String) },
          }),
        ]);
      } else {
        await expect(response).resolves.toEqual(
          expect.objectContaining({ email }),
        );
      }
    },
  );
});

describe('NgModule configuration', () => {
  it('hydrates responses when configured through TypedHttpClientModule', async () => {
    TestBed.configureTestingModule({
      imports: [TypedHttpClientModule],
      providers: [provideHttpClientTesting()],
    });
    const client = TestBed.inject(TypedHttpClient);
    const http = TestBed.inject(HttpTestingController);
    const response = firstValueFrom(client.get('/module', User));
    http.expectOne('/module').flush({ email: 'ada@example.com' });
    await expect(response).resolves.toBeInstanceOf(User);
    http.verify();
  });
});
