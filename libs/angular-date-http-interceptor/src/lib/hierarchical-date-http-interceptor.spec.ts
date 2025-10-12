import { hierarchicalConvertToDate } from '@adaskothebeast/hierarchical-convert-to-date';
import { HTTP_INTERCEPTORS, HttpClient, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
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
});
