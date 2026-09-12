import { BadRequestException } from '@nestjs/common';
import { IsString } from 'class-validator';
import { isBoundedJsonInput } from './json-input-limits';
import { normalizeInputStrings } from './input-normalization';
import { PayloadValidationService } from './payload-validation.service';

class TextPayload {
  @IsString()
  text!: string;
}

describe('untrusted JSON boundaries', () => {
  it('rejects instances, accessors and non-JSON array properties without executing them', () => {
    const getter = jest.fn(() => 'secret');
    class Entity {
      password = 'private';
    }
    class CustomArray extends Array<number> {}
    for (const value of [
      new Entity(),
      new CustomArray(),
      new Array(2),
      Object.defineProperty({}, 'password', { get: getter, enumerable: true }),
      Object.assign([1], { extra: true }),
      Object.defineProperty({}, 'hidden', { value: true }),
    ])
      expect(
        isBoundedJsonInput(value, { allowUndefinedProperties: true }),
      ).toBe(false);
    expect(getter).not.toHaveBeenCalled();
  });

  it('allows optional object fields explicitly and repeated references without allowing cycles', () => {
    const shared = { id: 1, optional: undefined };
    expect(
      isBoundedJsonInput(
        { left: shared, right: shared },
        { allowUndefinedProperties: true },
      ),
    ).toBe(true);
    expect(
      isBoundedJsonInput([undefined], { allowUndefinedProperties: true }),
    ).toBe(false);
    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    expect(isBoundedJsonInput(cycle, { allowUndefinedProperties: true })).toBe(
      false,
    );
  });
  it('normalizes ordinary text while preserving credentials', () => {
    expect(
      normalizeInputStrings({ text: '  Ａ  ', password: '  Ａ  ' }),
    ).toEqual({ text: 'A', password: '  Ａ  ' });
  });

  it('bounds depth and node count before recursion', () => {
    let value: unknown = null;
    for (let depth = 0; depth < 32; depth++) value = { child: value };
    expect(isBoundedJsonInput(value)).toBe(true);
    expect(() => normalizeInputStrings({ child: value })).toThrow(
      BadRequestException,
    );
    expect(isBoundedJsonInput(Array(9999).fill(null))).toBe(true);
    expect(isBoundedJsonInput(Array(10000).fill(null))).toBe(false);
  });

  it('rejects nested prototype injection, cycles and non-JSON numbers', () => {
    for (const key of ['__proto__', 'constructor', 'prototype']) {
      expect(() =>
        normalizeInputStrings(JSON.parse(`{"nested":{"${key}":{}}}`)),
      ).toThrow(BadRequestException);
    }
    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    for (const value of [cycle, NaN, Infinity, new Date(), { n: undefined }]) {
      expect(isBoundedJsonInput(value)).toBe(false);
    }
  });

  it('validates DTOs at runtime and rejects arrays and unknown fields', () => {
    const validator = new PayloadValidationService();
    expect(validator.validate(TextPayload, { text: ' hi ' }).text).toBe('hi');
    for (const value of [
      [],
      [{ text: 'hi' }],
      'hi',
      { text: 'hi', extra: true },
      { text: {} },
    ]) {
      expect(() => validator.validate(TextPayload, value)).toThrow(
        BadRequestException,
      );
    }
  });
});
