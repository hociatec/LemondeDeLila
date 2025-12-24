import { Injectable, OnModuleInit } from '@nestjs/common';
import { WsRouteRegistry } from '../../common/ws/ws-route-registry.service';
import { MessagingWsHandler } from './messaging-ws.handler';

@Injectable()
export class MessagingWsRegistrar implements OnModuleInit {
  constructor(
    private readonly registry: WsRouteRegistry,
    private readonly handler: MessagingWsHandler,
  ) {}

  onModuleInit() {
    this.registry.register('messaging.conversation', (session, payload) =>
      this.handler.conversation(session, payload),
    );
    this.registry.register('messaging.messages', (session, payload) =>
      this.handler.messages(session, payload),
    );
    this.registry.register('messaging.send', (session, payload) =>
      this.handler.send(session, payload),
    );
    this.registry.register('messaging.delete', (session, payload) =>
      this.handler.delete(session, payload),
    );
    this.registry.register('messaging.restore', (session, payload) =>
      this.handler.restore(session, payload),
    );
    this.registry.register('messaging.purge', (session, payload) =>
      this.handler.purge(session, payload),
    );
    this.registry.register('messaging.search', (_, payload) =>
      this.handler.search(payload),
    );
  }
}
