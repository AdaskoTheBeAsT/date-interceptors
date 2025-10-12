import {
  HTTP_INTERCEPTORS,
  HttpClient,
  HttpContext,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ClassTransformerHttpInterceptor } from './class-transformer-http.interceptor';
import { ClassTransformerSerializeInterceptor } from './class-transformer-serialize.interceptor';
import { RESPONSE_TYPE_CLASS } from './tokens';

class CloningHeaderInterceptor implements HttpInterceptor {
  intercept(req: HttpRequest<unknown>, next: HttpHandler) {
    // Force a clone before ClassTransformer runs
    const cloned = req.clone({ setHeaders: { 'X-Clone': '1' } });
    return next.handle(cloned);
  }
}

class PetDto {
  kind!: string;
  isCat() {
    return this.kind.toLowerCase() === 'cat';
  }
}

describe('ClassTransformerHttpInterceptor with prior cloning interceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
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
          useClass: CloningHeaderInterceptor,
          multi: true,
        },
        {
          provide: HTTP_INTERCEPTORS,
          useClass: ClassTransformerHttpInterceptor,
          multi: true,
        },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('preserves context and transforms response', (done) => {
    const ctx = new HttpContext().set(RESPONSE_TYPE_CLASS, PetDto);

    http
      .get<PetDto>('/api/pet/1', { context: ctx })
      .subscribe((pet: PetDto) => {
        expect(pet instanceof PetDto).toBe(true);
        expect(pet.isCat()).toBe(true);
        done();
      });

    const req = httpMock.expectOne('/api/pet/1');
    expect(req.request.headers.get('X-Clone')).toBe('1'); // sanity check: our first interceptor ran
    req.flush({ kind: 'Cat' });
  });
});
