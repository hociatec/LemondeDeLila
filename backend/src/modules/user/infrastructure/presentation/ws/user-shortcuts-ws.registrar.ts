import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  requireUser,
  WS_EVENTS,
  WsRouteRegistry,
} from '../../../../../platform/realtime/public-api';
import { UserShortcutsService } from '../../../application/use-cases/user-shortcuts.service';

@Injectable()
export class UserShortcutsWsRegistrar implements OnModuleInit {
  constructor(
    private readonly registry: WsRouteRegistry,
    private readonly shortcuts: UserShortcutsService,
  ) {}
  onModuleInit() {
    this.registry.register(WS_EVENTS.users.shortcutsGet, async (session) => ({
      type: WS_EVENTS.users.shortcutsGet,
      payload: await this.shortcuts.get(requireUser(session).id),
    }));
    this.registry.register(
      WS_EVENTS.users.shortcutsSet,
      async (session, payload) => ({
        type: WS_EVENTS.users.shortcutsSet,
        payload: await this.shortcuts.replace(requireUser(session).id, payload),
      }),
    );
  }
}
