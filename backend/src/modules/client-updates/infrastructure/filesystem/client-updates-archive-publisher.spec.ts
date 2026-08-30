import { ClientUpdatesInvalidArchiveError } from './client-updates-publisher.errors';
import { assertSafeClientUpdateArchiveEntries } from './client-updates-archive-publisher';

describe('client update archive safety', () => {
  it.each([
    '../outside.exe',
    'Application Files/../../outside.exe',
    '/absolute/file.exe',
    'C:/Windows/file.exe',
    String.raw`..\outside.exe`,
  ])('rejects a zip-slip entry: %s', (entry) => {
    expect(() => assertSafeClientUpdateArchiveEntries([entry])).toThrow(
      ClientUpdatesInvalidArchiveError,
    );
  });

  it('accepts ordinary ClickOnce paths without rejecting dotted names', () => {
    expect(() =>
      assertSafeClientUpdateArchiveEntries([
        'LeMondeDeLila.application',
        'Application Files/app_1_2_3_4/foo..bar.dll',
      ]),
    ).not.toThrow();
  });
});
