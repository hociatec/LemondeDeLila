import { Test } from '@nestjs/testing';
import { RandomService } from '../../../../modules/random/services/random.service';
import { TurnFlowService } from '../../../../modules/turn/services/turn-flow.service';
import { TurnService } from '../../../../modules/turn/services/turn.service';
import { TurnPoliciesService } from '../../../../modules/turn-policies/services/turn-policies.service';
import { GameCoreService } from '../../../../core/services/game-core.service';
import { DeckPoliciesService } from '../../../../modules/deck-policies/services/deck-policies.service';
import { SetupFlowService } from '../../../../modules/setup-flow/services/setup-flow.service';
import { GameContentLoaderService } from '../../../../engine/services/game-content-loader.service';
import { GaloponsActionService } from './galopons-action.service';
import { SetupFlowModule } from '../../../../modules/setup-flow/setup-flow.module';
import { GaloponsEnsembleModule } from '../galopons-ensemble.module';
import { GaloponsSetupService } from '../setup/galopons-setup.service';
import * as Rulebook from '../rulebook/rulebook';

function buildTiles() {
  const tiles = Array.from({ length: 40 }, (_, i) => ({
    n: i + 1,
    title: `T${i + 1}`,
    type: 'neutral',
    region: i % 4 === 0 ? 'foret' : i % 4 === 1 ? 'montagne' : 'prairie',
  })) as any[];
  tiles[0] = { n: 1, title: 'Start', type: 'start', region: 'prairie' };
  tiles[1] = { n: 2, title: 'Card', type: 'card', region: 'foret' };
  tiles[2] = {
    n: 3,
    title: 'Bonus',
    type: 'bonus',
    apples: 2,
    region: 'montagne',
  };
  tiles[3] = {
    n: 4,
    title: 'Skip',
    type: 'skip',
    skipTurns: 1,
    region: 'riviere',
  };
  tiles[4] = { n: 5, title: 'Finish', type: 'finish', region: 'prairie' };
  return tiles;
}

function makeState() {
  return {
    status: 'started',
    phase: 'playing',
    round: 1,
    turnIndex: 0,
    lastRoll: null,
    log: [],
    players: [
      { id: 1, username: 'P1' },
      { id: 2, username: 'P2' },
      { id: 3, username: 'P3' },
    ],
    turn: { currentPlayerId: 1, direction: 1 },
    pending: null,
    botThinking: false,
    metadata: {
      tiles: buildTiles(),
      positions: { 1: 0, 2: 1, 3: 2 },
      apples: { 1: 2, 2: 1, 3: 0 },
      ious: { 1: {}, 2: { 1: 1 }, 3: {} },
      statuses: { skipTurn: { 1: 0, 2: 0, 3: 0 } },
      decks: {
        cards: [{ id: 1, text: 'Recevez 2 jetons Pomme' }],
        discard: [],
      },
      finish: {
        triggered: false,
        starterId: null,
        pendingIds: [],
        bonusGiven: false,
      },
      winnerId: null,
    },
  } as any;
}

function meta(state: any) {
  return state.metadata;
}

function makeRuntime(rolls: number[] = []) {
  const random = new RandomService();
  let i = 0;
  jest.spyOn(random, 'rollDice').mockImplementation((meta: any) => ({
    roll: rolls[i++] ?? 1,
    meta,
  }));
  const core = new GameCoreService();
  const turns = new TurnFlowService(
    new TurnService(),
    new TurnPoliciesService(core),
  );
  const deckPolicies = new DeckPoliciesService(random);
  const setupFlow = new SetupFlowService();
  return {
    service: new GaloponsActionService(
      random,
      turns,
      core,
      deckPolicies,
      setupFlow,
    ),
  };
}

function makeSetupBaseState() {
  return {
    status: 'started',
    phase: 'turn',
    round: 1,
    turnIndex: 0,
    lastRoll: null,
    log: [],
    players: [
      { id: 1, username: 'Lilas', isBot: false },
      { id: 2, username: 'Bucky', isBot: true },
      { id: 3, username: 'Otis', isBot: false },
    ],
    turn: { currentPlayerId: 1, direction: 1 },
    metadata: {
      gameType: 'galopons-ensemble',
      rng: { seed: 1234, counter: 0 },
    },
    botThinking: false,
  } as any;
}

