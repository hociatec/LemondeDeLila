import { WsAdapter } from '@nestjs/platform-ws';
type BaseCreateOptions = Parameters<WsAdapter['create']>[1];
type BaseCreateReturn = ReturnType<WsAdapter['create']>;
type LilaWsOptions = BaseCreateOptions & {
    namespace?: string;
    server?: Parameters<WsAdapter['create']>[1] extends {
        server?: infer S;
    } ? S : unknown;
    path?: string;
    perMessageDeflate?: boolean;
};
export declare class LilaWsAdapter extends WsAdapter {
    create(port: number, options?: LilaWsOptions): BaseCreateReturn;
}
export {};
