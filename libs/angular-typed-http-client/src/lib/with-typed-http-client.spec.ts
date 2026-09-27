import 'reflect-metadata';

import {
  HttpClient,
  HttpContext,
  provideHttpClient,
  withFetch,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Expose, Type } from 'class-transformer';
import { firstValueFrom } from 'rxjs';

import { withTypedHttpClient } from './provide-typed-http-client';
import { SERIALIZE_REQUEST } from './serialize-token';
import { TypedHttpClient } from './typed-http-client';

class TagDto {
  label!: string;
}

class CustomerDto {
  id!: number;
  @Type(() => Date) createdAt!: Date;
  @Type(() => TagDto) tags!: TagDto[];
  describe(): string {
    return `#${this.id}`;
  }
}

class CreateCustomer {
  @Expose({ name: 'display_name' }) displayName!: string;
}

describe('withTypedHttpClient', () => {
  let typed: TypedHttpClient;
  let http: HttpClient;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withFetch(), withTypedHttpClient()),
        provideHttpClientTesting(),
      ],
    });
    typed = TestBed.inject(TypedHttpClient);
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('hydrates responses without forcing the XHR backend', async () => {
    const result = firstValueFrom(typed.get('/customers/1', CustomerDto));
    backend.expectOne('/customers/1').flush({
      id: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      tags: [{ label: 'vip' }],
    });
    const customer = await result;
    expect(customer).toBeInstanceOf(CustomerDto);
    expect(customer.describe()).toBe('#1');
    expect(customer.createdAt).toEqual(new Date('2026-01-01T00:00:00.000Z'));
    expect(customer.tags[0]).toBeInstanceOf(TagDto);
  });

  it('serializes request bodies through class-transformer metadata', () => {
    const body = Object.assign(new CreateCustomer(), { displayName: 'Ada' });
    typed.post('/customers', body, CustomerDto).subscribe();
    const request = backend.expectOne('/customers');
    expect(request.request.body).toEqual({ display_name: 'Ada' });
    expect(request.request.headers.get('Content-Type')).toContain(
      'application/json',
    );
    request.flush({ id: 2 });
  });

  it('leaves raw HttpClient requests without typed context untouched', async () => {
    const body = Object.assign(new CreateCustomer(), { displayName: 'Ada' });
    const result = firstValueFrom(http.post('/raw', body));
    const request = backend.expectOne('/raw');
    expect(request.request.body).toBe(body);
    request.flush({ id: 3 });
    expect(await result).toEqual({ id: 3 });
  });

  it('serializes raw HttpClient requests when the context asks for it', () => {
    const body = Object.assign(new CreateCustomer(), { displayName: 'Ada' });
    http
      .post('/raw', body, {
        context: new HttpContext().set(SERIALIZE_REQUEST, true),
      })
      .subscribe();
    const request = backend.expectOne('/raw');
    expect(request.request.body).toEqual({ display_name: 'Ada' });
    request.flush({});
  });
});
