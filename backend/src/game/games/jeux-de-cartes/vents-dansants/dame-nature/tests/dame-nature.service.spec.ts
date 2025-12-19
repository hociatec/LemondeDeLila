import { Test } from '@nestjs/testing';
import { DameNatureModule } from '../dame-nature.module';
import { DameNatureService } from '../services/dame-nature.service';
import { DameNatureBotService } from '../services/dame-nature-bot.service';

describe('DameNatureService', () => {
  let service: DameNatureService;
  let botService: DameNatureBotService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [DameNatureModule],
    }).compile();
    service = moduleRef.get(DameNatureService);
    botService = moduleRef.get(DameNatureBotService);
  });

  it('ne passe pas le tour après une défausse seule', () => {
    const state: any = service.hydrateInitialState({
      players: [
        { id: 1, username: 'A' },
        { id: 2, username: 'B' },
      ],
      status: 'started',
    } as any);
    state.turn = { currentPlayerId: 1, direction: 1 };
    state.turnIndex = 0;

    const me: any = state.players.find((p: any) => p.id === 1);
    const card = me.hand[0];

    const afterDiscard: any = service.applyActions(state as any, [
      { type: 'discard_card', payload: { playerId: 1, memberId: card.memberId, familyId: card.familyId } },
    ] as any);

    expect(afterDiscard.turn.currentPlayerId).toBe(1);
    expect(afterDiscard.metadata.turnProgress).toMatchObject({ playerId: 1, drew: false, discarded: true });
  });

  it('passe le tour après pioche puis défausse (ordre libre)', () => {
    const state: any = service.hydrateInitialState({
      players: [
        { id: 1, username: 'A' },
        { id: 2, username: 'B' },
      ],
      status: 'started',
    } as any);
    state.turn = { currentPlayerId: 1, direction: 1 };
    state.turnIndex = 0;

    // Forcer une pioche déterministe (carte famille).
    state.metadata.decks.family.deck = [
      { kind: 'family', familyId: 'arbres', familyName: 'Famille des Arbres', memberId: 'x', memberName: 'X', role: 'Enfant' },
    ];
    state.metadata.decks.family.discards = [];

    const afterDraw: any = service.applyActions(state as any, [{ type: 'draw', payload: { playerId: 1 } }] as any);
    expect(afterDraw.turn.currentPlayerId).toBe(1);
    expect(afterDraw.metadata.turnProgress).toMatchObject({ playerId: 1, drew: true, discarded: false });

    const me: any = afterDraw.players.find((p: any) => p.id === 1);
    const discard = me.hand[0];

    const afterDiscard: any = service.applyActions(afterDraw as any, [
      { type: 'discard_card', payload: { playerId: 1, memberId: discard.memberId, familyId: discard.familyId } },
    ] as any);

    expect(afterDiscard.turn.currentPlayerId).toBe(2);
    expect(afterDiscard.metadata.turnProgress).toMatchObject({ playerId: 2, drew: false, discarded: false });
  });

  it('complète une famille et refill la main à 4 cartes', () => {
    const state: any = service.hydrateInitialState({
      players: [
        { id: 1, username: 'A' },
        { id: 2, username: 'B' },
      ],
      status: 'started',
    } as any);
    state.turn = { currentPlayerId: 1, direction: 1 };
    state.turnIndex = 0;

    const me: any = state.players.find((p: any) => p.id === 1);
    me.books = [];
    me.hand = [
      { kind: 'family', familyId: 'arbres', familyName: 'Famille des Arbres', memberId: 'chene', memberName: 'Chêne', role: 'Parent' },
      { kind: 'family', familyId: 'arbres', familyName: 'Famille des Arbres', memberId: 'sapin', memberName: 'Sapin', role: 'Parent' },
      { kind: 'family', familyId: 'arbres', familyName: 'Famille des Arbres', memberId: 'bouleau', memberName: 'Bouleau', role: 'Enfant' },
      { kind: 'family', familyId: 'oiseaux', familyName: 'Famille des Oiseaux', memberId: 'aigle', memberName: 'Aigle', role: 'Parent' },
    ];
    me.handCount = me.hand.length;

    state.metadata.decks.family.deck = [
      // Complète la famille arbres
      { kind: 'family', familyId: 'arbres', familyName: 'Famille des Arbres', memberId: 'erable', memberName: 'Érable', role: 'Enfant' },
      // Refill à 4
      { kind: 'family', familyId: 'felins', familyName: 'Famille des Félins', memberId: 'lion', memberName: 'Lion', role: 'Parent' },
      { kind: 'family', familyId: 'poissons', familyName: 'Famille des Poissons', memberId: 'requin', memberName: 'Requin', role: 'Parent' },
      { kind: 'family', familyId: 'insectes', familyName: 'Famille des Insectes', memberId: 'cigale', memberName: 'Cigale', role: 'Parent' },
    ];
    state.metadata.decks.family.discards = [];

    const afterDraw: any = service.applyActions(state as any, [{ type: 'draw', payload: { playerId: 1 } }] as any);
    const afterMe: any = afterDraw.players.find((p: any) => p.id === 1);

    expect(afterMe.books).toContain('arbres');
    expect(afterMe.hand.length).toBe(4);
  });

  it('refuse une demande sans carte offerte', () => {
    const state: any = service.hydrateInitialState({
      players: [
        { id: 1, username: 'A' },
        { id: 2, username: 'B' },
      ],
      status: 'started',
    } as any);
    state.turn = { currentPlayerId: 1, direction: 1 };
    state.turnIndex = 0;

    const afterAsk: any = service.applyActions(state as any, [
      { type: 'ask_card', payload: { playerId: 1, target: 2, familyId: 'arbres', memberId: 'chene' } },
    ] as any);

    expect(afterAsk.metadata.pendingAsk ?? null).toBeNull();
  });

  it('bot: ask_card inclut une carte offerte', () => {
    const state: any = service.hydrateInitialState({
      players: [
        { id: 1, username: 'A' },
        { id: 2, username: 'Bot', isBot: true },
      ],
      status: 'started',
    } as any);
    state.turn = { currentPlayerId: 2, direction: 1 };
    state.turnIndex = 1;

    const bot = state.players.find((p: any) => p.id === 2);
    bot.hand = [
      { kind: 'family', familyId: 'felins', familyName: 'Famille des Félins', memberId: 'lynx', memberName: 'Lynx', role: 'Enfant' },
      { kind: 'family', familyId: 'poissons', familyName: 'Famille des Poissons', memberId: 'requin', memberName: 'Requin', role: 'Parent' },
    ];
    bot.handCount = bot.hand.length;

    const actions = botService.getBotActions(state as any, 2);
    const ask = actions.find((a: any) => a.type === 'ask_card');
    if (!ask) return; // le bot peut choisir draw selon le scoring
    expect(ask.payload.offerMemberId ?? ask.payload.giveMemberId ?? null).toBeTruthy();
  });

  it('bot: défausse quand la pioche est déjà faite', () => {
    const state: any = service.hydrateInitialState({
      players: [
        { id: 1, username: 'A' },
        { id: 2, username: 'Bot', isBot: true },
      ],
      status: 'started',
    } as any);
    state.turn = { currentPlayerId: 2, direction: 1 };
    state.turnIndex = 1;
    state.metadata.turnProgress = { playerId: 2, drew: true, discarded: false };

    const bot = state.players.find((p: any) => p.id === 2);
    bot.hand = [
      { kind: 'family', familyId: 'felins', familyName: 'Famille des Félins', memberId: 'lynx', memberName: 'Lynx', role: 'Enfant' },
      { kind: 'family', familyId: 'poissons', familyName: 'Famille des Poissons', memberId: 'requin', memberName: 'Requin', role: 'Parent' },
      { kind: 'family', familyId: 'arbres', familyName: 'Famille des Arbres', memberId: 'chene', memberName: 'Chêne', role: 'Parent' },
      { kind: 'family', familyId: 'oiseaux', familyName: 'Famille des Oiseaux', memberId: 'aigle', memberName: 'Aigle', role: 'Parent' },
    ];
    bot.handCount = bot.hand.length;

    const actions = botService.getBotActions(state as any, 2);
    expect(actions[0]?.type).toBe('discard_card');
  });

  it('pending ask: pas de "accept" si la cible n’a pas la carte', () => {
    const state: any = service.hydrateInitialState({
      players: [
        { id: 1, username: 'A' },
        { id: 2, username: 'B' },
      ],
      status: 'started',
    } as any);
    state.turn = { currentPlayerId: 1, direction: 1 };
    state.turnIndex = 0;
    state.metadata.pendingAsk = {
      fromId: 1,
      targetId: 2,
      familyId: 'felins',
      memberId: 'chat',
      offerMemberId: 'lynx',
    };
    // B n'a pas "chat" en main
    const b = state.players.find((p: any) => p.id === 2);
    b.hand = [{ kind: 'family', familyId: 'felins', familyName: 'Famille des Félins', memberId: 'lynx', memberName: 'Lynx', role: 'Enfant' }];
    b.handCount = b.hand.length;

    const actions = service.getAvailableActions(state as any, 2);
    expect(actions.some((a: any) => a.type === 'answer_ask_card_accept')).toBe(false);
    expect(actions.some((a: any) => a.type === 'answer_ask_card_refuse')).toBe(true);
  });

  it('exposeStateForUser: expose askTargetHands pour la demande', () => {
    const state: any = service.hydrateInitialState({
      players: [
        { id: 1, username: 'A' },
        { id: 2, username: 'B' },
      ],
      status: 'started',
    } as any);
    state.turn = { currentPlayerId: 1, direction: 1 };
    state.turnIndex = 0;

    const exposed: any = service.exposeStateForUser(state as any, 1);
    expect(exposed.extras.askTargetHands).toBeTruthy();
    expect(Array.isArray(exposed.extras.askTargetHands['2'])).toBe(true);
  });
});
