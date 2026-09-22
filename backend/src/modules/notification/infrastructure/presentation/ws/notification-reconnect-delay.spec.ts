import { operationalSettings } from '../../../../../platform/config/public-api';
import { notificationReconnectDelay } from './notification-reconnect-delay';

jest.mock('../../../../../platform/config/public-api', () => ({
  operationalSettings: { wsReconnectBackoffMs: 1000 },
}));

afterEach(() => jest.restoreAllMocks());

it.each([
  [1_000, 1_000, 1_500],
  [0, 100, 150],
  [Number.NaN, 1_000, 1_500],
  [Number.MAX_SAFE_INTEGER, 30_000, 45_000],
])('bounds reconnect jitter for %s', (configured, minimum, maximum) => {
  jest.replaceProperty(operationalSettings, 'wsReconnectBackoffMs', configured);
  for (let sample = 0; sample < 100; sample++) {
    const delay = notificationReconnectDelay();
    expect(Number.isSafeInteger(delay)).toBe(true);
    expect(delay).toBeGreaterThanOrEqual(minimum);
    expect(delay).toBeLessThanOrEqual(maximum);
  }
});
