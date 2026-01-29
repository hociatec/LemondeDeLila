import { Test } from '@nestjs/testing';
import { PanierExpressService } from '../panier-express.service';
import { createPanierExpressTestingModule } from './panier-express-test-harness';

function makeStartedState(
  game: PanierExpressService,
  players: any[],
  currentPlayerId: number,
) {
  const state: any = game.hydrateInitialState({
    players,
    status: 'running',
  } as any);
  state.status = 'started';
  state.turn = { currentPlayerId, direction: 1 };
  state.turnIndex = Math.max(
    0,
    players.findIndex((p: any) => p.id === currentPlayerId),
  );
  state.pending = null;
  // RNG deterministe pour les picks.
  state.metadata = { ...(state.metadata ?? {}), rng: { seed: 1, counter: 0 } };
  return state;
}

describe('PanierExpress pending scenarios', () => {
  let game: PanierExpressService;

  beforeAll(async () => {
    const moduleRef = await createPanierExpressTestingModule();
    game = moduleRef.get(PanierExpressService);
  });

  it('tirage chanceux: consomme 3 cartes du deck bonus et expose offered', () => {
    const state = makeStartedState(
      game,
      [
        { id: 1, username: 'A', inventory: [], basket: [], shoppingList: [] },
        { id: 2, username: 'B', inventory: [], basket: [], shoppingList: [] },
      ],
      1,
    );

    state.metadata.decks.events = {
      deck: ['tirage-chanceux'],
      discards: [],
    };
    state.metadata.decks['courses-bonus'] = {
      deck: ['amande', 'noix', 'pomme', 'banane'],
      discards: [],
    };

    const mid = (game as any).applyEvent(state, 1);
    expect(mid.pending?.type).toBe('draw');

    const after = game.applyActions(mid, [
      { type: 'draw', meta: { actorId: 1 } } as any,
    ]);

    expect(after.pending?.type).toBe('pick');
    expect(after.pending?.data?.kind).toBe('event.tirage_chanceux');
    expect(after.pending?.choices).toEqual(['amande', 'noix', 'pomme']);
    expect(after.pending?.data?.offered).toEqual(['amande', 'noix', 'pomme']);
    expect(after.metadata?.decks?.['courses-bonus']?.deck).toEqual(['banane']);
  });

  it('bot: résout un tirage chanceux en 1 pick_choice (anti-boucle)', () => {
    const state = makeStartedState(
      game,
      [
        {
          id: 1,
          username: 'Nuggets',
          isBot: true,
          inventory: [],
          basket: [],
          shoppingList: [],
        },
        {
          id: 2,
          username: 'Humain',
          inventory: [],
          basket: [],
          shoppingList: [],
        },
      ],
      1,
    );

    state.metadata.decks.events = {
      deck: ['tirage-chanceux'],
      discards: [],
    };
    state.metadata.decks['courses-bonus'] = {
      deck: ['amande', 'noix', 'pomme'],
      discards: [],
    };

    const afterEvent = (game as any).applyEvent(state, 1);
    const botActions1 = game.getBotActions(afterEvent, 1);
    expect(botActions1.map((a: any) => a.type)).toEqual(['draw']);
    const mid = game.applyActions(afterEvent, botActions1 as any);

    const botActions2 = game.getBotActions(mid, 1);
    expect(botActions2.map((a: any) => a.type)).toEqual(['pick_choice']);

    const after = game.applyActions(mid, botActions2 as any);
    expect(after.pending).toBeNull();
    expect(after.turn?.currentPlayerId).toBe(2);
  });

  it('producteur-genereux: 2 étapes (choix carte -> choix joueur)', () => {
    const state = makeStartedState(
      game,
      [
        {
          id: 1,
          username: 'A',
          inventory: ['amande'],
          basket: [],
          shoppingList: [],
        },
        { id: 2, username: 'B', inventory: [], basket: [], shoppingList: [] },
      ],
      1,
    );
    state.pending = {
      type: 'pick',
      playerId: 1,
      blocking: true,
      label: 'x',
      choices: ['amande'],
      data: {
        kind: 'event.producteur_genereux.choose_card',
        cards: ['amande'],
        targets: [{ playerId: 2, username: 'B' }],
      },
    };

    const step1 = game.applyActions(state, [
      {
        type: 'pick_choice',
        payload: { index: 0 },
        meta: { actorId: 1 },
      } as any,
    ]);
    expect(step1.pending?.type).toBe('pick');
    expect((step1.pending as any)?.data?.kind).toBe(
      'event.producteur_genereux.choose_target',
    );
    expect((step1.pending as any)?.choices).toEqual(['B']);

    const step2 = game.applyActions(step1 as any, [
      {
        type: 'pick_choice',
        payload: { index: 0 },
        meta: { actorId: 1 },
      } as any,
    ]);
    const a = (step2.players as any[]).find((p) => p.id === 1);
    const b = (step2.players as any[]).find((p) => p.id === 2);
    expect(a.inventory).not.toContain('amande');
    expect(b.inventory).toContain('amande');
    expect(step2.turn?.currentPlayerId).toBe(2);
  });

  it('panier-bonus: vole une carte unique au joueur cible', () => {
    const state = makeStartedState(
      game,
      [
        { id: 1, username: 'A', inventory: [], basket: [], shoppingList: [] },
        {
          id: 2,
          username: 'B',
          inventory: ['amande'],
          basket: [],
          shoppingList: [],
        },
      ],
      1,
    );
    state.pending = {
      type: 'pick',
      playerId: 1,
      blocking: true,
      label: 'x',
      choices: ['B'],
      data: {
        kind: 'event.panier_bonus.choose_target',
        targets: [{ playerId: 2, username: 'B' }],
      },
    };

    const after = game.applyActions(state, [
      {
        type: 'pick_choice',
        payload: { index: 0 },
        meta: { actorId: 1 },
      } as any,
    ]);
    const a = (after.players as any[]).find((p) => p.id === 1);
    const b = (after.players as any[]).find((p) => p.id === 2);
    expect(a.inventory).toContain('amande');
    expect(b.inventory).not.toContain('amande');
    expect(after.turn?.currentPlayerId).toBe(2);
  });

  it('échange spontané: choix cible -> choix carte -> échange', () => {
    const state = makeStartedState(
      game,
      [
        {
          id: 1,
          username: 'A',
          inventory: ['amande'],
          basket: [],
          shoppingList: [],
        },
        {
          id: 2,
          username: 'B',
          inventory: ['noix'],
          basket: [],
          shoppingList: [],
        },
      ],
      1,
    );
    state.pending = {
      type: 'pick',
      playerId: 1,
      blocking: true,
      label: 'x',
      choices: ['B'],
      data: {
        kind: 'event.echange_spontane.choose_target',
        targets: [{ playerId: 2, username: 'B' }],
      },
    };

    const step1 = game.applyActions(state, [
      {
        type: 'pick_choice',
        payload: { index: 0 },
        meta: { actorId: 1 },
      } as any,
    ]);
    expect((step1.pending as any)?.data?.kind).toBe(
      'event.echange_spontane.choose_give',
    );
    expect((step1.pending as any)?.choices).toEqual(['amande']);

    const step2 = game.applyActions(step1 as any, [
      {
        type: 'pick_choice',
        payload: { index: 0 },
        meta: { actorId: 1 },
      } as any,
    ]);
    const a = (step2.players as any[]).find((p) => p.id === 1);
    const b = (step2.players as any[]).find((p) => p.id === 2);
    expect(a.inventory).toContain('noix');
    expect(a.inventory).not.toContain('amande');
    expect(b.inventory).toContain('amande');
    expect(b.inventory).not.toContain('noix');
    expect(step2.turn?.currentPlayerId).toBe(2);
  });

  it('conseil de voisinage: prend une carte utile et donne une carte en retour', () => {
    const state = makeStartedState(
      game,
      [
        // Met la carte prise dans le panier (pas l'inventaire) pour éviter
        // le cas aléatoire où elle serait redonnée immédiatement.
        {
          id: 1,
          username: 'A',
          inventory: ['noix'],
          basket: [],
          shoppingList: ['amande'],
        },
        {
          id: 2,
          username: 'B',
          inventory: ['amande'],
          basket: [],
          shoppingList: [],
        },
      ],
      1,
    );
    state.pending = {
      type: 'pick',
      playerId: 1,
      blocking: true,
      label: 'x',
      choices: ['B: amande'],
      data: {
        kind: 'event.conseil_voisinage.pick',
        candidates: [{ targetPlayerId: 2, card: 'amande', label: 'B: amande' }],
      },
    };

    const after = game.applyActions(state, [
      {
        type: 'pick_choice',
        payload: { index: 0 },
        meta: { actorId: 1 },
      } as any,
    ]);
    const a = (after.players as any[]).find((p) => p.id === 1);
    const b = (after.players as any[]).find((p) => p.id === 2);
    expect(a.basket).toContain('amande');
    expect(b.inventory).toContain('noix');
    expect(after.turn?.currentPlayerId).toBe(2);
  });
});
