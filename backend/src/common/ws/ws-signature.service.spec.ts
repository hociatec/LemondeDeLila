import { ConfigService } from '@nestjs/config';
import { WsSignatureService } from './ws-signature.service';

const dummySocket = (data: Record<string, any>) => data as any;

describe('WsSignatureService', () => {
  it('allows connections when the shared secret is disabled', () => {
    const service = new WsSignatureService(new ConfigService({}));
    expect(service.isEnabled()).toBe(false);
    expect(service.validate(dummySocket({}), [])).toBe(true);
  });

  it('rejects missing signatures when the shared secret is required', () => {
    const service = new WsSignatureService(
      new ConfigService({ WS_SHARED_SECRET: 'super-secret' }),
    );
    expect(service.isEnabled()).toBe(true);
    expect(service.validate(dummySocket({}), [])).toBe(false);
  });

  it('accepts valid signatures from the query string', () => {
    const service = new WsSignatureService(
      new ConfigService({ WS_SHARED_SECRET: 'needle' }),
    );
    const socket = dummySocket({ url: '/ws?signature=needle' });
    expect(service.validate(socket, [])).toBe(true);
  });

  it('accepts valid signatures from headers', () => {
    const service = new WsSignatureService(
      new ConfigService({ WS_SHARED_SECRET: 'antelope' }),
    );
    const socket = dummySocket({
      handshakeHeaders: { 'x-lila-signature': 'antelope' },
    });
    expect(service.validate(socket, [])).toBe(true);
  });

  it('rejects invalid signatures', () => {
    const service = new WsSignatureService(
      new ConfigService({ WS_SHARED_SECRET: 'antelope' }),
    );
    const socket = dummySocket({ url: '/ws?signature=wrong' });
    expect(service.validate(socket, [])).toBe(false);
  });
});
