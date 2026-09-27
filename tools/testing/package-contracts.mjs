import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';

// Angular's partially compiled libraries need the compiler in a plain Node consumer.
await import('@angular/compiler');
const packages = JSON.parse(
  readFileSync(new URL('./packages.json', import.meta.url)),
);
const imported = new Map();
for (const name of packages) {
  imported.set(name, await import(name));
}

const cases = [
  ['date', 'hierarchicalConvertToDate', (value) => value.toISOString()],
  ['date-fns', 'hierarchicalConvertToDateFns', (value) => value.toISOString()],
  ['dayjs', 'hierarchicalConvertToDayjs', (value) => value.toISOString()],
  ['moment', 'hierarchicalConvertToMoment', (value) => value.toISOString()],
  ['luxon', 'hierarchicalConvertToLuxon', (value) => value.toUTC().toISO()],
  [
    'js-joda',
    'hierarchicalConvertToJsJoda',
    (value) => value.toInstant().toString(),
  ],
  ['temporal', 'hierarchicalConvertToTemporal', (value) => value.toString()],
];
const stringDurations = {
  'PT1.5S': 'string',
  'PT1,5S': 'string',
  P1Y2W: 'string',
  'PT0.123456789S': 'string',
  P99999999999999999999Y: 'string',
};
const durationContract = {
  date: stringDurations,
  'js-joda': stringDurations,
  'date-fns': {
    'PT1.5S': { milliseconds: 1500, iso: 'PT1.5S' },
    'PT1,5S': { milliseconds: 1500, iso: 'PT1.5S' },
    P1Y2W: { iso: 'P1Y2W' },
    'PT0.123456789S': { iso: 'PT0.123456789S' },
    P99999999999999999999Y: {},
  },
  dayjs: {
    'PT1.5S': { milliseconds: 1500, iso: 'PT1.5S' },
    'PT1,5S': { milliseconds: 1500, iso: 'PT1.5S' },
    P1Y2W: { milliseconds: 32745600000, iso: 'P1Y14D' },
    'PT0.123456789S': { iso: 'PT0.123456789S' },
    P99999999999999999999Y: {},
  },
  moment: {
    'PT1.5S': { milliseconds: 1500, iso: 'PT1.5S' },
    'PT1,5S': { milliseconds: 1500, iso: 'PT1.5S' },
    P1Y2W: { milliseconds: 32745600000, iso: 'P1Y14D' },
    'PT0.123456789S': { iso: 'PT0.123S' },
    P99999999999999999999Y: {},
  },
  luxon: {
    'PT1.5S': { milliseconds: 1500, iso: 'PT1.5S' },
    'PT1,5S': { milliseconds: 1500, iso: 'PT1.5S' },
    P1Y2W: { milliseconds: 32745600000, iso: 'P1Y2W' },
    'PT0.123456789S': { iso: 'PT0.123S' },
    P99999999999999999999Y: {},
  },
  temporal: {
    'PT1.5S': { milliseconds: 1500, iso: 'PT1.5S' },
    'PT1,5S': { milliseconds: 1500, iso: 'PT1.5S' },
    P1Y2W: { iso: 'P1Y2W' },
    'PT0.123456789S': { iso: 'PT0.123456789S' },
    P99999999999999999999Y: 'string',
  },
};

function durationMilliseconds(backend, value) {
  switch (backend) {
    case 'moment':
    case 'dayjs':
      return value.asMilliseconds();
    case 'luxon':
      return value.as('milliseconds');
    case 'temporal':
      return value.total('milliseconds');
    default:
      return ((value.hours * 60 + value.minutes) * 60 + value.seconds) * 1000;
  }
}

function durationIso(backend, value) {
  switch (backend) {
    case 'moment':
    case 'dayjs':
      return value.toISOString();
    case 'luxon':
      return value.toISO();
    case 'temporal':
      return value.toString();
    default: {
      const part = (units) =>
        units
          .filter(([key]) => value[key] !== 0)
          .map(([key, suffix]) => `${value[key]}${suffix}`)
          .join('');
      const date = part([
        ['years', 'Y'],
        ['months', 'M'],
        ['weeks', 'W'],
        ['days', 'D'],
      ]);
      const time = part([
        ['hours', 'H'],
        ['minutes', 'M'],
        ['seconds', 'S'],
      ]);
      return `P${date}${time === '' ? '' : `T${time}`}`;
    }
  }
}

