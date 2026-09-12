import { sanitizeLogText } from './log-sanitizer';

it.each([
  'apiKey',
  'api_key',
  'api-key',
  'access_token',
  'refresh-token',
  'client_secret',
  'set-cookie',
])('redacts the credential key %s in non-JSON framework messages', (key) => {
  const text = sanitizeLogText(
    `upstream failure ${key}="credential-value" code=ECONNREFUSED`,
  );
  expect(text).not.toContain('credential-value');
  expect(text).toContain('ECONNREFUSED');
});

it('redacts a quoted credential containing spaces', () => {
  expect(
    sanitizeLogText('failure client_secret="two secret words"'),
  ).not.toContain('secret words');
});
