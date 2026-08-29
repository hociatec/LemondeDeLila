import { Injectable, OnModuleInit } from '@nestjs/common';
import { WsRouteRegistry } from '../../../../../platform/realtime/public-api';
import { WS_EVENTS } from '../../../../../platform/realtime/public-api';
import { SocialWsHandler } from './social-ws.handler';

@Injectable()
export class SocialWsRegistrar implements OnModuleInit {
  constructor(
    private readonly registry: WsRouteRegistry,
    private readonly handler: SocialWsHandler,
  ) {}

  onModuleInit() {
    this.registry.register(WS_EVENTS.social.friendsList, (session, _payload) =>
      this.handler.listFriends(session),
    );
    this.registry.register(
      WS_EVENTS.social.friendsRequests,
      (session, payload) => this.handler.listRequests(session, payload),
    );
    this.registry.register(
      WS_EVENTS.social.friendsBlocked,
      (session, _payload) => this.handler.listBlocked(session),
    );
    this.registry.register(
      WS_EVENTS.social.friendsRequest,
      (session, payload) => this.handler.requestFriend(session, payload),
    );
    this.registry.register(WS_EVENTS.social.friendsAccept, (session, payload) =>
      this.handler.acceptFriend(session, payload),
    );
    this.registry.register(WS_EVENTS.social.friendsReject, (session, payload) =>
      this.handler.rejectFriend(session, payload),
    );
    this.registry.register(WS_EVENTS.social.friendsCancel, (session, payload) =>
      this.handler.cancelRequest(session, payload),
    );
    this.registry.register(WS_EVENTS.social.friendsRemove, (session, payload) =>
      this.handler.removeFriend(session, payload),
    );
    this.registry.register(WS_EVENTS.social.friendsBlock, (session, payload) =>
      this.handler.blockFriend(session, payload),
    );
    this.registry.register(
      WS_EVENTS.social.friendsUnblock,
      (session, payload) => this.handler.unblockFriend(session, payload),
    );
    this.registry.register(WS_EVENTS.social.profileGet, (session, payload) =>
      this.handler.getProfile(session, payload),
    );
    this.registry.register(WS_EVENTS.social.profileUpdate, (session, payload) =>
      this.handler.updateProfile(session, payload),
    );
    this.registry.register(WS_EVENTS.social.userSearch, (session, payload) =>
      this.handler.searchUsers(session, payload),
    );
  }
}
