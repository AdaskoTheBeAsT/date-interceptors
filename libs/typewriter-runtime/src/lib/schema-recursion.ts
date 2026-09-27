/** Tracks schema indirection without counting it as another level of data. */
export class SchemaRecursionGuard {
  private readonly active = new Map<number, Map<unknown, Set<unknown>>>();

  enter(schema: unknown, value: unknown, depth: number): boolean {
    let schemas = this.active.get(depth);
    if (schemas === undefined) {
      schemas = new Map();
      this.active.set(depth, schemas);
    }
    let values = schemas.get(schema);
    if (values === undefined) {
      values = new Set();
      schemas.set(schema, values);
    }
    if (values.has(value)) return false;
    values.add(value);
    return true;
  }

  leave(schema: unknown, value: unknown, depth: number): void {
    const schemas = this.active.get(depth);
    const values = schemas?.get(schema);
    values?.delete(value);
    if (values?.size === 0) schemas?.delete(schema);
    if (schemas?.size === 0) this.active.delete(depth);
  }
}
