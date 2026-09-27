import 'reflect-metadata';

import {
  HTTP_INTERCEPTORS,
  HttpHeaders,
  provideHttpClient,
  withInterceptorsFromDi,
  withXhr,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Transform } from 'class-transformer';
import { firstValueFrom } from 'rxjs';

import { ClassTransformerHttpInterceptor } from './class-transformer-http.interceptor';
import { ClassTransformerSerializeInterceptor } from './class-transformer-serialize.interceptor';
import { TypedHttpClient } from './typed-http-client';

class OutputDto {
  key: string | null = null;

  @Transform(({ value }) => new Date(value), { toClassOnly: true })
  date: Date | null = null;
}

describe('TypedHttpClient getResponse', () => {
  let typed: TypedHttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
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

    typed = TestBed.inject(TypedHttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it.each(['post', 'put', 'patch', 'delete'] as const)(
    'preserves %s response status and hydrates its body',
    async (method) => {
      const response = firstValueFrom(
        method === 'delete'
          ? typed.deleteResponse('/data', OutputDto)
          : typed[`${method}Response`]('/data', { key: 'request' }, OutputDto),
      );
      const request = httpMock.expectOne('/data');
      expect(request.request.method).toBe(method.toUpperCase());
      request.flush(
        { key: 'response' },
        { status: 202, statusText: 'Accepted' },
      );
      const result = await response;
      expect(result.status).toBe(202);
      expect(result.body).toBeInstanceOf(OutputDto);
      expect(result.body?.key).toBe('response');
    },
  );

  it.each(['post', 'put', 'patch', 'delete'] as const)(
    'returns only the hydrated body for %s',
    async (method) => {
      const response = firstValueFrom(
        method === 'delete'
          ? typed.delete('/data', OutputDto)
          : typed[method]('/data', { key: 'request' }, OutputDto),
      );
      httpMock.expectOne('/data').flush({ key: 'response' });
      const result = await response;
      expect(result).toBeInstanceOf(OutputDto);
      expect(result.key).toBe('response');
    },
  );

  it('returns full HttpResponse with transformed body, headers and status', (done) => {
    const testData = { key: 'v', date: '2023-07-22T16:08:00.000Z' };

    typed.getResponse('/data', OutputDto).subscribe((res) => {
      expect(res.status).toBe(201);
      expect(res.headers.get('x-foo')).toBe('bar');
      expect(res.body).toBeTruthy();
      const body = res.body;
      expect(body instanceof OutputDto).toBe(true);
      expect(body?.key).toBe('v');
      expect(body?.date).toEqual(new Date('2023-07-22T16:08:00.000Z'));
      done();
    });

    const req = httpMock.expectOne('/data');
    req.flush(testData, {
      status: 201,
      statusText: 'Created',
      headers: new HttpHeaders({ 'x-foo': 'bar' }),
    });
  });
});
