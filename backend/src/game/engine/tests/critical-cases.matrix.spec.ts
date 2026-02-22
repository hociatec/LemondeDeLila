import { BadRequestException } from '@nestjs/common';
import { SetupFlowService } from '../../modules/setup-flow/services/setup-flow.service';
import { GridCellActionsService } from '../../modules/grid/services/grid-cell-actions.service';
import { MorpionPresenter } from '../../games/vents-sacres/morpion/morpion.presenter';
import { MorpionService } from '../../games/vents-sacres/morpion/morpion.service';
import { GameEngineService } from '../services/game-engine.service';
import { GameRegistryService } from '../services/game-registry.service';
import { GameLoggerService } from '../../common/services/game-logger.service';
import type { GameStateEntity } from '../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../dto/game-action.dto';
import type { GameRulesAdapter } from '../interfaces/game-rules-adapter.interface';

const registryStub: Partial<GameRegistryService> = {
  register: () => undefined,
};

const defaultPlayers: GameStateEntity['players'] = [
  { id: 1, username: 'A' },
  { id: 2, username: 'B' },
];

function clonePlayers() {
  return defaultPlayers.map((player) => ({ ...player }));
}

function buildBaseState(
  overrides: Partial<GameStateEntity> = {},
): GameStateEntity {
  return {
    status: 'setup',
    phase: 'setup',
    round: 1,
    turnIndex: 0,
    lastRoll: null,
    log: [],
    metadata: {},
    players: overrides.players ?? clonePlayers(),
    ...overrides,
  };
}

const createMorpion = () =>
  new MorpionService(
    registryStub as GameRegistryService,
    new MorpionPresenter(new GridCellActionsService()),
  );

function buildPlayAction(
  actorId: number,
  x: number,
  y: number,
): GameSingleActionDto {
  return {
    type: 'morpion_play',
    payload: { x, y },
    meta: { actorId },
  };
}

function extractWinnerId(state: GameStateEntity): number | null {
  const metadata = state.metadata;
  if (!metadata || typeof metadata !== 'object') {
    return null;
  }
  const candidate = (metadata as { winnerId?: unknown }).winnerId;
  return typeof candidate === 'number' ? candidate : null;
}

describe('Critical Cases Matrix', () => {
  it('debut de partie: hydrate un etat started avec un joueur courant', () => {
    const service = createMorpion();
    const state = service.hydrateInitialState(
      buildBaseState({
        status: 'setup',
      }),
    );

    expect(state.status).toBe('started');
    expect(state.turn?.currentPlayerId).toBe(1);
  });

  it('choix pion: cree un pending bloquant avec playerId cible', () => {
    const setupFlow = new SetupFlowService();
    const out = setupFlow.createSequentialPawnPending({
      players: [
        { id: 1, username: 'A' },
        { id: 2, username: 'B' },
      ],
      startPlayerId: 1,
      isAssigned: (id) => id === 1,
      pawns: [
        { id: 'chat', label: 'Chat' },
        { id: 'chien', label: 'Chien' },
      ],
      pendingType: 'choose_pawn',
    });

    expect(out).not.toBeNull();
    expect(out?.pending.type).toBe('choose_pawn');
    expect(out?.pending.blocking).toBe(true);
    expect(out?.pending.playerId).toBe(2);
  });

  it('tour suivant: apres une action valide, le tour passe au joueur suivant', () => {
    const service = createMorpion();
    let state: GameStateEntity = service.hydrateInitialState(
      buildBaseState({ status: 'started' }),
    );

    state = service.applyActions(state, [buildPlayAction(1, 0, 0)]);
    expect(state.turn?.currentPlayerId).toBe(2);
  });

  it('victoire: une ligne gagnante termine la partie avec winnerId', () => {
    const service = createMorpion();
    let state: GameStateEntity = service.hydrateInitialState(
      buildBaseState({ status: 'started' }),
    );

    const plays = [
      buildPlayAction(1, 0, 0),
      buildPlayAction(2, 0, 1),
      buildPlayAction(1, 1, 0),
      buildPlayAction(2, 1, 1),
      buildPlayAction(1, 2, 0),
    ];
    for (const action of plays) {
      state = service.applyActions(state, [action]);
    }

    expect(state.status).toBe('finished');
    expect(extractWinnerId(state)).toBe(1);
  });

  it("erreurs d'action: une action indisponible est rejetee pour le joueur courant", async () => {
    const loggerStub = {
      logValidationFailure: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    } as unknown as GameLoggerService;

    const engine = Object.create(
      GameEngineService.prototype,
    ) as GameEngineService;
    const engineWithLogger = engine as GameEngineService & {
      gameLogger?: GameLoggerService;
    };
    engineWithLogger.gameLogger = loggerStub;

    const state: GameStateEntity = {
      ...buildBaseState({
        turn: { currentPlayerId: 1, direction: 1 },
        pending: { type: 'draw', playerId: 1, blocking: true },
        metadata: { gameType: 'morpion', roomId: 1 },
      }),
    };
    const handler: GameRulesAdapter = {
      gameType: 'morpion',
      category: 'tests',
      displayName: 'Morpion',
      hydrateInitialState: (incoming) => incoming,
      applyActions: (current) => current,
      getAvailableActions: () => [{ type: 'draw', payload: {} }],
    };
    const validateActions = (
      engine as unknown as {
        validateActions: (
          state: GameStateEntity,
          handler: GameRulesAdapter,
          actions: GameSingleActionDto[],
          actorId: number | null,
        ) => Promise<GameSingleActionDto[]>;
      }
    ).validateActions;
    const invalidAction: GameSingleActionDto = {
      type: 'play_card',
      payload: {},
    };

    await expect(
      validateActions(state, handler, [invalidAction], 1),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