describe('GaloponsActionService', () => {
  it('imports SetupFlowModule so Nest can resolve SetupFlowService', () => {
    const imports = Reflect.getMetadata('imports', GaloponsEnsembleModule);

    expect(Array.isArray(imports)).toBe(true);
    expect(imports).toContain(SetupFlowModule);
  });

  it('requires sequential pawn selection before rolling and restores the starter turn', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        GameCoreService,
        RandomService,
        SetupFlowService,
        GameContentLoaderService,
        DeckPoliciesService,
        GaloponsSetupService,
        {
          provide: 'TurnFlowService',
          useValue: {
            advanceTurn: (state: any) => state,
          },
        },
        {
          provide: GaloponsActionService,
          useFactory: (
            random: RandomService,
            turns: TurnFlowService,
            core: GameCoreService,
            deckPolicies: DeckPoliciesService,
            setupFlow: SetupFlowService,
          ) =>
            new GaloponsActionService(
              random,
              turns,
              core,
              deckPolicies,
              setupFlow,
            ),
          inject: [
            RandomService,
            'TurnFlowService',
            GameCoreService,
            DeckPoliciesService,
            SetupFlowService,
          ],
        },
      ],
    }).compile();

    const setup = moduleRef.get(GaloponsSetupService);
    const actions = moduleRef.get(GaloponsActionService);

    let state = setup.hydrateInitialState(makeSetupBaseState());
    expect((state.pending as any)?.type).toBe('choose_pawn');
    expect((state.pending as any)?.playerId).toBe(1);
    expect((state.players ?? []).find((player: any) => player?.id === 2)?.pawn).toBe(
      'shetland',
    );
    expect(
      (state.players ?? []).find((player: any) => player?.id === 2)?.pawnLabel,
    ).toBe('Le Poney Shetland');
    expect((state.metadata as any)?.tiles?.[0]?.description).toContain(
      "L'aventure commence ici.",
    );
    expect(
      String((state.pending as any)?.data?.pawns?.[0]?.description ?? '').trim()
        .length,
    ).toBeGreaterThan(0);

    let safety = 0;
    while ((state.pending as any)?.type === 'choose_pawn' && safety < 10) {
      const playerId = Number((state.pending as any)?.playerId ?? 0);
      const available = Rulebook.getAvailableActions(state, playerId);
      expect(available.length).toBeGreaterThan(0);
      expect(available.every((action) => action.type === 'choose_pawn')).toBe(
        true,
      );
      state = actions.applyActions(state, [available[0]]);
      safety += 1;
    }

    expect(state.pending ?? null).toBeNull();
    expect(safety).toBe(2);
    expect(Number(state.turn?.currentPlayerId ?? 0)).toBe(1);
    const players = state.players ?? [];
    expect(
      players.every(
        (player: any) =>
          String(player?.pawn ?? '').trim().length > 0 &&
          String(player?.pawnLabel ?? '').trim().length > 0,
      ),
    ).toBe(true);
  });

  it('handles roll with iou repayment and skip turns', () => {
    const { service } = makeRuntime([1, 2]);
    let state = makeState();

    state = {
      ...state,
      turn: { currentPlayerId: 2, direction: 1 },
      metadata: {
        ...meta(state),
        statuses: { skipTurn: { 1: 0, 2: 1, 3: 0 } },
      },
    };
    const skipped = service.applyActions(state, [
      { type: 'roll', payload: {} },
    ]);
    expect(skipped).toBeDefined();

    const rolled = service.applyActions(makeState(), [
      { type: 'roll', payload: {} },
    ]);
    expect(rolled).toBeDefined();
  });

  it('covers landing tile variants and finish trigger', () => {
    const { service } = makeRuntime();
    const base = makeState();

    for (const pos of [1, 2, 3, 4]) {
      const state = {
        ...base,
        metadata: {
          ...meta(base),
          positions: { ...meta(base).positions, 1: pos },
        },
      };
      const out = (service as any).applyLanding(state, 1);
      expect(out).toBeDefined();
    }
  });

  it('logs tile descriptions when present', () => {
    const { service } = makeRuntime();
    const state = makeState();
    const out = (service as any).applyLanding(
      {
        ...state,
        metadata: {
          ...meta(state),
          tiles: [
            {
              n: 1,
              title: 'Départ',
              type: 'start',
              region: 'prairie',
              description: "L'aventure commence ici.",
            },
          ],
          positions: { 1: 0 },
        },
      },
      1,
    );

    expect(
      out.log.some(
        (entry: any) => entry?.message === "L'aventure commence ici.",
      ),
    ).toBe(true);
  });

  it('covers choose_target contexts pair_advance, give_apple and help_advance', () => {
    const { service } = makeRuntime();
    const contexts = ['pair_advance', 'give_apple', 'help_advance'];

    for (const kind of contexts) {
      const state = {
        ...makeState(),
        pending: {
          type: 'choose_target',
          playerId: 1,
          blocking: true,
          choices: ['P2'],
          data: { context: { kind, actorId: 1, replayAfter: true } },
        },
        turn: { currentPlayerId: 1, direction: 1 },
        metadata: {
          ...meta(makeState()),
        },
      };
      const out = service.applyActions(state, [
        { type: 'choose_target', payload: { targetPlayerId: 2 } },
      ]);
      expect(out).toBeDefined();
    }
  });

  it('advances to the next player after resolving a simple draw card', () => {
    const { service } = makeRuntime();
    const state = {
      ...makeState(),
      pending: {
        type: 'draw',
        playerId: 1,
        blocking: true,
      },
      turn: { currentPlayerId: 1, direction: 1 },
      metadata: {
        ...meta(makeState()),
        decks: {
          cards: [{ id: 1, text: 'Recevez 2 jetons Pomme' }],
          discard: [],
        },
      },
    };

    const out = service.applyActions(state, [{ type: 'draw', payload: {} }]);

    expect(out.pending).toBeNull();
    expect(meta(out).apples[1]).toBe(4);
    expect(out.turn?.currentPlayerId).toBe(2);
  });

  it('keeps the first pending draw and preserves the collision outcome during pair advance', () => {
    const { service } = makeRuntime();
    const state = {
      ...makeState(),
      pending: {
        type: 'choose_target',
        playerId: 1,
        blocking: true,
        choices: ['P2'],
        data: { context: { kind: 'pair_advance', actorId: 1, replayAfter: false } },
      },
      metadata: {
        ...meta(makeState()),
        positions: { 1: 0, 2: 1, 3: 0 },
      },
    };

    const out = service.applyActions(state, [
      { type: 'choose_target', payload: { targetPlayerId: 2 } },
    ]);

    expect(meta(out).positions).toEqual({ 1: 1, 2: 2, 3: 0 });
    expect(meta(out).apples[1]).toBe(2);
    expect(meta(out).apples[2]).toBe(1);
    expect((out.pending as any)?.type).toBe('draw');
    expect((out.pending as any)?.playerId).toBe(1);
    expect(out.turn?.currentPlayerId).toBe(1);
  });

  it('does not overwrite the first pending draw when both players would land on card tiles during pair advance', () => {
    const { service } = makeRuntime();
    const state = {
      ...makeState(),
      pending: {
        type: 'choose_target',
        playerId: 1,
        blocking: true,
        choices: ['P2'],
        data: { context: { kind: 'pair_advance', actorId: 1, replayAfter: false } },
      },
      metadata: {
        ...meta(makeState()),
        positions: { 1: 1, 2: 1, 3: 0 },
        tiles: [
          { n: 1, title: 'Start', type: 'start', region: 'prairie' },
          { n: 2, title: 'Neutral', type: 'neutral', region: 'prairie' },
          { n: 3, title: 'Card', type: 'card', region: 'foret' },
          ...buildTiles().slice(3),
        ],
      },
    };

    const out = service.applyActions(state, [
      { type: 'choose_target', payload: { targetPlayerId: 2 } },
    ]);

    expect(meta(out).positions).toEqual({ 1: 2, 2: 0, 3: 0 });
    expect((out.pending as any)?.type).toBe('draw');
    expect((out.pending as any)?.playerId).toBe(1);
    expect(out.turn?.currentPlayerId).toBe(1);
  });

  it('transfers the thank-you apple from the helped player instead of creating one', () => {
    const { service } = makeRuntime();
    const state = {
      ...makeState(),
      pending: {
        type: 'choose_target',
        playerId: 1,
        blocking: true,
        choices: ['P2'],
        data: { context: { kind: 'help_advance', actorId: 1, replayAfter: false } },
      },
      metadata: {
        ...meta(makeState()),
        positions: { 1: 0, 2: 0, 3: 2 },
        apples: { 1: 2, 2: 1, 3: 0 },
      },
    };

    const out = service.applyActions(state, [
      { type: 'choose_target', payload: { targetPlayerId: 2 } },
    ]);

    expect(meta(out).positions[2]).toBe(2);
    expect(meta(out).apples[1]).toBe(3);
    expect(meta(out).apples[2]).toBe(2);
  });

  it('discards an apple without creating a target debt for the discard-and-replay card', () => {
    const { service } = makeRuntime();
    const out = (service as any).applyCard(makeState(), 1, {
      id: 15,
      text: "Vous aidez un poulain perdu à retrouver son chemin. Donnez-lui une pomme en la défaussant, puis rejouez immédiatement.",
    });

    expect(meta(out).apples[1]).toBe(1);
    expect(meta(out).ious?.[1] ?? {}).toEqual({});
    expect(out.pending).toBeNull();
    expect((meta(out) as any).keepTurn).toBe(true);
  });

  it('finishes the final round after removing the current player from pendingIds', () => {
    const { service } = makeRuntime([1]);
    const pawns = [
      { id: 'shetland', name: 'Le Poney Shetland', description: 'P1' },
      { id: 'mustang', name: 'Le Mustang', description: 'P2' },
      { id: 'percheron', name: 'Le Percheron', description: 'P3' },
    ];
    const state = {
      ...makeState(),
      players: [
        { id: 1, username: 'P1', pawn: 'shetland', pawnLabel: 'Le Poney Shetland' },
        { id: 2, username: 'P2', pawn: 'mustang', pawnLabel: 'Le Mustang' },
        { id: 3, username: 'P3', pawn: 'percheron', pawnLabel: 'Le Percheron' },
      ],
      turn: { currentPlayerId: 3, direction: 1 },
      metadata: {
        ...meta(makeState()),
        pawns,
        pawnByPlayerId: { 1: 'shetland', 2: 'mustang', 3: 'percheron' },
        setupStarterId: 3,
        positions: { 1: 39, 2: 20, 3: 10 },
        apples: { 1: 1, 2: 0, 3: 0 },
        finish: {
          triggered: true,
          starterId: 1,
          pendingIds: [3],
          bonusGiven: true,
        },
      },
    };

    const out = service.applyActions(state, [{ type: 'roll', payload: {} }]);

    expect(out.status).toBe('finished');
    expect(meta(out).winnerId).toBe(1);
    expect(meta(out).finish?.pendingIds).toEqual([]);
  });

  it('covers adventure card text branches', () => {
    const { service } = makeRuntime();
    const texts = [
      'Donnez-lui une pomme',
      'Rejouez',
      'Recevez 2 jetons Pomme',
      'Recevez un jeton pomme',
      'Passez votre tour',
      'Tous les joueurs restent sur place pendant un tour',
      "Choisissez un joueur et avancez tout les deux d'une case",
      'aidez un autre joueur en le faisant avancer de 2 cases',
      "Défaussez-vous d'une pomme",
      "Avancez jusqu'à la prochaine case forêt",
      "Avancez jusqu'à la prochaine case montagne",
      'Avancez de 3 cases',
      'Reculez de 2 cases',
    ];

    for (const text of texts) {
      const out = (service as any).applyCard(makeState(), 1, { id: 99, text });
      expect(out).toBeDefined();
    }
  });

  it('covers helper methods drawCard, findOccupant, pawnLabel and finishGame', () => {
    const { service } = makeRuntime();
    const state = makeState();

    const draw = (service as any).drawCard(meta(state));
    expect(draw).toBeDefined();

    expect((service as any).findOccupant(meta(state), 1, 1)).toBe(2);
    expect((service as any).pawnLabel(state, 1)).toContain('son');

    const finished = (service as any).finishGame({
      ...state,
      metadata: { ...meta(state), apples: { 1: 1, 2: 4, 3: 2 } },
    });
    expect(finished.status).toBe('finished');
    expect(meta(finished).winnerId).toBe(2);
  });
});
