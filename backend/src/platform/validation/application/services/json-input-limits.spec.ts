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
