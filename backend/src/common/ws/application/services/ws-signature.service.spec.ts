import type { IncomingHttpHeaders } from 'http';
import { WsSignatureService } from './ws-signature.service';
import type { WsClientLike } from './ws-signature.service';
import type { WsRuntimeConfig } from '../../infrastructure/config/ws-runtime.config';

type DummySocket = Partial<WsClientLike> & {
  url?: string;
  handshakeHeaders?: IncomingHttpHeaders;
};

const dummySocket = (data: DummySocket): DummySocket => data;
const asSocket = (data: DummySocket): WsClientLike => data;
const config = (sharedSecret: string | null): WsRuntimeConfig => ({
  nodeEnv: 'test',
  sharedSecret,
});

describe('WsSignatureService', () => {
  it('allows connections when the shared secret is disabled', () => {
    const service = new WsSignatureService(config(null));
    expect(service.isEnabled()).toBe(false);
    expect(service.validate(asSocket(dummySocket({})), [])).toBe(true);
  });

  it('rejects missing signatures when the shared secret is required', () => {
    const service = new WsSignatureService(config('super-secret'));
    expect(service.isEnabled()).toBe(true);
    expect(service.validate(asSocket(dummySocket({})), [])).toBe(false);
  });

  it('accepts valid signatures from the query string', () => {
    const service = new WsSignatureService(config('needle'));
    const socket = dummySocket({ url: '/ws?signature=needle' });
    expect(service.validate(asSocket(socket), [])).toBe(true);
  });

  it('accepts valid signatures from headers', () => {
    const service = new WsSignatureService(config('antelope'));
    const socket = dummySocket({
      handshakeHeaders: { 'x-lila-signature': 'antelope' },
    });
    expect(service.validate(asSocket(socket), [])).toBe(true);
  });

  it('rejects invalid signatures', () => {
    const service = new WsSignatureService(config('antelope'));
    const socket = dummySocket({ url: '/ws?signature=wrong' });
    expect(service.validate(asSocket(socket), [])).toBe(false);
  });
});
