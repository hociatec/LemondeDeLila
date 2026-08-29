import { Injectable, OnModuleInit } from '@nestjs/common';
import { WsRouteRegistry } from '../../../../../platform/realtime/public-api';
import { WS_EVENTS } from '../../../../../platform/realtime/public-api';
import { MessagingWsHandler } from './messaging-ws.handler';

@Injectable()
export class MessagingWsRegistrar implements OnModuleInit {
  constructor(
    private readonly registry: WsRouteRegistry,
    private readonly handler: MessagingWsHandler,
  ) {}

  onModuleInit() {
    this.registry.register(
      WS_EVENTS.messaging.conversation,
      (session, payload) => this.handler.conversation(session, payload),
    );
    this.registry.register(WS_EVENTS.messaging.messages, (session, payload) =>
      this.handler.messages(session, payload),
    );
    this.registry.register(WS_EVENTS.messaging.send, (session, payload) =>
      this.handler.send(session, payload),
    );
    this.registry.register(WS_EVENTS.messaging.delete, (session, payload) =>
      this.handler.delete(session, payload),
    );
    this.registry.register(WS_EVENTS.messaging.restore, (session, payload) =>
      this.handler.restore(session, payload),
    );
    this.registry.register(WS_EVENTS.messaging.purge, (session, payload) =>
      this.handler.purge(session, payload),
    );
    this.registry.register(WS_EVENTS.messaging.markRead, (session, payload) =>
      this.handler.markRead(session, payload),
    );
    this.registry.register(WS_EVENTS.messaging.search, (session, payload) =>
      this.handler.search(session, payload),
    );
  }
}
