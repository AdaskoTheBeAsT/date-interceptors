/**
 * Linked JSON path. Segments are only formatted when an error or a custom
 * codec asks for the textual path, so successful conversions build no strings.
 */
export interface SchemaPathNode {
  readonly parent: SchemaPath;
  readonly key: string | number;
}

export type SchemaPath = SchemaPathNode | undefined;

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/u;

export function childPath(
  parent: SchemaPath,
  key: string | number,
): SchemaPathNode {
  return { parent, key };
}

export function formatPath(path: SchemaPath): string {
  const segments: string[] = [];
  for (let node = path; node !== undefined; node = node.parent) {
    segments.push(formatSegment(node.key));
  }
  return `$${segments.reverse().join('')}`;
}

function formatSegment(key: string | number): string {
  if (typeof key === 'number') {
    return `[${key}]`;
  }
  return IDENTIFIER.test(key) ? `.${key}` : `[${JSON.stringify(key)}]`;
}
