import { Test } from '@nestjs/testing';
import { PanierExpressService } from '../services/panier-express.service';
import { PanierExpressModule } from '../panier-express.module';
import { PanierExpressExchangeService } from '../services/panier-express-exchange.service';

// Tests unitaires ciblés Panier Express (pioche stand/bonus, échange, quiz, flux de tour, bot, presenter).
describe('PanierExpressService', () => {
  let service: PanierExpressService;
  let exchangeSvc: PanierExpressExchangeService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PanierExpressModule],
    }).compile();
    service = moduleRef.get(PanierExpressService);
    exchangeSvc = moduleRef.get(PanierExpressExchangeService);
  });

  it('expose un état initial avec decks et tuiles', () => {
    const state: any = { players: [{ id: 1, username: 'A' }, { id: 2, username: 'B' }], status: 'starting' };
    const hydrated = service.hydrateInitialState(state as any);
    const meta = hydrated.metadata as any;
    expect(Array.isArray(meta.tiles)).toBe(true);
    expect(meta.decks?.courses?.deck?.length).toBeGreaterThan(0);
  });

  it("expose correctement les pending non-quiz et les vues joueurs", () => {
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

    const exposed = service.exposeState(base as any);

    expect(exposed.pending?.type).toBe('exchange');
    expect((exposed.pending as any).foo).toBe('bar');

    const extras: any = exposed.extras;
    expect(Array.isArray(extras.playerViews)).toBe(true);
    expect(extras.playerViews.length).toBe(2);
    const currentView = extras.currentPlayerView;
    expect(currentView).toBeTruthy();
    expect(currentView.id).toBe(1);
    expect(currentView.basket).toContain('pomme');
  });

  it('avancer sur un stand ajoute une carte cohérente', () => {
    const base: any = service.hydrateInitialState({ players: [{ id: 1, username: 'A' }], status: 'starting' } as any);
    base.metadata.positions[1] = 1; // stand fruitier
    const moved = (service as any)['drawSvc'].drawCourse(base, 1, 'fruitier');
    const p = (moved.players as any[])[0];
    expect((p.basket?.length ?? 0) + (p.inventory?.length ?? 0)).toBeGreaterThan(0);
  });

  it('bloque le tour sur un quiz en pending', () => {
    const base: any = service.hydrateInitialState({ players: [{ id: 1, username: 'A' }], status: 'running' } as any);
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
    const exposed = service.exposeState(base as any);
    expect(exposed.pending?.type).toBe('quiz');
    expect((exposed.pending as any)?.blocking).toBe(true);
  });

  it('sanitize et expose les quiz même sans question explicite', () => {
    const base: any = service.hydrateInitialState({ players: [{ id: 1, username: 'A' }], status: 'running' } as any);
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

    const exposed = service.exposeState(base as any);
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
    const afterSkip = (service as any).handleSkipTurn(base as any, { type: 'skip_turn', payload: { playerId: 1 } });
    expect(afterSkip.turn?.currentPlayerId).toBe(2);
  });

  it('déclare une victoire quand un joueur a complété sa liste sur la case start', () => {
    const base: any = service.hydrateInitialState({
      players: [{ id: 1, username: 'A', shoppingList: ['pomme'], basket: ['pomme'] }],
      status: 'starting',
    } as any);
    base.metadata.positions[1] = 5; // pas start
    const afterVictory = (service as any).applyVictory(base as any);
    expect(afterVictory.status?.toLowerCase()).toBe('finished');
    expect((afterVictory.metadata as any).winnerId).toBe(1);
  });

  it('permet à un bot de choisir automatiquement une réponse de quiz parmi les choix proposés', () => {
    const base: any = service.hydrateInitialState({
      players: [{ id: 1, username: 'Bot A', isBot: true }],
      status: 'running',
    } as any);
    const meta = base.metadata as any;
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

    const actions = service.getBotActions(base as any, 1);
    const quizActions = actions.filter((a) => a.type === 'answer_quiz');
    expect(quizActions.length).toBeGreaterThan(0);
    quizActions.forEach((a) => {
      expect(a.payload?.answer).toBeDefined();
      expect(['1', '2', '3']).toContain(a.payload.answer);
    });
  });

  it('refill le deck de courses lorsqu’il est vide et permet toujours de piocher', () => {
    const base: any = service.hydrateInitialState({
      players: [{ id: 1, username: 'A' }],
      status: 'starting',
    } as any);
    const meta = base.metadata as any;
    if (meta.decks?.courses) {
      meta.decks.courses.deck = [];
      meta.decks.courses.discards = [];
    }
    meta.positions[1] = 1; // stand fruitier
    const after = (service as any)['drawSvc'].drawCourse(base as any, 1, 'fruitier');
    const p = (after.players as any[])[0];
    expect((p.basket?.length ?? 0) + (p.inventory?.length ?? 0)).toBeGreaterThan(0);
  });

  it('propose des actions exchange_with via le service dédié', () => {
    const state: any = service.hydrateInitialState({
      players: [
        { id: 1, username: 'A', inventory: ['pomme'] },
        { id: 2, username: 'B', inventory: ['poire'] },
      ],
      status: 'running',
    } as any);
    state.turn = { currentPlayerId: 1, direction: 1 };
    state.turnIndex = 0;
    const actions = exchangeSvc.buildExchangeActions(state as any, 1);
    expect(actions.some((a: any) => a.type === 'exchange_with')).toBe(true);
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

    const actions = service.getAvailableActions(state as any, 1);
    expect(actions.some((a: any) => a.type === 'exchange_with')).toBe(false);
    expect(actions.some((a: any) => a.type === 'roll')).toBe(true);
  });

  it("propose des echanges uniquement quand pending exchange correspond au joueur", () => {
    const state: any = service.hydrateInitialState({
      players: [
        { id: 1, username: 'A', inventory: ['pomme'] },
        { id: 2, username: 'B', inventory: ['poire'] },
      ],
      status: 'running',
      pending: { type: 'exchange', playerId: 1 },
    } as any);
    state.turn = { currentPlayerId: 1, direction: 1 };
    state.turnIndex = 0;
    state.metadata.positions[1] = 4; // exchange-1

    const actions = service.getAvailableActions(state as any, 1);
    expect(actions.some((a: any) => a.type === 'exchange_with')).toBe(true);
  });

  it('met en pending un échange lorsqu’une offre est possible', () => {
    const state: any = service.hydrateInitialState({
      players: [
        { id: 1, username: 'A', inventory: ['pomme'] },
        { id: 2, username: 'B', inventory: ['poire'] },
      ],
      status: 'running',
    } as any);

    const after = exchangeSvc.applyExchange(state as any, 1);
    expect(after.pending?.type).toBe('exchange');
    expect((after.pending as any)?.playerId).toBe(1);
    expect(typeof (after.pending as any)?.card).toBe('string');
  });

  it("refuse un exchange_with sans pending exchange", () => {
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

    const after = service.applyActions(state as any, [
      { type: 'exchange_with', payload: { playerId: 1, targetPlayerId: 2, give: 'pomme', take: 'poire' } },
    ] as any);

    const a = (after.players as any[]).find((p) => p.id === 1);
    const b = (after.players as any[]).find((p) => p.id === 2);
    expect(a.inventory).toContain('pomme');
    expect(a.inventory).not.toContain('poire');
    expect(b.inventory).toContain('poire');
    expect(b.inventory).not.toContain('pomme');
  });

  it("gère l'échange impossible en reculant le joueur sans pending", () => {
    const state: any = service.hydrateInitialState({
      players: [
        { id: 1, username: 'A', inventory: [] },
        { id: 2, username: 'B', inventory: [] },
      ],
      status: 'running',
    } as any);
    (state.metadata as any).positions[1] = 5;
    const after = exchangeSvc.applyExchange(state as any, 1);
    expect((after as any).pending ?? null).toBeNull();
    expect((after.metadata as any).positions[1]).not.toBe(5);
  });

  it("résout un échange et met à jour les inventaires", () => {
    const state: any = service.hydrateInitialState({
      players: [
        { id: 1, username: 'A', inventory: ['pomme', 'banane'] },
        { id: 2, username: 'B', inventory: ['poire'] },
      ],
      status: 'running',
    } as any);
    const pendingState = exchangeSvc.applyExchange(state as any, 1);
    const after = exchangeSvc.resolveExchange(pendingState as any, 1, 2, 'pomme', 'poire');
    const a = (after.players as any[]).find((p) => p.id === 1);
    const b = (after.players as any[]).find((p) => p.id === 2);
    expect(a.inventory).toContain('poire');
    expect(a.inventory).not.toContain('pomme');
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
    const first = exchangeSvc.applyExchange(base as any, 1);
    const second = exchangeSvc.applyExchange(first as any, 2);
    expect(second.pending?.playerId).toBe(1);
  });

  it("rejette la résolution d'un autre joueur que celui concerné", () => {
    const base: any = service.hydrateInitialState({
      players: [
        { id: 1, username: 'A', inventory: ['pomme'] },
        { id: 2, username: 'B', inventory: ['poire'] },
      ],
      status: 'running',
    } as any);
    const pending = exchangeSvc.applyExchange(base as any, 1);
    const after = exchangeSvc.resolveExchange(pending as any, 2, 1, 'poire', 'pomme');
    expect(after.pending?.playerId).toBe(1);
  });
});
