import type { GameStateEntity } from '../../../../../../../../application/models/game-state.model';
import type { GameSingleActionDto } from '../../../../../../../../models/game-action.model';
import { createAventureSauvageRuntime } from '../../aventure-sauvage.runtime';

function asRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

function toText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function messagesOf(state: GameStateEntity): string[] {
  return (state.log ?? []).map((entry) => {
    const row = asRecord(entry);
    return toText(row.message);
  });
}

function makeBaseState(): GameStateEntity {
  return {
    status: 'started',
    phase: 'playing',
    round: 1,
    turnIndex: 0,
    lastRoll: null,
    log: [],
    players: [
      { id: 1, username: 'Lilas', isBot: false },
      { id: 2, username: 'Nino', isBot: false },
    ],
    turn: { currentPlayerId: 1, direction: 1 },
    metadata: {
      roomId: 1,
      roomOwnerId: 1,
      roomStartedAt: '2026-01-31T00:00:00.000Z',
      roomRunId: 1,
      gameType: 'aventure-sauvage',
      rng: { seed: 123, counter: 0 },
    },
    botThinking: false,
  };
}

describe('AventureSauvageActionService', () => {
  it('demande au joueur de choisir son pion via le pending label', async () => {
    const { setup, actions } = createAventureSauvageRuntime();

    const state = setup.hydrateInitialState(makeBaseState());
    const next = actions.applyActions(state, []);

    expect(String(next.pending?.label ?? '')).toContain(
      "C'est a Lilas de choisir son pion.",
    );
  });

  it('attribue automatiquement un pion au bot au demarrage', async () => {
    const { setup } = createAventureSauvageRuntime();

    const state = setup.hydrateInitialState({
      ...makeBaseState(),
      players: [
        { id: 1, username: 'Lilas', isBot: false },
        { id: 2, username: 'Balto', isBot: true },
      ],
    });

    expect(state.pending?.playerId).toBe(1);
    const metadata = asRecord(state.metadata);
    const pawnByPlayerId = asRecord(metadata.pawnByPlayerId);
    expect(typeof pawnByPlayerId['2']).toBe('string');

    const messages = messagesOf(state);
    const botPromptIndex = messages.findIndex(
      (message) => message === "C'est a Balto de choisir son pion.",
    );
    const botChoiceIndex = messages.findIndex((message) =>
      message.startsWith('Balto a choisi le pion: '),
    );
    const humanPromptIndex = messages.findIndex(
      (message) => message === "C'est a Lilas de choisir son pion.",
    );

    expect(botChoiceIndex).toBeGreaterThanOrEqual(0);
    if (botPromptIndex >= 0) {
      expect(botChoiceIndex).toBeGreaterThan(botPromptIndex);
    }
    if (humanPromptIndex >= 0) {
      expect(humanPromptIndex).toBeGreaterThan(botChoiceIndex);
    }
  });

  it("corrige l'accent de la grenouille gÃƒÂ©ante dans le deck Animal rigolo", async () => {
    const { setup } = createAventureSauvageRuntime();
    const state = setup.hydrateInitialState(makeBaseState());
    const metadata = asRecord(state.metadata);
    const decks = asRecord(metadata.decks);
    const animalDeck = Array.isArray(decks.animal) ? decks.animal : [];
    const frogCard = animalDeck.find((card) =>
      toText(asRecord(card).text).includes('grenouille gÃƒÂ©ante'),
    );
    const frogText = toText(asRecord(frogCard).text);

    expect(frogText).toContain('Ãƒâ‚¬ chaque saut');
    expect(frogText).not.toContain('ÃƒÅ’ chaque saut');
  });

  it('avance le tour apres une pioche avec Passez un tour', async () => {
    const { setup, actions } = createAventureSauvageRuntime();

    let state = setup.hydrateInitialState(makeBaseState());

    const meta = asRecord(state.metadata);
    const decks = asRecord(meta.decks);
    state = {
      ...state,
      metadata: {
        ...meta,
        decks: {
          ...decks,
          patte: [
            {
              id: 999,
              deck: 'patte',
              text: 'Test: vous vous reposez. Passez votre tour.',
              skipTurns: 1,
            },
          ],
          discardPatte: [],
        },
      },
      pending: {
        type: 'draw',
        playerId: 1,
        blocking: true,
        data: { deck: 'patte' },
      },
    };

    const drawAction: GameSingleActionDto[] = [{ type: 'draw', payload: {} }];
    const next = actions.applyActions(state, drawAction);

    expect(next.pending).toBeNull();
    expect(next.turn?.currentPlayerId).toBe(2);
    const nextMeta = asRecord(next.metadata);
    const statuses = asRecord(nextMeta.statuses);
    const skipTurn = asRecord(statuses.skipTurn);
    expect(Number(skipTurn['1'] ?? 0)).toBe(1);
  });

  it('saute le joueur suivant si skipTurn est actif (et l annonce)', async () => {
    const { setup, actions } = createAventureSauvageRuntime();

    let state = setup.hydrateInitialState(makeBaseState());

    const meta = asRecord(state.metadata);
    const statuses = asRecord(meta.statuses);
    const skipTurn = asRecord(statuses.skipTurn);
    const decks = asRecord(meta.decks);

    state = {
      ...state,
      metadata: {
        ...meta,
        statuses: {
          ...statuses,
          skipTurn: { ...skipTurn, '2': 1 },
        },
        decks: {
          ...decks,
          animal: [{ id: 1, deck: 'animal', text: 'Test: aucune action.' }],
          discardAnimal: [],
        },
      },
      pending: {
        type: 'draw',
        playerId: 1,
        blocking: true,
        data: { deck: 'animal' },
      },
    };

    const drawAction: GameSingleActionDto[] = [{ type: 'draw', payload: {} }];
    const next = actions.applyActions(state, drawAction);

    expect(next.turn?.currentPlayerId).toBe(1);
    const messages = messagesOf(next);
    expect(messages.some((m) => /Nino passe son tour\./.test(m))).toBe(true);
  });

  it('utilise le libelle possessif pour le pion et le log de de', async () => {
    const { setup, actions } = createAventureSauvageRuntime();

    let state = setup.hydrateInitialState(makeBaseState());
    const meta = asRecord(state.metadata);

    state = {
      ...state,
      metadata: {
        ...meta,
        pawnByPlayerId: { '1': 'girafe', '2': 'lion' },
        positions: { '1': 0, '2': 0 },
      },
      pending: null,
      turn: { currentPlayerId: 1, direction: 1 },
      turnIndex: 0,
    };

    const rollAction: GameSingleActionDto[] = [{ type: 'roll', payload: {} }];
    const next = actions.applyActions(state, rollAction);
    const messages = messagesOf(next);

    expect(messages.some((m) => /Lilas place .*girafe.* en case/.test(m))).toBe(
      true,
    );
    expect(messages.some((m) => /Lilas lance le d/.test(m))).toBe(true);
  });

  it('melange les decks au demarrage', async () => {
    const { setup } = createAventureSauvageRuntime();
    const state = setup.hydrateInitialState(makeBaseState());
    const meta = asRecord(state.metadata);
    const decks = asRecord(meta.decks);
    const animalDeck = Array.isArray(decks.animal) ? decks.animal : [];

    const animalIds = Array.isArray(animalDeck)
      ? animalDeck.map((card) => {
          const row = asRecord(card);
          return row.id;
        })
      : [];
    expect(animalIds.length).toBeGreaterThan(3);

    const sorted = [...animalIds].sort((a, b) => Number(a) - Number(b));
    expect(animalIds).not.toEqual(sorted);
  });
});








