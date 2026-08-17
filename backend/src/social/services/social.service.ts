import { Injectable } from '@nestjs/common';
import type { SocialDirection } from './social-relationship.service';
import { SocialProfileService } from './social-profile.service';
import { SocialRelationshipService } from './social-relationship.service';

@Injectable()
export class SocialService {
  constructor(
    private readonly relationships: SocialRelationshipService,
    private readonly profiles: SocialProfileService,
  ) {}

  async listFriends(userId: number) {
    return this.relationships.listFriends(userId);
  }

  async listRequests(userId: number, direction: SocialDirection) {
    return this.relationships.listRequests(userId, direction);
  }

  async listBlocked(userId: number) {
    return this.relationships.listBlocked(userId);
  }

  async requestFriend(requesterId: number, addresseeId: number) {
    return this.relationships.requestFriend(requesterId, addresseeId);
  }

  async acceptFriend(userId: number, requesterId: number) {
    return this.relationships.acceptFriend(userId, requesterId);
  }

  async rejectFriend(userId: number, requesterId: number) {
    return this.relationships.rejectFriend(userId, requesterId);
  }

  async cancelRequest(userId: number, targetId: number) {
    return this.relationships.cancelRequest(userId, targetId);
  }

  async removeFriend(userId: number, targetId: number) {
    return this.relationships.removeFriend(userId, targetId);
  }

  async blockUser(userId: number, targetId: number) {
    return this.relationships.blockUser(userId, targetId);
  }

  async unblockUser(userId: number, targetId: number) {
    return this.relationships.unblockUser(userId, targetId);
  }

  async getProfile(viewerId: number, targetId: number) {
    return this.profiles.getProfile(viewerId, targetId);
  }

  async updateProfile(
    userId: number,
    bio?: string,
    victoryMessage?: string,
    defeatMessage?: string,
    visibility?: string,
  ) {
    return this.profiles.updateProfile(
      userId,
      bio,
      victoryMessage,
      defeatMessage,
      visibility,
    );
  }

  async searchUsers(query: string, userId: number) {
    return this.profiles.searchUsers(query, userId);
  }
}
