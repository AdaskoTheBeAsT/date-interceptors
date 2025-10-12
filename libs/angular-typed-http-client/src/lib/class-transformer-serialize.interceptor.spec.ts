import 'reflect-metadata';

import {
  HTTP_INTERCEPTORS,
  HttpClient,
  HttpContext,
  HttpHeaders,
  HttpParams,
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Exclude, Expose } from 'class-transformer';

import { ClassTransformerSerializeInterceptor } from './class-transformer-serialize.interceptor';
import { SERIALIZE_REQUEST } from './serialize-token';

@Exclude()
class CreateUser {
  @Expose() name!: string;

  // Only included when { groups: ['create'] } is active
  @Expose({ groups: ['create'] })
  email!: string;

  // Only included when { groups: ['update'] } is active
  @Expose({ groups: ['update'] })
  updated!: boolean;

  // Never exposed
  secret!: string;

  constructor(init?: Partial<CreateUser>) {
    Object.assign(this, init);
  }
}

describe('ClassTransformerSerializeInterceptor (Jest)', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        // Provide HttpClient that honors DI interceptors
        provideHttpClient(withInterceptorsFromDi()),
        // Provide the testing backend + controller
        provideHttpClientTesting(),
        // Register the interceptor under test
        {
          provide: HTTP_INTERCEPTORS,
          useClass: ClassTransformerSerializeInterceptor,
          multi: true,
        },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  function ctx(opt: boolean | Parameters<typeof HttpContext.prototype.set>[1]) {
    return new HttpContext().set(SERIALIZE_REQUEST, opt);
  }

  it('serializes POST bodies to plain objects and sets JSON content-type', () => {
    const body = new CreateUser({
      name: 'Ada',
      email: 'ada@example.com',
      secret: 'shh',
    });

    http.post('/users', body, { context: ctx(true) }).subscribe();

    const req = httpMock.expectOne('/users');
    // Body should be plain (no class instance, no methods)
    expect(req.request.body).toEqual({ name: 'Ada' });
    expect(req.request.body).not.toBeInstanceOf(CreateUser);

    // Content-Type is set to JSON if it was missing
    const ct = req.request.headers.get('Content-Type');
    expect(ct).toBeTruthy();
    expect(ct?.toLowerCase()).toContain('application/json');

    req.flush({}, { status: 200, statusText: 'OK' });
  });

  it('honors ClassTransformOptions (groups) when provided via token', () => {
    const body = new CreateUser({
      name: 'Ada',
      email: 'ada@example.com',
      updated: true,
      secret: 'shh',
    });

    // Only include properties exposed for the "create" group + generally-exposed fields
    const options = { groups: ['create'], excludeExtraneousValues: true };

    http.post('/users', body, { context: ctx(options) }).subscribe();

    const req = httpMock.expectOne('/users');
    expect(req.request.body).toEqual({ name: 'Ada', email: 'ada@example.com' });
    expect(req.request.body.updated).toBeUndefined();
    expect(req.request.body.secret).toBeUndefined();

    req.flush({}, { status: 200, statusText: 'OK' });
  });

  it('does not serialize GET requests (even if token is true)', () => {
    http.get('/users', { context: ctx(true) }).subscribe();

    const req = httpMock.expectOne('/users');
    // No body on GET, and interceptor should not force a Content-Type
    expect(req.request.body).toBeNull();
    expect(req.request.headers.has('Content-Type')).toBe(false);

    req.flush([], { status: 200, statusText: 'OK' });
  });

  it('skips native bodies: FormData, Blob, URLSearchParams, ArrayBuffer', () => {
    const fd = new FormData();
    fd.append('k', 'v');

    const blob = new Blob(['hello'], { type: 'text/plain' });
    const usp = new URLSearchParams('a=b&c=d');
    const buf = new TextEncoder().encode('abc').buffer;
    const params = new HttpParams({ fromString: 'a=b&c=d' });

    // FormData
    http.post('/native/FormData', fd, { context: ctx(true) }).subscribe();
    let req = httpMock.expectOne('/native/FormData');
    expect(req.request.body).toBe(fd);
    expect(req.request.headers.has('Content-Type')).toBe(false); // MUST be absent for FormData
    req.flush({});

    // Blob
    http.post('/native/Blob', blob, { context: ctx(true) }).subscribe();
    req = httpMock.expectOne('/native/Blob');
    expect(req.request.body).toBe(blob);
    expect(req.request.headers.has('Content-Type')).toBe(false);
    req.flush({});

    // URLSearchParams
    http
      .post('/native/URLSearchParams', usp, { context: ctx(true) })
      .subscribe();
    req = httpMock.expectOne('/native/URLSearchParams');
    expect(req.request.body).toBe(usp);
    expect(req.request.headers.get('Content-Type')).toBe(null);
    req.flush({});

    // HttpParams
    let headers = new HttpHeaders({
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    });
    http
      .post('/native/HttpParams', params, { context: ctx(true), headers })
      .subscribe();
    req = httpMock.expectOne('/native/HttpParams');
    expect(req.request.headers.get('Content-Type')).toBe(
      'application/x-www-form-urlencoded;charset=UTF-8',
    );
    req.flush({});

    // ArrayBuffer
    headers = new HttpHeaders({
      'Content-Type': 'application/octet-stream',
    });
    http
      .post('/native/ArrayBuffer', buf, { context: ctx(true), headers })
      .subscribe();
    req = httpMock.expectOne('/native/ArrayBuffer');
    // Some Angular versions set octet-stream here; if yours doesn’t, relax to "not JSON":
    const ct = req.request.headers.get('Content-Type');
    expect(ct === null || ct.toLowerCase() === 'application/octet-stream').toBe(
      true,
    );
    req.flush({});
  });

  it('does not override existing Content-Type header', () => {
    const body = new CreateUser({ name: 'Patch', email: 'p@ex.com' });
    const headers = new HttpHeaders({
      'Content-Type': 'application/json-patch+json',
    });

    const options = { groups: ['create'], excludeExtraneousValues: true };
    http.post('/patch', body, { context: ctx(options), headers }).subscribe();

    const req = httpMock.expectOne('/patch');
    expect(req.request.body).toEqual({ name: 'Patch', email: 'p@ex.com' });
    expect(req.request.headers.get('Content-Type')).toBe(
      'application/json-patch+json',
    );
    req.flush({});
  });

  it('respects serialize: false (no serialization occurs)', () => {
    const body = new CreateUser({ name: 'Nope', email: 'nope@example.com' });

    http.post('/noserialize', body, { context: ctx(false) }).subscribe();

    const req = httpMock.expectOne('/noserialize');
    // Body remains the original instance
    expect(req.request.body).toBe(body);
    // No forced Content-Type
    expect(req.request.headers.has('Content-Type')).toBe(false);

    req.flush({}, { status: 200, statusText: 'OK' });
  });
});