for (const [backend, fn, toIso] of cases) {
  const convert = imported.get(
    `@adaskothebeast/hierarchical-convert-to-${backend}`,
  )[fn];
  const highPrecision = backend === 'temporal' || backend === 'js-joda';
  for (const wire of [
    '2024-02-29T12:34:56Z',
    '2024-02-29T12:34:56.1Z',
    '2024-02-29T12:34:56.1234567Z',
    '2024-02-29T12:34:56.123456789+02:30',
  ]) {
    const data = { value: wire };
    convert(data);
    assert.notEqual(
      typeof data.value,
      'string',
      `${backend}: ${wire} must convert`,
    );
    assert.equal(
      new Date(toIso(data.value)).getTime(),
      new Date(wire).getTime(),
      `${backend}: instant must match`,
    );
    if (wire.includes('.1234567')) {
      assert.ok(
        toIso(data.value).includes(highPrecision ? '.1234567' : '.123'),
        `${backend}: precision contract`,
      );
    }
  }
  for (const wire of [
    '2023-02-29T00:00:00Z',
    '2024-02-30T00:00:00Z',
    '1900-02-29T00:00:00Z',
    '2024-04-31T00:00:00Z',
    '2024-01-01T24:00:00Z',
    '2024-01-01T00:60:00Z',
    '2024-01-01T00:00:60Z',
    '2024-01-01T00:00:00+24:00',
    '2024-01-01T00:00:00.1234567890Z',
    'PT',
    'P',
    'P1DT',
  ]) {
    const data = { value: wire };
    convert(data);
    assert.equal(
      data.value,
      wire,
      `${backend}: invalid ${wire} must remain unchanged`,
    );
  }
  const local = { value: '2024-01-15T12:34:56' };
  convert(local);
  if (backend === 'js-joda') {
    assert.equal(local.value, '2024-01-15T12:34:56');
  } else if (backend === 'temporal') {
    assert.equal(local.value.toString(), '2024-01-15T12:34:56');
  } else {
    assert.equal(
      new Date(toIso(local.value)).getTime(),
      new Date(2024, 0, 15, 12, 34, 56).getTime(),
      `${backend}: local timezone`,
    );
  }
  for (const wire of ['PT0S', 'P1DT2H3M4S', 'PT1.5S']) {
    const data = { value: wire };
    convert(data);
    const supportsDurations = backend !== 'date' && backend !== 'js-joda';
    assert.equal(
      typeof data.value === 'object',
      supportsDurations,
      `${backend}: duration ${wire}`,
    );
  }
  // Documented per-backend duration precision table (docs/conversion-contract.md).
  const durationExpectations = durationContract[backend];
  for (const [wire, expected] of Object.entries(durationExpectations)) {
    const data = { value: wire };
    convert(data);
    if (expected === 'string') {
      assert.equal(data.value, wire, `${backend}: ${wire} must stay a string`);
      continue;
    }
    assert.equal(typeof data.value, 'object', `${backend}: ${wire} converts`);
    if (expected.milliseconds !== undefined) {
      assert.equal(
        durationMilliseconds(backend, data.value),
        expected.milliseconds,
        `${backend}: ${wire} magnitude`,
      );
    }
    if (expected.iso !== undefined) {
      assert.equal(
        durationIso(backend, data.value),
        expected.iso,
        `${backend}: ${wire} components`,
      );
    }
  }
  const child = { value: '2024-02-29T12:34:56Z' };
  const negative = { value: '-PT1.5S' };
  convert(negative);
  if (backend === 'moment') {
    assert.equal(negative.value.asMilliseconds(), -1500);
  } else if (backend === 'luxon') {
    assert.equal(negative.value.as('milliseconds'), -1500);
  } else if (backend === 'temporal') {
    assert.equal(negative.value.total('milliseconds'), -1500);
  } else {
    assert.equal(negative.value, '-PT1.5S');
  }
  const graph = { a: child, b: child, array: [child], self: null };
  graph.self = graph;
  convert(graph);
  assert.equal(graph.self, graph);
  assert.equal(graph.a, graph.b);
  assert.equal(graph.array[0], graph.a);
  assert.notEqual(typeof child.value, 'string');
}

const { schema } = imported.get('@adaskothebeast/typewriter-schema');
const { transformJson, serializeJson } = imported.get(
  '@adaskothebeast/typewriter-runtime',
);
const swapped = schema.object({
  a: schema.property(schema.string(), 'b'),
  b: schema.property(schema.string(), 'a'),
});
const model = transformJson({ a: 'A', b: 'B' }, swapped, undefined, {
  strict: true,
});
assert.deepEqual(model, { a: 'B', b: 'A' });
assert.deepEqual(serializeJson(model, swapped, undefined, { strict: true }), {
  a: 'A',
  b: 'B',
});
assert.throws(() => transformJson({}, swapped, undefined, { strict: true }));

const shared = { raw: 'value' };
const hydrated = transformJson(
  [shared, shared],
  schema.array(schema.custom('replace')),
  undefined,
  {
    strict: true,
    transformers: { replace: (value) => ({ hydrated: value.raw }) },
  },
);
assert.deepEqual(hydrated, [{ hydrated: 'value' }, { hydrated: 'value' }]);
assert.equal(hydrated[0], hydrated[1]);
const loop = schema.reference('Loop');
for (const convert of [transformJson, serializeJson]) {
  assert.throws(
    () =>
      convert(
        'value',
        loop,
        { Loop: loop },
        {
          strict: true,
          maxDepth: 2,
        },
      ),
    /Circular schema reference at \$/,
  );
}

