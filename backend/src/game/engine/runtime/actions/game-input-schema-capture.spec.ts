import { gameInput, type GameInputSchema } from './game-input-schema';

it('captures numeric, text and array bounds at schema creation', () => {
  const textOptions = { max: 3 };
  const numberOptions = { max: 3, integer: true };
  const arrayOptions = { max: 1 };
  const text = gameInput.string(textOptions);
  const number = gameInput.number(numberOptions);
  const array = gameInput.array(number, arrayOptions);
  textOptions.max = 100;
  numberOptions.max = 100;
  arrayOptions.max = 100;
  expect(() => text.parse('too long')).toThrow();
  expect(() => number.parse(4)).toThrow();
  expect(() => array.parse([1, 2])).toThrow();
  expect(text.describe()).toMatchObject({ max: 3 });
});

it('captures enumeration members and union alternatives', () => {
  const labels = ['allowed'];
  const values = [1];
  const candidates: GameInputSchema<unknown>[] = [gameInput.literal('first')];
  const text = gameInput.enum(labels);
  const number = gameInput.numberEnum(values);
  const union = gameInput.union(candidates);
  labels.push('injected');
  values.push(2);
  candidates.push(gameInput.literal('second'));
  expect(() => text.parse('injected')).toThrow();
  expect(() => number.parse(2)).toThrow();
  expect(() => union.parse('second')).toThrow();
});

it('compiles object fields once and retains their parsers after caller mutation', () => {
  let reads = 0;
  const child = { ...gameInput.number({ integer: true }) };
  const shape: Record<string, GameInputSchema<unknown>> = {};
  Object.defineProperty(shape, 'count', {
    enumerable: true,
    configurable: true,
    get: () => {
      reads++;
      return child;
    },
  });
  const schema = gameInput.object(shape);
  delete shape.count;
  child.parse = () => 999;
  expect(schema.parse({ count: '3' })).toEqual({ count: 3 });
  expect(schema.parse({ count: '4' })).toEqual({ count: 4 });
  expect(reads).toBe(1);
});

it('captures nested adapters and descriptors without exposing mutable schema objects', () => {
  const descriptor = { type: 'number', nested: { label: 'original' } };
  const child = { ...gameInput.number(), describe: () => descriptor };
  const array = gameInput.array(child);
  const optional = gameInput.optional(child);
  const labeled = gameInput.label('label', child);
  child.parse = () => 999;
  descriptor.nested.label = 'changed';
  expect(array.parse(['3'])).toEqual([3]);
  expect(optional.parse('3')).toBe(3);
  expect(labeled.parse('3')).toBe(3);
  expect(optional.describe()).toMatchObject({ nested: { label: 'original' } });
  expect(Object.isFrozen(optional)).toBe(true);
  expect(Reflect.set(optional, 'parse', () => 999)).toBe(false);
  const projection = optional.describe();
  projection.type = 'changed';
  expect(optional.describe().type).toBe('number');
});

it('preserves a declared __proto__ field as data without changing the output prototype', () => {
  const fields = Object.fromEntries([['__proto__', gameInput.string()]]);
  const parsed = gameInput
    .object(fields)
    .parse(JSON.parse('{"__proto__":"data"}'));
  expect(Object.getPrototypeOf(parsed)).toBe(Object.prototype);
  expect(Object.hasOwn(parsed, '__proto__')).toBe(true);
  expect(parsed.__proto__).toBe('data');
});
