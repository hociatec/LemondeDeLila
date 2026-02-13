import { Test } from '@nestjs/testing';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { GameCoreService } from '../../../../core/services/game-core.service';
import { RandomService } from '../../../../modules/random/services/random.service';
import { GameContentLoaderService } from '../../../../engine/services/game-content-loader.service';
import { AventureSauvageActionService } from '../actions/aventure-sauvage-action.service';
import { AventureSauvageSetupService } from '../setup/aventure-sauvage-setup.service';

function makeBaseState(): GameStateEntity {
  return {
    status: 'started',
    phase: 'playing',
    round: 1,
    turnIndex: 0,
    lastRoll: null,
    log: [],
    players: [
      { id: 1, username: 'Lilas', isBot: false } as any,
      { id: 2, username: 'Nino', isBot: false } as any,
    ],
    turn: { currentPlayerId: 1, direction: 1 },
    metadata: {
      roomId: 1,
      roomOwnerId: 1,
      roomStartedAt: '2026-01-31T00:00:00.000Z',
      roomRunId: 1,
      gameType: 'aventure-sauvage',
      rng: { seed: 123, counter: 0 },
    } as any,
    botThinking: false,
  } as any;
}

describe('AventureSauvageActionService', () => {
  it('annonce qu un joueur doit choisir un pion', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        GameCoreService,
        RandomService,
        GameContentLoaderService,
        AventureSauvageSetupService,
        AventureSauvageActionService,
      ],
    }).compile();

    const setup = moduleRef.get(AventureSauvageSetupService);
    const actions = moduleRef.get(AventureSauvageActionService);

    const state = setup.hydrateInitialState(makeBaseState());
    const next = actions.applyActions(state, []);

    const messages = (next.log ?? []).map((e: any) => String(e?.message ?? ''));
    expect(messages.some((m) => /doit choisir un pion\./.test(m))).toBe(true);
  });

  it('avance le tour apres une pioche avec Passez un tour', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        GameCoreService,
        RandomService,
        GameContentLoaderService,
        AventureSauvageSetupService,
        AventureSauvageActionService,
      ],
    }).compile();

    const setup = moduleRef.get(AventureSauvageSetupService);
    const actions = moduleRef.get(AventureSauvageActionService);

    let state = setup.hydrateInitialState(makeBaseState());

    const meta: any = state.metadata ?? {};
    meta.decks = {
      ...(meta.decks ?? {}),
      patte: [
        {
          id: 999,
          deck: 'patte',
          text: 'Test: vous vous reposez. Passez votre tour.',
          skipTurns: 1,
        },
      ],
      discardPatte: [],
    };
    state = {
      ...state,
      metadata: meta,
      pending: { type: 'draw', playerId: 1, blocking: true, data: { deck: 'patte' } },
    };

    const next = actions.applyActions(state, [{ type: 'draw', payload: {} } as any]);

    expect(next.pending).toBeNull();
    expect(next.turn?.currentPlayerId).toBe(2);
    expect((next.metadata as any)?.statuses?.skipTurn?.[1]).toBe(1);
  });

  it('saute le joueur suivant si skipTurn est actif (et l annonce)', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        GameCoreService,
        RandomService,
        GameContentLoaderService,
        AventureSauvageSetupService,
        AventureSauvageActionService,
      ],
    }).compile();

    const setup = moduleRef.get(AventureSauvageSetupService);
    const actions = moduleRef.get(AventureSauvageActionService);

    let state = setup.hydrateInitialState(makeBaseState());

    const meta: any = state.metadata ?? {};
    meta.statuses = { ...(meta.statuses ?? {}), skipTurn: { ...(meta.statuses?.skipTurn ?? {}), 2: 1 } };
    meta.decks = {
      ...(meta.decks ?? {}),
      animal: [{ id: 1, deck: 'animal', text: 'Test: aucune action.' }],
      discardAnimal: [],
    };

    state = {
      ...state,
      metadata: meta,
      pending: { type: 'draw', playerId: 1, blocking: true, data: { deck: 'animal' } },
    };

    const next = actions.applyActions(state, [{ type: 'draw', payload: {} } as any]);

    expect(next.turn?.currentPlayerId).toBe(1);
    const messages = (next.log ?? []).map((e: any) => String(e?.message ?? ''));
    expect(messages.some((m) => /Nino passe son tour\./.test(m))).toBe(true);
  });

  it('utilise le libelle possessif pour le pion et le log de de', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        GameCoreService,
        RandomService,
        GameContentLoaderService,
        AventureSauvageSetupService,
        AventureSauvageActionService,
      ],
    }).compile();

    const setup = moduleRef.get(AventureSauvageSetupService);
    const actions = moduleRef.get(AventureSauvageActionService);

    let state = setup.hydrateInitialState(makeBaseState());
    const meta: any = state.metadata ?? {};
    meta.pawnByPlayerId = { 1: 'girafe', 2: 'lion' };
    meta.positions = { 1: 0, 2: 0 };

    state = {
      ...state,
      metadata: meta,
      pending: null,
      turn: { currentPlayerId: 1, direction: 1 },
      turnIndex: 0,
    };

    const next = actions.applyActions(state, [{ type: 'roll', payload: {} } as any]);
    const messages = (next.log ?? []).map((e: any) => String(e?.message ?? ''));

    expect(messages.some((m) => /Lilas place "sa girafe" en case/.test(m))).toBe(true);
    expect(messages.some((m) => /Lilas lance le de : "\d"\./.test(m))).toBe(true);
  });

  it('melange les decks au demarrage', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        GameCoreService,
        RandomService,
        GameContentLoaderService,
        AventureSauvageSetupService,
        AventureSauvageActionService,
      ],
    }).compile();

    const setup = moduleRef.get(AventureSauvageSetupService);
    const state = setup.hydrateInitialState(makeBaseState());
    const meta: any = state.metadata ?? {};

    const animalIds = Array.isArray(meta?.decks?.animal) ? meta.decks.animal.map((c: any) => c?.id) : [];
    expect(animalIds.length).toBeGreaterThan(3);

    const sorted = [...animalIds].sort((a, b) => Number(a) - Number(b));
    expect(animalIds).not.toEqual(sorted);
  });
});
