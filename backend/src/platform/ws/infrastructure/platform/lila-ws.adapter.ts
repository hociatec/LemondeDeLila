import { WsAdapter } from '@nestjs/platform-ws';
import { readEnvironmentBoolean } from '../../../config/public-api';

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
        readEnvironmentBoolean('WS_PERMESSAGE_DEFLATE', true),
    };
    return super.create(port, merged);
  }
}
