import { Injectable } from '@nestjs/common';
import { PayloadValidationService } from '../../common/validation/payload-validation.service';
import { requireUser } from '../../common/ws/ws-auth';
import type { WsSession } from '../../common/ws/ws-route-registry.service';
import { SocialService } from '../services/social.service';
import { WS_EVENTS } from '../../common/ws/ws-events';
import {
  SocialProfileGetDto,
  SocialProfileUpdateDto,
  SocialRequestListDto,
  SocialSearchDto,
  SocialUserIdDto,
} from './ws.dto';

@Injectable()
export class SocialWsHandler {
  constructor(
    private readonly social: SocialService,
    private readonly validator: PayloadValidationService,
  ) {}

  async listFriends(session: WsSession) {
    const user = requireUser(session);
    const items = await this.social.listFriends(user.id);
    return { type: WS_EVENTS.social.friendsList, payload: { items } };
  }

  async listRequests(session: WsSession, payload: unknown) {
    const user = requireUser(session);
    const dto = this.validator.validate(SocialRequestListDto, payload);
    const direction = (dto.direction ?? 'incoming') as
      | 'incoming'
      | 'outgoing'
      | 'all';
    const items = await this.social.listRequests(user.id, direction);
    return { type: WS_EVENTS.social.friendsRequests, payload: { items } };
  }

  async listBlocked(session: WsSession) {
    const user = requireUser(session);
    const items = await this.social.listBlocked(user.id);
    return { type: WS_EVENTS.social.friendsBlocked, payload: { items } };
  }

  async requestFriend(session: WsSession, payload: unknown) {
    const user = requireUser(session);
    const dto = this.validator.validate(SocialUserIdDto, payload);
    const result = await this.social.requestFriend(user.id, dto.userId);
    return { type: WS_EVENTS.social.friendsRequest, payload: result };
  }

  async acceptFriend(session: WsSession, payload: unknown) {
    const user = requireUser(session);
    const dto = this.validator.validate(SocialUserIdDto, payload);
    const result = await this.social.acceptFriend(user.id, dto.userId);
    return { type: WS_EVENTS.social.friendsAccept, payload: result };
  }

  async rejectFriend(session: WsSession, payload: unknown) {
    const user = requireUser(session);
    const dto = this.validator.validate(SocialUserIdDto, payload);
    const result = await this.social.rejectFriend(user.id, dto.userId);
    return { type: WS_EVENTS.social.friendsReject, payload: result };
  }

  async cancelRequest(session: WsSession, payload: unknown) {
    const user = requireUser(session);
    const dto = this.validator.validate(SocialUserIdDto, payload);
    const result = await this.social.cancelRequest(user.id, dto.userId);
    return { type: WS_EVENTS.social.friendsCancel, payload: result };
  }

  async removeFriend(session: WsSession, payload: unknown) {
    const user = requireUser(session);
    const dto = this.validator.validate(SocialUserIdDto, payload);
    const result = await this.social.removeFriend(user.id, dto.userId);
    return { type: WS_EVENTS.social.friendsRemove, payload: result };
  }

  async blockFriend(session: WsSession, payload: unknown) {
    const user = requireUser(session);
    const dto = this.validator.validate(SocialUserIdDto, payload);
    const result = await this.social.blockUser(user.id, dto.userId);
    return { type: WS_EVENTS.social.friendsBlock, payload: result };
  }

  async unblockFriend(session: WsSession, payload: unknown) {
    const user = requireUser(session);
    const dto = this.validator.validate(SocialUserIdDto, payload);
    const result = await this.social.unblockUser(user.id, dto.userId);
    return { type: WS_EVENTS.social.friendsUnblock, payload: result };
  }

  async getProfile(session: WsSession, payload: unknown) {
    const user = requireUser(session);
    const dto = this.validator.validate(SocialProfileGetDto, payload);
    const targetId = dto.userId ?? user.id;
    const result = await this.social.getProfile(user.id, targetId);
    return { type: WS_EVENTS.social.profileGet, payload: { profile: result } };
  }

  async updateProfile(session: WsSession, payload: unknown) {
    const user = requireUser(session);
    const dto = this.validator.validate(SocialProfileUpdateDto, payload);
    const result = await this.social.updateProfile(
      user.id,
      dto.bio,
      dto.victoryMessage,
      dto.defeatMessage,
      dto.visibility,
    );
    return { type: WS_EVENTS.social.profileUpdate, payload: { profile: result } };
  }

  async searchUsers(session: WsSession, payload: unknown) {
    const user = requireUser(session);
    const dto = this.validator.validate(SocialSearchDto, payload);
    const items = await this.social.searchUsers(dto.query, user.id);
    return { type: WS_EVENTS.social.userSearch, payload: { items } };
  }
}
