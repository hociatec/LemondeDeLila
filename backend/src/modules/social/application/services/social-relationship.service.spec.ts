import { HttpException } from '@nestjs/common';
import type { SocialRelationshipNotifier } from '../ports/social-relationship-notifier.port';
import type { SocialRelationshipRepository } from '../ports/social-relationship.repository';
import type { SocialUserReader } from '../ports/social-user.repository';
import { SocialRelationshipService } from './social-relationship.service';

describe('SocialRelationshipService', () => {
  const alice = { id: 1, username: 'Alice', avatar: null };
  const bob = { id: 2, username: 'Bob', avatar: null };
  const pending = {
    id: 7,
    requester: alice,
    addressee: bob,
    status: 'pending' as const,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  };

  function setup() {
    const relationships = {
      listAcceptedForUser: jest.fn().mockResolvedValue([]),
      listPendingForUser: jest.fn().mockResolvedValue([]),
      listBlockedByUser: jest.fn().mockResolvedValue([]),
      findRelationsBetween: jest.fn().mockResolvedValue([]),
      findPendingIncoming: jest.fn().mockResolvedValue(null),
      findPendingOutgoing: jest.fn().mockResolvedValue(null),
      findBlocked: jest.fn().mockResolvedValue(null),
      findAcceptedRelation: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(pending),
      save: jest.fn(async (record) => ({ ...record, updatedAt: new Date() })),
      remove: jest.fn().mockResolvedValue(undefined),
      removeMany: jest.fn().mockResolvedValue(undefined),
    };
    const users = { findById: jest.fn().mockResolvedValue(bob) };
    const notifications = {
      notifyFriendRequested: jest.fn().mockResolvedValue(undefined),
      notifyFriendAccepted: jest.fn().mockResolvedValue(undefined),
      notifyFriendRejected: jest.fn().mockResolvedValue(undefined),
    };
    return {
      service: new SocialRelationshipService(
        relationships as unknown as SocialRelationshipRepository,
        users as unknown as SocialUserReader,
        notifications as unknown as SocialRelationshipNotifier,
      ),
      relationships,
      notifications,
    };
  }

  it('accepts a crossed pending invitation instead of creating a duplicate', async () => {
    const { service, relationships, notifications } = setup();
    relationships.findRelationsBetween.mockResolvedValue([
      { ...pending, requester: bob, addressee: alice },
    ]);

    await expect(service.requestFriend(1, 2)).resolves.toEqual(
      expect.objectContaining({ status: 'accepted' }),
    );
    expect(relationships.create).not.toHaveBeenCalled();
    expect(notifications.notifyFriendAccepted).toHaveBeenCalledWith(2, {
      userId: 1,
    });
  });

  it('recovers idempotently from a concurrent unique-pair failure', async () => {
    const { service, relationships, notifications } = setup();
    relationships.findRelationsBetween
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([pending]);
    relationships.create.mockRejectedValue({ code: 'ER_DUP_ENTRY' });

    await expect(service.requestFriend(1, 2)).resolves.toEqual({
      id: 7,
      status: 'pending',
      createdAt: pending.createdAt,
    });
    expect(notifications.notifyFriendRequested).not.toHaveBeenCalled();
  });

  it('rejects unauthorized acceptance and removes pending edges before blocking', async () => {
    const { service, relationships } = setup();
    await expect(service.acceptFriend(1, 2)).rejects.toBeInstanceOf(
      HttpException,
    );

    relationships.findRelationsBetween.mockResolvedValue([pending]);
    relationships.create.mockResolvedValue({ ...pending, status: 'blocked' });
    await service.blockUser(1, 2);
    expect(relationships.removeMany).toHaveBeenCalledWith([pending]);
  });
});
