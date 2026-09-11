import { decodeWsEnvelope } from './ws-message-codec';

it('accepts legacy and version-one envelopes in the supported binary/text encodings', () => {
  const value = {
    type: 'room.intent.execute',
    requestId: 'request-1',
    payload: {},
  };
  const text = JSON.stringify(value);
  expect(decodeWsEnvelope(text)).toEqual(value);
  expect(decodeWsEnvelope(Buffer.from(text))).toEqual(value);
  expect(decodeWsEnvelope(new TextEncoder().encode(text).buffer)).toEqual(
    value,
  );
  expect(
    decodeWsEnvelope(JSON.stringify({ ...value, protocolVersion: 1 })),
  ).not.toBeNull();
});

it('rejects unsupported versions, ambiguous request ids, extra fields and oversized multibyte text', () => {
  for (const value of [
    [],
    null,
    { type: 'x', protocolVersion: 2 },
    { type: 'x', requestId: ' ' },
    { type: 'x', unexpected: true },
  ]) {
    expect(decodeWsEnvelope(JSON.stringify(value))).toBeNull();
  }
  const text = JSON.stringify({ type: 'x', payload: 'ééé' });
  expect(decodeWsEnvelope(text, text.length)).toBeNull();
});

it('rejects hostile nested payloads before dispatch', () => {
  expect(
    decodeWsEnvelope('{"type":"x","payload":{"constructor":{}}}'),
  ).toBeNull();
  expect(decodeWsEnvelope('{"type":"x","payload":{"n":1e999}}')).toBeNull();
  let payload: unknown = null;
  for (let i = 0; i < 33; i++) payload = { child: payload };
  expect(decodeWsEnvelope(JSON.stringify({ type: 'x', payload }))).toBeNull();
});