const { fetchJson, serializeJsonBody } = imported.get(
  '@adaskothebeast/typewriter-http-fetch',
);
assert.throws(
  () => serializeJsonBody(undefined, schema.optional(schema.string())),
  TypeError,
);
for (const status of [200, 204, 205]) {
  assert.equal(
    await fetchJson('/empty', schema.string(), undefined, {
      fetch: async () => new Response(null, { status }),
    }),
    undefined,
  );
}
const { isProblemDetailsError } = imported.get(
  '@adaskothebeast/hierarchical-convert-core',
);
const problemBody = {
  title: 'Validation failed',
  status: 400,
  errors: { field: ['required'] },
  traceId: 'trace',
  timestamp: '2026-01-01T00:00:00Z',
};
const problemServer = createServer((request, response) => {
  const url = new URL(request.url, 'http://localhost');
  response.writeHead(Number(url.searchParams.get('status')), {
    'content-type': 'application/problem+json; charset=utf-8',
  });
  response.end(JSON.stringify(problemBody));
});
await new Promise((resolve, reject) => {
  problemServer.once('error', reject);
  problemServer.listen(0, '127.0.0.1', resolve);
});
try {
  const baseUrl = `http://127.0.0.1:${problemServer.address().port}`;
  const axios = (await import('axios')).default;
  const { fetchBaseQuery } = await import('@reduxjs/toolkit/query');
  const { withHierarchicalDateConversion } = imported.get(
    '@adaskothebeast/react-redux-toolkit-hierarchical-date-hook',
  );
  const { AxiosInstanceManager } = imported.get(
    '@adaskothebeast/axios-interceptor',
  );
  const { installTypewriterAxiosInterceptor } = imported.get(
    '@adaskothebeast/typewriter-http-axios',
  );
  const forbidConversion = () => {
    throw new Error('Problem entered success conversion');
  };
  for (const status of [200, 422, 500]) {
    const url = `${baseUrl}/?status=${status}`;
    for (const library of [
      'hierarchical-convert-to-date',
      'typewriter-http-fetch',
    ]) {
      const module = imported.get(`@adaskothebeast/${library}`);
      const call =
        library === 'typewriter-http-fetch'
          ? module.fetchJson(url, schema.string(), undefined, {
              transformOptions: { strict: true },
            })
          : module.fetchJson(url);
      const error = await call.catch((failure) => failure);
      assert.ok(isProblemDetailsError(error));
      assert.equal(error.httpStatus, status);
      assert.deepEqual(error.problem.errors, problemBody.errors);
      assert.deepEqual(await error.response.json(), problemBody);
    }
    for (const multiple of [false, true]) {
      const client = multiple
        ? AxiosInstanceManager.createInstanceWithMultipleInterceptors([
            forbidConversion,
          ])
        : AxiosInstanceManager.createInstance(forbidConversion);
      const error = await client
        .get(url, { proxy: false })
        .catch((failure) => failure);
      assert.ok(axios.isAxiosError(error) && isProblemDetailsError(error));
      assert.equal(error.httpStatus, status);
      assert.deepEqual(error.response.data, problemBody);
    }
    for (const acceptErrors of [false, true]) {
      const client = axios.create({
        proxy: false,
        ...(acceptErrors ? { validateStatus: () => true } : {}),
      });
      installTypewriterAxiosInterceptor(client);
      const error = await client
        .get(url, {
          responseSchema: schema.string(),
          responseTransformOptions: { strict: true },
        })
        .catch((failure) => failure);
      assert.ok(axios.isAxiosError(error) && isProblemDetailsError(error));
      assert.equal(error.httpStatus, status);
      assert.deepEqual(error.response.data, problemBody);
    }
    const baseQuery = withHierarchicalDateConversion(
      fetchBaseQuery({ baseUrl }),
      forbidConversion,
    );
    const controller = new AbortController();
    const result = await baseQuery(
      `/?status=${status}`,
      {
        signal: controller.signal,
        abort: () => controller.abort(),
        getState: () => ({}),
        extra: undefined,
        endpoint: 'problem',
        type: 'query',
      },
      {},
    );
    assert.ok(isProblemDetailsError(result.error));
    assert.equal(result.error.status, status);
    assert.deepEqual(result.error.data, problemBody);
    assert.deepEqual(JSON.parse(JSON.stringify(result.error)), result.error);
  }
} finally {
  const closed = new Promise((resolve, reject) =>
    problemServer.close((error) => (error ? reject(error) : resolve())),
  );
  problemServer.closeAllConnections();
  await closed;
}
console.log(
  `All ${packages.length} package imports and runtime contracts passed in ${process.env.TZ}.`,
);
