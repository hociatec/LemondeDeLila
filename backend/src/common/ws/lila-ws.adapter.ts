import { WsAdapter } from '@nestjs/platform-ws';

export class LilaWsAdapter extends WsAdapter {
  override create(
    port: number,
    options?: Record<string, any> & {
      namespace?: string;
      server?: any;
      path?: string;
    },
  ): any {
    const merged = {
      ...(options ?? {}),
      perMessageDeflate:
        options?.perMessageDeflate ??
        (process.env.WS_PERMESSAGE_DEFLATE || 'true').toLowerCase() === 'true',
    };
    return super.create(port, merged);
  }
}
