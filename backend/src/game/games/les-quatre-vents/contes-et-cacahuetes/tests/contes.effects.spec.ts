import { Test } from '@nestjs/testing';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { GameCoreService } from '../../../../core/services/game-core.service';
import { RandomService } from '../../../../modules/random/services/random.service';
import { SetupFlowService } from '../../../../modules/setup-flow/services/setup-flow.service';
import { DeckPoliciesService } from '../../../../modules/deck-policies/services/deck-policies.service';
import type { TurnFlowService } from '../../../../modules/turn/services/turn-flow.service';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import { ContesCacahuetesSetupService } from '../setup/contes-et-cacahuetes-setup.service';
import { ContesActionService } from '../actions/contes-action.service';
import { ContesPresenterService } from '../presenter/contes-presenter.service';
import type { ContesCard } from '../model/contes-et-cacahuetes-state.entity';
import { BoardPayloadService } from '../../../../modules/board/services/board-payload.service';

function asRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

function toText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function baseState(): GameStateEntity {
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
      gameType: 'contes-et-cacahuetes',
      rng: { seed: 1234, counter: 0 },
    },
    botThinking: false,
  };
}

async function createActionsModule(
  advanceTurn: (state: GameStateEntity) => GameStateEntity = (state) => state,
) {
  return Test.createTestingModule({
    providers: [
      GameCoreService,
      RandomService,
      SetupFlowService,
      DeckPoliciesService,
      ContesCacahuetesSetupService,
      {
        provide: 'TurnFlowService',
        useValue: { advanceTurn },
      },
      {
        provide: ContesActionService,
        useFactory: (
          core: GameCoreService,
          random: RandomService,
          turns: TurnFlowService,
          setupFlow: SetupFlowService,
          deckPolicies: DeckPoliciesService,
        ) =>
          new ContesActionService(core, random, turns, setupFlow, deckPolicies),
        inject: [
          GameCoreService,
          RandomService,
          'TurnFlowService',
          SetupFlowService,
          DeckPoliciesService,
        ],
      },
    ],
  }).compile();
}

