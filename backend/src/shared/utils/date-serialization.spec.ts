import {
  businessMsToDate,
  businessMsToIso,
  normalizeOptional,
  parseExplicitInstant,
  serializeDate,
  serializeOptionalDate,
} from './date-serialization';

it.each([
  '2026-02-30T12:00:00Z',
  '2025-02-29T12:00:00Z',
  '2026-04-31T12:00:00+02:00',
  '2026-09-10T24:00:00Z',
  '2026-09-10T12:60:00Z',
  '2026-09-10T12:00:60Z',
  '2026-09-10T12:00:00+25:00',
  'September 10, 2026 12:00:00Z',
])('rejects invalid or ambiguous instant %s without normalization', (value) => {
  expect(parseExplicitInstant(value)).toBeNull();
});

it.each(['2024-02-29T23:00:00Z', '2026-09-10T12:00:00.123+0200'])(
  'accepts valid explicit instant %s',
  (value) => {
    expect(parseExplicitInstant(value)).toBe(Date.parse(value));
  },
);

it('serializes a stored date in UTC and preserves an absent optional date', () => {
  expect(serializeDate(new Date('2026-09-08T12:00:00+02:00'))).toBe(
    '2026-09-08T10:00:00.000Z',
  );
  expect(serializeOptionalDate(null)).toBeNull();
  expect(serializeOptionalDate(undefined)).toBeNull();
  expect(normalizeOptional(null)).toBeNull();
  expect(normalizeOptional(undefined)).toBeNull();
  expect(normalizeOptional('present')).toBe('present');
});

it('never replaces an invalid or missing stored instant with the current time', () => {
  for (const value of [
    null,
    undefined,
    new Date(NaN),
    '2026-09-08',
    1000,
    { toISOString: () => 'fake' },
  ]) {
    expect(() => serializeDate(value)).toThrow(RangeError);
  }
  expect(serializeOptionalDate(new Date(NaN))).toBeNull();
});

it('keeps business-clock milliseconds, Date values and wire ISO at explicit boundaries', () => {
  expect(businessMsToDate(0).getTime()).toBe(0);
  expect(businessMsToIso(0)).toBe('1970-01-01T00:00:00.000Z');
  expect(parseExplicitInstant('2026-09-10T12:00:00+02:00')).toBe(
    Date.parse('2026-09-10T12:00:00+02:00'),
  );
  expect(parseExplicitInstant('2026-09-10T12:00:00')).toBeNull();
  expect(() => businessMsToDate(Number.NaN)).toThrow(RangeError);
});

it.each([
  NaN,
  Infinity,
  -Infinity,
  0.5,
  Number.MAX_SAFE_INTEGER,
  8640000000000001,
  -8640000000000001,
])('rejects invalid business milliseconds %s at conversion time', (value) => {
  expect(() => businessMsToDate(value)).toThrow(RangeError);
  expect(() => businessMsToIso(value)).toThrow(RangeError);
});

it.each([-8640000000000000, 8640000000000000])(
  'accepts the inclusive Date boundary %s',
  (value) => expect(businessMsToDate(value).getTime()).toBe(value),
);
