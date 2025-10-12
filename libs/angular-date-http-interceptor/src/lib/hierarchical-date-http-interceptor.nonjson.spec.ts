import 'reflect-metadata';

import {
  HTTP_INTERCEPTORS,
  HttpClient,
  HttpHeaders,
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Observer } from 'rxjs';

import { HIERARCHICAL_DATE_ADJUST_FUNCTION } from './hierarchical-date-adjust-symbol';
import { HierarchicalDateHttpInterceptor } from './hierarchical-date-http-interceptor';

describe('HierarchicalDateHttpInterceptor - non JSON payloads (Jest)', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  const adjustSpy = jest.fn() as jest.Mock<(o: unknown) => void>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        // HttpClient + respect DI interceptors
        provideHttpClient(withInterceptorsFromDi()),
        // Testing backend + HttpTestingController
        provideHttpClientTesting(),

        { provide: HIERARCHICAL_DATE_ADJUST_FUNCTION, useValue: adjustSpy },
        {
          provide: HTTP_INTERCEPTORS,
          useClass: HierarchicalDateHttpInterceptor,
          multi: true,
        },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    adjustSpy.mockReset();
  });

  it('ignores Blob responses', (done) => {
    http
      .get('/blob', { responseType: 'blob' as 'json' })
      .subscribe((b: Partial<Observer<object>>) => {
        expect(b).toBeInstanceOf(Blob);
        expect(adjustSpy).not.toHaveBeenCalled();
        done();
      });

    const req = httpMock.expectOne('/blob');
    req.flush(new Blob(['abc']), {
      headers: new HttpHeaders({ 'Content-Type': 'application/octet-stream' }),
      status: 200,
      statusText: 'OK',
    });
  });

  it('ignores text/plain responses', (done) => {
    http
      .get('/text', { responseType: 'text' as 'json' })
      .subscribe((t: Partial<Observer<object>>) => {
        expect(t).toBe('just text');
        expect(adjustSpy).not.toHaveBeenCalled();
        done();
      });

    const req = httpMock.expectOne('/text');
    req.flush('just text', {
      headers: new HttpHeaders({ 'Content-Type': 'text/plain; charset=utf-8' }),
      status: 200,
      statusText: 'OK',
    });
  });
});
