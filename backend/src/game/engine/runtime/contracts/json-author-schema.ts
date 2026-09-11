/** Small, closed JSON Schema vocabulary shared by authoring grammars. */
export type AuthorSchema = {
  type?:
    'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean' | 'null';
  const?: string | number | boolean;
  enum?: readonly (string | number)[];
  properties?: Readonly<Record<string, AuthorSchema>>;
  required?: readonly string[];
  additionalProperties?: false | AuthorSchema;
  items?: AuthorSchema;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  minItems?: number;
  maxItems?: number;
  oneOf?: readonly AuthorSchema[];
  $ref?: string;
};

export const authorId: AuthorSchema = {
  type: 'string',
  minLength: 1,
  maxLength: 128,
  pattern:
    '^(?!__proto__$|prototype$|constructor$)[A-Za-z0-9][A-Za-z0-9_.:-]*$',
};
export const authorNumber: AuthorSchema = { type: 'number' };
export const authorInteger: AuthorSchema = { type: 'integer' };
export const authorPositive: AuthorSchema = { type: 'integer', minimum: 1 };
export const authorBoolean: AuthorSchema = { type: 'boolean' };
export const authorRef = (name: string): AuthorSchema => ({
  $ref: `#/$defs/${name}`,
});
export const authorArray = (
  items: AuthorSchema,
  minItems = 0,
): AuthorSchema => ({
  type: 'array',
  items,
  minItems,
  maxItems: 10000,
});
export const authorObject = (
  properties: Readonly<Record<string, AuthorSchema>>,
  required: readonly string[] = Object.keys(properties),
): AuthorSchema => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
});
export const authorRecord = (values: AuthorSchema): AuthorSchema => ({
  type: 'object',
  additionalProperties: values,
});

/** Schema descriptors contain only trees of plain data. */
export function freezeAuthorSchema<T extends object>(value: T): T {
  for (const nested of Object.values(value)) {
    if (nested && typeof nested === 'object' && !Object.isFrozen(nested))
      freezeAuthorSchema(nested);
  }
  return Object.freeze(value);
}

/** Reject non-JSON values, cycles and oversized trees before recursive grammar validation. */
export function assertAuthorJson(
  value: unknown,
  path = '$',
  allowUndefinedOptionalFields = false,
): void {
  let nodes = 0;
  let textBytes = 0;
  const accountText = (text: string, location: string): void => {
    textBytes += Buffer.byteLength(text, 'utf8');
    if (text.length > 65536 || textBytes > 8 * 1024 * 1024)
      throw new Error(`${location}: JSON text limit exceeded`);
  };
  const ancestors = new Set<object>();
  function visit(current: unknown, location: string, depth: number): void {
    if (++nodes > 100000 || depth > 64)
      throw new Error(`${location}: JSON limit exceeded`);
    if (
      current === null ||
      typeof current === 'boolean' ||
      typeof current === 'string'
    ) {
      if (typeof current === 'string') accountText(current, location);
      return;
    }
    if (
      typeof current === 'number' &&
      Number.isFinite(current) &&
      Math.abs(current) <= Number.MAX_SAFE_INTEGER
    )
      return;
    if (typeof current !== 'object' || !current)
      throw new Error(`${location}: JSON value expected`);
    if (ancestors.has(current)) throw new Error(`${location}: cyclic JSON`);
    const prototype = Object.getPrototypeOf(current) as object | null;
    const constructor: unknown =
      prototype &&
      Object.getOwnPropertyDescriptor(prototype, 'constructor')?.value;
    const plainPrototype =
      prototype === null ||
      prototype === Object.prototype ||
      (Object.getPrototypeOf(prototype) === null &&
        typeof constructor === 'function' &&
        constructor.name === 'Object');
    if (!Array.isArray(current) && !plainPrototype) {
      throw new Error(`${location}: plain JSON object expected`);
    }
    ancestors.add(current);
    for (const key of Reflect.ownKeys(current)) {
      if (Array.isArray(current) && key === 'length') continue;
      if (
        typeof key !== 'string' ||
        ['__proto__', 'prototype', 'constructor'].includes(key)
      )
        throw new Error(`${location}: forbidden key`);
      accountText(key, location);
      if (
        Array.isArray(current) &&
        (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= current.length)
      )
        throw new Error(`${location}: array index expected`);
      const descriptor = Object.getOwnPropertyDescriptor(current, key);
      if (!descriptor || !('value' in descriptor) || !descriptor.enumerable)
        throw new Error(`${location}.${key}: JSON data expected`);
      if (
        allowUndefinedOptionalFields &&
        !Array.isArray(current) &&
        descriptor.value === undefined
      )
        continue;
      visit(descriptor.value, `${location}.${key}`, depth + 1);
    }
    if (
      Array.isArray(current) &&
      Object.keys(current).length !== current.length
    )
      throw new Error(`${location}: dense JSON array expected`);
    ancestors.delete(current);
  }
  visit(value, path, 0);
}

