'use strict';

function schemaType(schema, references = {}) {
  if (schema.$ref) {
    const name = schema.$ref.replace(/^#\/\$defs\//, '');
    if (!Object.hasOwn(references, name))
      throw new Error(`Unknown schema reference ${name}`);
    return references[name];
  }
  if (Object.hasOwn(schema, 'const')) return JSON.stringify(schema.const);
  if (schema.enum)
    return (
      schema.enum.map((value) => JSON.stringify(value)).join(' | ') || 'never'
    );
  if (schema.oneOf)
    return (
      schema.oneOf
        .map((value) => `(${schemaType(value, references)})`)
        .join(' | ') || 'never'
    );
  if (schema.type === 'null') return 'null';
  if (schema.type === 'boolean') return 'boolean';
  if (schema.type === 'string') return 'string';
  if (schema.type === 'number' || schema.type === 'integer') return 'number';
  if (schema.type === 'array') {
    if (!schema.items)
      throw new Error('Array schema requires items for typed authoring');
    const item = schemaType(schema.items, references);
    if (
      Number.isInteger(schema.minItems) &&
      schema.minItems === schema.maxItems &&
      schema.minItems <= 64
    )
      return `[${Array.from({ length: schema.minItems }, () => item).join(', ')}]`;
    return `Array<${item}>`;
  }
  if (schema.type === 'object') {
    const fields = Object.entries(schema.properties ?? {}).map(
      ([key, value]) =>
        `readonly ${JSON.stringify(key)}${schema.required?.includes(key) ? '' : '?'}: ${schemaType(value, references)}`,
    );
    if (
      schema.additionalProperties &&
      typeof schema.additionalProperties === 'object'
    )
      fields.push(
        `readonly [key: string]: ${schemaType(schema.additionalProperties, references)}`,
      );
    return `{ ${fields.join('; ')} }`;
  }
  throw new Error(`Unsupported authoring grammar: ${JSON.stringify(schema)}`);
}

module.exports = { schemaType };
