import type { GameStateEntity } from '../../../../../application/models/game-state.model';
import { GameCoreService } from '../../../../../application/services/game-core.service';
import { RandomService } from '../../../../../application/services/random.service';
import { DeckPoliciesService } from '../../../../../application/features/deck-policies/services/deck-policies.service';
import { TurnPoliciesService } from '../../../../../application/services/turn-policies.service';
import type { TurnFlowService } from '../../../../../application/services/turn-flow.service';
import { CatPattesActionService } from './cat-pattes-action.service';
import { CatPattesSetupService } from './cat-pattes-setup.service';
import { CatPattesPresenterService } from './cat-pattes-presenter.service';
import * as Rulebook from '../../rulebook/rulebook';

function baseState(): GameStateEntity {
  return {
    status: 'started',
    phase: 'turn',
    round: 1,
    turnIndex: 0,
    lastRoll: null,
    log: [],
    players: [
      { id: 1, username: 'Hacene', isBot: false } as any,
      { id: 2, username: 'Lilas', isBot: false } as any,
    ],
    turn: { currentPlayerId: 1, direction: 1 },
    metadata: {
      gameType: 'cat-pattes',
      roomStartedAt: '2026-02-13T00:00:00.000Z',
      roomRunId: 1,
      rng: { seed: 123, counter: 0 },
    } as any,
    botThinking: false,
  } as any;
}

function createAdvanceTurn() {
  return (state: any) => {
    const players = Array.isArray(state.players) ? state.players : [];
    const currentId = state.turn?.currentPlayerId ?? null;
    const idx = players.findIndex((p: any) => p?.id === currentId);
    const nextIdx = idx >= 0 ? (idx + 1) % players.length : 0;
    return {
      ...state,
      turnIndex: nextIdx,
      turn: {
        ...(state.turn ?? { direction: 1 }),
        currentPlayerId: players[nextIdx]?.id ?? currentId,
        direction: 1,
      },
    };
  };
}

function createHarness(options?: { advanceTurn?: (state: any) => any }) {
  const core = new GameCoreService();
  const random = new RandomService();
  const deckPolicies = new DeckPoliciesService(random);
  const turns = {
    advanceTurn: options?.advanceTurn ?? createAdvanceTurn(),
  } as TurnFlowService;

  return {
    setup: new CatPattesSetupService(core, random),
    actions: new CatPattesActionService(
      core,
      turns,
      deckPolicies,
      random,
      new TurnPoliciesService(core),
    ),
  };
}

