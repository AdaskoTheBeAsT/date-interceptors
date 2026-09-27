import { hierarchicalConvertToDate } from '@adaskothebeast/hierarchical-convert-to-date';
import { HttpClient, provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { HIERARCHICAL_DATE_ADJUST_FUNCTION } from './hierarchical-date-adjust-symbol';
import { withHierarchicalDateHttpInterceptor } from './with-hierarchical-date-http-interceptor';

describe('hierarchicalDateHttpInterceptorFn', () => {
  let http: HttpClient;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withHierarchicalDateHttpInterceptor()),
        provideHttpClientTesting(),
        {
          provide: HIERARCHICAL_DATE_ADJUST_FUNCTION,
          useValue: hierarchicalConvertToDate,
        },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('converts JSON responses through the standalone provider API', () => {
    let result: { createdAt: Date } | undefined;

    http.get<{ createdAt: Date }>('/users/1').subscribe((value) => {
      result = value;
    });

    httpTesting
      .expectOne('/users/1')
      .flush(
        { createdAt: '2026-07-21T12:34:56.000Z' },
        { headers: { 'Content-Type': 'application/json' } },
      );

    expect(result?.createdAt).toEqual(new Date('2026-07-21T12:34:56.000Z'));
  });
});
