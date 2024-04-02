import 'reflect-metadata';

import {
  HTTP_INTERCEPTORS,
  HttpClient,
  HttpResponse,
} from '@angular/common/http';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Transform, Type } from 'class-transformer';

import { ClassTransformerHttpInterceptor } from './class-transformer-http-interceptor';
import { TypedHttpRequest } from './typed-http-request';

describe('ClassTransformerHttpInterceptor', () => {
  let httpClient: HttpClient;
  let httpTestingController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        {
          provide: HTTP_INTERCEPTORS,
          useClass: ClassTransformerHttpInterceptor,
          multi: true,
        },
      ],
    });

    httpClient = TestBed.inject(HttpClient);
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTestingController.verify(); // Verify that no unmatched requests are outstanding
  });

  it('should transform data using plainToInstance', (done) => {
    const testData = { key: 'value', date: '2023-07-22T16:08:00.000Z' };
    const httpRequest = new TypedHttpRequest<unknown, OutputDto>(
      'GET',
      '/data',
      { responseTypeClass: OutputDto },
    );

    httpClient.request<OutputDto>(httpRequest).subscribe((event) => {
      if (event instanceof HttpResponse) {
        // Now data is of type OutputDto | null
        const data = event.body;

        // Ensure data is not null
        expect(data).toBeTruthy();

        if (data) {
          expect(data instanceof OutputDto).toBeTruthy();
          expect(data.key).toEqual(testData.key);
          expect(data.date).toEqual(new Date(testData.date));
        }

        done();
      }
    });

    const req = httpTestingController.expectOne('/data');

    req.flush(testData);
  });
});

class OutputDto {
  key: string | null = null;

  @Type(() => Date)
  @Transform(({ value }) => new Date(value), { toClassOnly: true })
  @Transform(({ value }) => value.toString(), { toPlainOnly: true })
  date: Date | null = null;
}
