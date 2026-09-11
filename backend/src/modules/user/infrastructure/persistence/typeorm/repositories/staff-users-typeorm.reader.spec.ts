import { DataSource } from 'typeorm';
import { User } from '../entities/user.entity';
import { StaffUsersTypeormReader } from './staff-users-typeorm.reader';

it('finds staff beyond the first page and returns identifiers without loading user secrets', async () => {
  const repository = new DataSource({
    type: 'mysql',
    database: 'metadata_only',
  }).getRepository(User);
  const find = jest
    .spyOn(repository, 'find')
    .mockResolvedValueOnce(
      Array.from({ length: 500 }, (_, index) =>
        Object.assign(new User(), { id: index + 1, roles: [] }),
      ),
    )
    .mockResolvedValueOnce([
      Object.assign(new User(), { id: 501, roles: ['ROLE_ADMIN'] }),
    ])
    .mockResolvedValueOnce([]);
  await expect(
    new StaffUsersTypeormReader(repository).listStaff(),
  ).resolves.toEqual([{ id: 501 }]);
  for (const [options] of find.mock.calls)
    expect(options?.select).toEqual({ id: true, roles: true });
  expect(find.mock.calls[1][0]?.where).toMatchObject({
    id: expect.objectContaining({ _value: 500 }),
  });
});
