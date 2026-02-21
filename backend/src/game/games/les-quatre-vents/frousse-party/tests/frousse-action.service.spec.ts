/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return */
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { SetupFlowService } from '../../../../modules/setup-flow/services/setup-flow.service';
import { BoardEffectsPoliciesService } from '../../../../modules/board-effects-policies/services/board-effects-policies.service';
import { DeckPoliciesService } from '../../../../modules/deck-policies/services/deck-policies.service';
import { FrousseActionService } from '../actions/frousse-action.service';

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
              category: 'Fant�me',
              localNumber: 999,
              text: 'Le fant�me surgit en hurlant.\nAvancez de 5 cases puis reculez de 3.',
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
    expect(messages).not.toContain('3 au d�, recul de 2 cases.');
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
      "C'est � Lilas de choisir",
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
            title: 'D�part',
            label: 'case 1. D�part (case neutre)',
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
              category: 'Pi�ge',
              localNumber: 1,
              text: 'Une bougie clignote et vous joue un tour. Lancez le d� deux fois et gardez le plus petit r�sultat.',
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
    expect(messages.some((m) => /gardez le plus petit r�sultat/i.test(m))).toBe(
      true,
    );
  });
});
