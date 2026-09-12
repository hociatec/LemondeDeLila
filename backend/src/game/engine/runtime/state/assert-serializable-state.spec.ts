import { assertSerializableState } from './assert-serializable-state';
import { runInNewContext } from 'node:vm';

describe('snapshot JSON fidelity', () => {
  it.each([
    ['sparse array', () => new Array(2)],
    ['undefined array entry', () => [undefined]],
    ['array property', () => Object.assign([1], { extra: 2 })],
    ['hidden data', () => Object.defineProperty({}, 'secret', { value: 42 })],
    [
      'hidden callback',
      () => Object.defineProperty({}, 'toJSON', { value: () => ({}) }),
    ],
  ])('rejects %s that JSON would silently change or omit', (_name, create) => {
    expect(() => assertSerializableState(create())).toThrow();
  });

  it('does not execute accessors', () => {
    const get = jest.fn(() => 1);
    const state = Object.defineProperty({}, 'value', { get, enumerable: true });
    expect(() => assertSerializableState(state)).toThrow();
    expect(get).not.toHaveBeenCalled();
  });

  it('does not execute a prototype constructor accessor', () => {
    const get = jest.fn(() => Object);
    const prototype: object = Object.create(null) as object;
    Object.defineProperty(prototype, 'constructor', { get });
    const value: unknown = Object.create(prototype);
    expect(() => assertSerializableState(value)).toThrow();
    expect(get).not.toHaveBeenCalled();
  });

  it('rejects custom serialization on the supported room timestamp', () => {
    const toJSON = jest.fn(() => 'replacement');
    const roomStartedAt = Object.assign(new Date(0), { toJSON });
    expect(() =>
      assertSerializableState({ metadata: { roomStartedAt } }),
    ).toThrow();
    expect(toJSON).not.toHaveBeenCalled();
  });

  it('accepts the explicit Date timestamp codec', () => {
    expect(() =>
      assertSerializableState({ metadata: { roomStartedAt: new Date(0) } }),
    ).not.toThrow();
  });

  it('accepts native Date timestamps from another realm but rejects forged Date objects', () => {
    const roomStartedAt: unknown = runInNewContext('new Date(0)');
    expect(() =>
      assertSerializableState({ metadata: { roomStartedAt } }),
    ).not.toThrow();
    const forged: unknown = Object.create(Date.prototype);
    expect(() =>
      assertSerializableState({ metadata: { roomStartedAt: forged } }),
    ).toThrow();
  });

  it('rejects inherited Date behavior without executing it', () => {
    const getTime = jest.fn(() => 0);
    class CustomDate extends Date {
      override getTime = getTime;
    }
    expect(() =>
      assertSerializableState({
        metadata: { roomStartedAt: new CustomDate() },
      }),
    ).toThrow();
    expect(getTime).not.toHaveBeenCalled();
  });

  it('rejects array subclasses with inherited serialization', () => {
    const toJSON = jest.fn(() => 'replacement');
    class CustomArray extends Array<number> {}
    Object.defineProperty(CustomArray.prototype, 'toJSON', { value: toJSON });
    expect(() => assertSerializableState(new CustomArray(1, 2))).toThrow();
    expect(toJSON).not.toHaveBeenCalled();
  });

  it('does not trust a custom prototype whose constructor is named Object', () => {
    const constructor = function Object() {};
    const prototype: object = Object.create(null) as object;
    Object.defineProperty(prototype, 'constructor', { value: constructor });
    const toJSON = jest.fn(() => 'replacement');
    Object.defineProperty(prototype, 'toJSON', { value: toJSON });
    expect(() => assertSerializableState(Object.create(prototype))).toThrow();
    expect(toJSON).not.toHaveBeenCalled();
  });

  it('accepts native objects and arrays from another realm', () => {
    const value: unknown = runInNewContext(
      '({ nested: [1, { value: true }] })',
    );
    expect(() => assertSerializableState(value)).not.toThrow();
  });

  it('accepts optional object fields, dense arrays and shared values', () => {
    const shared = { value: 2 };
    expect(() =>
      assertSerializableState({
        optional: undefined,
        values: [null, shared, shared],
      }),
    ).not.toThrow();
  });
});
