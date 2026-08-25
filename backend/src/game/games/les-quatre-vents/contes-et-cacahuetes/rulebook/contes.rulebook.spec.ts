import type { GameStateEntity } from '../../../../core/application/models/game-state.model';
import {
  GameValidationError,
  PlayerActionError,
} from '../../../../core/domain/errors/public-api';
import { getAvailableActions, validateAction } from './rulebook';

function makeState(overrides: Partial<GameStateEntity> = {}): GameStateEntity {
  return {
    status: 'started',
    phase: 'turn',
    round: 1,
    turnIndex: 0,
    lastRoll: null,
    log: [],
    players: [
      { id: 1, username: 'P1' } as any,
      { id: 2, username: 'P2' } as any,
    ],
    turn: { currentPlayerId: 1, direction: 1 },
    metadata: {
      statuses: {
        blockedUntilPassed: {},
      },
    } as any,
    pending: null,
    botThinking: false,
    ...overrides,
  };
}

describe('Contes rulebook', () => {
  it('returns available actions for choose_option and choose_card pending states', () => {
    const optionActions = getAvailableActions(
      makeState({
        pending: {
          type: 'choose_option',
          playerId: 1,
          blocking: true,
          choices: ['Avancer', 'Piocher'],
        } as any,
      }),
      1,
    );

    expect(optionActions).toEqual([
      { type: 'choose_option', payload: { option: 'Avancer' } },
      { type: 'choose_option', payload: { option: 'Piocher' } },
    ]);

    const cardActions = getAvailableActions(
      makeState({
        pending: {
          type: 'choose_card',
          playerId: 1,
          blocking: true,
          data: {
            cards: [
              { cardType: 'bonus', cardId: 10 },
              { cardType: 'surprise', cardId: 22 },
            ],
          },
        } as any,
      }),
      1,
    );

    expect(cardActions).toEqual([
      { type: 'choose_card', payload: { cardType: 'bonus', cardId: 10 } },
      { type: 'choose_card', payload: { cardType: 'surprise', cardId: 22 } },
    ]);
  });

  it('keeps roll available for a blocked current player so the turn can be skipped', () => {
    const blocked = getAvailableActions(
      makeState({
        metadata: {
          statuses: {
            blockedUntilPassed: { 1: 5 },
          },
        } as any,
      }),
      1,
    );
    expect(blocked).toEqual([{ type: 'roll', payload: {} }]);
  });

  it('returns empty actions when not current player', () => {
    const notCurrent = getAvailableActions(
      makeState({
        turn: { currentPlayerId: 2, direction: 1 },
      }),
      1,
    );
    expect(notCurrent).toEqual([]);
  });

  it('validates choose_card and rejects invalid choose_option payload', () => {
    const validated = validateAction(
      makeState({
        pending: {
          type: 'choose_card',
          playerId: 1,
          blocking: true,
          data: {
            cards: [{ cardType: 'bonus', cardId: 7 }],
          },
        } as any,
      }),
      { type: 'choose_card', payload: { cardType: 'bonus', cardId: 7 } },
      1,
    );
    expect(validated).toEqual({
      type: 'choose_card',
      payload: { cardType: 'bonus', cardId: 7 },
    });

    expect(() =>
      validateAction(
        makeState({
          pending: {
            type: 'choose_option',
            playerId: 1,
            blocking: true,
            choices: ['A', 'B'],
          } as any,
        }),
        { type: 'choose_option', payload: { option: 'Z' } },
        1,
      ),
    ).toThrow(GameValidationError);
  });

  it('validates roll for a blocked current player so the action service can skip them', () => {
    expect(
      validateAction(
        makeState({
          metadata: {
            statuses: {
              blockedUntilPassed: { 1: 9 },
            },
          } as any,
        }),
        { type: 'roll', payload: {} },
        1,
      ),
    ).toEqual({ type: 'roll', payload: {} });
  });

  it('rejects roll when actor is not on turn', () => {
    expect(() =>
      validateAction(
        makeState({
          turn: { currentPlayerId: 2, direction: 1 },
        }),
        { type: 'roll', payload: {} },
        1,
      ),
    ).toThrow(PlayerActionError);
  });
});






