/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call */
import { PanierExpressService } from '../panier-express.service';
import { PanierExpressExchangeService } from '../actions/panier-express-exchange.service';
import { PanierExpressPhaseService } from '../phases/panier-express-phase.service';
import { nextRngInt } from '../../../../../common/utils/seeded-rng';
import { createPanierExpressTestingModule } from './panier-express-test-harness';

// Tests unitaires ciblés Panier Express (pioche stand/bonus, échange, quiz, flux de tour, bot, presenter).
describe('PanierExpressService', () => {
  let service: PanierExpressService;
  let exchangeSvc: PanierExpressExchangeService;
  let phaseSvc: PanierExpressPhaseService;

  beforeAll(async () => {
    const moduleRef = await createPanierExpressTestingModule();
    service = moduleRef.get(PanierExpressService);
    exchangeSvc = moduleRef.get(PanierExpressExchangeService);
    phaseSvc = moduleRef.get(PanierExpressPhaseService);
  });

  it('expose un état initial avec decks et tuiles', () => {
    const state: any = {
      players: [
        { id: 1, username: 'A' },
        { id: 2, username: 'B' },
      ],
      status: 'starting',
    };
    const hydrated = service.hydrateInitialState(state);
    const meta = hydrated.metadata as any;
    expect(Array.isArray(meta.tiles)).toBe(true);
    expect(meta.decks?.courses?.deck?.length).toBeGreaterThan(0);
  });
  it('demande une selection de pion (obligatoire) au demarrage', () => {
    const state: any = {
      players: [
        { id: 1, username: 'A' },
        { id: 2, username: 'B' },
      ],
      status: 'started',
    };
    const hydrated = service.hydrateInitialState(state);
    expect(hydrated.status?.toLowerCase()).toBe('started');
    expect(hydrated.pending?.type).toBe('choose_pawn');
    expect((hydrated.pending as any)?.blocking).toBe(true);
    expect((hydrated.pending as any)?.playerId).toBe(1);
    expect(Array.isArray((hydrated.pending as any)?.data?.pawns)).toBe(true);
    const p1: any = (hydrated.players ?? []).find((p: any) => p.id === 1);
    expect(Array.isArray(p1.shoppingList)).toBe(true);
    expect(p1.shoppingList.length).toBe(3);
    expect(Boolean(p1.pawn)).toBe(false);
    const choices = Array.isArray((hydrated.pending as any)?.choices)
      ? (hydrated.pending as any).choices
      : [];
    expect(choices.length).toBeGreaterThan(0);
  });

  it('propose tous les pions quand un bot en a déjà un (reset bot pawn pendant setup)', () => {
    const base: any = service.hydrateInitialState({
      players: [
        { id: 1, username: 'A' },
        { id: 2, username: 'B', isBot: true, pawn: 'sac en toile' },
      ],
      status: 'started',
    } as any);

    const pending: any = base.pending;
    expect(pending?.type).toBe('choose_pawn');
    expect(Array.isArray(pending?.data?.pawns)).toBe(true);
    const choices = Array.isArray(pending?.choices) ? pending.choices : [];
    // pawns.json currently contains 6 options; ensure bot pawn doesn't reduce the list for the first human.
    expect(choices.length).toBeGreaterThanOrEqual(6);
  });

  it('expose correctement les pending non-quiz et les vues joueurs', () => {
    const base: any = service.hydrateInitialState({
      players: [
        { id: 1, username: 'A', basket: ['pomme'], inventory: [] },
        { id: 2, username: 'B', basket: [], inventory: ['poire'] },
      ],
      status: 'running',
      pending: { type: 'exchange', foo: 'bar' },
    } as any);
    base.turn = { currentPlayerId: 1, direction: 1 };
    base.turnIndex = 0;

    const exposed = service.exposeState(base);

    expect(exposed.pending?.type).toBe('exchange');
    expect((exposed.pending as any).foo).toBe('bar');

    const extras: any = (exposed as any).extras;
    expect(Array.isArray(extras.playerViews)).toBe(true);
    expect(extras.playerViews.length).toBe(2);
    const currentView = extras.currentPlayerView;
    expect(currentView).toBeTruthy();
    expect(currentView.id).toBe(1);
    expect(currentView.basket).toContain('pomme');

    // Plateau exposé pour permettre l'annonce "case/total".
    const board: any = (exposed as any).board;
    expect(board).toBeTruthy();
    expect(Array.isArray(board.tiles)).toBe(true);
    expect(board.tiles.length).toBeGreaterThan(0);
    expect(typeof board.positions).toBe('object');
    expect(typeof board.laps).toBe('object');
    expect(typeof board.turns).toBe('object');
  });

  it('avancer sur un stand ajoute une carte cohérente', () => {
    const base: any = service.hydrateInitialState({
      players: [{ id: 1, username: 'A' }],
      status: 'starting',
    } as any);
    base.metadata.positions[1] = 1; // stand fruitier
    const moved = (service as any)['drawSvc'].drawCourse(base, 1, 'fruitier');
    const p = (moved.players as any[])[0];
    expect(
      (p.basket?.length ?? 0) + (p.inventory?.length ?? 0),
    ).toBeGreaterThan(0);
  });

  it('bloque le tour sur un quiz en pending', () => {
    const base: any = service.hydrateInitialState({
      players: [{ id: 1, username: 'A' }],
      status: 'running',
    } as any);
    base.turn = { currentPlayerId: 1, direction: 1 };
    base.turnIndex = 0;
    base.metadata.quiz = {
      pending: {
        1: {
          question: 'Combien de pommes ?',
          choices: ['1', '2'],
          answer: '1',
        },
      },
    };
    const exposed = service.exposeState(base);
    expect(exposed.pending?.type).toBe('quiz');
    expect((exposed.pending as any)?.blocking).toBe(true);
  });

  it('sanitize et expose les quiz même sans question explicite', () => {
    const base: any = service.hydrateInitialState({
      players: [{ id: 1, username: 'A' }],
      status: 'running',
    } as any);
    base.turn = { currentPlayerId: 1, direction: 1 };
    base.turnIndex = 0;
    base.metadata.quiz = {
      pending: {
        1: {
          question: '   ',
          choices: [],
          answer: '  poire ',
        },
      },
    };

    const exposed = service.exposeState(base);
    expect(exposed.pending?.type).toBe('quiz');
    expect(exposed.pending?.choices).toEqual(['poire']);
    expect(exposed.pending?.question).toBe('');
  });

  it('applique un skip_turn et avance le tour', () => {
    const base: any = service.hydrateInitialState({
      players: [
        { id: 1, username: 'A' },
        { id: 2, username: 'B' },
      ],
      status: 'running',
    } as any);
    base.turn = { currentPlayerId: 1, direction: 1 };
    base.turnIndex = 0;
    const afterSkip = (service as any).handleSkipTurn(base, {
      type: 'skip_turn',
      payload: { playerId: 1 },
    });
    expect(afterSkip.turn?.currentPlayerId).toBe(2);
  });

  it('incrémente le tour de plateau quand un joueur repasse par la case départ', () => {
    const base: any = service.hydrateInitialState({
      players: [
        { id: 1, username: 'A' },
        { id: 2, username: 'B' },
      ],
      status: 'running',
    } as any);
    base.turn = { currentPlayerId: 1, direction: 1 };
    base.turnIndex = 0;

    const meta = base.metadata;
    const tilesLen =
      Array.isArray(meta.tiles) && meta.tiles.length ? meta.tiles.length : 40;
    meta.positions[1] = tilesLen - 1;
    meta.laps[1] = 0;

    // 39 -> 1 : le joueur repasse par la case départ pendant le déplacement.
    const moved = (service as any).movePlayer(base, 1, 2);
    expect(moved.metadata.laps[1]).toBe(1);
  });

  it('décrémente le tour de plateau quand un joueur recule en repassant par la case départ (tour 1 -> tour 0)', () => {
    const base: any = service.hydrateInitialState({
      players: [
        { id: 1, username: 'A' },
        { id: 2, username: 'B' },
      ],
      status: 'running',
    } as any);
    base.turn = { currentPlayerId: 1, direction: 1 };
    base.turnIndex = 0;

    const meta = base.metadata;
    meta.positions[1] = 0;
    meta.laps[1] = 0;

    const moved = (service as any).movePlayer(base, 1, -1);
    expect(moved.metadata.laps[1]).toBe(-1);
  });

  it("ne met pas d'échange en pending si l'initiateur n'a aucune carte", () => {
    const state: any = service.hydrateInitialState({
      players: [
        { id: 1, username: 'A', inventory: [] },
        { id: 2, username: 'B', inventory: ['poire'] },
      ],
      status: 'running',
    } as any);

    state.metadata.decks.exchanges = {
      deck: ['echange-amiable'],
      discards: [],
    };

    const after = exchangeSvc.applyExchange(state, 1);
    expect(after.pending ?? null).toBeNull();
  });

  it('déclare une victoire quand un joueur a complété sa liste sur la case start', () => {
    const base: any = service.hydrateInitialState({
      players: [
        { id: 1, username: 'A', shoppingList: ['pomme'], basket: ['pomme'] },
      ],
      status: 'running',
    } as any);
    base.metadata.positions[1] = 0; // start
    const afterVictory = (service as any).applyVictory(base);
    expect(afterVictory.status?.toLowerCase()).toBe('finished');
    expect(afterVictory.metadata.winnerId).toBe(1);
  });

  it('permet à un bot de choisir automatiquement une réponse de quiz parmi les choix proposés', () => {
    const base: any = service.hydrateInitialState({
      players: [{ id: 1, username: 'Bot A', isBot: true }],
      status: 'running',
    } as any);
    const meta = base.metadata;
    const quizIndex = meta.tiles.findIndex((t: any) => t.type === 'quiz');
    meta.positions[1] = quizIndex >= 0 ? quizIndex : 0;
    meta.quiz = {
      pending: {
        1: {
          question: 'Combien de pommes ?',
          choices: ['1', '2', '3'],
          answer: '1',
        },
      },
    };
    base.turn = { currentPlayerId: 1, direction: 1 };
    base.turnIndex = 0;

    const actions = service.getBotActions(base, 1);
    const quizActions = actions.filter((a) => a.type === 'answer_quiz');
    expect(quizActions.length).toBeGreaterThan(0);
    quizActions.forEach((a) => {
      const answer = a.payload?.answer;
      expect(answer).toBeDefined();
      expect(['1', '2', '3']).toContain(answer);
    });
  });

  it('tirage chanceux: remet les cartes non choisies en discard (anti-boucle bot)', () => {
    const base: any = service.hydrateInitialState({
      players: [
        { id: 1, username: 'Nuggets', isBot: true, inventory: [], basket: [] },
        { id: 2, username: 'Humain', inventory: [], basket: [] },
      ],
      status: 'running',
    } as any);
    base.turn = { currentPlayerId: 1, direction: 1 };
    base.turnIndex = 0;

    // Simule un tirage chanceux : 3 cartes ont déjà été sorties du deck au moment de l'offre.
    base.metadata.decks['courses-bonus'] = {
      deck: ['banane'],
      discards: [],
    };
    base.pending = {
      type: 'pick',
      playerId: 1,
      blocking: true,
      label: 'tirage',
      choices: ['amande', 'noix', 'pomme'],
      data: {
        kind: 'event.tirage_chanceux',
        offered: ['amande', 'noix', 'pomme'],
      },
    };

    const after = service.applyActions(base, [
      {
        type: 'pick_choice',
        payload: { index: 0 },
        meta: { actorId: 1 },
      } as any,
    ]);

    const pool = (after.metadata as any)?.decks?.['courses-bonus'];
    expect(pool).toBeTruthy();
    expect(pool.deck).toEqual(['banane']);
    expect(pool.discards).toEqual(['noix', 'pomme']);
    expect(after.turn?.currentPlayerId).toBe(2);
  });

  it('ignore un roll fourni par le client (anti-triche)', () => {
    const base: any = service.hydrateInitialState({
      players: [
        { id: 1, username: 'A' },
        { id: 2, username: 'B' },
      ],
      status: 'running',
    } as any);
    base.turn = { currentPlayerId: 1, direction: 1 };
    base.turnIndex = 0;
    base.metadata = {
      ...(base.metadata ?? {}),
      rng: { seed: 123, counter: 0 },
    };

    const expected = nextRngInt(base.metadata, 6).value + 1;

    const after = service.applyActions(base, [
      { type: 'roll', payload: { roll: 999 } },
    ] as any);

    expect(typeof after.lastRoll).toBe('number');
    expect(after.lastRoll).toBe(expected);
    expect((after.metadata as any)?.rng?.seed).toBe(123);
    expect((after.metadata as any)?.rng?.counter).toBe(1);
  });

  it("expose currentPlayerView pour l'utilisateur connecté (même si c'est le tour d'un bot)", () => {
    const state: any = service.hydrateInitialState({
      players: [
        {
          id: 1,
          username: 'admin',
          shoppingList: ['ananas'],
          basket: [],
          inventory: [],
        },
        {
          id: -1,
          username: 'GnoleGear',
          isBot: true,
          shoppingList: ['melon'],
          basket: [],
          inventory: [],
        },
      ],
      status: 'running',
    } as any);

    // Le bot a un id négatif dans le state du moteur.
    state.turn = { currentPlayerId: -1, direction: 1 };
    state.turnIndex = 0;

    const exposed: any = service.exposeStateForUser(state, 1);
    expect(exposed.extras?.currentPlayerView?.shoppingList).toEqual(['ananas']);
  });

  it('requiert une réponse pour answer_quiz (ignore correct côté client)', () => {
    const base: any = service.hydrateInitialState({
      players: [{ id: 1, username: 'A' }],
      status: 'running',
    } as any);
    base.turn = { currentPlayerId: 1, direction: 1 };
    base.turnIndex = 0;
    base.metadata.quiz = {
      pending: {
        1: {
          question: 'Q?',
          choices: ['a', 'b'],
          answer: 'a',
        },
      },
    };

    const after = service.applyActions(base, [
      { type: 'answer_quiz', payload: { correct: true } },
    ] as any);

    expect((after.metadata as any)?.quiz?.pending?.[1]).toBeTruthy();
  });

  it('refill le deck de courses lorsqu’il est vide et permet toujours de piocher', () => {
    const base: any = service.hydrateInitialState({
      players: [{ id: 1, username: 'A' }],
      status: 'starting',
    } as any);
    const meta = base.metadata;
    if (meta.decks?.courses) {
      meta.decks.courses.deck = [];
      meta.decks.courses.discards = [];
    }
    meta.positions[1] = 1; // stand fruitier
    const after = (service as any)['drawSvc'].drawCourse(base, 1, 'fruitier');
    const p = (after.players as any[])[0];
    expect(
      (p.basket?.length ?? 0) + (p.inventory?.length ?? 0),
    ).toBeGreaterThan(0);
  });

  it("ne propose pas d'echange si aucun pending exchange", () => {
    const state: any = service.hydrateInitialState({
      players: [
        { id: 1, username: 'A', inventory: ['pomme'] },
        { id: 2, username: 'B', inventory: ['poire'] },
      ],
      status: 'running',
      pending: null,
    } as any);
    state.turn = { currentPlayerId: 1, direction: 1 };
    state.turnIndex = 0;
    state.metadata.positions[1] = 4; // exchange-1

    const actions = service.getAvailableActions(state, 1);
    expect(actions.some((a: any) => a.type === 'exchange_choose_target')).toBe(
      false,
    );
    expect(actions.some((a: any) => a.type === 'roll')).toBe(true);
  });

  it('propose des echanges uniquement quand pending exchange correspond au joueur', () => {
    const state: any = service.hydrateInitialState({
      players: [
        { id: 1, username: 'A', inventory: ['pomme'] },
        { id: 2, username: 'B', inventory: ['poire'] },
      ],
      status: 'running',
      pending: {
        type: 'exchange',
        playerId: 1,
        card: 'exchange',
        step: 'choose_target',
        targets: [{ targetPlayerId: 2, targetUsername: 'B' }],
      },
    } as any);
    state.turn = { currentPlayerId: 1, direction: 1 };
    state.turnIndex = 0;
    state.metadata.positions[1] = 4; // exchange-1

    const actions = service.getAvailableActions(state, 1);
    expect(actions.some((a: any) => a.type === 'exchange_choose_target')).toBe(
      true,
    );
  });

  it('met en pending un échange lorsqu’une offre est possible', () => {
    const state: any = service.hydrateInitialState({
      players: [
        { id: 1, username: 'A', inventory: ['pomme'] },
        { id: 2, username: 'B', inventory: ['poire'] },
      ],
      status: 'running',
    } as any);

    state.metadata.decks.exchanges = {
      deck: ['echange-amiable'],
      discards: [],
    };
    const after = exchangeSvc.applyExchange(state, 1);
    expect(after.pending?.type).toBe('exchange');
    expect((after.pending as any)?.playerId).toBe(1);
    expect(typeof (after.pending as any)?.card).toBe('string');
  });

  it("gère l'échange impossible sans pending", () => {
    const state: any = service.hydrateInitialState({
      players: [{ id: 1, username: 'A', inventory: ['pomme'] }],
      status: 'running',
    } as any);
    state.metadata.decks.exchanges = {
      deck: ['echange-amiable'],
      discards: [],
    };
    const after = exchangeSvc.applyExchange(state, 1);
    expect((after as any).pending ?? null).toBeNull();
  });

  it('résout un échange et met à jour les inventaires', () => {
    const state: any = service.hydrateInitialState({
      players: [
        { id: 1, username: 'A', inventory: ['pomme', 'banane'] },
        { id: 2, username: 'B', inventory: ['poire'] },
      ],
      status: 'running',
    } as any);
    state.metadata.decks.exchanges = {
      deck: ['echange-amiable'],
      discards: [],
    };

    const pendingState = exchangeSvc.applyExchange(state, 1);
    const chosenTarget = exchangeSvc.chooseTarget(pendingState as any, 1, 2);
    const offered = exchangeSvc.chooseGive(chosenTarget as any, 1, 'pomme');
    const after = exchangeSvc.acceptOffer(offered as any, 2);
    const a = (after.players as any[]).find((p) => p.id === 1);
    const b = (after.players as any[]).find((p) => p.id === 2);
    expect(a.inventory).toContain('poire');
    expect(a.inventory).not.toContain('pomme');
    expect(a.inventory).toContain('banane');
    expect(b.inventory).toContain('pomme');
    expect(b.inventory).not.toContain('poire');
    expect(after.pending).toBeNull();
  });

  it('refuse de lancer un second échange tant que le premier est en attente', () => {
    const base: any = service.hydrateInitialState({
      players: [
        { id: 1, username: 'A', inventory: ['pomme'] },
        { id: 2, username: 'B', inventory: ['poire'] },
      ],
      status: 'running',
    } as any);
    base.metadata.decks.exchanges = {
      deck: ['echange-amiable'],
      discards: [],
    };
    const first = exchangeSvc.applyExchange(base, 1);
    const second = exchangeSvc.applyExchange(first as any, 2);
    expect(second.pending?.playerId).toBe(1);
  });

  it("rejette l'action d'un autre joueur que celui concerné", () => {
    const base: any = service.hydrateInitialState({
      players: [
        { id: 1, username: 'A', inventory: ['pomme'] },
        { id: 2, username: 'B', inventory: ['poire'] },
      ],
      status: 'running',
    } as any);
    base.metadata.decks.exchanges = {
      deck: ['echange-amiable'],
      discards: [],
    };
    const pending = exchangeSvc.applyExchange(base, 1);
    const after = exchangeSvc.chooseTarget(pending as any, 2, 1);
    expect(after.pending?.playerId).toBe(1);
  });

  it('ne propose pas de roll quand un pending bloquant concerne un autre joueur', () => {
    const state: any = service.hydrateInitialState({
      players: [
        { id: 1, username: 'A' },
        { id: 2, username: 'B' },
      ],
      status: 'started',
      pending: {
        type: 'pick',
        playerId: 2,
        blocking: true,
        label: 'Choix',
        choices: ['x'],
        data: {
          kind: 'exchange.impose.choose_card',
          initiatorId: 1,
          cards: ['x'],
        },
      },
    } as any);
    state.turn = { currentPlayerId: 1, direction: 1 };
    state.turnIndex = 0;

    const actions = service.getAvailableActions(state, 1);
    expect(
      actions.some((a: any) => String(a.type).toLowerCase() === 'roll'),
    ).toBe(false);
    expect(actions.length).toBe(0);
  });

  it('rejette le roll si une action bloquante est en attente', () => {
    const state: any = service.hydrateInitialState({
      players: [
        { id: 1, username: 'A' },
        { id: 2, username: 'B' },
      ],
      status: 'started',
      pending: {
        type: 'pick',
        playerId: 2,
        blocking: true,
        label: 'Choix',
        choices: ['x'],
        data: {
          kind: 'exchange.impose.choose_card',
          initiatorId: 1,
          cards: ['x'],
        },
      },
    } as any);
    state.turn = { currentPlayerId: 1, direction: 1 };
    state.turnIndex = 0;

    expect(() =>
      service.validateAction(
        state,
        { type: 'roll', payload: {}, meta: { actorId: 1 } } as any,
        1,
      ),
    ).toThrow();
  });

  it('décrémente les statuts temporaires au changement de tour', () => {
    const state: any = service.hydrateInitialState({
      players: [
        { id: 1, username: 'A' },
        { id: 2, username: 'B' },
      ],
      status: 'started',
    } as any);
    state.turn = { currentPlayerId: 1, direction: 1 };
    state.turnIndex = 0;
    state.metadata.statuses.noDrawCourses = { 1: 1 };
    state.metadata.statuses.revealInventory = { 1: 1 };

    const after = phaseSvc.advanceTurn(state) as any;
    expect(after.metadata.statuses.noDrawCourses?.[1] ?? 0).toBe(0);
    expect(after.metadata.statuses.revealInventory?.[1] ?? 0).toBe(0);
  });

  it('conserve la direction de mouvement au changement de tour', () => {
    const state: any = service.hydrateInitialState({
      players: [
        { id: 1, username: 'A' },
        { id: 2, username: 'B' },
      ],
      status: 'started',
    } as any);
    state.turn = { currentPlayerId: 1, direction: -1 };
    state.turnIndex = 0;
    state.metadata.movementDirection = -1;
    state.metadata.movementDirectionOwnerId = 1;

    const after = phaseSvc.advanceTurn(state) as any;
    expect(after.turn?.direction).toBe(-1);
  });
});
