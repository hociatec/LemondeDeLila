import { isAllowedWsOrigin } from './ws-origin-policy';

it('checks browser origins exactly while allowing native clients without Origin', () => {
  const allowed = 'https://lila.example, http://localhost:3000';
  expect(isAllowedWsOrigin('https://lila.example', allowed, true)).toBe(true);
  expect(isAllowedWsOrigin('http://localhost:3000', allowed, true)).toBe(true);
  expect(isAllowedWsOrigin(undefined, allowed, true)).toBe(true);
  for (const origin of [
    'https://lila.example.evil',
    'https://lila.example/path',
    'null',
    '',
    ['https://lila.example'],
    'file:///tmp',
  ]) {
    expect(isAllowedWsOrigin(origin, allowed, true)).toBe(false);
  }
});

it('denies browser origins by default in production and permits development origins', () => {
  expect(isAllowedWsOrigin('https://lila.example', '', true)).toBe(false);
  expect(isAllowedWsOrigin('http://localhost:3000', '', false)).toBe(true);
});
