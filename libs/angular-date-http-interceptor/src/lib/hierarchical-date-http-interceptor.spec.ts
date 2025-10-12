import { hierarchicalConvertToDate } from '@adaskothebeast/hierarchical-convert-to-date';
import {
  HTTP_INTERCEPTORS,
  HttpClient,
  HttpEvent,
  HttpEventType,
  HttpResponse,
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { HIERARCHICAL_DATE_ADJUST_FUNCTION } from './hierarchical-date-adjust-symbol';
import { HierarchicalDateHttpInterceptor } from './hierarchical-date-http-interceptor';

describe('HierarchicalDateHttpInterceptor', () => {
  let httpClient: HttpClient;
  let httpTestingController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        {
          provide: HTTP_INTERCEPTORS,
          useClass: HierarchicalDateHttpInterceptor,
          multi: true,
        },
        {
          provide: HIERARCHICAL_DATE_ADJUST_FUNCTION,
          useValue: hierarchicalConvertToDate,
        },
      ],
    });

    httpClient = TestBed.inject(HttpClient);
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTestingController.verify(); // Verify that no unmatched requests are outstanding
  });

  it('should call adjustDates function with the response body', (done) => {
    const testData = { key: 'value', date: '2023-07-22T16:08:00.000Z' };

    httpClient.get('/data').subscribe((data) => {
      expect(data).toEqual({
        key: 'value',
        date: new Date(Date.UTC(2023, 6, 22, 16, 8, 0, 0)),
      });

      done();
    });

    const req = httpTestingController.expectOne('/data');

    req.flush(testData, {
      status: 200,
      statusText: 'OK',
      headers: { 'Content-Type': 'application/json' },
    });
  });

  it('should not mutate the original response payload object', (done) => {
    const original = { date: '2023-07-22T16:08:00.000Z', other: 'x' };

    httpClient.get('/no-mutate').subscribe((data) => {
      expect(data).toEqual({
        date: new Date(Date.UTC(2023, 6, 22, 16, 8, 0, 0)),
        other: 'x',
      });
      // original should remain unchanged
      expect(original).toEqual({
        date: '2023-07-22T16:08:00.000Z',
        other: 'x',
      });
      done();
    });

    const req = httpTestingController.expectOne('/no-mutate');
    req.flush(original, {
      status: 200,
      statusText: 'OK',
      headers: { 'Content-Type': 'application/json' },
    });
  });

  it('should skip conversion for non-JSON content types', (done) => {
    httpClient
      // cast to json to satisfy typing while requesting text
      .get('/text', { responseType: 'text' as 'json' })
      .subscribe((data) => {
        expect(data).toBe('plain text');
        done();
      });

    const req = httpTestingController.expectOne('/text');
    req.flush('plain text', {
      status: 200,
      statusText: 'OK',
      headers: { 'Content-Type': 'text/plain' },
    });
  });

  it('should handle null JSON body without conversion', (done) => {
    httpClient.get<unknown>('/null').subscribe((data) => {
      expect(data).toBeNull();
      done();
    });

    const req = httpTestingController.expectOne('/null');
    req.flush(null, {
      status: 200,
      statusText: 'OK',
      headers: { 'Content-Type': 'application/json' },
    });
  });

  it('should convert dates inside JSON arrays', (done) => {
    const testArray = [
      { id: 1, date: '2023-07-22T16:08:00.000Z' },
      { id: 2, date: '2021-01-01T00:00:00.000Z' },
    ];

    httpClient.get('/array').subscribe((data: unknown) => {
      expect(Array.isArray(data)).toBe(true);
      expect(data).toEqual([
        { id: 1, date: new Date(Date.UTC(2023, 6, 22, 16, 8, 0, 0)) },
        { id: 2, date: new Date(Date.UTC(2021, 0, 1, 0, 0, 0, 0)) },
      ]);
      done();
    });

    const req = httpTestingController.expectOne('/array');
    req.flush(testArray, {
      status: 200,
      statusText: 'OK',
      headers: { 'Content-Type': 'application/json' },
    });
  });

  it('should handle application/json with charset', (done) => {
    const testData = { date: '2023-07-22T16:08:00.000Z' };

    httpClient
      .get<{ date: string }>('/utf8')
      .subscribe((data: { date: string }) => {
        expect(data.date).toEqual(new Date(Date.UTC(2023, 6, 22, 16, 8, 0, 0)));
        done();
      });

    const req = httpTestingController.expectOne('/utf8');
    req.flush(testData, {
      status: 200,
      statusText: 'OK',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  });

  it('should pass through non-HttpResponse events unchanged and still convert final response', (done) => {
    const events: HttpEvent<unknown>[] = [];

    httpClient
      .request('GET', '/events', { reportProgress: true, observe: 'events' })
      .subscribe({
        next: (e) => events.push(e),
        complete: () => {
          // allow an optional Sent event before progress
          const progress = events.find(
            (e) => (e as {type: HttpEventType}).type === HttpEventType.DownloadProgress
          );

          expect(progress).toBeDefined();
          expect(progress).toEqual(
            expect.objectContaining({
              type: HttpEventType.DownloadProgress,
              loaded: 20,
              total: 100,
            })
          );

          // final HttpResponse should have converted body
          const final = events.find(
            (e): e is HttpResponse<{ date: Date }> => e instanceof HttpResponse
          );
          expect(final?.body?.date).toEqual(
            new Date(Date.UTC(2023, 6, 22, 16, 8, 0, 0))
          );
          done();
        },
      });

    const req = httpTestingController.expectOne('/events');
    // emit a progress event before the final response
    req.event({
      type: HttpEventType.DownloadProgress,
      loaded: 20,
      total: 100,
    });

    req.flush(
      { date: '2023-07-22T16:08:00.000Z' },
      {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' },
      },
    );
  });

  it('should skip conversion when Content-Type header is missing (empty string fallback)', (done) => {
    const original = { date: '2023-07-22T16:08:00.000Z', other: 'x' };

    httpClient.get('/no-content-type').subscribe((data) => {
      expect(data).toEqual(original);
      expect((data as { date: unknown }).date instanceof Date).toBe(false);
      done();
    });

    const req = httpTestingController.expectOne('/no-content-type');
    // Do not set headers -> Content-Type is missing, ct falls back to ''
    req.flush(original, {
      status: 200,
      statusText: 'OK',
      // no headers provided on purpose
    });
  });
});
