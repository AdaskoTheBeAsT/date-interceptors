import {
  ArraySchema,
  NullableSchema,
  RuntimeSchemaFactory,
  RuntimeSchemaMap,
  SchemaRegistry,
  arraySchema,
  customSchema,
  decimalSchema,
  defineTypeRegistry,
  discriminatedUnionSchema,
  nullableSchema,
  objectSchema,
  property,
  referenceSchema,
  schema,
  uuidSchema,
} from './runtime-schema';

interface User {
  id: string;
  displayName: string;
}

describe('runtime schema builders', () => {
  it('constructs primitive, decimal, uuid, and literal descriptors', () => {
    expect(schema.unknown()).toEqual({ kind: 'unknown' });
    expect(schema.string()).toEqual({ kind: 'string' });
    expect(schema.number()).toEqual({ kind: 'number' });
    expect(schema.boolean()).toEqual({ kind: 'boolean' });
    expect(decimalSchema('string')).toEqual({
      kind: 'decimal',
      wireType: 'string',
    });
    expect(decimalSchema('number')).toEqual({
      kind: 'decimal',
      wireType: 'number',
    });
    expect(uuidSchema()).toEqual({ kind: 'uuid' });
    expect(uuidSchema([4, 7])).toEqual({
      kind: 'uuid',
      versions: [4, 7],
    });
    expect(schema.literal('active')).toEqual({
      kind: 'literal',
      value: 'active',
    });
  });

  it.each([
    ['instant', schema.instant],
    ['plain-date', schema.plainDate],
    ['plain-time', schema.plainTime],
    ['plain-date-time', schema.plainDateTime],
    ['zoned-date-time', schema.zonedDateTime],
    ['duration', schema.duration],
    ['period', schema.period],
    ['plain-year-month', schema.plainYearMonth],
    ['plain-month-day', schema.plainMonthDay],
  ] as const)('constructs the %s Temporal descriptor', (kind, builder) => {
    expect(builder()).toEqual({ kind });
  });

  it('constructs objects with ids and serialized property names', () => {
    const properties: RuntimeSchemaMap<User> = {
      id: property(schema.uuid()),
      displayName: property(schema.string(), 'display_name'),
    };

    expect(objectSchema(properties, { id: 'User' })).toEqual({
      kind: 'object',
      id: 'User',
      properties: {
        id: { schema: { kind: 'uuid' } },
        displayName: {
          schema: { kind: 'string' },
          serializedName: 'display_name',
        },
      },
    });
  });

  it('constructs arrays, nullable values, records, and references', () => {
    const descriptor: ArraySchema<User | null> = arraySchema(
      nullableSchema(referenceSchema<User>('User')),
    );
    const nullableString: NullableSchema<string> = schema.nullable(
      schema.string(),
    );

    expect(descriptor).toEqual({
      kind: 'array',
      items: {
        kind: 'nullable',
        schema: { kind: 'reference', typeName: 'User' },
      },
    });
    expect(nullableString).toEqual({
      kind: 'nullable',
      schema: { kind: 'string' },
    });
    expect(schema.optional(schema.number())).toEqual({
      kind: 'optional',
      schema: { kind: 'number' },
    });
    expect(schema.record(schema.boolean())).toEqual({
      kind: 'record',
      values: { kind: 'boolean' },
    });
  });

  it('constructs discriminated unions and custom descriptors', () => {
    interface Cat {
      kind: 'cat';
      lives: number;
    }

    interface Dog {
      kind: 'dog';
      good: boolean;
    }

    type Pet = Cat | Dog;

    const cat = schema.object<Cat>({
      kind: schema.property(schema.literal('cat')),
      lives: schema.property(schema.number()),
    });
    const dog = schema.object<Dog>({
      kind: schema.property(schema.literal('dog')),
      good: schema.property(schema.boolean()),
    });

    expect(
      discriminatedUnionSchema<Pet>('kind', { cat, dog }),
    ).toEqual({
      kind: 'discriminated-union',
      discriminator: 'kind',
      variants: { cat, dog },
    });
    expect(
      customSchema<Date, { format: string }>('date', {
        format: 'yyyy-MM-dd',
      }),
    ).toEqual({
      kind: 'custom',
      name: 'date',
      options: { format: 'yyyy-MM-dd' },
    });
  });
});

describe('type registry', () => {
  const userSchema = schema.object<User>(
    {
      id: schema.property(schema.uuid()),
      displayName: schema.property(schema.string()),
    },
    { id: 'User' },
  );

  it('supports strongly typed schema factories and lookups', () => {
    const userFactory: RuntimeSchemaFactory<User> = () => userSchema;
    const definitions = { User: userFactory };
    const registry: SchemaRegistry<typeof definitions> =
      defineTypeRegistry(definitions);

    expect(registry.has('User')).toBe(true);
    expect(registry.get('User')).toBe(userSchema);
  });

  it('returns undefined for unknown type names', () => {
    const registry = defineTypeRegistry({ User: userSchema });

    expect(registry.has('Missing')).toBe(false);
    expect(registry.get('Missing')).toBeUndefined();
  });

  it('protects registered type names from duplicates', () => {
    const registry = defineTypeRegistry({ User: userSchema });

    expect(() => registry.register('User', () => userSchema)).toThrow(
      'Type "User" is already registered.',
    );
  });

  it('resolves recursive schema factories lazily', () => {
    interface TreeNode {
      value: string;
      children: TreeNode[];
    }

    const registry = defineTypeRegistry({
      TreeNode: () =>
        schema.object<TreeNode>(
          {
            value: schema.property(schema.string()),
            children: schema.property(
              schema.array(schema.reference<TreeNode>('TreeNode')),
            ),
          },
          { id: 'TreeNode' },
        ),
    });

    expect(registry.get('TreeNode')).toEqual({
      kind: 'object',
      id: 'TreeNode',
      properties: {
        value: { schema: { kind: 'string' } },
        children: {
          schema: {
            kind: 'array',
            items: { kind: 'reference', typeName: 'TreeNode' },
          },
        },
      },
    });
  });
});
