import { Injectable, OnModuleInit } from '@nestjs/common';
import { WsRouteRegistry } from '../../../../realtime/public-api';
import { VaultWsHandler } from './vault-ws.handler';

@Injectable()
export class VaultWsRegistrar implements OnModuleInit {
  constructor(
    private readonly registry: WsRouteRegistry,
    private readonly handler: VaultWsHandler,
  ) {}

  onModuleInit(): void {
    this.registry.register('vault.list', (s) => this.handler.list(s));
    this.registry.register('vault.save', (s, p) => this.handler.save(s, p));
    this.registry.register('vault.restore', (s, p) =>
      this.handler.restore(s, p),
    );
    this.registry.register('vault.delete', (s, p) => this.handler.delete(s, p));
    this.registry.register('vault.abandon', (s, p) =>
      this.handler.abandon(s, p),
    );
  }
}

