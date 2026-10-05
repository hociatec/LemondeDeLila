import {
  type RoomSnapshot,
  collectRoomAnnouncementMessages,
} from './room-announcement.helpers';

function snapshot(input: Partial<RoomSnapshot> = {}): RoomSnapshot {
  return {
    players: new Map(),
    spectators: new Map(),
    bots: new Map(),
    ownerId: null,
    ownerName: '',
    isPrivate: false,
    ...input,
  };
}

it('announces joins, leaves, bot replacement and human owner transfer', () => {
  const previous = snapshot({
    players: new Map([
      [1, 'Lila'],
      [2, 'Mina'],
    ]),
    ownerId: 1,
    ownerName: 'Lila',
  });
  const next = snapshot({
    players: new Map([
      [2, 'Mina'],
      [3, 'Noé'],
    ]),
    bots: new Map([[-1, 'Bot Lila']]),
    ownerId: 2,
    ownerName: 'Mina',
  });

  expect(collectRoomAnnouncementMessages(previous, next)).toEqual([
    'Noé a rejoint la table.',
    'Lila a quitté la table.',
    'Bot Lila a rejoint la table.',
    'Nouveau propriétaire : Mina.',
  ]);
});
