import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { GameCoreService } from '../../../../core/services/game-core.service';
import { SetupFlowService } from '../../../../modules/setup-flow/services/setup-flow.service';
import { BoardEffectsPoliciesService } from '../../../../modules/board-effects-policies/services/board-effects-policies.service';
import { DeckPoliciesService } from '../../../../modules/deck-policies/services/deck-policies.service';
import { TurnPoliciesService } from '../../../../modules/turn-policies/services/turn-policies.service';
import { TurnFlowService } from '../../../../modules/turn/services/turn-flow.service';
import { TurnService } from '../../../../modules/turn/services/turn.service';
import { FrousseActionService } from '../actions/frousse-action.service';
import * as Rulebook from '../rulebook/rulebook';

function buildRealTurnService(randomOverrides: Partial<any> = {}) {
  const core = new GameCoreService();
  const random: any = {
    rollDice: jest.fn(() => ({ roll: 1, meta: {} })),
    nextInt: jest.fn(() => ({ value: 0, meta: {} })),
    pickOne: jest.fn(() => ({ value: null, meta: {} })),
    shuffle: jest.fn((_meta: any, values: any[]) => ({ values, meta: {} })),
    ...randomOverrides,
  };
  const turns = new TurnFlowService(
    new TurnService(),
    new TurnPoliciesService(core),
  );
  return {
    random,
    service: new FrousseActionService(
      random,
      turns,
      core,
      new SetupFlowService(),
      new BoardEffectsPoliciesService(),
      new DeckPoliciesService(random),
    ),
  };
}

function buildFrousseMeta(overrides: Record<string, unknown> = {}): any {
  return {
    positions: { 1: 0, 2: 0 },
    statuses: {
      skipTurn: {},
      blocked: {},
      nextMoveCap: {},
      nextRollIfThreeBackTwo: {},
      nextRollKeepLowest: {},
      nextRollMalus: {},
      nextRollDouble: {},
      ignoreTrapUntilNextDraw: {},
      ignoreNextGhost: {},
      ignoreNextPrank: {},
      ignoreNextTrap: {},
    },
    tiles: [
      {
        n: 1,
        type: 'normal',
        title: 'Entree du manoir',
        label: 'case 1. Entree du manoir (case neutre)',
        description: '',
      },
      {
        n: 2,
        type: 'normal',
        title: 'Vestibule',
        label: 'case 2. Vestibule (case neutre)',
        description: '',
      },
      {
        n: 3,
        type: 'normal',
        title: 'Couloir silencieux',
        label: 'case 3. Couloir silencieux (case neutre)',
        description: '',
      },
    ],
    pawns: [
      { id: 'balai-farceur', name: 'Balai farceur' },
      { id: 'citrouille-rigolote', name: 'Citrouille rigolote' },
    ],
    decks: { cards: [], discard: [] },
    ...overrides,
  };
}

function buildTurnState(overrides: Partial<GameStateEntity> = {}): GameStateEntity {
  return {
    status: 'started',
    turnIndex: 0,
    turn: { currentPlayerId: 1, direction: 1 },
    players: [
      {
        id: 1,
        username: 'Lilas',
        pawn: 'balai-farceur',
        pawnLabel: 'Un balai farceur',
      } as any,
      {
        id: 2,
        username: 'Hacene',
        pawn: 'citrouille-rigolote',
        pawnLabel: 'Une citrouille rigolote',
      } as any,
    ],
    pending: null,
    metadata: buildFrousseMeta(),
    log: [],
    extras: {},
    ...overrides,
  } as GameStateEntity;
}

