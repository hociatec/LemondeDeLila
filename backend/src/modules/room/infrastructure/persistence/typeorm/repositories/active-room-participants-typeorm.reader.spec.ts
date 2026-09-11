import { DataSource, In, IsNull } from 'typeorm';
import { RoomParticipant } from '../entities/room-participant.entity';
import { ActiveRoomParticipantsTypeormReader } from './active-room-participants-typeorm.reader';

describe('ActiveRoomParticipantsTypeormReader', () => {
  const repository = new DataSource({ type: 'mysql' }).getRepository(
    RoomParticipant,
  );
  const find = jest.spyOn(repository, 'find');
  const reader = new ActiveRoomParticipantsTypeormReader(repository);

  beforeEach(() => find.mockReset());

  it('does not query for empty or invalid identifiers', async () => {
    await expect(
      reader.listActiveRoomsByUserIds([NaN, 0, -1, Infinity]),
    ).resolves.toEqual([]);
    expect(find).not.toHaveBeenCalled();
  });

  it('returns a projection and filters active memberships in newest-first order', async () => {
    const row = Object.assign(new RoomParticipant(), {
      user: { id: 7, email: 'private' },
      room: {
        id: 3,
        name: 'Room',
        status: 'waiting',
        startedAt: null,
        secret: 'private',
      },
    });
    find.mockResolvedValue([row]);
    await expect(reader.listActiveRoomsByUserIds([7])).resolves.toEqual([
      {
        userId: 7,
        room: { id: 3, name: 'Room', status: 'waiting', startedAt: null },
      },
    ]);
    expect(find).toHaveBeenCalledWith({
      where: { leftAt: IsNull(), user: { id: In([7]) } },
      relations: { room: true, user: true },
      order: { joinedAt: 'DESC' },
      take: 10,
    });
  });
});
