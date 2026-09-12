import { hasOnlyAllowedKeys } from './exact-object-input';

it('accepts only plain object keys declared by the boundary', () => {
  expect(hasOnlyAllowedKeys({ id: 1 }, ['id'])).toBe(true);
  expect(hasOnlyAllowedKeys({ id: 1, admin: true }, ['id'])).toBe(false);
  expect(hasOnlyAllowedKeys([], ['id'])).toBe(false);
  expect(hasOnlyAllowedKeys(null, ['id'])).toBe(false);
});
