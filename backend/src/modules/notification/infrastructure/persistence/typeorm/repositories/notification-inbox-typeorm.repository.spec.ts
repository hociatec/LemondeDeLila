import type { Repository } from 'typeorm';
import { NotificationInboxItemEntity } from '../entities/notification-inbox-item.entity';
import {
  NotificationInboxPersistenceError,
  NotificationInboxTypeormRepository,
} from './notification-inbox-typeorm.repository';

describe('NotificationInboxTypeormRepository ownership', () => {
  it('filters contact history by owner before applying the message limit', async () => {
    const builder = Object.fromEntries(
      [
        'innerJoin',
        'select',
        'addSelect',
        'where',
        'andWhere',
        'orderBy',
        'addOrderBy',
        'limit',
      ].map((method) => [method, jest.fn().mockReturnThis()]),
    ) as Record<string, jest.Mock> & { getRawMany: jest.Mock };
    builder.getRawMany = jest.fn().mockResolvedValue([]);
    const repository = {
      createQueryBuilder: () => builder,
    } as unknown as Repository<NotificationInboxItemEntity>;
    const inbox = new NotificationInboxTypeormRepository(repository, {
      now: () => Date.now(),
    });
    await inbox.listByContactId('admin_contact', 'contact-1', 7);
    expect(builder.andWhere).toHaveBeenCalledWith('u.id = :userId', {
      userId: 7,
    });
    expect(builder.orderBy).toHaveBeenCalledWith('it.createdAt', 'DESC');
    expect(builder.limit).toHaveBeenCalledWith(500);
  });

  it('never deletes an inbox item without matching its owner', async () => {
    const execute = jest.fn().mockResolvedValue({ affected: 0 });
    const query = {
      delete: jest.fn(),
      from: jest.fn(),
      where: jest.fn(),
      andWhere: jest.fn(),
      execute,
    };
    query.delete.mockReturnValue(query);
    query.from.mockReturnValue(query);
    query.where.mockReturnValue(query);
    query.andWhere.mockReturnValue(query);
    const repository = {
      createQueryBuilder: jest.fn().mockReturnValue(query),
      findOne: jest.fn(),
    } as unknown as Repository<NotificationInboxItemEntity>;
    const inbox = new NotificationInboxTypeormRepository(repository, {
      now: () => Date.now(),
    });

    await expect(inbox.delete(7, 'owned-by-another-user')).resolves.toBe(false);

    expect(query.where).toHaveBeenCalledWith('id = :id', {
      id: 'owned-by-another-user',
    });
    expect(query.andWhere).toHaveBeenCalledWith('user_id = :userId', {
      userId: 7,
    });
    expect(repository.findOne).not.toHaveBeenCalled();
  });

  it('distinguishes an empty contact inbox from a SQL failure', async () => {
    const builder = Object.fromEntries(
      ['innerJoin', 'select', 'addSelect', 'where', 'andWhere', 'limit'].map(
        (method) => [method, jest.fn().mockReturnThis()],
      ),
    ) as Record<string, jest.Mock> & { getRawMany: jest.Mock };
    const repository = {
      createQueryBuilder: jest.fn().mockReturnValue(builder),
    } as unknown as Repository<NotificationInboxItemEntity>;
    const inbox = new NotificationInboxTypeormRepository(repository, {
      now: () => Date.now(),
    });

    builder.getRawMany = jest.fn().mockResolvedValueOnce([]);
    await expect(
      inbox.listByContactId('message', 'contact-1'),
    ).resolves.toEqual([]);

    const sqlFailure = new Error('connection lost');
    builder.getRawMany.mockRejectedValueOnce(sqlFailure);
    await expect(
      inbox.listByContactId('message', 'contact-1'),
    ).rejects.toMatchObject({
      name: 'NotificationInboxPersistenceError',
      code: 'NOTIFICATION_INBOX_PERSISTENCE_FAILURE',
      cause: sqlFailure,
    } satisfies Partial<NotificationInboxPersistenceError>);
  });
});
