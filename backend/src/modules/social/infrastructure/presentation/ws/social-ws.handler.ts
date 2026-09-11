import { Injectable } from '@nestjs/common';
import { PayloadValidationService } from '../../../../../platform/validation/public-api';
import { requireUser } from '../../../../../platform/realtime/public-api';
import type { WsSession } from '../../../../../platform/realtime/public-api';
import { SocialProfileService } from '../../../application/services/social-profile.service';
import { SocialRelationshipService } from '../../../application/services/social-relationship.service';
import { WS_EVENTS } from '../../../../../platform/realtime/public-api';
import {
  SocialProfileGetDto,
  SocialProfileUpdateDto,
  SocialRequestListDto,
  SocialSearchDto,
  SocialUserIdDto,
} from './dto/social-ws.dto';

@Injectable()
export class SocialWsHandler {
  constructor(
    private readonly relationships: SocialRelationshipService,
    private readonly profiles: SocialProfileService,
    private readonly validator: PayloadValidationService,
  ) {}

  async listFriends(session: WsSession) {
    const user = requireUser(session);
    const items = await this.relationships.listFriends(user.id);
    return { type: WS_EVENTS.social.friendsList, payload: { items } };
  }

  async listRequests(session: WsSession, payload: unknown) {
    const user = requireUser(session);
    const dto = this.validator.validate(SocialRequestListDto, payload);
    const direction = (dto.direction ?? 'incoming') as
      'incoming' | 'outgoing' | 'all';
    const items = await this.relationships.listRequests(user.id, direction);
    return { type: WS_EVENTS.social.friendsRequests, payload: { items } };
  }

  async listBlocked(session: WsSession) {
    const user = requireUser(session);
    const items = await this.relationships.listBlocked(user.id);
    return { type: WS_EVENTS.social.friendsBlocked, payload: { items } };
  }

  async requestFriend(session: WsSession, payload: unknown) {
    const user = requireUser(session);
    const dto = this.validator.validate(SocialUserIdDto, payload);
    const result = await this.relationships.requestFriend(user.id, dto.userId);
    return { type: WS_EVENTS.social.friendsRequest, payload: result };
  }

  async acceptFriend(session: WsSession, payload: unknown) {
    const user = requireUser(session);
    const dto = this.validator.validate(SocialUserIdDto, payload);
    const result = await this.relationships.acceptFriend(user.id, dto.userId);
    return { type: WS_EVENTS.social.friendsAccept, payload: result };
  }

  async rejectFriend(session: WsSession, payload: unknown) {
    const user = requireUser(session);
    const dto = this.validator.validate(SocialUserIdDto, payload);
    const result = await this.relationships.rejectFriend(user.id, dto.userId);
    return { type: WS_EVENTS.social.friendsReject, payload: result };
  }

  async cancelRequest(session: WsSession, payload: unknown) {
    const user = requireUser(session);
    const dto = this.validator.validate(SocialUserIdDto, payload);
    const result = await this.relationships.cancelRequest(user.id, dto.userId);
    return { type: WS_EVENTS.social.friendsCancel, payload: result };
  }

  async removeFriend(session: WsSession, payload: unknown) {
    const user = requireUser(session);
    const dto = this.validator.validate(SocialUserIdDto, payload);
    const result = await this.relationships.removeFriend(user.id, dto.userId);
    return { type: WS_EVENTS.social.friendsRemove, payload: result };
  }

  async blockFriend(session: WsSession, payload: unknown) {
    const user = requireUser(session);
    const dto = this.validator.validate(SocialUserIdDto, payload);
    const result = await this.relationships.blockUser(user.id, dto.userId);
    return { type: WS_EVENTS.social.friendsBlock, payload: result };
  }

  async unblockFriend(session: WsSession, payload: unknown) {
    const user = requireUser(session);
    const dto = this.validator.validate(SocialUserIdDto, payload);
    const result = await this.relationships.unblockUser(user.id, dto.userId);
    return { type: WS_EVENTS.social.friendsUnblock, payload: result };
  }

  async getProfile(session: WsSession, payload: unknown) {
    const user = requireUser(session);
    const dto = this.validator.validate(SocialProfileGetDto, payload);
    const targetId = dto.userId ?? user.id;
    const result = await this.profiles.getProfile(user.id, targetId);
    return { type: WS_EVENTS.social.profileGet, payload: { profile: result } };
  }

  async updateProfile(session: WsSession, payload: unknown) {
    const user = requireUser(session);
    const dto = this.validator.validate(SocialProfileUpdateDto, payload);
    const result = await this.profiles.updateProfile(
      user.id,
      dto.bio,
      dto.victoryMessage,
      dto.defeatMessage,
      dto.visibility,
    );
    return {
      type: WS_EVENTS.social.profileUpdate,
      payload: { profile: result },
    };
  }

  async searchUsers(session: WsSession, payload: unknown) {
    const user = requireUser(session);
    const dto = this.validator.validate(SocialSearchDto, payload);
    const items = await this.profiles.searchUsers(dto.query, user.id);
    return { type: WS_EVENTS.social.userSearch, payload: { items } };
  }
}
