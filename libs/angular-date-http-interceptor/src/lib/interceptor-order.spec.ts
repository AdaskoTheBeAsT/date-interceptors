import 'reflect-metadata';

import {
  ClassTransformerHttpInterceptor,
  TypedHttpClient,
  withTypedHttpClient,
} from '@adaskothebeast/angular-typed-http-client';
import { hierarchicalConvertToDate } from '@adaskothebeast/hierarchical-convert-to-date';
import {
  HTTP_INTERCEPTORS,
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { EnvironmentProviders, Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { HierarchicalDateHttpInterceptor } from './hierarchical-date-http-interceptor';
import {
  provideHierarchicalDateConverter,
  withHierarchicalDateHttpInterceptor,
} from './with-hierarchical-date-http-interceptor';

class EventDto {
  name!: string;
  startsAt!: Date;
  year(): number {
    return this.startsAt.getUTCFullYear();
  }
}

const classInterceptor: Provider = {
  provide: HTTP_INTERCEPTORS,
  useClass: ClassTransformerHttpInterceptor,
  multi: true,
};
const dateInterceptor: Provider = {
  provide: HTTP_INTERCEPTORS,
  useClass: HierarchicalDateHttpInterceptor,
  multi: true,
};

async function fetchEvent(providers: (Provider | EnvironmentProviders)[]) {
  TestBed.configureTestingModule({
    providers: [...providers, provideHttpClientTesting()],
  });
  const result = firstValueFrom(
    TestBed.inject(TypedHttpClient).get('/event', EventDto),
  );
  TestBed.inject(HttpTestingController)
    .expectOne('/event')
    .flush(
      { name: 'launch', startsAt: '2026-07-21T12:34:56.000Z' },
      { headers: { 'Content-Type': 'application/json' } },
    );
  return result;
}

describe('date interceptor combined with class-transformer hydration', () => {
  describe.each([
    [
      'functional features',
      () => [
        provideHttpClient(
          withTypedHttpClient(),
          withHierarchicalDateHttpInterceptor(hierarchicalConvertToDate),
        ),
      ],
    ],
    [
      'DI interceptors',
      () => [
        provideHttpClient(withInterceptorsFromDi()),
        provideHierarchicalDateConverter(hierarchicalConvertToDate),
        classInterceptor,
        dateInterceptor,
      ],
    ],
  ])(
    'documented order: typed client first, date interceptor second (%s)',
    (_, providers) => {
      it('keeps class instances and converts their dates', async () => {
        const event = await fetchEvent(providers());
        expect(event).toBeInstanceOf(EventDto);
        expect(event.startsAt).toBeInstanceOf(Date);
        expect(event.year()).toBe(2026);
      });
    },
  );

  describe.each([
    [
      'functional features',
      () => [
        provideHttpClient(
          withHierarchicalDateHttpInterceptor(hierarchicalConvertToDate),
          withTypedHttpClient(),
        ),
      ],
    ],
    [
      'DI interceptors',
      () => [
        provideHttpClient(withInterceptorsFromDi()),
        provideHierarchicalDateConverter(hierarchicalConvertToDate),
        dateInterceptor,
        classInterceptor,
      ],
    ],
  ])('reversed order (%s)', (_, providers) => {
    it('loses class prototypes because the date interceptor clones hydrated instances', async () => {
      const event = await fetchEvent(providers());
      expect(event).not.toBeInstanceOf(EventDto);
      expect(event.startsAt).toBeInstanceOf(Date);
    });
  });
});
