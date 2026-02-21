import { Injectable, OnModuleInit } from '@nestjs/common';
import { WsRouteRegistry } from '../../common/ws/ws-route-registry.service';
import { SocialWsHandler } from './social-ws.handler';

@Injectable()
export class SocialWsRegistrar implements OnModuleInit {
  constructor(
    private readonly registry: WsRouteRegistry,
    private readonly handler: SocialWsHandler,
  ) {}

  onModuleInit() {
    this.registry.register('social.friends.list', (session, _payload) =>
      this.handler.listFriends(session),
    );
    this.registry.register('social.friends.requests', (session, payload) =>
      this.handler.listRequests(session, payload),
    );
    this.registry.register('social.friends.blocked', (session, _payload) =>
      this.handler.listBlocked(session),
    );
    this.registry.register('social.friends.request', (session, payload) =>
      this.handler.requestFriend(session, payload),
    );
    this.registry.register('social.friends.accept', (session, payload) =>
      this.handler.acceptFriend(session, payload),
    );
    this.registry.register('social.friends.reject', (session, payload) =>
      this.handler.rejectFriend(session, payload),
    );
    this.registry.register('social.friends.cancel', (session, payload) =>
      this.handler.cancelRequest(session, payload),
    );
    this.registry.register('social.friends.remove', (session, payload) =>
      this.handler.removeFriend(session, payload),
    );
    this.registry.register('social.friends.block', (session, payload) =>
      this.handler.blockFriend(session, payload),
    );
    this.registry.register('social.friends.unblock', (session, payload) =>
      this.handler.unblockFriend(session, payload),
    );
    this.registry.register('social.profile.get', (session, payload) =>
      this.handler.getProfile(session, payload),
    );
    this.registry.register('social.profile.update', (session, payload) =>
      this.handler.updateProfile(session, payload),
    );
    this.registry.register('social.user.search', (session, payload) =>
      this.handler.searchUsers(session, payload),
    );
  }
}