export function validateAuthorSchema(
  value: unknown,
  schema: AuthorSchema,
  definitions: Readonly<Record<string, AuthorSchema>>,
  path = '$',
  allowUndefinedOptionalFields = false,
): void {
  function invalid(reason: string): never {
    throw new Error(`${path}: ${reason}`);
  }
  if (schema.$ref) {
    const target = resolveSchemaReference(schema.$ref, definitions, path);
    return validateAuthorSchema(
      value,
      target,
      definitions,
      path,
      allowUndefinedOptionalFields,
    );
  }
  if (schema.oneOf)
    return validateSchemaUnion(
      value,
      { ...schema, oneOf: schema.oneOf },
      definitions,
      path,
      allowUndefinedOptionalFields,
    );
  if (schema.const !== undefined && value !== schema.const)
    invalid(`expected ${schema.const}`);
  if (schema.enum && !schema.enum.some((candidate) => candidate === value))
    invalid('unsupported value');
  if (schema.type === 'object') {
    if (value === null || typeof value !== 'object' || Array.isArray(value))
      invalid('object expected');
    const record = value as Record<string, unknown>;
    for (const key of schema.required ?? [])
      if (!Object.hasOwn(record, key)) invalid(`missing ${key}`);
    for (const [key, entry] of Object.entries(record)) {
      const property =
        schema.properties && Object.hasOwn(schema.properties, key)
          ? schema.properties[key]
          : schema.additionalProperties;
      if (!property) invalid(`unknown field ${key}`);
      if (
        entry === undefined &&
        allowUndefinedOptionalFields &&
        schema.properties &&
        Object.hasOwn(schema.properties, key) &&
        !schema.required?.includes(key)
      )
        continue;
      validateAuthorSchema(
        entry,
        property,
        definitions,
        `${path}.${key}`,
        allowUndefinedOptionalFields,
      );
    }
  } else if (schema.type === 'array') {
    if (!Array.isArray(value)) invalid('array expected');
    const array: unknown[] = value;
    if (
      array.length < (schema.minItems ?? 0) ||
      array.length > (schema.maxItems ?? 10000)
    )
      invalid('invalid array length');
    if (schema.items)
      for (const [index, entry] of array.entries())
        validateAuthorSchema(
          entry,
          schema.items,
          definitions,
          `${path}[${index}]`,
          allowUndefinedOptionalFields,
        );
  } else validateScalarSchema(value, schema, path);
}

function validateSchemaUnion(
  value: unknown,
  schema: AuthorSchema & { oneOf: readonly AuthorSchema[] },
  definitions: Readonly<Record<string, AuthorSchema>>,
  path: string,
  allowUndefinedOptionalFields: boolean,
): void {
  function invalid(reason: string): never {
    throw new Error(`${path}: ${reason}`);
  }
  // Discriminated unions have exactly one candidate; avoid exponential work
  // and enormous errors for deeply nested effect and condition trees.
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const discriminator of ['kind', 'component']) {
      if (
        schema.oneOf.every(
          (alternative) =>
            alternative.properties?.[discriminator]?.const !== undefined,
        )
      ) {
        const actual: unknown = Object.getOwnPropertyDescriptor(
          value,
          discriminator,
        )?.value;
        const candidate = schema.oneOf.find(
          (alternative) =>
            alternative.properties?.[discriminator]?.const === actual,
        );
        if (!candidate) invalid(`unsupported ${discriminator}`);
        return validateAuthorSchema(
          value,
          candidate,
          definitions,
          path,
          allowUndefinedOptionalFields,
        );
      }
    }
  }
  const failures: string[] = [];
  let matches = 0;
  for (const alternative of schema.oneOf) {
    try {
      validateAuthorSchema(
        value,
        alternative,
        definitions,
        path,
        allowUndefinedOptionalFields,
      );
      matches++;
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    }
  }
  if (matches !== 1)
    invalid(`expected one valid variant (${failures.join('; ')})`);
  return;
}

function validateScalarSchema(
  value: unknown,
  schema: AuthorSchema,
  path: string,
): void {
  function invalid(reason: string): never {
    throw new Error(`${path}: ${reason}`);
  }
  if (schema.type === 'string') {
    if (typeof value !== 'string') invalid('string expected');
    const string = value;
    if (
      string.length < (schema.minLength ?? 0) ||
      string.length > (schema.maxLength ?? 65536)
    )
      invalid('invalid string length');
    if (schema.pattern && !new RegExp(schema.pattern).test(string))
      invalid('invalid identifier');
  } else if (schema.type === 'number' || schema.type === 'integer') {
    if (typeof value !== 'number' || !Number.isFinite(value))
      invalid('finite number expected');
    const number = value;
    if (schema.type === 'integer' && !Number.isSafeInteger(number))
      invalid('safe integer expected');
    if (
      number < (schema.minimum ?? -Infinity) ||
      number > (schema.maximum ?? Infinity)
    )
      invalid('number out of range');
  } else if (schema.type === 'boolean' && typeof value !== 'boolean')
    invalid('boolean expected');
  else if (schema.type === 'null' && value !== null) invalid('null expected');
}

function resolveSchemaReference(
  reference: string,
  definitions: Readonly<Record<string, AuthorSchema>>,
  path: string,
): AuthorSchema {
  const name = reference.replace(/^#\/\$defs\//, '');
  const target = Object.hasOwn(definitions, name)
    ? definitions[name]
    : undefined;
  if (!target) throw new Error(`${path}: unknown schema ${name}`);
  return target;
}