describe('CatPattes flow', () => {
  it('starts playing immediately after config (no pawn selection)', async () => {
    const { setup, actions: actionSvc } = createHarness({
      advanceTurn: (state: any) => state,
    });
    const seeded = baseState();
    seeded.players = [
      { id: 1, username: 'Lilas', isBot: false } as any,
      { id: 2, username: 'Botou', isBot: true } as any,
    ];
    seeded.turn = { currentPlayerId: 2, direction: 1 };

    let state = setup.hydrateInitialState(seeded);
    expect((state.pending as any)?.type).toBe('config_prompt');
    expect((state.pending as any)?.playerId).toBe(1);

    state = actionSvc.applyActions(state, [
      { type: 'cat_pattes_set_config', payload: { roundsToPlay: 3 } } as any,
    ]);

    expect(state.pending).toBeNull();
    expect(String((state.metadata as any)?.setupStep ?? '')).toBe('playing');
    expect(state.turn?.currentPlayerId).toBe(2);

    const actionsP2 = Rulebook.getAvailableActions(state as any, 2);
    expect(actionsP2).toEqual([{ type: 'draw', payload: {} }]);

    const messages = (state.log ?? []).map((e: any) =>
      String(e?.message ?? ''),
    );
    expect(
      messages.some((m) => /D.+but de partie: .* commence\./i.test(m)),
    ).toBe(true);
  });

  it('allows draw/play after config', async () => {
    const { setup, actions: actionsService } = createHarness();

    let state = setup.hydrateInitialState(baseState());
    expect((state.pending as any)?.type).toBe('config_prompt');

    const actionsP1 = Rulebook.getAvailableActions(state as any, 1);
    expect(
      actionsP1.every((a: any) => a.type === 'cat_pattes_set_config'),
    ).toBe(true);

    state = actionsService.applyActions(state, [
      { type: 'cat_pattes_set_config', payload: { roundsToPlay: 3 } } as any,
    ]);

    expect(state.pending).toBeNull();
    const messages = (state.log ?? []).map((e: any) =>
      String(e?.message ?? ''),
    );
    expect(
      messages.some((m) => /D.+but de partie: .* commence\./i.test(m)),
    ).toBe(true);
    expect(messages.some((m) => /C'est au tour de .+\./.test(m))).toBe(true);

    const afterSelectionActions = Rulebook.getAvailableActions(state as any, 1);
    expect(afterSelectionActions).toEqual([{ type: 'draw', payload: {} }]);
  });

  it('draws to seven then returns to six after playing one card', async () => {
    const { setup, actions: actionsService } = createHarness();

    let state = setup.hydrateInitialState(baseState());
    state = actionsService.applyActions(state, [
      { type: 'cat_pattes_set_config', payload: { roundsToPlay: 3 } } as any,
    ]);

    const meta0: any = state.metadata ?? {};
    const beforeCount = Array.isArray(meta0.hands?.[1])
      ? meta0.hands[1].length
      : 0;
    expect(beforeCount).toBe(6);

    state = actionsService.applyActions(state, [
      { type: 'draw', payload: {} } as any,
    ]);
    const meta1: any = state.metadata ?? {};
    const drawnCount = Array.isArray(meta1.hands?.[1])
      ? meta1.hands[1].length
      : 0;
    expect(drawnCount).toBe(7);

    const available = Rulebook.getAvailableActions(state as any, 1);
    const fallbackCardId = Array.isArray(meta1.hands?.[1])
      ? String(meta1.hands[1][0] ?? '')
      : '';
    const discardAction =
      available.find((a: any) => a.type === 'discard_card') ??
      (fallbackCardId
        ? ({ type: 'discard_card', payload: { cardId: fallbackCardId } } as any)
        : null);
    expect(discardAction).toBeDefined();

    state = actionsService.applyActions(state, [discardAction]);
    const meta2: any = state.metadata ?? {};
    const afterPlayCount = Array.isArray(meta2.hands?.[1])
      ? meta2.hands[1].length
      : 0;
    expect(afterPlayCount).toBe(6);
    expect(state.turn?.currentPlayerId).toBe(2);
  });

  it('does not block the game when a player draws with an empty deck and empty hand', async () => {
    const { setup, actions: actionsService } = createHarness();

    let state = setup.hydrateInitialState(baseState());
    state = actionsService.applyActions(state, [
      { type: 'cat_pattes_set_config', payload: { roundsToPlay: 3 } } as any,
    ]);

    const meta: any = { ...(state.metadata ?? {}) };
    meta.deck = [];
    meta.discard = [];
    meta.hands = { ...(meta.hands ?? {}), 1: [] };
    meta.drawnPlayerId = null;
    state = {
      ...state,
      metadata: meta,
      turn: {
        ...(state.turn ?? { direction: 1 }),
        currentPlayerId: 1,
        direction: 1,
      },
      turnIndex: 0,
    };

    const actionsBefore = Rulebook.getAvailableActions(state as any, 1);
    expect(actionsBefore).toEqual([{ type: 'draw', payload: {} }]);
    const actionsWhenDrawn = Rulebook.getAvailableActions(
      {
        ...state,
        metadata: { ...(state.metadata as any), drawnPlayerId: 1 },
      } as any,
      1,
    );
    expect(actionsWhenDrawn).toEqual([{ type: 'pass', payload: {} }]);

    state = actionsService.applyActions(state, [
      { type: 'draw', payload: {} } as any,
    ]);
    expect((state.metadata as any)?.drawnPlayerId ?? null).toBeNull();
    expect(state.turn?.currentPlayerId).toBe(2);

    const messages = (state.log ?? []).map((e: any) =>
      String(e?.message ?? ''),
    );
    expect(messages.some((m) => /ne peut plus piocher/i.test(m))).toBe(true);
    expect(messages.some((m) => /passe son tour/i.test(m))).toBe(true);
  });

  it('exposes config prompt to the owner at setup', async () => {
    const { setup } = createHarness();
    const presenter = new CatPattesPresenterService();

    const state = setup.hydrateInitialState(baseState());
    const exposed: any = presenter.exposeStateForUser(state, 1);

    expect(exposed.pending?.type).toBe('config_prompt');
    const fields = Array.isArray(exposed.pending?.data?.fields)
      ? exposed.pending.data.fields
      : [];
    const fieldKeys = fields.map((f: any) => String(f?.key ?? ''));
    expect(fieldKeys).toContain('roundsToPlay');

    const actions = Array.isArray(exposed.actions) ? exposed.actions : [];
    expect(actions.length).toBeGreaterThan(0);
    expect(
      actions.every(
        (a: any) => String(a?.type ?? '') === 'cat_pattes_set_config',
      ),
    ).toBe(true);
  });

  it('starts a new round when pattes goal is reached but points target is not yet met', async () => {
    const { setup, actions: actionsService } = createHarness({
      advanceTurn: (state: any) => state,
    });

    let state = setup.hydrateInitialState(baseState());
    state = actionsService.applyActions(state, [
      {
        type: 'cat_pattes_set_config',
        payload: { roundsToPlay: 2 },
      } as any,
    ]);

    const metaBefore: any = { ...(state.metadata ?? {}) };
    metaBefore.positions = { ...(metaBefore.positions ?? {}), 1: 980 };
    metaBefore.hasSun = { ...(metaBefore.hasSun ?? {}), 1: true };
    metaBefore.hands = { ...(metaBefore.hands ?? {}), 1: ['pattes-20-1'] };
    metaBefore.drawnPlayerId = 1;
    state = {
      ...state,
      metadata: metaBefore,
      turn: {
        ...(state.turn ?? { direction: 1 }),
        currentPlayerId: 1,
        direction: 1,
      },
      turnIndex: 0,
    };

    state = actionsService.applyActions(state, [
      { type: 'play_card', payload: { cardId: 'pattes-20-1' } } as any,
    ]);

    expect(String(state.status ?? '')).toBe('started');
    expect(Number(state.turn?.currentPlayerId ?? 0)).toBe(1);
    const metaAfter: any = state.metadata ?? {};
    expect(Number(metaAfter.positions?.[1] ?? -1)).toBe(0);
    expect(metaAfter.drawnPlayerId ?? null).toBeNull();
    expect(Number(metaAfter.points?.[1] ?? 0)).toBeGreaterThan(0);
    const messages = (state.log ?? []).map((e: any) =>
      String(e?.message ?? ''),
    );
    expect(messages.some((m) => /Nouvelle manche/i.test(m))).toBe(true);
  });

  it('redacts drawn card names for opponents', async () => {
    const presenter = new CatPattesPresenterService();
    const state: any = {
      ...baseState(),
      log: [
        { message: 'Hacene pioche un poney.' },
        { message: 'Lilas pioche Rayon de soleil.' },
        { message: 'Hacene passe son tour.' },
      ],
      metadata: {
        ...(baseState().metadata as any),
        hands: { 1: [], 2: [] },
        positions: { 1: 0, 2: 0 },
        points: { 1: 0, 2: 0 },
        obstacles: { 1: null, 2: null },
        bots: { 1: [], 2: [] },
        hasSun: { 1: false, 2: false },
      },
    };

    const forHacene: any = presenter.exposeStateForUser(state, 1);
    const forLilas: any = presenter.exposeStateForUser(state, 2);

    const logsHacene = (forHacene.log ?? []).map((e: any) =>
      String(e?.message ?? ''),
    );
    const logsLilas = (forLilas.log ?? []).map((e: any) =>
      String(e?.message ?? ''),
    );

    expect(logsHacene).toContain('Hacene pioche un poney.');
    expect(logsHacene).toContain('Lilas pioche une carte.');
    expect(logsHacene).not.toContain('Lilas pioche Rayon de soleil.');

    expect(logsLilas).toContain('Lilas pioche Rayon de soleil.');
    expect(logsLilas).toContain('Hacene pioche une carte.');
    expect(logsLilas).not.toContain('Hacene pioche un poney.');
  });

  it('redacts drawn card name end-to-end after a real draw action', async () => {
    const { setup, actions: actionsService } = createHarness({
      advanceTurn: (state: any) => state,
    });
    const presenter = new CatPattesPresenterService();

    let state: any = setup.hydrateInitialState(baseState());
    state = actionsService.applyActions(state, [
      { type: 'cat_pattes_set_config', payload: { roundsToPlay: 1 } } as any,
    ]);

    state = {
      ...state,
      metadata: {
        ...(state.metadata ?? {}),
        deck: ['pattes-20-1'],
        discard: [],
        hands: { 1: [], 2: [] },
        drawnPlayerId: null,
      },
      turn: { currentPlayerId: 1, direction: 1 },
      turnIndex: 0,
    };

    state = actionsService.applyActions(state, [
      { type: 'draw', payload: {} } as any,
    ]);

    const rawLog = (state.log ?? []).map((e: any) => String(e?.message ?? ''));
    expect(rawLog.some((m: string) => m.startsWith('Hacene pioche '))).toBe(
      true,
    );
    expect(rawLog.some((m: string) => m.includes('Petite foulée'))).toBe(
      true,
    );

    const exposedP2: any = presenter.exposeStateForUser(state, 2);
    const exposedLog = (exposedP2.log ?? []).map((e: any) =>
      String(e?.message ?? ''),
    );
    expect(
      exposedLog.some((m: string) => m === 'Hacene pioche une carte.'),
    ).toBe(true);
    expect(
      exposedLog.some((m: string) => m.includes('Petite foulée')),
    ).toBe(false);
  });

  it('does not expose opponents hands in presenter extras', async () => {
    const presenter = new CatPattesPresenterService();
    const state: any = {
      ...baseState(),
      metadata: {
        ...(baseState().metadata as any),
        hands: { 1: ['pattes-10-1'], 2: ['parade-rayon-1'] },
        positions: { 1: 0, 2: 0 },
        points: { 1: 0, 2: 0 },
        obstacles: { 1: null, 2: null },
        bots: { 1: [], 2: [] },
        hasSun: { 1: false, 2: false },
      },
    };

    const exposed: any = presenter.exposeStateForUser(state, 1);
    expect(exposed.extras?.hands).toBeUndefined();
    expect(Array.isArray(exposed.extras?.hand)).toBe(true);
  });

  it('requires matching parade (and sun-ready for rayon)', async () => {
    const state: any = {
      ...baseState(),
      metadata: {
        ...(baseState().metadata as any),
        hands: { 1: ['parade-croquettes-1', 'parade-rayon-1'], 2: [] },
        positions: { 1: 0, 2: 0 },
        points: { 1: 0, 2: 0 },
        obstacles: { 1: null, 2: null },
        bots: { 1: [], 2: [] },
        hasSun: { 1: false, 2: false },
        sunReady: { 1: false, 2: true },
        obstacleLock: { 1: false, 2: false },
        drawnPlayerId: 1,
      },
      turn: { currentPlayerId: 1, direction: 1 },
      turnIndex: 0,
    };

    const actions = Rulebook.getAvailableActions(state, 1);
    expect(actions.some((a: any) => a.type === 'play_card')).toBe(false);
    expect(actions.filter((a: any) => a.type === 'discard_card').length).toBe(
      2,
    );
  });

  it('limits actions to counters when an obstacle is active', async () => {
    const state: any = {
      ...baseState(),
      metadata: {
        ...(baseState().metadata as any),
        hands: { 1: ['parade-croquettes-1', 'pattes-10-1'], 2: [] },
        positions: { 1: 0, 2: 0 },
        points: { 1: 0, 2: 0 },
        obstacles: { 1: 'gamelle', 2: null },
        bots: { 1: [], 2: [] },
        hasSun: { 1: false, 2: false },
        sunReady: { 1: false, 2: true },
        obstacleLock: { 1: false, 2: false },
        drawnPlayerId: 1,
      },
      turn: { currentPlayerId: 1, direction: 1 },
      turnIndex: 0,
    };

    const actions = Rulebook.getAvailableActions(state, 1);
    expect(actions).toEqual([
      { type: 'play_card', payload: { cardId: 'parade-croquettes-1' } },
    ]);
  });

  it('lets a player replay after playing a power', async () => {
    const { actions: actionsService } = createHarness({
      advanceTurn: (state: any) => state,
    });
    const state: any = {
      ...baseState(),
      metadata: {
        ...(baseState().metadata as any),
        hands: { 1: ['bot-reserve'], 2: [] },
        positions: { 1: 0, 2: 0 },
        points: { 1: 0, 2: 0 },
        obstacles: { 1: null, 2: null },
        bots: { 1: [], 2: [] },
        hasSun: { 1: false, 2: false },
        sunReady: { 1: true, 2: true },
        obstacleLock: { 1: false, 2: false },
        drawnPlayerId: 1,
      },
      turn: { currentPlayerId: 1, direction: 1 },
      turnIndex: 0,
    };

    const next = actionsService.applyActions(state, [
      { type: 'play_card', payload: { cardId: 'bot-reserve' } } as any,
    ]);

    expect(next.turn?.currentPlayerId).toBe(1);
    expect((next.metadata as any)?.drawnPlayerId ?? null).toBeNull();
  });
});
