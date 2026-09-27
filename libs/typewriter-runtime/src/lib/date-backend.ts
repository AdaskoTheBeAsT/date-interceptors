import type { DateBackend } from '@adaskothebeast/hierarchical-convert-core';

export type {
  DateBackend,
  DateCodec,
  DateSchemaKind,
} from '@adaskothebeast/hierarchical-convert-core';

export function defineDateBackend<TBackend extends DateBackend>(
  backend: TBackend,
): TBackend {
  return backend;
}
