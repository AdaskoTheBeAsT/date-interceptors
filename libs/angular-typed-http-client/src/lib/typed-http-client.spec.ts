import 'reflect-metadata';

import {
  HTTP_INTERCEPTORS,
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Transform } from 'class-transformer';

import { ClassTransformerHttpInterceptor } from './class-transformer-http.interceptor';
import { ClassTransformerSerializeInterceptor } from './class-transformer-serialize.interceptor';
import { TypedHttpClient } from './typed-http-client';

describe('TypedHttpClient', () => {
  let typedHttpClient: TypedHttpClient;
  let httpTestingController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [],
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
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

    typedHttpClient = TestBed.inject(TypedHttpClient);
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTestingController.verify(); // Verify that no unmatched requests are outstanding
  });

  it('should transform data when invoking get', (done) => {
    const testData = { key: 'value', date: '2023-07-22T16:08:00.000Z' };

    typedHttpClient.get('/data', OutputDto).subscribe((data) => {
      // Ensure data is not null
      expect(data).toBeTruthy();

      if (data) {
        expect(data instanceof OutputDto).toBeTruthy();
        expect(data.key).toEqual(testData.key);
        expect(data.date).toEqual(new Date(testData.date));
      }

      done();
    });

    const req = httpTestingController.expectOne('/data');

    req.flush(testData);
  });
});

class OutputDto {
  key: string | null = null;

  @Transform(({ value }) => new Date(value), { toClassOnly: true })
  @Transform(({ value }) => value?.toString(), { toPlainOnly: true })
  date: Date | null = null;
}
