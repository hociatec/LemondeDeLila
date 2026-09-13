import { RoomPayloadTypeormReader } from './room-payload-typeorm.reader';

type ReaderArguments = ConstructorParameters<typeof RoomPayloadTypeormReader>;

it('loads the payload projection through bounded relation queries', async () => {
  const roomFindOne = jest.fn().mockResolvedValue({
    id: 8,
    name: 'Table',
    gameType: 'lama',
    maxPlayers: 6,
    isPrivate: false,
    status: 'waiting',
    startedAt: null,
    runId: 3,
    tableAmbienceSoundId: null,
    owner: { id: 2, username: 'Lila', roles: ['ROLE_ADMIN'] },
    restoredFromSnapshotId: 'internal',
  });
  const participantFind = jest.fn().mockResolvedValue([
    {
      role: 'owner',
      leftAt: null,
      user: { id: 2, username: 'Lila', roles: ['ROLE_ADMIN'] },
    },
  ]);
  const botFind = jest
    .fn()
    .mockResolvedValue([{ id: 4, name: 'Noodle', createdAt: new Date() }]);
  const reader = new RoomPayloadTypeormReader(
    { findOne: roomFindOne } as ReaderArguments[0],
    { find: participantFind } as ReaderArguments[1],
    { find: botFind } as ReaderArguments[2],
  );

  await expect(reader.findPayload(8)).resolves.toEqual({
    id: 8,
    name: 'Table',
    gameType: 'lama',
    maxPlayers: 6,
    isPrivate: false,
    status: 'waiting',
    startedAt: null,
    runId: 3,
    tableAmbienceSoundId: null,
    owner: { id: 2, username: 'Lila' },
    participants: [
      {
        role: 'owner',
        leftAt: null,
        user: { id: 2, username: 'Lila' },
      },
    ],
    bots: [{ id: 4, name: 'Noodle' }],
  });
  expect(participantFind).toHaveBeenCalledWith(
    expect.objectContaining({
      select: {
        id: true,
        role: true,
        joinedAt: true,
        leftAt: true,
        user: { id: true, username: true },
      },
      take: 64,
    }),
  );
  expect(botFind).toHaveBeenCalledWith(
    expect.objectContaining({
      select: { id: true, name: true },
      take: 64,
    }),
  );
  expect(roomFindOne.mock.calls[0][0].select).not.toHaveProperty(
    'restoredFromSnapshotId',
  );
});

it('rejects invalid identifiers without querying persistence', async () => {
  const roomFindOne = jest.fn();
  const reader = new RoomPayloadTypeormReader(
    { findOne: roomFindOne } as ReaderArguments[0],
    { find: jest.fn() } as ReaderArguments[1],
    { find: jest.fn() } as ReaderArguments[2],
  );
  await expect(reader.findPayload(0)).resolves.toBeNull();
  expect(roomFindOne).not.toHaveBeenCalled();
});
