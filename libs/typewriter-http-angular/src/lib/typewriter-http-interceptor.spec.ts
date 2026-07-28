import {
  HttpClient,
  HttpContext,
  HttpContextToken,
  HttpDownloadProgressEvent,
  HttpEvent,
  HttpEventType,
  HttpResponse,
  provideHttpClient,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  defineTypeRegistry,
  schema,
} from '@adaskothebeast/typewriter-schema';
import Decimal from 'decimal.js';
import { parse as parseUuid, v4 as uuidV4 } from 'uuid';

import { withTypewriterHttpInterceptor } from './provide-typewriter-http';
import {
  TYPEWRITER_REQUEST_SCHEMA,
  TYPEWRITER_RESPONSE_SCHEMA,
  TYPEWRITER_SERIALIZE_OPTIONS,
  TYPEWRITER_SCHEMA_REGISTRY,
  TYPEWRITER_TRANSFORM_OPTIONS,
  withTypewriterRequestSchema,
  withTypewriterResponseSchema,
} from './typewriter-http-context';

describe('typewriterHttpInterceptor', () => {
  let http: HttpClient;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withTypewriterHttpInterceptor()),
        provideHttpClientTesting(),
      ],
    });

    http = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('hydrates response bodies using request schema metadata', () => {
    const invoiceSchema = schema.object({
      amount: schema.property(schema.decimal('string')),
    });
    const registry = defineTypeRegistry({ Invoice: invoiceSchema });
    const context = withTypewriterResponseSchema(
      schema.reference('Invoice'),
      { registry },
    );
    let result: { amount: { toString(): string } } | undefined;

    http
      .get<{ amount: { toString(): string } }>('/invoice', { context })
      .subscribe((body) => {
        result = body;
      });

    httpTesting.expectOne('/invoice').flush({ amount: '123.45' });

    expect(result?.amount.constructor.name).toBe('Decimal');
    expect(result?.amount.toString()).toBe('123.45');
  });

  it('passes response bodies through when no schema is present', () => {
    const body = { amount: '123.45' };
    let result: unknown;

    http.get('/passthrough').subscribe((value) => {
      result = value;
    });

    httpTesting.expectOne('/passthrough').flush(body);

    expect(result).toBe(body);
  });

  it('preserves a supplied context while attaching schema metadata', () => {
    const marker = new HttpContextToken(() => 'missing');
    const existingContext = new HttpContext().set(marker, 'preserved');
    const responseSchema = schema.decimal('string');
    const registry = defineTypeRegistry({});
    const transformOptions = { strict: true } as const;

    const context = withTypewriterResponseSchema(responseSchema, {
      context: existingContext,
      registry,
      transformOptions,
    });

    expect(context).toBe(existingContext);
    expect(context.get(marker)).toBe('preserved');
    expect(context.get(TYPEWRITER_RESPONSE_SCHEMA)).toBe(responseSchema);
    expect(context.get(TYPEWRITER_SCHEMA_REGISTRY)).toBe(registry);
    expect(context.get(TYPEWRITER_TRANSFORM_OPTIONS)).toBe(transformOptions);
  });

  it('passes non-response events through unchanged', () => {
    const context = withTypewriterResponseSchema(
      schema.decimal('string'),
    );
    const events: HttpEvent<unknown>[] = [];

    http
      .get('/progress', {
        context,
        observe: 'events',
        reportProgress: true,
      })
      .subscribe((event) => {
        events.push(event);
      });

    const request = httpTesting.expectOne('/progress');
    const progress: HttpDownloadProgressEvent = {
      type: HttpEventType.DownloadProgress,
      loaded: 5,
      total: 10,
    };

    request.event(progress);
    request.flush('6.25');

    expect(events).toContain(progress);

    const response = events.find(
      (event): event is HttpResponse<unknown> =>
        event instanceof HttpResponse,
    );

    expect(response).toBeDefined();
    expect(
      (response?.body as { constructor: { name: string } }).constructor.name,
    ).toBe('Decimal');
    expect(String(response?.body)).toBe('6.25');
  });

  it('serializes request bodies using request schema metadata', () => {
    const id = uuidV4();
    const requestSchema = schema.object({
      id: schema.property(schema.uuid()),
      amount: schema.property(schema.decimal<Decimal>('string')),
      displayName: schema.property(schema.string(), 'display_name'),
    });
    const context = withTypewriterRequestSchema(requestSchema);

    http
      .post('/invoice', {
        id: parseUuid(id),
        amount: new Decimal('42.75'),
        displayName: 'Invoice',
      }, { context })
      .subscribe();

    const request = httpTesting.expectOne('/invoice');

    expect(request.request.body).toEqual({
      id,
      amount: '42.75',
      display_name: 'Invoice',
    });

    request.flush({});
  });

  it('preserves request serialization metadata on an existing context', () => {
    const marker = new HttpContextToken(() => 'missing');
    const existingContext = new HttpContext().set(marker, 'preserved');
    const requestSchema = schema.decimal<Decimal>('string');
    const registry = defineTypeRegistry({});
    const serializeOptions = { strict: true } as const;

    const context = withTypewriterRequestSchema(requestSchema, {
      context: existingContext,
      registry,
      serializeOptions,
    });

    expect(context).toBe(existingContext);
    expect(context.get(marker)).toBe('preserved');
    expect(context.get(TYPEWRITER_REQUEST_SCHEMA)).toBe(requestSchema);
    expect(context.get(TYPEWRITER_SCHEMA_REGISTRY)).toBe(registry);
    expect(context.get(TYPEWRITER_SERIALIZE_OPTIONS)).toBe(serializeOptions);
  });
});
