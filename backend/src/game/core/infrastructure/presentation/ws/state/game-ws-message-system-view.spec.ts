import {
  decodeMessageSystem,
  decodeReceivedCardData,
  decodeScoreChangedData,
  decodeSemanticMessageData,
  decodeTurnStartedData,
} from './game-ws-message-system-view';

describe('game message boundary decoders', () => {
  it('decodes stable event structures once and drops invalid known fields', () => {
    const system = decodeMessageSystem({
      match: { status: 'playing' },
      players: { all: [{ id: 1, username: 'Lila' }, { id: 'bad' }] },
      events: {
        recent: [
          {
            id: 'message:1',
            type: 'game.message',
            actorId: 1,
            data: {
              announce: true,
              message: '  Bonjour  ',
              narration: {
                default: '  Message public  ',
                byPlayerId: { '1': '  Message privé  ', bad: 42 },
                supersedes: ['card.drawn', 7],
              },
            },
          },
        ],
        latestByType: {},
      },
    });

    expect(system.players.all).toEqual([{ id: 1, username: 'Lila' }]);
    expect(system.events.recent[0]?.data).toMatchObject({
      announce: true,
      message: 'Bonjour',
      narration: {
        default: 'Message public',
        byPlayerId: { '1': 'Message privé' },
        supersedes: ['card.drawn'],
      },
    });
  });

  it('specializes semantic, received-card, next-turn and score payloads', () => {
    const semantic = decodeSemanticMessageData({
      key: ' game.card.drawn ',
      params: {
        playerId: 1,
        total: 'invalid',
        cardLabel: 'Soleil',
        revealed: true,
        results: [
          { playerId: 1, outcome: 'correct', ignored: 'private answer' },
        ],
        ignored: 'not propagated',
      },
    });
    expect(semantic).toEqual({
      key: 'game.card.drawn',
      params: {
        playerId: 1,
        cardLabel: 'Soleil',
        revealed: true,
        results: [{ playerId: 1, outcome: 'correct' }],
      },
    });
    expect(
      decodeReceivedCardData({
        playerId: 1,
        card: { id: 'sun', label: 'Soleil', secret: 'removed' },
      }),
    ).toEqual({ playerId: 1, card: { id: 'sun', label: 'Soleil' } });
    expect(decodeTurnStartedData({ playerId: 2, turnNumber: 4 })).toEqual({
      playerId: 2,
      turnNumber: 4,
    });
    expect(
      decodeScoreChangedData({ playerId: 2, value: 12, delta: 3 }),
    ).toEqual({ playerId: 2, value: 12, delta: 3 });
  });
});