describe('Contes effects', () => {
  it('hydrates the board, decks and pawn choices expected by the pending content report', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        GameCoreService,
        RandomService,
        SetupFlowService,
        ContesCacahuetesSetupService,
      ],
    }).compile();

    const setup = moduleRef.get(ContesCacahuetesSetupService);
    const state = setup.hydrateInitialState(baseState());
    const metadata = asRecord(state.metadata);
    const tiles = Array.isArray(metadata.tiles) ? metadata.tiles : [];
    const decks = asRecord(metadata.decks);
    const bonusDeck = Array.isArray(decks.bonus) ? decks.bonus : [];
    const malusDeck = Array.isArray(decks.malus) ? decks.malus : [];
    const surpriseDeck = Array.isArray(decks.surprise) ? decks.surprise : [];
    const conteDeck = Array.isArray(decks.contes) ? decks.contes : [];
    const pending = asRecord(state.pending);
    const pendingData = asRecord(pending.data);
    const pawns = Array.isArray(pendingData.pawns) ? pendingData.pawns : [];

    expect(tiles).toHaveLength(60);
    expect(toText(asRecord(tiles[0]).label)).toContain('Case Départ');
    expect(toText(asRecord(tiles[59]).label)).toContain('Case Arrivée');

    expect(bonusDeck).toHaveLength(15);
    expect(malusDeck).toHaveLength(15);
    expect(surpriseDeck).toHaveLength(15);
    expect(conteDeck).toHaveLength(29);

    expect(toText(asRecord(bonusDeck[0]).title)).toBe('Bottes de sept lieues');
    expect(toText(asRecord(malusDeck[0]).title)).toBe('Sortilège de Sommeil');
    expect(toText(asRecord(surpriseDeck[0]).title)).toBe('Baguette Malicieuse');
    expect(toText(asRecord(surpriseDeck[12]).title)).toBe('Souhait Éphémère');
    expect(toText(asRecord(surpriseDeck[12]).text)).toContain(
      'Faites un vœu simple',
    );
    expect(toText(asRecord(conteDeck[0]).title)).toBe(
      'Conte - Japon : Momotarō',
    );

    expect(pawns).toHaveLength(6);
    expect(toText(asRecord(pawns[0]).id)).toBe('Aika - Mongolie');
    expect(toText(asRecord(pawns[0]).label)).toContain('Aika - Mongolie');
    expect(toText(asRecord(pawns[0]).description)).not.toHaveLength(0);
  });

  it("keeps Cape d'Invisibilité aligned with malus tile behavior", async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        GameCoreService,
        RandomService,
        SetupFlowService,
        ContesCacahuetesSetupService,
      ],
    }).compile();

    const setup = moduleRef.get(ContesCacahuetesSetupService);
    const state = setup.hydrateInitialState(baseState());
    const metadata = asRecord(state.metadata);
    const decks = asRecord(metadata.decks);
    const bonusDeck: unknown[] = Array.isArray(decks.bonus)
      ? (decks.bonus as unknown[])
      : [];
    const cape = bonusDeck.find((card) => {
      const row = asRecord(card);
      return Number(row.id ?? 0) === 4;
    });
    const capeRow = asRecord(cape);

    expect(toText(capeRow.text)).toContain('case Malus');
    expect(toText(capeRow.text)).not.toContain('case Conte');
  });

  it('uses the canonical board labels for start, bonus and finish', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        GameCoreService,
        RandomService,
        SetupFlowService,
        ContesCacahuetesSetupService,
      ],
    }).compile();

    const setup = moduleRef.get(ContesCacahuetesSetupService);
    const state = setup.hydrateInitialState(baseState());
    const metadata = asRecord(state.metadata);
    const tiles = Array.isArray(metadata.tiles) ? metadata.tiles : [];

    expect(toText(asRecord(tiles[0]).label)).toBe('Case Départ');
    expect(toText(asRecord(tiles[0]).description)).toContain(
      'Vous ouvrez le grand livre des contes',
    );
    expect(toText(asRecord(tiles[1]).label)).toBe('Case Bonus');
    expect(toText(asRecord(tiles[1]).description)).toContain(
      'Un coup de pouce magique',
    );
    expect(toText(asRecord(tiles[59]).label)).toBe('Case Arrivée');
    expect(toText(asRecord(tiles[59]).description)).toContain(
      'Vous atteignez le majestueux livre magique',
    );
  });

  it('attaches the full story text to conte tiles', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        GameCoreService,
        RandomService,
        SetupFlowService,
        ContesCacahuetesSetupService,
      ],
    }).compile();

    const setup = moduleRef.get(ContesCacahuetesSetupService);
    const state = setup.hydrateInitialState(baseState());
    const metadata = asRecord(state.metadata);
    const tiles = Array.isArray(metadata.tiles) ? metadata.tiles : [];
    const firstConte = asRecord(tiles[2]);
    const lastConte = asRecord(tiles[58]);

    expect(toText(firstConte.label)).toContain('Momotar');
    expect(toText(firstConte.description)).toContain('gar');
    expect(toText(lastConte.label)).toContain('roi grenouille');
    expect(toText(lastConte.description)).toContain('princesse curieuse');
  });

  it('requires a number choice from each player for Poussiere de rire', async () => {
    const moduleRef = await createActionsModule();

    const setup = moduleRef.get(ContesCacahuetesSetupService);
    const actionsService = moduleRef.get(ContesActionService);

    let state = setup.hydrateInitialState(baseState());
    state = {
      ...state,
      pending: {
        type: 'choose_number',
        label: 'Poussiere de rire',
        playerId: 1,
        blocking: true,
        choices: ['1', '2', '3'],
        data: {
          context: 'laughter_dust',
          min: 1,
          max: 3,
          order: [1, 2, 3],
          picks: {},
        },
      },
      metadata: {
        ...(state.metadata ?? {}),
        positions: { 1: 58, 2: 58, 3: 58 },
      },
    };

    const chooseTwo: GameSingleActionDto[] = [
      { type: 'choose_number', payload: { value: 2 } },
    ];
    state = actionsService.applyActions(state, chooseTwo);
    const pending1 = asRecord(state.pending);
    const data1 = asRecord(pending1.data);
    const picks1 = asRecord(data1.picks);
    expect(Number(pending1.playerId)).toBe(2);
    expect(Number(picks1['1'] ?? 0)).toBe(2);

    const chooseThree: GameSingleActionDto[] = [
      { type: 'choose_number', payload: { value: 3 } },
    ];
    state = actionsService.applyActions(state, chooseThree);
    const pending2 = asRecord(state.pending);
    const data2 = asRecord(pending2.data);
    const picks2 = asRecord(data2.picks);
    expect(Number(pending2.playerId)).toBe(3);
    expect(Number(picks2['2'] ?? 0)).toBe(3);

    const chooseOne: GameSingleActionDto[] = [
      { type: 'choose_number', payload: { value: 1 } },
    ];
    state = actionsService.applyActions(state, chooseOne);
    expect(state.pending ?? null).toBeNull();
    expect(String(state.status ?? '').toLowerCase()).toBe('finished');
    const finalMeta = asRecord(state.metadata);
    expect(Number(finalMeta.winnerId ?? 0)).toBe(2);
  });

  it('ends the turn after resolving a draw pending with no follow-up pending', async () => {
    const advanceTurn = jest.fn(
      (state: GameStateEntity): GameStateEntity => ({
        ...state,
        turnIndex: 1,
        turn: { ...(state.turn ?? { direction: 1 }), currentPlayerId: 2 },
      }),
    );

    const moduleRef = await createActionsModule(advanceTurn);

    const setup = moduleRef.get(ContesCacahuetesSetupService);
    const actionsService = moduleRef.get(ContesActionService);

    let state = setup.hydrateInitialState(baseState());
    const metadata = asRecord(state.metadata);
    const decks = asRecord(metadata.decks);
    const bonusDeck = Array.isArray(decks.bonus) ? decks.bonus : [];
    const parch = bonusDeck.find(
      (card) => Number(asRecord(card).id ?? 0) === 2,
    ) as unknown;
    expect(parch).toBeTruthy();

    state = {
      ...state,
      turn: { ...(state.turn ?? { direction: 1 }), currentPlayerId: 1 },
      pending: {
        type: 'draw',
        label: 'Piocher une carte BONUS (Espace).',
        playerId: 1,
        blocking: true,
        data: { context: 'draw_and_apply', cardType: 'bonus', depth: 0 },
      },
      metadata: {
        ...(state.metadata ?? {}),
        decks: {
          ...decks,
          bonus: [parch],
          discardBonus: [],
        },
      },
    };

    state = actionsService.applyActions(state, [{ type: 'draw', payload: {} }]);

    expect(advanceTurn).toHaveBeenCalledTimes(1);
    expect(state.pending ?? null).toBeNull();
    expect(Number(state.turn?.currentPlayerId ?? 0)).toBe(2);
  });

  it('announces the drawn bonus card before applying its effect', async () => {
    const moduleRef = await createActionsModule();
    const setup = moduleRef.get(ContesCacahuetesSetupService);
    const actionsService = moduleRef.get(ContesActionService);

    let state = setup.hydrateInitialState(baseState());
    const metadata = asRecord(state.metadata);
    const decks = asRecord(metadata.decks);
    state = {
      ...state,
      metadata: {
        ...(state.metadata ?? {}),
        decks: {
          ...decks,
          bonus: [
            {
              id: 1,
              type: 'bonus',
              title: 'Bottes de sept lieues',
              text: 'Avancez de 2 cases supplémentaires. Ces bottes magiques vous font bondir loin devant !',
            },
          ],
          discardBonus: [],
        },
      },
    };

    state = (actionsService as any).resolveQueuedDraw(state, 1, {
      queue: ['bonus'],
      depth: 0,
    });

    const logText = Array.isArray(state.log)
      ? state.log.map((entry) => toText(asRecord(entry).message)).join(' ')
      : '';
    expect(logText).toContain('Lilas pioche une carte Bonus');
    expect(logText).toContain('Bottes de sept lieues');
  });

  it('clarifies the doubled die result for Haricot magique', async () => {
    const moduleRef = await createActionsModule();
    const setup = moduleRef.get(ContesCacahuetesSetupService);
    const actionsService = moduleRef.get(ContesActionService);
    const random = moduleRef.get(RandomService);
    jest.spyOn(random, 'rollDice').mockReturnValue({ roll: 4, meta: {} });

    let state = setup.hydrateInitialState(baseState());
    const metadata = asRecord(state.metadata);
    const decks = asRecord(metadata.decks);
    state = {
      ...state,
      metadata: {
        ...(state.metadata ?? {}),
        decks: {
          ...decks,
          bonus: [
            {
              id: 6,
              type: 'bonus',
              title: 'Haricot magique',
              text: 'Lancez le dé maintenant : le résultat obtenu est automatiquement doublé.',
            },
          ],
          discardBonus: [],
        },
      },
    };

    state = (actionsService as any).resolveQueuedDraw(state, 1, {
      queue: ['bonus'],
      depth: 0,
    });

    const logText = Array.isArray(state.log)
      ? state.log.map((entry) => toText(asRecord(entry).message)).join(' ')
      : '';
    expect(logText).toMatch(/Haricot magique\s*:\s*dé "4" x 2 = 8\./);
  });

  it('keeps the retained bonus cards in hand through statuses', async () => {
    const moduleRef = await createActionsModule();
    const setup = moduleRef.get(ContesCacahuetesSetupService);
    const actionsService = moduleRef.get(ContesActionService);

    let state = setup.hydrateInitialState(baseState());
    state = (actionsService as any).applyBonusEffectById(state, 1, 3, 0);
    state = (actionsService as any).applyBonusEffectById(state, 1, 4, 0);
    state = (actionsService as any).applyBonusEffectById(state, 1, 14, 0);

    const statuses = asRecord(asRecord(state.metadata).statuses);
    expect(Number(asRecord(statuses.shieldMalus)['1'] ?? 0)).toBe(1);
    expect(Boolean(asRecord(statuses.ignoreNextConteAndAdvance)['1'])).toBe(
      true,
    );
    expect(Boolean(asRecord(statuses.replaceOneOn1By4)['1'])).toBe(true);
  });

  it('lets all tied winners advance on Poussiere de rire', async () => {
    const moduleRef = await createActionsModule();
    const setup = moduleRef.get(ContesCacahuetesSetupService);
    const actionsService = moduleRef.get(ContesActionService);

    let state = setup.hydrateInitialState(baseState());
    state = {
      ...state,
      pending: {
        type: 'choose_number',
        label: 'Poussière de rire',
        playerId: 1,
        blocking: true,
        choices: ['1', '2', '3'],
        data: {
          context: 'laughter_dust',
          min: 1,
          max: 3,
          order: [1, 2, 3],
          picks: {},
        },
      },
      metadata: {
        ...(state.metadata ?? {}),
        positions: { 1: 10, 2: 11, 3: 12 },
      },
    };

    state = actionsService.applyActions(state, [
      { type: 'choose_number', payload: { value: 3 } },
    ]);
    state = actionsService.applyActions(state, [
      { type: 'choose_number', payload: { value: 2 } },
    ]);
    state = actionsService.applyActions(state, [
      { type: 'choose_number', payload: { value: 3 } },
    ]);

    const positions = asRecord(asRecord(state.metadata).positions);
    expect(Number(positions['1'] ?? 0)).toBe(11);
    expect(Number(positions['2'] ?? 0)).toBe(11);
    expect(Number(positions['3'] ?? 0)).toBe(13);
  });

  it('draws a bonus for Maladresse de Sorcier and applies it to the chosen player', async () => {
    const moduleRef = await createActionsModule();
    const setup = moduleRef.get(ContesCacahuetesSetupService);
    const actionsService = moduleRef.get(ContesActionService);

    let state = setup.hydrateInitialState(baseState());
    const metadata = asRecord(state.metadata);
    const decks = asRecord(metadata.decks);
    state = {
      ...state,
      metadata: {
        ...(state.metadata ?? {}),
        positions: { 1: 5, 2: 7, 3: 9 },
        decks: {
          ...decks,
          bonus: [
            {
              id: 8,
              type: 'bonus',
              title: 'Ami Légendaire',
              text: 'Vous êtes aidé par un personnage magique ! Avancez de 3 cases.',
            },
          ],
          discardBonus: [],
        },
      },
    };

    state = (actionsService as any).applyMalusEffectById(state, 1, 9, 0);
    expect(asRecord(state.pending).data.context).toBe('give_drawn_bonus:8');

    state = actionsService.applyActions(state, [
      { type: 'choose_target', payload: { targetPlayerId: 2 } },
    ]);

    const positions = asRecord(asRecord(state.metadata).positions);
    expect(Number(positions['2'] ?? 0)).toBe(10);
  });

  it('keeps the caster in place for Grimoire voyageur and only moves the target', async () => {
    const moduleRef = await createActionsModule();
    const setup = moduleRef.get(ContesCacahuetesSetupService);
    const actionsService = moduleRef.get(ContesActionService);

    let state = setup.hydrateInitialState(baseState());
    state = {
      ...state,
      metadata: {
        ...(state.metadata ?? {}),
        positions: { 1: 14, 2: 6, 3: 2 },
      },
    };

    state = (actionsService as any).applySurpriseEffectById(state, 1, 15, 0);
    state = actionsService.applyActions(state, [
      { type: 'choose_target', payload: { targetPlayerId: 2 } },
    ]);

    const positions = asRecord(asRecord(state.metadata).positions);
    expect(Number(positions['1'] ?? 0)).toBe(14);
    expect(Number(positions['2'] ?? 0)).toBe(15);
  });
  it('announces the tile text on bonus and conte spaces without a redundant conte prompt', async () => {
    const moduleRef = await createActionsModule();
    const setup = moduleRef.get(ContesCacahuetesSetupService);
    const actionsService = moduleRef.get(ContesActionService);

    let state = setup.hydrateInitialState(baseState());
    state = {
      ...state,
      metadata: {
        ...(state.metadata ?? {}),
        positions: { 1: 0, 2: 0, 3: 0 },
      },
    };

    state = (actionsService as any).moveBy(state, 1, 1, 0);
    const bonusLog = Array.isArray(state.log)
      ? state.log.map((entry) => toText(asRecord(entry).message)).join(' ')
      : '';
    expect(bonusLog).toContain('Lilas arrive sur Case Bonus.');
    expect(bonusLog).toContain('Un coup de pouce magique');
    expect(bonusLog).toContain('Piochez une carte Bonus.');

    state = {
      ...state,
      log: [],
      pending: null,
      metadata: {
        ...(state.metadata ?? {}),
        positions: { 1: 1, 2: 0, 3: 0 },
      },
    };

    state = (actionsService as any).moveBy(state, 1, 1, 0);
    const conteLog = Array.isArray(state.log)
      ? state.log.map((entry) => toText(asRecord(entry).message)).join(' ')
      : '';
    expect(conteLog).toContain('Lilas arrive sur Case Conte - Japon');
    expect(conteLog).not.toContain('gar');
    expect(conteLog).not.toContain('Piochez une carte Conte.');
  });

  it('records conte narration only for the drawing player', async () => {
    const moduleRef = await createActionsModule();
    const setup = moduleRef.get(ContesCacahuetesSetupService);
    const actionsService = moduleRef.get(ContesActionService);

    let state = setup.hydrateInitialState(baseState());
    const metadata = asRecord(state.metadata);
    const decks = asRecord(metadata.decks);
    const conteCard: ContesCard = {
      id: 999,
      type: 'conte',
      title: 'Conte test',
      text: 'Le conte secret.',
    };

    state = {
      ...state,
      metadata: {
        ...(state.metadata ?? {}),
        decks: {
          ...decks,
          contes: [conteCard],
          conte: [conteCard],
          discardContes: [],
        },
      },
    };

    state = (actionsService as any).resolveQueuedDraw(
      { ...state, pending: null },
      1,
      { cardType: 'conte', depth: 0 },
    );

    const logText = Array.isArray(state.log)
      ? state.log.map((entry) => toText(asRecord(entry).message)).join(' ')
      : '';
    expect(logText).toContain('Lilas pioche une carte Conte: Conte test.');
    expect(logText).not.toContain('Le conte secret.');

    const updatedMeta = asRecord(state.metadata);
    const lastConte = asRecord(updatedMeta.lastConte);
    expect(toText(lastConte.title)).toBe('Conte test');
    expect(toText(lastConte.text)).toBe('Le conte secret.');
  });

  it('uses simplified pawn names and the new arrival phrasing during movement', async () => {
    const moduleRef = await createActionsModule();
    const setup = moduleRef.get(ContesCacahuetesSetupService);
    const actionsService = moduleRef.get(ContesActionService);

    let state = setup.hydrateInitialState(baseState());
    state = {
      ...state,
      players: [
        { id: 1, username: 'Lilas', isBot: false, pawn: 'Niko - Géorgie' },
        { id: 2, username: 'Bucky', isBot: true, pawn: 'Freja - Suède' },
        { id: 3, username: 'Otis', isBot: false, pawn: 'Lani - Îles Marshall' },
      ] as any,
      metadata: {
        ...(state.metadata ?? {}),
        positions: { 1: 0, 2: 0, 3: 0 },
      },
    };

    state = (actionsService as any).moveBy(state, 1, 1, 0);
    const logText = Array.isArray(state.log)
      ? state.log.map((entry) => toText(asRecord(entry).message)).join(' ')
      : '';

    expect(logText).toContain('Lilas déplace Niko sur une Case Bonus.');
    expect(logText).not.toContain('Niko - Géorgie');
    expect(logText).not.toContain("jusqu'à");
  });

  it('uses the "sur une Case ..." phrasing on surprise spaces', async () => {
    const moduleRef = await createActionsModule();
    const setup = moduleRef.get(ContesCacahuetesSetupService);
    const actionsService = moduleRef.get(ContesActionService);

    let state = setup.hydrateInitialState(baseState());
    state = {
      ...state,
      players: [
        { id: 1, username: 'Lilas', isBot: false, pawn: 'Niko - Géorgie' },
        { id: 2, username: 'Bucky', isBot: true, pawn: 'Freja - Suède' },
        { id: 3, username: 'Otis', isBot: false, pawn: 'Lani - Îles Marshall' },
      ] as any,
      metadata: {
        ...(state.metadata ?? {}),
        positions: { 1: 0, 2: 0, 3: 0 },
      },
      log: [],
    };

    state = (actionsService as any).moveBy(state, 1, 3, 0);
    const messages = Array.isArray(state.log)
      ? state.log.map((entry) => toText(asRecord(entry).message))
      : [];

    expect(
      messages.some((message) => message.includes('Lilas déplace Niko sur une Case Surprise')),
    ).toBe(true);
    expect(messages.some((message) => message.includes("jusqu'à"))).toBe(false);
  });

  it('keeps only the pawn first name in movement logs', async () => {
    const moduleRef = await createActionsModule();
    const setup = moduleRef.get(ContesCacahuetesSetupService);
    const actionsService = moduleRef.get(ContesActionService);

    let state = setup.hydrateInitialState(baseState());
    state = {
      ...state,
      players: [
        { id: 1, username: 'Lilas', isBot: false, pawn: 'Niko - Géorgie' },
        { id: 2, username: 'Bucky', isBot: true, pawn: 'Freja - Suède' },
        { id: 3, username: 'Otis', isBot: false, pawn: 'Lani - Îles Marshall' },
      ] as any,
      metadata: {
        ...(state.metadata ?? {}),
        positions: { 1: 2, 2: 0, 3: 0 },
      },
      log: [],
    };

    state = (actionsService as any).moveBy(state, 1, 3, 0);
    const logText = Array.isArray(state.log)
      ? state.log.map((entry) => toText(asRecord(entry).message)).join(' ')
      : '';

    expect(logText).toContain('Lilas déplace Niko');
    expect(logText).not.toContain('Niko - Géorgie');
  });

  it('applies Baguette Malicieuse on the final square only', async () => {
    const moduleRef = await createActionsModule();
    const setup = moduleRef.get(ContesCacahuetesSetupService);
    const actionsService = moduleRef.get(ContesActionService);

    let state = setup.hydrateInitialState(baseState());
    state = {
      ...state,
      players: [
        { id: 1, username: 'Lilas', isBot: false, pawn: 'Niko - Géorgie' },
        { id: 2, username: 'Bucky', isBot: true, pawn: 'Freja - Suède' },
        { id: 3, username: 'Otis', isBot: false, pawn: 'Lani - Îles Marshall' },
      ] as any,
      metadata: {
        ...(state.metadata ?? {}),
        positions: { 1: 7, 2: 0, 3: 0 },
      },
      log: [],
    };

    state = (actionsService as any).applySurpriseEffectById(state, 1, 1, 0);
    const logText = Array.isArray(state.log)
      ? state.log.map((entry) => toText(asRecord(entry).message)).join(' ')
      : '';
    const positions = asRecord(asRecord(state.metadata).positions);

    expect(Number(positions['1'] ?? 0)).toBe(6);
    expect(logText).toContain('Lilas déplace Niko sur une Case Conte -');
    expect(logText.match(/Lilas déplace Niko sur une Case Conte -/g) ?? []).toHaveLength(1);
  });

  it('resumes the queued Coffre aux merveilles draw after Poussière de rire resolves', async () => {
    const moduleRef = await createActionsModule();
    const setup = moduleRef.get(ContesCacahuetesSetupService);
    const actionsService = moduleRef.get(ContesActionService);

    let state = setup.hydrateInitialState(baseState());
    const metadata = asRecord(state.metadata);
    const decks = asRecord(metadata.decks);

    state = {
      ...state,
      turn: { currentPlayerId: 2, direction: 1 },
      turnIndex: 1,
      players: [
        { id: 1, username: 'Lilas', isBot: false, pawn: 'Niko - Géorgie' },
        { id: 2, username: 'Noodle', isBot: true, pawn: 'Freja - Suède' },
        { id: 3, username: 'Otis', isBot: false, pawn: 'Lani - Îles Marshall' },
      ] as any,
      metadata: {
        ...(state.metadata ?? {}),
        positions: { 1: 10, 2: 11, 3: 12 },
        decks: {
          ...decks,
          surprise: [
            {
              id: 5,
              type: 'surprise',
              title: 'Poussière de Rire',
              text: 'Chaque joueur lance un petit dé de 1 à 3. Celui qui a le plus grand avance d’une case.',
            },
          ],
          bonus: [
            {
              id: 2,
              type: 'bonus',
              title: 'Parchemin enchanté',
              text: 'Relancez le dé.',
            },
          ],
          discardSurprise: [],
          discardBonus: [],
        },
      },
      pending: {
        type: 'draw',
        label: 'Piocher une carte (Espace).',
        playerId: 2,
        blocking: true,
        data: {
          context: 'draw_and_apply',
          queue: ['surprise', 'bonus'],
          depth: 0,
        },
      } as any,
      log: [],
    } as any;

    state = actionsService.applyActions(state, [{ type: 'draw', payload: {} }]);
    expect(toText(asRecord(state.pending).type)).toBe('choose_number');

    state = actionsService.applyActions(state, [
      { type: 'choose_number', payload: { value: 3 } },
    ]);
    state = actionsService.applyActions(state, [
      { type: 'choose_number', payload: { value: 1 } },
    ]);
    state = actionsService.applyActions(state, [
      { type: 'choose_number', payload: { value: 2 } },
    ]);

    expect(toText(asRecord(state.pending).type)).toBe('draw');
    expect(toText(asRecord(asRecord(state.pending).data).context)).toBe(
      'draw_and_apply',
    );

    state = actionsService.applyActions(state, [{ type: 'draw', payload: {} }]);

    expect(toText(asRecord(state.pending).type)).toBe('draw');
    state = actionsService.applyActions(state, [{ type: 'draw', payload: {} }]);

    expect(state.pending ?? null).toBeNull();
    const logText = Array.isArray(state.log)
      ? state.log.map((entry) => toText(asRecord(entry).message)).join(' ')
      : '';
    expect(logText).toContain('Noodle pioche une carte Bonus: Parchemin enchanté.');
  });

  it('uses the singular form for Poussière de rire when one player wins', async () => {
    const moduleRef = await createActionsModule();
    const setup = moduleRef.get(ContesCacahuetesSetupService);
    const actionsService = moduleRef.get(ContesActionService);

    let state = setup.hydrateInitialState(baseState());
    state = {
      ...state,
      pending: {
        type: 'choose_number',
        label: 'Poussière de rire',
        playerId: 1,
        blocking: true,
        choices: ['1', '2', '3'],
        data: {
          context: 'laughter_dust',
          min: 1,
          max: 3,
          order: [1, 2, 3],
          picks: {},
        },
      },
      metadata: {
        ...(state.metadata ?? {}),
        positions: { 1: 10, 2: 11, 3: 12 },
      },
      log: [],
    } as any;

    state = actionsService.applyActions(state, [
      { type: 'choose_number', payload: { value: 3 } },
    ]);
    state = actionsService.applyActions(state, [
      { type: 'choose_number', payload: { value: 1 } },
    ]);
    state = actionsService.applyActions(state, [
      { type: 'choose_number', payload: { value: 2 } },
    ]);

    const logText = Array.isArray(state.log)
      ? state.log.map((entry) => toText(asRecord(entry).message)).join(' ')
      : '';

    expect(logText).toContain("Lilas avance d'1 case.");
    expect(logText).not.toContain('avance(nt)');
  });

  it('uses the plural form for Poussière de rire when players tie', async () => {
    const moduleRef = await createActionsModule();
    const setup = moduleRef.get(ContesCacahuetesSetupService);
    const actionsService = moduleRef.get(ContesActionService);

    let state = setup.hydrateInitialState(baseState());
    state = {
      ...state,
      pending: {
        type: 'choose_number',
        label: 'Poussière de rire',
        playerId: 1,
        blocking: true,
        choices: ['1', '2', '3'],
        data: {
          context: 'laughter_dust',
          min: 1,
          max: 3,
          order: [1, 2, 3],
          picks: {},
        },
      },
      metadata: {
        ...(state.metadata ?? {}),
        positions: { 1: 10, 2: 11, 3: 12 },
      },
      log: [],
    } as any;

    state = actionsService.applyActions(state, [
      { type: 'choose_number', payload: { value: 3 } },
    ]);
    state = actionsService.applyActions(state, [
      { type: 'choose_number', payload: { value: 1 } },
    ]);
    state = actionsService.applyActions(state, [
      { type: 'choose_number', payload: { value: 3 } },
    ]);

    const logText = Array.isArray(state.log)
      ? state.log.map((entry) => toText(asRecord(entry).message)).join(' ')
      : '';

    expect(logText).toContain("Lilas, Otis avancent d'1 case.");
    expect(logText).not.toContain('avance(nt)');
  });

  it('shows conte narration to the landing player only through the presenter', async () => {
    const moduleRef = await createActionsModule();
    const setup = moduleRef.get(ContesCacahuetesSetupService);
    const actionsService = moduleRef.get(ContesActionService);
    const presenter = new ContesPresenterService(new BoardPayloadService());

    let state = setup.hydrateInitialState(baseState());
    const metadata = asRecord(state.metadata);
    const decks = asRecord(metadata.decks);
    const conteCard: ContesCard = {
      id: 1001,
      type: 'conte',
      title: 'Conte privé',
      text: 'Le conte doit être visible uniquement pour Lilas.',
    };

    state = {
      ...state,
      players: [
        { id: 1, username: 'Lilas', isBot: false, pawn: 'Niko - Géorgie' },
        { id: 2, username: 'Bucky', isBot: true, pawn: 'Freja - Suède' },
        { id: 3, username: 'Otis', isBot: false, pawn: 'Lani - Îles Marshall' },
      ] as any,
      metadata: {
        ...(state.metadata ?? {}),
        positions: { 1: 1, 2: 0, 3: 0 },
        decks: {
          ...decks,
          contes: [conteCard],
          conte: [conteCard],
          discardContes: [],
        },
      },
      log: [],
    } as any;

    state = (actionsService as any).moveBy(state, 1, 1, 0);
    state = actionsService.applyActions(state, [{ type: 'draw', payload: {} }]);

    const lilasView = presenter.exposeStateForUser(state, 1);
    const buckyView = presenter.exposeStateForUser(state, 2);
    const lilasLog = Array.isArray(lilasView.log)
      ? lilasView.log.map((entry) => toText(asRecord(entry).message)).join(' ')
      : '';
    const buckyLog = Array.isArray(buckyView.log)
      ? buckyView.log.map((entry) => toText(asRecord(entry).message)).join(' ')
      : '';

    expect(lilasLog).toContain('Le conte doit être visible uniquement pour Lilas.');
    expect(buckyLog).not.toContain('Le conte doit être visible uniquement pour Lilas.');
  });

  it('does not announce unavailable cards when a draw pile is empty', async () => {
    const moduleRef = await createActionsModule();
    const setup = moduleRef.get(ContesCacahuetesSetupService);
    const actionsService = moduleRef.get(ContesActionService);

    let state = setup.hydrateInitialState(baseState());
    const metadata = asRecord(state.metadata);
    const decks = asRecord(metadata.decks);
    state = {
      ...state,
      metadata: {
        ...(state.metadata ?? {}),
        decks: {
          ...decks,
          bonus: [],
          discardBonus: [],
        },
      },
    };

    state = (actionsService as any).resolveQueuedDraw(state, 1, {
      queue: ['bonus'],
      depth: 0,
    });

    const logText = Array.isArray(state.log)
      ? state.log.map((entry) => toText(asRecord(entry).message)).join(' ')
      : '';
    expect(logText).not.toContain('Aucune carte disponible');
  });
});
