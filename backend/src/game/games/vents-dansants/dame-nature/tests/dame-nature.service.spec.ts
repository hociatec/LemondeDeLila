import { Test } from '@nestjs/testing';
import { DameNatureModule } from '../dame-nature.module';
import { DameNatureService } from '../dame-nature.service';
import { DameNatureBotService } from '../bots/dame-nature-bot.service';
import { DameNatureSetupService } from '../setup/dame-nature-setup.service';

describe('DameNatureService', () => {
  let service: DameNatureService;
  let botService: DameNatureBotService;
  let setup: DameNatureSetupService;

  const pickFamily = (opts?: { excludeId?: string; minMembers?: number }) => {
    const excludeId = opts?.excludeId;
    const minMembers = opts?.minMembers ?? 1;
    const families = setup.families();
    return (
      families.find(
        (f) => f.id !== excludeId && (f.members?.length ?? 0) >= minMembers,
      ) ??
      families.find((f) => (f.members?.length ?? 0) >= minMembers) ??
      families[0]
    );
  };

  const asFamilyCard = (fam: any, member: any) => ({
    kind: 'family',
    familyId: fam.id,
    familyName: fam.name,
    memberId: member.id,
    memberName: member.name,
    role: member.role ?? 'Membre',
  });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [DameNatureModule],
    }).compile();
    service = moduleRef.get(DameNatureService);
    botService = moduleRef.get(DameNatureBotService);
    setup = moduleRef.get(DameNatureSetupService);
  });

  it('discard: refill to 4 and advances turn if refill drew', () => {
    const fam = pickFamily();
    const state: any = service.hydrateInitialState({
      players: [
        { id: 1, username: 'A' },
        { id: 2, username: 'B' },
      ],
      status: 'started',
    } as any);
    state.turn = { currentPlayerId: 1, direction: 1 };
    state.turnIndex = 0;

    state.metadata.decks.family.deck = [
      {
        kind: 'family',
        familyId: fam.id,
        familyName: fam.name,
        memberId: 'x',
        memberName: 'X',
        role: 'Membre',
      },
      ...(state.metadata.decks.family.deck ?? []),
    ];

    const me: any = state.players.find((p: any) => p.id === 1);
    const card = me.hand[0];

    const afterDiscard: any = service.applyActions(state, [
      {
        type: 'discard_card',
        payload: {
          playerId: 1,
          memberId: card.memberId,
          familyId: card.familyId,
        },
      },
    ] as any);

    expect(afterDiscard.turn.currentPlayerId).toBe(2);
    const afterMe: any = afterDiscard.players.find((p: any) => p.id === 1);
    expect(afterMe.hand.length).toBe(4);
  });

  it('turn ends after draw + discard (any order)', () => {
    const fam = pickFamily();
    const state: any = service.hydrateInitialState({
      players: [
        { id: 1, username: 'A' },
        { id: 2, username: 'B' },
      ],
      status: 'started',
    } as any);
    state.turn = { currentPlayerId: 1, direction: 1 };
    state.turnIndex = 0;

    state.metadata.decks.family.deck = [
      {
        kind: 'family',
        familyId: fam.id,
        familyName: fam.name,
        memberId: 'x',
        memberName: 'X',
        role: 'Membre',
      },
    ];
    state.metadata.decks.family.discards = [];

    const afterDraw: any = service.applyActions(state, [
      { type: 'draw', payload: { playerId: 1 } },
    ] as any);
    expect(afterDraw.turn.currentPlayerId).toBe(1);
    expect(afterDraw.metadata.turnProgress).toMatchObject({
      playerId: 1,
      drew: true,
      discarded: false,
    });

    const me: any = afterDraw.players.find((p: any) => p.id === 1);
    const discard = me.hand[0];

    const afterDiscard: any = service.applyActions(afterDraw, [
      {
        type: 'discard_card',
        payload: {
          playerId: 1,
          memberId: discard.memberId,
          familyId: discard.familyId,
        },
      },
    ] as any);

    expect(afterDiscard.turn.currentPlayerId).toBe(2);
    expect(afterDiscard.metadata.turnProgress).toMatchObject({
      playerId: 2,
      drew: false,
      discarded: false,
    });
  });

  it('completes a family and refills hand to 4', () => {
    const fam = pickFamily({ minMembers: 4 });
    const otherFam = pickFamily({ excludeId: fam.id, minMembers: 1 });
    const [m1, m2, m3, m4] = fam.members;

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
      asFamilyCard(fam, m1),
      asFamilyCard(fam, m2),
      asFamilyCard(fam, m3),
      asFamilyCard(otherFam, otherFam.members[0]),
    ];
    me.handCount = me.hand.length;

    state.metadata.decks.family.deck = [
      asFamilyCard(fam, m4),
      asFamilyCard(otherFam, otherFam.members[0]),
      asFamilyCard(otherFam, otherFam.members[1] ?? otherFam.members[0]),
      asFamilyCard(otherFam, otherFam.members[2] ?? otherFam.members[0]),
    ];
    state.metadata.decks.family.discards = [];

    const afterDraw: any = service.applyActions(state, [
      { type: 'draw', payload: { playerId: 1 } },
    ] as any);
    const afterMe: any = afterDraw.players.find((p: any) => p.id === 1);

    expect(afterMe.books).toContain(fam.id);
    expect(afterMe.hand.length).toBe(4);
  });

  it('rejects ask without offered card', () => {
    const fam = pickFamily();
    const state: any = service.hydrateInitialState({
      players: [
        { id: 1, username: 'A' },
        { id: 2, username: 'B' },
      ],
      status: 'started',
    } as any);
    state.turn = { currentPlayerId: 1, direction: 1 };
    state.turnIndex = 0;

    const afterAsk: any = service.applyActions(state, [
      {
        type: 'ask_card',
        payload: {
          playerId: 1,
          target: 2,
          familyId: fam.id,
          memberId: fam.members?.[0]?.id ?? 'x',
        },
      },
    ] as any);

    expect(afterAsk.metadata.pendingAsk ?? null).toBeNull();
  });

  it('rejects ask if target does not have the requested card', () => {
    const fam = pickFamily({ minMembers: 2 });
    const want = fam.members[0].id;

    const state: any = service.hydrateInitialState({
      players: [
        { id: 1, username: 'A' },
        { id: 2, username: 'B' },
      ],
      status: 'started',
    } as any);
    state.turn = { currentPlayerId: 1, direction: 1 };
    state.turnIndex = 0;

    // B n'a pas la carte demandée
    const b: any = state.players.find((p: any) => p.id === 2);
    b.hand = [asFamilyCard(fam, fam.members[1])];
    b.handCount = b.hand.length;

    // A offre une carte (obligatoire)
    const a: any = state.players.find((p: any) => p.id === 1);
    a.hand = [asFamilyCard(fam, fam.members[1])];
    a.handCount = a.hand.length;

    const afterAsk: any = service.applyActions(state, [
      {
        type: 'ask_card',
        payload: {
          playerId: 1,
          target: 2,
          familyId: fam.id,
          memberId: want,
          offerMemberId: a.hand[0].memberId,
        },
      },
    ] as any);

    expect(afterAsk.metadata.pendingAsk ?? null).toBeNull();
    expect(afterAsk.turn.currentPlayerId).toBe(1);
  });

  it('allows only one ask_card per turn', () => {
    const fam = pickFamily({ minMembers: 2 });
    const want = fam.members[0];
    const offer = fam.members[1];

    const state: any = service.hydrateInitialState({
      players: [
        { id: 1, username: 'A' },
        { id: 2, username: 'B' },
      ],
      status: 'started',
    } as any);
    state.turn = { currentPlayerId: 1, direction: 1 };
    state.turnIndex = 0;

    const a: any = state.players.find((p: any) => p.id === 1);
    a.hand = [asFamilyCard(fam, offer)];
    a.handCount = a.hand.length;

    const b: any = state.players.find((p: any) => p.id === 2);
    b.hand = [asFamilyCard(fam, want)];
    b.handCount = b.hand.length;

    const afterAsk: any = service.applyActions(state, [
      {
        type: 'ask_card',
        payload: {
          playerId: 1,
          target: 2,
          familyId: fam.id,
          memberId: want.id,
          offerMemberId: offer.id,
        },
      },
    ] as any);
    expect(afterAsk.metadata.pendingAsk).toBeTruthy();
    expect(afterAsk.turn.currentPlayerId).toBe(2);

    const afterRefuse: any = service.applyActions(afterAsk, [
      {
        type: 'answer_ask_card_refuse',
        payload: { accept: false, playerId: 2 },
      },
    ] as any);
    expect(afterRefuse.metadata.pendingAsk ?? null).toBeNull();
    expect(afterRefuse.turn.currentPlayerId).toBe(1);

    const available: any[] = service.getAvailableActions(afterRefuse, 1) as any;
    expect(available.some((a: any) => a.type === 'ask_card')).toBe(false);

    const afterSecondAsk: any = service.applyActions(afterRefuse, [
      {
        type: 'ask_card',
        payload: {
          playerId: 1,
          target: 2,
          familyId: fam.id,
          memberId: want.id,
          offerMemberId: offer.id,
        },
      },
    ] as any);
    expect(afterSecondAsk.metadata.pendingAsk ?? null).toBeNull();
    expect(afterSecondAsk.turn.currentPlayerId).toBe(1);
  });

  it('bot: ask_card includes an offered card', () => {
    const fam1 = pickFamily();
    const fam2 = pickFamily({ excludeId: fam1.id });

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
      asFamilyCard(fam1, fam1.members[0]),
      asFamilyCard(fam2, fam2.members[0]),
    ];
    bot.handCount = bot.hand.length;

    const actions = botService.getBotActions(state, 2);
    const ask = actions.find((a: any) => a.type === 'ask_card');
    if (!ask) return;
    expect(ask.payload).toBeDefined();
    const payload: any = ask.payload ?? {};
    expect(payload.offerMemberId ?? payload.giveMemberId ?? null).toBeTruthy();
  });

  it('bot: ask_card only requests a card that target actually has', () => {
    const fam = pickFamily({ minMembers: 2 });
    const [m1, m2] = fam.members;

    const state: any = service.hydrateInitialState({
      players: [
        { id: 1, username: 'A' },
        { id: 2, username: 'Bot', isBot: true },
      ],
      status: 'started',
    } as any);
    state.turn = { currentPlayerId: 2, direction: 1 };
    state.turnIndex = 1;

    const target = state.players.find((p: any) => p.id === 1);
    target.hand = [asFamilyCard(fam, m2)];
    target.handCount = target.hand.length;

    const bot = state.players.find((p: any) => p.id === 2);
    bot.hand = [asFamilyCard(fam, m1)];
    bot.handCount = bot.hand.length;
    bot.books = [];

    const actions = botService.getBotActions(state, 2);
    const ask = actions.find((a: any) => a.type === 'ask_card');
    if (!ask) return;
    const requestedMemberId = ask.payload?.memberId ?? null;
    expect(target.hand.some((c: any) => c.memberId === requestedMemberId)).toBe(
      true,
    );
  });

  it('bot: discards when it already drew', () => {
    const fam1 = pickFamily();
    const fam2 = pickFamily({ excludeId: fam1.id });
    const fam3 = pickFamily({ excludeId: fam2.id });
    const fam4 = pickFamily({ excludeId: fam3.id });

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
      asFamilyCard(fam1, fam1.members[0]),
      asFamilyCard(fam2, fam2.members[0]),
      asFamilyCard(fam3, fam3.members[0]),
      asFamilyCard(fam4, fam4.members[0]),
    ];
    bot.handCount = bot.hand.length;

    const actions = botService.getBotActions(state, 2);
    expect(actions[0]?.type).toBe('discard_card');
  });

  it('pending ask: does not expose accept if target does not have requested card', () => {
    const fam = pickFamily({ minMembers: 2 });
    const want = fam.members[0].id;
    const have = fam.members[1].id;

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
      familyId: fam.id,
      memberId: want,
      offerMemberId: have,
    };

    const b = state.players.find((p: any) => p.id === 2);
    b.hand = [
      {
        kind: 'family',
        familyId: fam.id,
        familyName: fam.name,
        memberId: have,
        memberName: 'Have',
        role: 'Membre',
      },
    ];
    b.handCount = b.hand.length;

    const actions = service.getAvailableActions(state, 2);
    expect(actions.some((a: any) => a.type === 'answer_ask_card_accept')).toBe(
      false,
    );
    expect(actions.some((a: any) => a.type === 'answer_ask_card_refuse')).toBe(
      true,
    );
  });

  it('exposeStateForUser does not expose askTargetHands', () => {
    const state: any = service.hydrateInitialState({
      players: [
        { id: 1, username: 'A' },
        { id: 2, username: 'B' },
      ],
      status: 'started',
    } as any);
    state.turn = { currentPlayerId: 1, direction: 1 };
    state.turnIndex = 0;

    const exposed: any = service.exposeStateForUser(state, 1);
    expect(exposed.extras.askTargetHands).toBeUndefined();
  });

  it('does not expose hands before the game is started', () => {
    const fam = pickFamily({ minMembers: 2 });

    const state: any = service.hydrateInitialState({
      players: [
        { id: 1, username: 'A' },
        { id: 2, username: 'B' },
      ],
      status: 'open',
    } as any);
    state.turn = { currentPlayerId: 1, direction: 1 };
    state.turnIndex = 0;

    const a = state.players.find((p: any) => p.id === 1);
    a.hand = [asFamilyCard(fam, fam.members[0])];
    a.handCount = a.hand.length;
    a.books = [fam.id];

    const b = state.players.find((p: any) => p.id === 2);
    b.hand = [asFamilyCard(fam, fam.members[1])];
    b.handCount = b.hand.length;
    b.books = [fam.id];

    const exposedForA: any = service.exposeStateForUser(state, 1);
    expect(exposedForA.extras.hand).toEqual([]);
    expect(exposedForA.extras.handCards).toEqual([]);
    expect(exposedForA.extras.books).toEqual([]);
    expect(exposedForA.extras.askTargetHands).toBeUndefined();
    expect(
      exposedForA.extras.playerViews.find((v: any) => v.id === 1)?.hand,
    ).toEqual([]);
    expect(
      exposedForA.extras.playerViews.find((v: any) => v.id === 1)?.books,
    ).toEqual([]);
    expect(
      exposedForA.extras.playerViews.find((v: any) => v.id === 1)?.handCount,
    ).toBeGreaterThan(0);

    const exposedGeneric: any = service.exposeState(state);
    expect(exposedGeneric.extras.hand).toEqual([]);
    expect(exposedGeneric.extras.handCards).toEqual([]);
    expect(exposedGeneric.extras.books).toEqual([]);
    expect(exposedGeneric.extras.askTargetHands).toBeUndefined();
  });

  it('pollution is tracked per player (not shared)', () => {
    const state: any = service.hydrateInitialState({
      players: [
        { id: 1, username: 'A' },
        { id: 2, username: 'B' },
      ],
      status: 'started',
    } as any);
    state.turn = { currentPlayerId: 1, direction: 1 };
    state.turnIndex = 0;
    state.metadata.maxPollution = 12;
    state.metadata.pollutionByPlayer = {};

    state.metadata.decks.family.deck = [
      {
        kind: 'danger',
        familyId: 'danger',
        familyName: 'Nature en danger',
        memberId: 'danger-x',
        memberName: 'Test',
        role: 'Événement',
        pollutionDelta: 2,
      },
    ];

    const after: any = service.applyActions(state, [
      { type: 'draw', payload: { playerId: 1 } },
    ] as any);
    expect(after.metadata.pollutionByPlayer['1']).toBe(2);
    expect(after.metadata.pollutionByPlayer['2'] ?? 0).toBe(0);

    const exposedA: any = service.exposeStateForUser(after, 1);
    const exposedB: any = service.exposeStateForUser(after, 2);
    expect(exposedA.metadata.pollution).toBe(2);
    expect(exposedB.metadata.pollution).toBe(0);
  });
});
