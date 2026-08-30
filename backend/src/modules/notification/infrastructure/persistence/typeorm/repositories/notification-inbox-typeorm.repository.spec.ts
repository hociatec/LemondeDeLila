import type { Repository } from 'typeorm';
import { NotificationInboxItemEntity } from '../entities/notification-inbox-item.entity';
import { NotificationInboxTypeormRepository } from './notification-inbox-typeorm.repository';

describe('NotificationInboxTypeormRepository ownership', () => {
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
    const inbox = new NotificationInboxTypeormRepository(repository);

    await expect(inbox.delete(7, 'owned-by-another-user')).resolves.toBe(false);

    expect(query.where).toHaveBeenCalledWith('id = :id', {
      id: 'owned-by-another-user',
    });
    expect(query.andWhere).toHaveBeenCalledWith('user_id = :userId', {
      userId: 7,
    });
    expect(repository.findOne).not.toHaveBeenCalled();
  });
});
