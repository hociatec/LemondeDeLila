import { toRoomEntityPatch } from './room-typeorm.mappers';

describe('Room TypeORM mappers', () => {
  it('keeps omitted room fields out of a partial update', () => {
    expect(
      toRoomEntityPatch({ status: 'setup', startedAt: null }),
    ).toStrictEqual({ status: 'setup', startedAt: null });
  });

  it('maps explicit nullable and false values without inventing defaults', () => {
    expect(
      toRoomEntityPatch({
        gameType: 'lama',
        isPrivate: false,
        owner: null,
      }),
    ).toStrictEqual({ gameType: 'lama', isPrivate: false, owner: null });
  });
});
