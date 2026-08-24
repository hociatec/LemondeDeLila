import { WsAdapter } from '@nestjs/platform-ws';

type BaseCreateOptions = Parameters<WsAdapter['create']>[1];
type BaseCreateReturn = ReturnType<WsAdapter['create']>;

type LilaWsOptions = BaseCreateOptions & {
  namespace?: string;
  server?: Parameters<WsAdapter['create']>[1] extends { server?: infer S }
    ? S
    : unknown;
  path?: string;
  perMessageDeflate?: boolean;
};

export class LilaWsAdapter extends WsAdapter {
  override create(port: number, options?: LilaWsOptions): BaseCreateReturn {
    const merged: BaseCreateOptions = {
      ...(options ?? {}),
      perMessageDeflate:
        options?.perMessageDeflate ??
        (process.env.WS_PERMESSAGE_DEFLATE || 'true').toLowerCase() === 'true',
    };
    return super.create(port, merged);
  }
}
