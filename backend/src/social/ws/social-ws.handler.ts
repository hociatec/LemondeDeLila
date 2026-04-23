import { Injectable } from '@nestjs/common';
import { PayloadValidationService } from '../../common/validation/payload-validation.service';
import { requireUser } from '../../common/ws/ws-auth';
import type { WsSession } from '../../common/ws/ws-route-registry.service';
import { SocialService } from '../services/social.service';
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
    return { type: 'social.friends.list', payload: { items } };
  }

  async listRequests(session: WsSession, payload: unknown) {
    const user = requireUser(session);
    const dto = this.validator.validate(SocialRequestListDto, payload);
    const direction = (dto.direction ?? 'incoming') as
      | 'incoming'
      | 'outgoing'
      | 'all';
    const items = await this.social.listRequests(user.id, direction);
    return { type: 'social.friends.requests', payload: { items } };
  }

  async listBlocked(session: WsSession) {
    const user = requireUser(session);
    const items = await this.social.listBlocked(user.id);
    return { type: 'social.friends.blocked', payload: { items } };
  }

  async requestFriend(session: WsSession, payload: unknown) {
    const user = requireUser(session);
    const dto = this.validator.validate(SocialUserIdDto, payload);
    const result = await this.social.requestFriend(user.id, dto.userId);
    return { type: 'social.friends.request', payload: result };
  }

  async acceptFriend(session: WsSession, payload: unknown) {
    const user = requireUser(session);
    const dto = this.validator.validate(SocialUserIdDto, payload);
    const result = await this.social.acceptFriend(user.id, dto.userId);
    return { type: 'social.friends.accept', payload: result };
  }

  async rejectFriend(session: WsSession, payload: unknown) {
    const user = requireUser(session);
    const dto = this.validator.validate(SocialUserIdDto, payload);
    const result = await this.social.rejectFriend(user.id, dto.userId);
    return { type: 'social.friends.reject', payload: result };
  }

  async cancelRequest(session: WsSession, payload: unknown) {
    const user = requireUser(session);
    const dto = this.validator.validate(SocialUserIdDto, payload);
    const result = await this.social.cancelRequest(user.id, dto.userId);
    return { type: 'social.friends.cancel', payload: result };
  }

  async removeFriend(session: WsSession, payload: unknown) {
    const user = requireUser(session);
    const dto = this.validator.validate(SocialUserIdDto, payload);
    const result = await this.social.removeFriend(user.id, dto.userId);
    return { type: 'social.friends.remove', payload: result };
  }

  async blockFriend(session: WsSession, payload: unknown) {
    const user = requireUser(session);
    const dto = this.validator.validate(SocialUserIdDto, payload);
    const result = await this.social.blockUser(user.id, dto.userId);
    return { type: 'social.friends.block', payload: result };
  }

  async unblockFriend(session: WsSession, payload: unknown) {
    const user = requireUser(session);
    const dto = this.validator.validate(SocialUserIdDto, payload);
    const result = await this.social.unblockUser(user.id, dto.userId);
    return { type: 'social.friends.unblock', payload: result };
  }

  async getProfile(session: WsSession, payload: unknown) {
    const user = requireUser(session);
    const dto = this.validator.validate(SocialProfileGetDto, payload);
    const targetId = dto.userId ?? user.id;
    const result = await this.social.getProfile(user.id, targetId);
    return { type: 'social.profile.get', payload: { profile: result } };
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
    return { type: 'social.profile.update', payload: { profile: result } };
  }

  async searchUsers(session: WsSession, payload: unknown) {
    const user = requireUser(session);
    const dto = this.validator.validate(SocialSearchDto, payload);
    const items = await this.social.searchUsers(dto.query, user.id);
    return { type: 'social.user.search', payload: { items } };
  }
}