describe('FrousseActionService movement effects', () => {
  it('applies combined move effects (advance then back) as a net delta', () => {
    const random: any = {
      rollDice: jest.fn(() => ({ roll: 1, meta: {} })),
      nextInt: jest.fn(() => ({ value: 0, meta: {} })),
      pickOne: jest.fn(() => ({ value: null, meta: {} })),
      shuffle: jest.fn((_meta: any, values: any[]) => ({ values, meta: {} })),
    };
    const turns: any = {
      advanceTurn: jest.fn((state: GameStateEntity) => state),
    };
    const core: any = {
      appendLog: jest.fn((state: GameStateEntity, message: string) => ({
        ...state,
        log: [...(Array.isArray(state.log) ? state.log : []), { message }],
      })),
    };

    const service = new FrousseActionService(
      random,
      turns,
      core,
      new SetupFlowService(),
      new BoardEffectsPoliciesService(),
      new DeckPoliciesService(random),
    );

    const state: GameStateEntity = {
      status: 'started',
      turnIndex: 0,
      turn: { currentPlayerId: 1, direction: 1 },
      players: [{ id: 1, username: 'hacene' } as any],
      pending: { type: 'draw', playerId: 1, blocking: true } as any,
      metadata: {
        positions: { 1: 11 }, // case 12 (index-based)
        statuses: {
          skipTurn: {},
          blocked: {},
          nextMoveCap: {},
          nextRollIfThreeBackTwo: {},
          nextRollKeepLowest: {},
          nextRollMalus: {},
          nextRollDouble: {},
          ignoreTrapUntilNextDraw: {},
          ignoreNextGhost: {},
          ignoreNextPrank: {},
          ignoreNextTrap: {},
        },
        tiles: [],
        decks: {
          cards: [
            {
              category: 'Fantôme',
              localNumber: 999,
              text: 'Le fantôme surgit en hurlant.\nAvancez de 5 cases puis reculez de 3.',
            },
          ],
          discard: [],
        },
      } as any,
      log: [],
      extras: {},
    } as any;

    const next = service.applyActions(state, [
      { type: 'draw', payload: {} } as any,
    ]);
    const meta: any = next.metadata ?? {};

    // 12 -> +5 -> 17 -> -3 -> 14 (index 13)
    expect(meta.positions?.[1]).toBe(13);
  });

  it('logs conditional "roll 3 => back 2" effect as a simple instruction', () => {
    const random: any = {
      rollDice: jest.fn(() => ({ roll: 3, meta: {} })),
      nextInt: jest.fn(() => ({ value: 0, meta: {} })),
      pickOne: jest.fn(() => ({ value: null, meta: {} })),
      shuffle: jest.fn((_meta: any, values: any[]) => ({ values, meta: {} })),
    };
    const turns: any = {
      advanceTurn: jest.fn((state: GameStateEntity) => state),
    };
    const core: any = {
      appendLog: jest.fn((state: GameStateEntity, message: string) => ({
        ...state,
        log: [...(Array.isArray(state.log) ? state.log : []), { message }],
      })),
    };

    const service = new FrousseActionService(
      random,
      turns,
      core,
      new SetupFlowService(),
      new BoardEffectsPoliciesService(),
      new DeckPoliciesService(random),
    );

    const state: GameStateEntity = {
      status: 'started',
      turnIndex: 0,
      turn: { currentPlayerId: 1, direction: 1 },
      players: [{ id: 1, username: 'lilas' } as any],
      pending: null,
      metadata: {
        positions: { 1: 10 },
        statuses: {
          skipTurn: {},
          blocked: {},
          nextMoveCap: {},
          nextRollIfThreeBackTwo: { 1: true },
          nextRollKeepLowest: {},
          nextRollMalus: {},
          nextRollDouble: {},
          ignoreTrapUntilNextDraw: {},
          ignoreNextGhost: {},
          ignoreNextPrank: {},
          ignoreNextTrap: {},
        },
        tiles: [],
        pawns: [],
        decks: { cards: [], discard: [] },
      } as any,
      log: [],
      extras: {},
    } as any;

    const next = service.applyActions(state, [
      { type: 'roll', payload: {} } as any,
    ]);
    const messages = (next.log ?? []).map((l: any) => l.message);

    expect(messages).toContain('Reculez de 2 cases.');
    expect(messages).not.toContain('3 au dé, recul de 2 cases.');
  });

  it('formats doubled roll log with "=" (not "->")', () => {
    const random: any = {
      rollDice: jest.fn(() => ({ roll: 1, meta: {} })),
      nextInt: jest.fn(() => ({ value: 0, meta: {} })),
      pickOne: jest.fn(() => ({ value: null, meta: {} })),
      shuffle: jest.fn((_meta: any, values: any[]) => ({ values, meta: {} })),
    };
    const turns: any = {
      advanceTurn: jest.fn((state: GameStateEntity) => state),
    };
    const core: any = {
      appendLog: jest.fn((state: GameStateEntity, message: string) => ({
        ...state,
        log: [...(Array.isArray(state.log) ? state.log : []), { message }],
      })),
    };

    const service = new FrousseActionService(
      random,
      turns,
      core,
      new SetupFlowService(),
      new BoardEffectsPoliciesService(),
      new DeckPoliciesService(random),
    );

    const state: GameStateEntity = {
      status: 'started',
      turnIndex: 0,
      turn: { currentPlayerId: 1, direction: 1 },
      players: [{ id: 1, username: 'pumbaa' } as any],
      pending: null,
      metadata: {
        positions: { 1: 0 },
        statuses: {
          skipTurn: {},
          blocked: {},
          nextMoveCap: {},
          nextRollIfThreeBackTwo: {},
          nextRollKeepLowest: {},
          nextRollMalus: {},
          nextRollDouble: { 1: true },
          ignoreTrapUntilNextDraw: {},
          ignoreNextGhost: {},
          ignoreNextPrank: {},
          ignoreNextTrap: {},
        },
        tiles: [],
        pawns: [],
        decks: { cards: [], discard: [] },
      } as any,
      log: [],
      extras: {},
    } as any;

    const next = service.applyActions(state, [
      { type: 'roll', payload: {} } as any,
    ]);
    const messages = (next.log ?? []).map((l: any) => String(l.message ?? ''));
    const rollMessage = messages.find((m) => m.includes('lance le')) ?? '';

    expect(rollMessage).toMatch(/\(doubl.+ = 2\)/i);
    expect(rollMessage).not.toMatch(/doubl.+ ->/i);
  });

  it('formats malus roll log with explicit calculation', () => {
    const random: any = {
      rollDice: jest.fn(() => ({ roll: 6, meta: {} })),
      nextInt: jest.fn(() => ({ value: 0, meta: {} })),
      pickOne: jest.fn(() => ({ value: null, meta: {} })),
      shuffle: jest.fn((_meta: any, values: any[]) => ({ values, meta: {} })),
    };
    const turns: any = {
      advanceTurn: jest.fn((state: GameStateEntity) => state),
    };
    const core: any = {
      appendLog: jest.fn((state: GameStateEntity, message: string) => ({
        ...state,
        log: [...(Array.isArray(state.log) ? state.log : []), { message }],
      })),
    };

    const service = new FrousseActionService(
      random,
      turns,
      core,
      new SetupFlowService(),
      new BoardEffectsPoliciesService(),
      new DeckPoliciesService(random),
    );

    const state: GameStateEntity = {
      status: 'started',
      turnIndex: 0,
      turn: { currentPlayerId: 1, direction: 1 },
      players: [{ id: 1, username: 'pumbaa' } as any],
      pending: null,
      metadata: {
        positions: { 1: 0 },
        statuses: {
          skipTurn: {},
          blocked: {},
          nextMoveCap: {},
          nextRollIfThreeBackTwo: {},
          nextRollKeepLowest: {},
          nextRollMalus: { 1: -2 },
          nextRollDouble: {},
          ignoreTrapUntilNextDraw: {},
          ignoreNextGhost: {},
          ignoreNextPrank: {},
          ignoreNextTrap: {},
        },
        tiles: [],
        pawns: [],
        decks: { cards: [], discard: [] },
      } as any,
      log: [],
      extras: {},
    } as any;

    const next = service.applyActions(state, [
      { type: 'roll', payload: {} } as any,
    ]);
    const messages = (next.log ?? []).map((l: any) => String(l.message ?? ''));
    const rollMessage = messages.find((m) => m.includes('lance le')) ?? '';

    expect(rollMessage).toContain('"6 moins 2 = 4"');
  });

  it('announces explicitly when a player must choose a pawn', () => {
    const random: any = {
      rollDice: jest.fn(() => ({ roll: 1, meta: {} })),
      nextInt: jest.fn(() => ({ value: 0, meta: {} })),
      pickOne: jest.fn(() => ({ value: null, meta: {} })),
      shuffle: jest.fn((_meta: any, values: any[]) => ({ values, meta: {} })),
    };
    const turns: any = {
      advanceTurn: jest.fn((state: GameStateEntity) => state),
    };
    const core: any = {
      appendLog: jest.fn((state: GameStateEntity, message: string) => ({
        ...state,
        log: [...(Array.isArray(state.log) ? state.log : []), { message }],
      })),
    };

    const service = new FrousseActionService(
      random,
      turns,
      core,
      new SetupFlowService(),
      new BoardEffectsPoliciesService(),
      new DeckPoliciesService(random),
    );

    const state: GameStateEntity = {
      status: 'started',
      turnIndex: 0,
      turn: { currentPlayerId: 1, direction: 1 },
      players: [
        { id: 1, username: 'Lilas' } as any,
        { id: 2, username: 'Bucky' } as any,
      ],
      pending: null,
      metadata: {
        pawns: [
          { id: 'citrouille-rigolote', title: 'Une citrouille rigolote' },
          { id: 'balai-farceur', title: 'Un balai farceur' },
        ],
      } as any,
      log: [],
      extras: {},
    } as any;

    const next = service.applyActions(state, [
      { type: 'roll', payload: {} } as any,
    ]);
    expect(next.pending?.type).toBe('choose_pawn');
    expect(String(next.pending?.label ?? '')).toContain(
      "C'est à Lilas de choisir",
    );
  });

  it('uses possessive pawn wording in placement logs', () => {
    const random: any = {
      rollDice: jest.fn(() => ({ roll: 2, meta: {} })),
      nextInt: jest.fn(() => ({ value: 0, meta: {} })),
      pickOne: jest.fn(() => ({ value: null, meta: {} })),
      shuffle: jest.fn((_meta: any, values: any[]) => ({ values, meta: {} })),
    };
    const turns: any = {
      advanceTurn: jest.fn((state: GameStateEntity) => state),
    };
    const core: any = {
      appendLog: jest.fn((state: GameStateEntity, message: string) => ({
        ...state,
        log: [...(Array.isArray(state.log) ? state.log : []), { message }],
      })),
    };

    const service = new FrousseActionService(
      random,
      turns,
      core,
      new SetupFlowService(),
      new BoardEffectsPoliciesService(),
      new DeckPoliciesService(random),
    );

    const state: GameStateEntity = {
      status: 'started',
      turnIndex: 0,
      turn: { currentPlayerId: 2, direction: 1 },
      players: [
        {
          id: 1,
          username: 'Lilas',
          pawn: 'citrouille-rigolote',
          pawnLabel: 'Une citrouille rigolote',
        } as any,
        {
          id: 2,
          username: 'Bucky',
          pawn: 'balai-farceur',
          pawnLabel: 'Un balai farceur',
        } as any,
      ],
      pending: null,
      metadata: {
        positions: { 1: 0, 2: 0 },
        statuses: {
          skipTurn: {},
          blocked: {},
          nextMoveCap: {},
          nextRollIfThreeBackTwo: {},
          nextRollKeepLowest: {},
          nextRollMalus: {},
          nextRollDouble: {},
          ignoreTrapUntilNextDraw: {},
          ignoreNextGhost: {},
          ignoreNextPrank: {},
          ignoreNextTrap: {},
        },
        tiles: [
          {
            n: 1,
            type: 'normal',
            title: 'Départ',
            label: 'case 1. Départ (case neutre)',
            description: '',
          },
          {
            n: 2,
            type: 'normal',
            title: 'Hall',
            label: 'case 2. Hall (case neutre)',
            description: '',
          },
          {
            n: 3,
            type: 'normal',
            title: 'Couloir des portraits',
            label: 'case 3. Couloir des portraits (case neutre)',
            description: '',
          },
        ],
        decks: { cards: [], discard: [] },
      } as any,
      log: [],
      extras: {},
    } as any;

    const next = service.applyActions(state, [
      { type: 'roll', payload: {} } as any,
    ]);
    const messages = (next.log ?? []).map((l: any) => String(l.message ?? ''));
    const placement = messages.find((m) => m.includes('Bucky place')) ?? '';

    expect(placement).toContain('"son balai farceur"');
    expect(placement).not.toContain('"Un balai farceur"');
  });

  it('avoids duplicate replay logs when draw effect already states replay rule', () => {
    const random: any = {
      rollDice: jest.fn(() => ({ roll: 1, meta: {} })),
      nextInt: jest.fn(() => ({ value: 0, meta: {} })),
      pickOne: jest.fn(() => ({ value: null, meta: {} })),
      shuffle: jest.fn((_meta: any, values: any[]) => ({ values, meta: {} })),
    };
    const turns: any = {
      advanceTurn: jest.fn((state: GameStateEntity) => state),
    };
    const core: any = {
      appendLog: jest.fn((state: GameStateEntity, message: string) => ({
        ...state,
        log: [...(Array.isArray(state.log) ? state.log : []), { message }],
      })),
    };

    const service = new FrousseActionService(
      random,
      turns,
      core,
      new SetupFlowService(),
      new BoardEffectsPoliciesService(),
      new DeckPoliciesService(random),
    );

    const state: GameStateEntity = {
      status: 'started',
      turnIndex: 0,
      turn: { currentPlayerId: 1, direction: 1 },
      players: [{ id: 1, username: 'Lilas' } as any],
      pending: { type: 'draw', playerId: 1, blocking: true } as any,
      metadata: {
        positions: { 1: 0 },
        statuses: {
          skipTurn: {},
          blocked: {},
          nextMoveCap: {},
          nextRollIfThreeBackTwo: {},
          nextRollKeepLowest: {},
          nextRollMalus: {},
          nextRollDouble: {},
          ignoreTrapUntilNextDraw: {},
          ignoreNextGhost: {},
          ignoreNextPrank: {},
          ignoreNextTrap: {},
        },
        tiles: [],
        decks: {
          cards: [
            {
              category: 'Piège',
              localNumber: 1,
              text: 'Une bougie clignote et vous joue un tour. Lancez le dé deux fois et gardez le plus petit résultat.',
            },
          ],
          discard: [],
        },
      } as any,
      log: [],
      extras: {},
    } as any;

    const next = service.applyActions(state, [
      { type: 'draw', payload: {} } as any,
    ]);
    const messages = (next.log ?? []).map((l: any) => String(l.message ?? ''));

    expect(
      messages.some((m) => /^Lilas rejoue/i.test(m) || /rejoue\s*\(/i.test(m)),
    ).toBe(false);
    expect(messages.some((m) => /gardez le plus petit résultat/i.test(m))).toBe(
      true,
    );
  });

  it('does not auto-roll the odd-result trap test after drawing the card', () => {
    const random: any = {
      rollDice: jest.fn(() => ({ roll: 6, meta: {} })),
      nextInt: jest.fn(() => ({ value: 0, meta: {} })),
      pickOne: jest.fn(() => ({ value: null, meta: {} })),
      shuffle: jest.fn((_meta: any, values: any[]) => ({ values, meta: {} })),
    };
    const turns: any = {
      advanceTurn: jest.fn((state: GameStateEntity) => state),
    };
    const core: any = {
      appendLog: jest.fn((state: GameStateEntity, message: string) => ({
        ...state,
        log: [...(Array.isArray(state.log) ? state.log : []), { message }],
      })),
    };

    const service = new FrousseActionService(
      random,
      turns,
      core,
      new SetupFlowService(),
      new BoardEffectsPoliciesService(),
      new DeckPoliciesService(random),
    );

    const state: GameStateEntity = {
      status: 'started',
      turnIndex: 0,
      turn: { currentPlayerId: 1, direction: 1 },
      players: [{ id: 1, username: 'hacene' } as any],
      pending: { type: 'draw', playerId: 1, blocking: true } as any,
      metadata: {
        positions: { 1: 2 },
        statuses: {
          skipTurn: {},
          blocked: {},
          nextMoveCap: {},
          nextRollIfThreeBackTwo: {},
          nextRollKeepLowest: {},
          nextRollMalus: {},
          nextRollDouble: {},
          ignoreTrapUntilNextDraw: {},
          ignoreNextGhost: {},
          ignoreNextPrank: {},
          ignoreNextTrap: {},
        },
        tiles: [],
        decks: {
          cards: [
            {
              category: 'Fantôme',
              localNumber: 999,
              text: 'Une ombre étrange vous barre la route. Lancez le dé : si le résultat est impair, passez 1 tour.',
            },
          ],
          discard: [],
        },
      } as any,
      log: [],
      extras: {},
    } as any;

    const next = service.applyActions(state, [
      { type: 'draw', payload: {} } as any,
    ]);
    const meta: any = next.metadata ?? {};
    const messages = (next.log ?? []).map((l: any) => String(l.message ?? ''));

    expect(random.rollDice).not.toHaveBeenCalled();
    expect(meta.statuses?.blocked?.[1]).toEqual({ kind: 'need_roll_even' });
    expect(next.turn?.currentPlayerId).toBe(1);
    expect(messages.some((m) => m.includes('Test : dé ='))).toBe(false);
  });

  it('lets the player refuse a swap card and advances the turn', () => {
    const { service } = buildRealTurnService();
    const state = buildTurnState({
      pending: { type: 'draw', playerId: 1, blocking: true } as any,
      metadata: buildFrousseMeta({
        decks: {
          cards: [
            {
              category: 'Farce',
              localNumber: 3,
              text: 'Un autre joueur vous joue une farce. Echangez immédiatement vos places.',
            },
          ],
          discard: [],
        },
      }),
    });

    const afterDraw = service.applyActions(state, [
      { type: 'draw', payload: {} } as any,
    ]);
    expect(afterDraw.pending?.type).toBe('choose_target');
    expect(afterDraw.pending?.choices).toEqual([
      'Hacene',
      "Refuser l'échange.",
    ]);
    expect(Rulebook.getAvailableActions(afterDraw, 1)).toContainEqual({
      type: 'swap_decline',
      payload: {},
    });

    const afterDecline = service.applyActions(afterDraw, [
      { type: 'swap_decline', payload: {} } as any,
    ]);
    const messages = (afterDecline.log ?? []).map((entry: any) =>
      String(entry?.message ?? ''),
    );

    expect(afterDecline.pending).toBeNull();
    expect(afterDecline.turn?.currentPlayerId).toBe(2);
    expect(messages).toContain("Lilas refuse l'échange de position.");
    expect(messages).toContain("C'est au tour de Hacene.");
  });

  it('does not replay on a neutral tile after an immediate replay card', () => {
    const rollDice = jest
      .fn()
      .mockReturnValueOnce({ roll: 4, meta: {} })
      .mockReturnValueOnce({ roll: 2, meta: {} });
    const { service } = buildRealTurnService({ rollDice });
    const state = buildTurnState({
      pending: { type: 'draw', playerId: 1, blocking: true } as any,
      metadata: buildFrousseMeta({
        decks: {
          cards: [
            {
              category: 'Farce',
              localNumber: 11,
              text: 'Une bougie clignote et vous joue un tour. Lancez le dé deux fois et gardez le plus petit résultat.',
            },
          ],
          discard: [],
        },
      }),
    });

    const afterDraw = service.applyActions(state, [
      { type: 'draw', payload: {} } as any,
    ]);
    expect(afterDraw.turn?.currentPlayerId).toBe(1);
    expect(afterDraw.pending).toBeNull();

    const afterRoll = service.applyActions(afterDraw, [
      { type: 'roll', payload: {} } as any,
    ]);
    const messages = (afterRoll.log ?? []).map((entry: any) =>
      String(entry?.message ?? ''),
    );

    expect(afterRoll.turn?.currentPlayerId).toBe(2);
    expect(messages).toContain("C'est au tour de Hacene.");
    expect(
      messages.some((message) => /^Lilas rejoue\./i.test(message)),
    ).toBe(false);
  });

  it('advances to the next player immediately after a skip-turn card', () => {
    const { service } = buildRealTurnService();
    const state = buildTurnState({
      pending: { type: 'draw', playerId: 1, blocking: true } as any,
      metadata: buildFrousseMeta({
        decks: {
          cards: [
            {
              category: 'Piège',
              localNumber: 2,
              text: 'Vous glissez sur une flaque gluante et malodorante. Impossible de vous relever tout de suite. Passez 1 tour.',
            },
          ],
          discard: [],
        },
      }),
    });

    const afterDraw = service.applyActions(state, [
      { type: 'draw', payload: {} } as any,
    ]);
    const messages = (afterDraw.log ?? []).map((entry: any) =>
      String(entry?.message ?? ''),
    );

    expect(afterDraw.turn?.currentPlayerId).toBe(2);
    expect((afterDraw.metadata as any)?.statuses?.skipTurn?.[1]).toBe(1);
    expect(messages.at(-1)).toBe("C'est au tour de Hacene.");
  });
});
