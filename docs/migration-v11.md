# Migrating to 11.0.0

All 19 libraries share version 11.0.0. Upgrade internal packages together.
This guide describes local source changes; it does not mean v11 is published.

## Packaging

- Non-Angular packages provide ESM and CommonJS, with separate `.d.ts` and
  `.d.cts` declarations. Angular packages retain Angular Package Format.
- Import from the public package name. New `exports` maps intentionally block
  undocumented deep imports. `package.json` remains exported.
- Non-Angular packages require Node 22.12 or newer. Angular packages follow
  Angular 22's Node range: `^22.22.3 || ^24.15.0 || >=26.0.0`.
- Angular peers accept `^22.0.0`; RxJS peers accept `^7.8.0`.
- Typewriter HTTP adapters use a peer dependency on `typewriter-runtime`.
  Install it explicitly when using a package manager that does not install peers.
- Standalone converters no longer require the typewriter runtime just for backend
  types. `DateBackend`, `DateCodec`, and `DateSchemaKind` live in core and are
  still re-exported from typewriter-runtime.

## Converters

- Converter functions now take only the value to convert. Remove the old internal
  `depth` and `visited` arguments.
- Traversal only enters arrays and plain objects, including null-prototype and
  cross-realm JSON objects. Class instances and previously converted values are
  left alone. Frozen/non-writable string properties and accessors are skipped.
- Day.js heuristic timestamps always use local mode, including timestamps ending
  in `Z`. Their instant is unchanged. Call `.utc()` explicitly if needed.
- See [the conversion contract](conversion-contract.md) for precision, timezone,
  negative-duration, and unsupported-value behavior.

## Typewriter

- HTTP adapters default to strict validation in both directions. Use
  `transformOptions: { strict: false }` or
  `serializeOptions: { strict: false }` to retain tolerant behavior. Direct
  runtime calls keep their existing default.
- Schema normalization is shared between serialization and hydration. Descriptor
  objects and lazy factories are cached, so do not mutate schemas after first use.
- Schema registries no longer resolve inherited members such as `toString`.
  In a shared schema/codec registry, bare functions mean lazy schemas. Put
  codec functions in explicit `transformers`/`serializers` collections or use
  codec objects with `transform`/`serialize`.
- Custom codec `context.transform` and `context.serialize` calls advance
  `maxDepth`; pass a child path segment for precise errors.
- Invalid UUID byte arrays cannot silently pass through tolerant serialization
  as JSON objects.
- Axios uses `config.typewriter` with `requestSchema`, `responseSchema`,
  `registry`, `requestRegistry`, `responseRegistry`, `transformOptions`, and
  `serializeOptions`. Older top-level aliases remain deprecated.
- Axios adds `requestWithSchemas` and `requestWithResponseSchema`.
  The old `requestWithSchema` remains a deprecated response-only alias.
- Fetch adds `sendJson` for schema-guided request/response handling.
  Invalid JSON throws `TypewriterJsonParseError` with `body`, `response`, and
  `cause`; empty successful responses return `undefined`.
- Angular keeps request and response registries separate and hydrates a clone
  to avoid changing the downstream response or transfer cache. Empty responses
  and non-JSON response types bypass schema transformation.

## Framework adapters

- Axios heuristic conversion skips binary, stream, and explicit text responses.
  `AxiosInstanceManager` accepts Axios creation options.
  `attachHierarchicalConverter(instance, converter)` returns an eject function.
- Angular date conversion respects JSON response types and accepts `+json`.
  Supply a converter through `withHierarchicalDateHttpInterceptor(converter)`.
- Prefer `provideHttpClient(withFetch(), withTypedHttpClient())` for the typed
  Angular client. The old provider and NgModule remain deprecated.
  Use `TypedHttpClient.getArray` for array responses.
- With both class transformation and date conversion, register the typed-client
  feature **before** the date feature. Responses run through interceptors in
  reverse order, so date conversion occurs before class instantiation.
- Typed request serialization preserves strings and ArrayBuffer views. Import
  `reflect-metadata` before using class-transformer's `@Type` decorators.
- The React hook converts both `data` and `currentData` without modifying Redux
  state. Keep converters stable to preserve memoization.
- RTK endpoint transforms no longer throw Problem Details errors. Use
  `withHierarchicalDateConversion` to receive structured query errors. The wrapper
  preserves `PARSING_ERROR` and exposes numeric `httpStatus`.
- Dates in RTK cache state need `hierarchicalDateSerializableCheck(api.reducerPath)`
  in the store's `serializableCheck` settings. Prefer the hook if the store must
  remain serializable.

## Release procedure

1. Use the workspace version command for subsequent versions:
   `yarn release:version <version> --dry-run` first, then without `--dry-run`
   when ready. Review all source-manifest and internal dependency changes.
2. Run `yarn check-versions v<version>`, `yarn test:tools`,
   `yarn build:all`, `yarn typecheck`, `yarn test:all`, `yarn lint:ci:all`,
   `yarn test:packages`, and `yarn test:packages:minimum`.
3. Commit reviewed changes and push the matching `v<version>` tag when authorized.
   The tag must match every library manifest.

The workflow publishes core first and waits until its version is visible before
starting dependents. Retries skip an existing version only when its tarball
integrity matches; different contents fail. Registry/authentication failures never
count as “not published.” Prereleases use `next`, not `latest`.

The root package is private. The old `tools/scripts/publish.mjs` and per-project
publish commands are removed. Publishing uses npm trusted publishing from
`publish.yml`, not a long-lived npm token.
