import { isChatMutationWindowOpen } from './chat-mutation-window';

it('allows the exact deadline and refuses the following millisecond', () => {
  expect(isChatMutationWindowOpen(100, 60_100, 60)).toBe(true);
  expect(isChatMutationWindowOpen(100, 60_101, 60)).toBe(false);
});

it.each([
  [NaN, 100, 60],
  [101, 100, 60],
  [100, NaN, 60],
  [100, Infinity, 60],
  [100, 100, NaN],
  [100, 100, Infinity],
  [100, 100, 0],
  [100, 100, -1],
])('refuses invalid dates and windows: %j', (createdAt, now, seconds) => {
  expect(isChatMutationWindowOpen(createdAt, now, seconds)).toBe(false);
});
