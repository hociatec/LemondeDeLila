import { stringifyExternalJson } from './external-json';

describe('external JSON null and undefined policy', () => {
  it('preserves explicit null and omits undefined object properties', () => {
    expect(
      stringifyExternalJson({ explicit: null, omitted: undefined, value: 1 }),
    ).toBe('{"explicit":null,"value":1}');
  });

  it('rejects undefined array entries and non-JSON root values', () => {
    expect(() => stringifyExternalJson([undefined])).toThrow(TypeError);
    expect(() => stringifyExternalJson(undefined)).toThrow(TypeError);
    expect(() => stringifyExternalJson({ value: Number.NaN })).toThrow(
      TypeError,
    );
  });
});
