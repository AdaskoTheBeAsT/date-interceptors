import {
  JsonSerializationError,
  JsonTransformationError,
} from '@adaskothebeast/typewriter-runtime';
import type { SchemaDescriptor } from '@adaskothebeast/typewriter-runtime';
import { defineTypeRegistry, schema } from '@adaskothebeast/typewriter-schema';
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
import Decimal from 'decimal.js';
import { parse as parseUuid, v4 as uuidV4 } from 'uuid';

import { withTypewriterHttpInterceptor } from './provide-typewriter-http';
import {
  TYPEWRITER_REQUEST_REGISTRY,
  TYPEWRITER_REQUEST_SCHEMA,
  TYPEWRITER_RESPONSE_REGISTRY,
  TYPEWRITER_RESPONSE_SCHEMA,
  TYPEWRITER_SCHEMA_REGISTRY,
  TYPEWRITER_SERIALIZE_OPTIONS,
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
    const context = withTypewriterResponseSchema(schema.reference('Invoice'), {
      registry,
    });
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
    expect(context.get(TYPEWRITER_RESPONSE_REGISTRY)).toBe(registry);
    expect(context.get(TYPEWRITER_SCHEMA_REGISTRY)).toBeUndefined();
    expect(context.get(TYPEWRITER_TRANSFORM_OPTIONS)).toBe(transformOptions);
  });

  it('passes non-response events through unchanged', () => {
    const context = withTypewriterResponseSchema(schema.decimal('string'));
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
      (event): event is HttpResponse<unknown> => event instanceof HttpResponse,
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
      .post(
        '/invoice',
        {
          id: parseUuid(id),
          amount: new Decimal('42.75'),
          displayName: 'Invoice',
        },
        { context },
      )
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
    expect(context.get(TYPEWRITER_REQUEST_REGISTRY)).toBe(registry);
    expect(context.get(TYPEWRITER_SERIALIZE_OPTIONS)).toBe(serializeOptions);
  });

  it('keeps separate registries when both schema helpers share a context', () => {
    const requestRegistry = defineTypeRegistry({ Amount: amountSchema });
    const responseRegistry = defineTypeRegistry({
      Amount: schema.object<{ amount: Decimal }>({
        amount: schema.property(schema.decimal<Decimal>('string'), 'total'),
      }),
    });
    const context = withTypewriterResponseSchema(schema.reference('Amount'), {
      registry: responseRegistry,
      context: withTypewriterRequestSchema(schema.reference('Amount'), {
        registry: requestRegistry,
      }),
    });
    let result: { amount: Decimal } | undefined;

    http
      .post<{ amount: Decimal }>(
        '/amount',
        { amount: new Decimal('1.5') },
        { context },
      )
      .subscribe((body) => {
        result = body;
      });

    const request = httpTesting.expectOne('/amount');
    expect(request.request.body).toEqual({ amount: '1.5' });
    request.flush({ total: '2.5' });

    expect(result?.amount).toBeInstanceOf(Decimal);
    expect(result?.amount.toString()).toBe('2.5');
  });

  it('falls back to the shared registry token', () => {
    const registry = defineTypeRegistry({ Amount: amountSchema });
    const context = withTypewriterResponseSchema(schema.reference('Amount'), {
      context: withTypewriterRequestSchema(schema.reference('Amount')).set(
        TYPEWRITER_SCHEMA_REGISTRY,
        registry,
      ),
    });
    let result: { amount: Decimal } | undefined;

    http
      .post<{ amount: Decimal }>(
        '/amount',
        { amount: new Decimal('3') },
        { context },
      )
      .subscribe((body) => {
        result = body;
      });

    const request = httpTesting.expectOne('/amount');
    expect(request.request.body).toEqual({ amount: '3' });
    request.flush({ amount: '4' });

    expect(result?.amount).toBeInstanceOf(Decimal);
  });

  it('accepts plain schema descriptors', () => {
    const descriptor: SchemaDescriptor<Decimal> = {
      kind: 'decimal',
      wireType: 'string',
    };
    let result: unknown;

    http
      .get('/amount', { context: withTypewriterResponseSchema(descriptor) })
      .subscribe((body) => {
        result = body;
      });

    httpTesting.expectOne('/amount').flush('5.5');

    expect(result).toBeInstanceOf(Decimal);
  });

  it('hydrates a copy and leaves the downstream body untouched', () => {
    const body = { amount: '6.5' };
    let result: { amount: Decimal } | undefined;

    http
      .get<{ amount: Decimal }>('/amount', {
        context: withTypewriterResponseSchema(amountSchema),
      })
      .subscribe((value) => {
        result = value;
      });

    httpTesting.expectOne('/amount').flush(body);

    expect(result?.amount).toBeInstanceOf(Decimal);
    expect(body).toEqual({ amount: '6.5' });
  });

  it('is strict by default for responses', () => {
    let error: unknown;

    http
      .get('/amount', { context: withTypewriterResponseSchema(amountSchema) })
      .subscribe({
        error: (failure: unknown) => {
          error = failure;
        },
      });

    httpTesting.expectOne('/amount').flush({ amount: 'invalid' });

    expect(error).toBeInstanceOf(JsonTransformationError);
  });

  it('preserves invalid responses when strictness is disabled', () => {
    let result: unknown;

    http
      .get('/amount', {
        context: withTypewriterResponseSchema(amountSchema, {
          transformOptions: { strict: false },
        }),
      })
      .subscribe((value) => {
        result = value;
      });

    httpTesting.expectOne('/amount').flush({ amount: 'invalid' });

    expect(result).toEqual({ amount: 'invalid' });
  });

  it('is strict by default for request bodies', () => {
    let error: unknown;

    http
      .post(
        '/amount',
        { amount: 'invalid' },
        { context: withTypewriterRequestSchema(amountSchema) },
      )
      .subscribe({
        error: (failure: unknown) => {
          error = failure;
        },
      });

    httpTesting.expectNone('/amount');
    expect(error).toBeInstanceOf(JsonSerializationError);
  });

  it('skips serialization for requests without a body', () => {
    http
      .get('/amount', { context: withTypewriterRequestSchema(amountSchema) })
      .subscribe();

    const request = httpTesting.expectOne('/amount');
    expect(request.request.body).toBeNull();
    request.flush({});
  });

  it.each([
    [204, null],
    [205, null],
    [200, null],
    [200, ''],
    [200, '  '],
  ])('skips hydration for a %s response with body %p', (status, body) => {
    let result: unknown = 'unset';

    http
      .get('/empty', { context: withTypewriterResponseSchema(amountSchema) })
      .subscribe((value) => {
        result = value;
      });

    httpTesting
      .expectOne('/empty')
      .flush(body, { status, statusText: 'Empty' });

    expect(result).toBe(body);
  });

  it('skips hydration for non-JSON response types', () => {
    let result: unknown;

    http
      .get('/text', {
        context: withTypewriterResponseSchema(amountSchema),
        responseType: 'text',
      })
      .subscribe((value) => {
        result = value;
      });

    httpTesting.expectOne('/text').flush('plain text');

    expect(result).toBe('plain text');
  });
});

const amountSchema = schema.object<{ amount: Decimal }>({
  amount: schema.property(schema.decimal<Decimal>('string')),
});
