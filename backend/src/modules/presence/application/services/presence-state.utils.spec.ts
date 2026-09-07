import {
  computePresenceAvailability,
  computePresenceLocation,
  decodePresenceCurrentRoom,
  decodePresencePublicPlayer,
  enrichPresencePlayers,
  mergePresencePlayersFromOrigins,
  normalizePresenceContext,
  parsePresenceRoomId,
  scorePresenceActivity,
  type PresenceConnectionContext,
  type PresencePublicPlayer,
} from './presence-state.utils';

describe('presence state utilities', () => {
  describe('parsePresenceRoomId', () => {
    it.each([
      [7, 7],
      ['42', 42],
      ['7-table', 7],
      [0, null],
      [-1, null],
      [1.5, null],
      ['invalid', null],
      [null, null],
    ])('normalizes %p to %p', (value, expected) => {
      expect(parsePresenceRoomId(value)).toBe(expected);
    });
  });

  it('normalizes every public context and falls back to home', () => {
    const contexts: PresenceConnectionContext[] = [
      'chat',
      'table',
      'tavern',
      'messaging',
      'social',
      'stats',
      'notifications',
      'other',
    ];

    for (const context of contexts) {
      expect(normalizePresenceContext(context)).toBe(context);
    }
    expect(normalizePresenceContext('unknown')).toBe('home');
  });

  it('ranks contexts by their relevance to the current activity', () => {
    expect(scorePresenceActivity('table')).toBe(0);
    for (const context of [
      'messaging',
      'social',
      'notifications',
      'other',
    ] as const) {
      expect(scorePresenceActivity(context)).toBe(1);
    }
    expect(scorePresenceActivity('chat')).toBe(2);
    expect(scorePresenceActivity('tavern')).toBe(3);
    expect(scorePresenceActivity('stats')).toBe(3);
    expect(scorePresenceActivity('home')).toBe(4);
  });

  describe('decoding', () => {
    it('decodes rooms and supplies a stable fallback name', () => {
      expect(
        decodePresenceCurrentRoom({ id: '12', name: '  Salon  ' }),
      ).toEqual({ id: 12, name: 'Salon' });
      expect(decodePresenceCurrentRoom({ id: 8, name: '' })).toEqual({
        id: 8,
        name: 'Table #8',
      });
      expect(decodePresenceCurrentRoom(null)).toBeNull();
      expect(decodePresenceCurrentRoom([])).toBeNull();
      expect(decodePresenceCurrentRoom({ id: 0 })).toBeNull();
    });

    it('rejects malformed players', () => {
      for (const value of [null, [], {}, { id: 0 }, { id: -1 }, { id: NaN }]) {
        expect(decodePresencePublicPlayer(value)).toBeNull();
      }
    });

    it('normalizes optional player fields', () => {
      expect(
        decodePresencePublicPlayer({
          id: 4,
          username: '  Lila  ',
          activity: ' TABLE ',
          currentRoom: { id: 9, name: ' Jeu ' },
          lastInteractionAt: 123,
          roomStarted: true,
        }),
      ).toEqual({
        id: 4,
        username: 'Lila',
        activity: 'table',
        currentRoom: { id: 9, name: 'Jeu' },
        lastInteractionAt: 123,
        roomStarted: true,
      });

      expect(decodePresencePublicPlayer({ id: 5 })).toEqual({
        id: 5,
        username: 'user#5',
        activity: 'home',
        currentRoom: null,
        lastInteractionAt: 0,
        roomStarted: null,
      });
    });
  });

  it('merges duplicate players using context priority and fresh metadata', () => {
    const playersByOrigin = new Map<
      string,
      { at: number; players: PresencePublicPlayer[] }
    >([
      [
        'one',
        {
          at: 1,
          players: [
            player(1, 'home', 10),
            player(2, 'chat', 10),
            player(3, 'chat', 10, null, null),
          ],
        },
      ],
      [
        'two',
        {
          at: 2,
          players: [
            player(1, 'table', 5, { id: 7, name: 'Partie' }, true),
            player(2, 'chat', 20, { id: 8, name: 'Salon' }, false),
            player(3, 'chat', 5, { id: 9, name: 'Table #9' }, true),
            player(4, 'stats', 30),
            { ...player(99, 'home', 1), id: 0 },
          ],
        },
      ],
      ['empty', { at: 3, players: undefined as never }],
    ]);

    expect(mergePresencePlayersFromOrigins(playersByOrigin)).toEqual([
      player(1, 'table', 5, { id: 7, name: 'Partie' }, true),
      player(2, 'chat', 20, { id: 8, name: 'Salon' }, false),
      player(3, 'chat', 10, { id: 9, name: 'Table #9' }, true),
      player(4, 'stats', 30),
    ]);
  });

  describe('presentation', () => {
    it('computes absence and activity availability', () => {
      expect(computePresenceAvailability('home', null, 1_000, 100, 500)).toBe(
        'absent',
      );
      expect(computePresenceAvailability('table', true, 1_000, 900, 500)).toBe(
        'occupied',
      );
      expect(computePresenceAvailability('table', false, 1_000, 900, 500)).toBe(
        'available',
      );
      for (const activity of ['chat', 'tavern', 'stats', 'home'] as const) {
        expect(
          computePresenceAvailability(activity, null, 1_000, 900, 500),
        ).toBe('available');
      }
      expect(
        computePresenceAvailability('messaging', null, 1_000, 900, 500),
      ).toBe('occupied');
    });

    it.each([
      ['table', { id: 2, name: 'Duel' }, 'Duel'],
      ['table', { id: 2, name: '' }, 'Table #2'],
      ['table', null, 'Table'],
      ['chat', null, 'tchat'],
      ['tavern', null, 'taverne'],
      ['stats', null, 'livre des contes'],
      ['messaging', null, 'messagerie'],
      ['social', null, 'social'],
      ['notifications', null, 'notifications'],
      ['home', null, 'accueil'],
      ['other', null, 'application'],
    ] as const)(
      'maps %s to its public location',
      (activity, room, expected) => {
        expect(computePresenceLocation(activity, room)).toBe(expected);
      },
    );

    it('enriches every player without mutating the source', () => {
      const source = [player(1, 'table', 950, { id: 3, name: 'Lama' }, true)];
      const result = enrichPresencePlayers(source, 1_000, 500);

      expect(result).toEqual([
        {
          ...source[0],
          availability: 'occupied',
          location: 'Lama',
        },
      ]);
      expect(result[0]).not.toBe(source[0]);
      expect(source[0]).not.toHaveProperty('availability');
    });
  });
});

function player(
  id: number,
  activity: PresenceConnectionContext,
  lastInteractionAt: number,
  currentRoom: { id: number; name: string } | null = null,
  roomStarted: boolean | null = null,
): PresencePublicPlayer {
  return {
    id,
    username: `user-${id}`,
    activity,
    currentRoom,
    lastInteractionAt,
    roomStarted,
  };
}
