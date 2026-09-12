import { decodeVaultRoomSnapshot } from './vault-snapshot.decoder';

const snapshot = () => ({
  version: 1,
  savedAt: '2026-09-08T00:00:00.000Z',
  room: {
    name: 'Room',
    isPrivate: false,
    maxPlayers: 4,
    tableAmbienceSoundId: null,
  },
  roster: {
    ownerUserId: 1,
    players: [{ id: 1, username: 'Owner' }],
    bots: [{ id: 2, name: 'Bot' }],
  },
  game: {
    gameType: 'lama',
    state: { status: 'started', phase: 'playing', log: [] },
  },
});

it.each([
  '2026-02-30T00:00:00Z',
  '2026-09-08T00:00:00',
  '2026-09-08T24:00:00Z',
])('rejects savedAt %s before restoration', (savedAt) => {
  expect(decodeVaultRoomSnapshot({ ...snapshot(), savedAt })).toBeNull();
});

it('accepts the versioned snapshot envelope and rejects invalid dates, bounds and identities', () => {
  expect(decodeVaultRoomSnapshot(snapshot())).not.toBeNull();
  const changes: ((value: ReturnType<typeof snapshot>) => void)[] = [
    (value) => {
      value.version = 2;
    },
    (value) => {
      value.savedAt = 'invalid';
    },
    (value) => {
      value.room.maxPlayers = 0;
    },
    (value) => {
      value.room.maxPlayers = 65;
    },
    (value) => {
      value.roster.ownerUserId = -1;
    },
    (value) => {
      value.roster.players[0].id = -1;
    },
    (value) => {
      value.roster.players.push({ ...value.roster.players[0] });
    },
    (value) => {
      value.roster.bots.push({ ...value.roster.bots[0] });
    },
    (value) => {
      value.game.gameType = ' ';
    },
  ];
  for (const change of changes) {
    const value = snapshot();
    change(value);
    expect(decodeVaultRoomSnapshot(value)).toBeNull();
  }
});
