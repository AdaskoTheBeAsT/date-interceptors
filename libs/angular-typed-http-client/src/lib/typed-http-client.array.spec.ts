import 'reflect-metadata';

import {
  HttpClient,
  HttpContext,
  HttpEventType,
  provideHttpClient,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Type } from 'class-transformer';
import { firstValueFrom } from 'rxjs';

import { withTypedHttpClient } from './provide-typed-http-client';
import { SERIALIZE_REQUEST } from './serialize-token';
import { RESPONSE_TYPE_CLASS } from './tokens';
import { TypedHttpClient } from './typed-http-client';

class ItemDto {
  name!: string;
  @Type(() => Date) createdAt!: Date;
  shout(): string {
    return this.name.toUpperCase();
  }
}

describe('TypedHttpClient arrays and options', () => {
  let typed: TypedHttpClient;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withTypedHttpClient()),
        provideHttpClientTesting(),
      ],
    });
    typed = TestBed.inject(TypedHttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  const wire = [
    { name: 'a', createdAt: '2026-01-01T00:00:00.000Z' },
    { name: 'b', createdAt: '2026-02-01T00:00:00.000Z' },
  ];

  it('hydrates every element of an array response with getArray', async () => {
    const result = firstValueFrom(typed.getArray('/items', ItemDto));
    backend.expectOne('/items').flush(wire);
    const items: ItemDto[] = await result;
    expect(items).toHaveLength(2);
    expect(items.every((item) => item instanceof ItemDto)).toBe(true);
    expect(items.map((item) => item.shout())).toEqual(['A', 'B']);
    expect(items[1].createdAt).toEqual(new Date('2026-02-01T00:00:00.000Z'));
  });

  it('keeps status and headers with getArrayResponse', async () => {
    const result = firstValueFrom(typed.getArrayResponse('/items', ItemDto));
    backend.expectOne('/items').flush(wire, {
      status: 206,
      statusText: 'Partial',
      headers: { 'x-total': '10' },
    });
    const response = await result;
    expect(response.status).toBe(206);
    expect(response.headers.get('x-total')).toBe('10');
    expect(response.body?.[0]).toBeInstanceOf(ItemDto);
  });

  it('does not forward the serialize option to HttpClient', () => {
    const request = jest.spyOn(TestBed.inject(HttpClient), 'request');
    const context = new HttpContext();
    typed
      .post('/items', { name: 'c' }, ItemDto, { serialize: false, context })
      .subscribe();
    const options = request.mock.calls[0][2] as Record<string, unknown>;
    expect(options).not.toHaveProperty('serialize');
    expect(options['observe']).toBe('response');
    expect(context.get(SERIALIZE_REQUEST)).toBe(false);
    expect(context.get(RESPONSE_TYPE_CLASS)).toBe(ItemDto);
    backend.expectOne('/items').flush({ name: 'c' });
  });

  it('emits exactly one response even when progress events are reported', async () => {
    const next = jest.fn();
    typed
      .getResponse('/items/1', ItemDto, { reportProgress: true })
      .subscribe(next);
    const request = backend.expectOne('/items/1');
    request.event({
      type: HttpEventType.DownloadProgress,
      loaded: 1,
      total: 2,
    });
    request.flush(wire[0]);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0].body).toBeInstanceOf(ItemDto);
  });
});
