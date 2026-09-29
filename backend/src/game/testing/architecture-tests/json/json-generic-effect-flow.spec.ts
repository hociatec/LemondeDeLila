import { compileJsonGame } from '../../../rules/public-api';
import { testGame } from '../../../core/testing/game-test-kit';
import manifest from '../../fixtures/json-course/manifest.json';
import document from '../../fixtures/json-course/game.json';

it('executes bounded generic value, movement and control-flow effects from JSON', async () => {
  const definition = compileJsonGame(manifest, {
    ...document,
    phases: {
      playing: { actions: ['compose'], transitions: ['resolved'] },
      resolved: { actions: [], terminal: true },
    },
    actions: {
      compose: {
        effects: [
          { kind: 'set-resource', resource: 'stars', value: 3 },
          { kind: 'set-score', value: 2 },
          {
            kind: 'repeat',
            count: 2,
            effects: [{ kind: 'gain-score', amount: 2 }],
          },
          {
            kind: 'switch',
            cases: [
              {
                condition: { kind: 'phase-is', phase: 'playing' },
                effects: [{ kind: 'gain-score', amount: 1 }],
              },
            ],
          },
          {
            kind: 'random-choice',
            choices: [
              [{ kind: 'gain-score', amount: 3 }],
              [{ kind: 'gain-score', amount: 3 }],
            ],
          },
          {
            kind: 'move-to',
            trackId: 'board',
            position: { kind: 'add', left: 2, right: 4 },
            target: { kind: 'player', playerId: 2 },
          },
          {
            kind: 'move-relative-to',
            trackId: 'board',
            reference: { kind: 'player', playerId: 2 },
            offset: -1,
          },
          { kind: 'transition-phase', phase: 'resolved' },
          { kind: 'stop' },
          { kind: 'gain-score', amount: 100 },
        ],
      },
    },
    victory: { kind: 'score-at-least', amount: 999 },
  });
  const game = await testGame(definition).players(2).seed(17).start();

  await game.as(1).do('compose', {});

  expect(game.state()).toHaveProperty(
    'engine.playerValues.resources.stars.1',
    3,
  );
  expect(game.state()).toHaveProperty('engine.playerValues.scores.1', 10);
  expect(game.state()).toHaveProperty(
    'engine.kits.movement.positions.board.2',
    6,
  );
  expect(game.state()).toHaveProperty(
    'engine.kits.movement.positions.board.1',
    5,
  );
  expect(game.state()).toHaveProperty('phase', 'resolved');
  expect(await game.replay()).toEqual(game.state());
});

it('rejects unbounded control flow before a game can start', () => {
  expect(() =>
    compileJsonGame(manifest, {
      ...document,
      actions: {
        advance: {
          effects: [{ kind: 'repeat', count: 65, effects: [] }],
        },
      },
    }),
  ).toThrow();
});

it('composes generic draw zones and property comparison without a battle effect', async () => {
  const definition = compileJsonGame(manifest, {
    ...document,
    components: [
      ...document.components.filter(
        (component) =>
          component.component !== 'cards.deck' &&
          component.component !== 'cards.hands',
      ),
      {
        component: 'cards.deck',
        id: 'contest',
        cards: [
          { id: 'strong', points: 5 },
          { id: 'weak', points: 2 },
          { id: 'reserve', points: 1 },
        ],
        shuffle: false,
      },
      {
        component: 'cards.zone',
        id: 'left-stake',
        deck: 'contest',
        visibility: 'public',
      },
      {
        component: 'cards.zone',
        id: 'right-stake',
        deck: 'contest',
        visibility: 'public',
      },
    ],
    setup: { ...document.setup },
    actions: {
      advance: {
        effects: [
          {
            kind: 'draw-to-zone',
            deckId: 'contest',
            zoneId: 'left-stake',
            count: 1,
          },
          {
            kind: 'draw-to-zone',
            deckId: 'contest',
            zoneId: 'right-stake',
            count: 1,
          },
          {
            kind: 'conditional',
            condition: {
              kind: 'compare-zone-cards',
              leftZoneId: 'left-stake',
              rightZoneId: 'right-stake',
              property: 'points',
              compare: 'gt',
            },
            then: [{ kind: 'gain-score', amount: 7 }],
          },
          { kind: 'shuffle-cards', deckId: 'contest' },
        ],
      },
    },
    victory: { kind: 'score-at-least', amount: 99 },
  });
  const game = await testGame(definition).players(2).seed(23).start();

  await game.as(1).do('advance', {});

  expect(game.state()).toHaveProperty('engine.playerValues.scores.1', 7);
  expect(game.state()).toHaveProperty('engine.kits.cards.zones.left-stake', [
    'strong',
  ]);
  expect(game.state()).toHaveProperty('engine.kits.cards.zones.right-stake', [
    'weak',
  ]);
  expect(await game.replay()).toEqual(game.state());
});

it('resolves tagged landings and collisions through generic composition', async () => {
  const definition = compileJsonGame(manifest, {
    ...document,
    components: document.components.map((component) =>
      component.component === 'movement.track'
        ? {
            ...component,
            positionTags: { 4: ['checkpoint'] },
            tagEffects: {
              checkpoint: [{ kind: 'gain-score', amount: 2 }],
            },
          }
        : component,
    ),
    setup: {
      ...document.setup,
      tracks: { board: { '1': 0, '2': 4 } },
    },
    actions: {
      advance: {
        effects: [
          {
            kind: 'move-to-tag',
            trackId: 'board',
            tag: 'checkpoint',
            direction: 'next',
          },
          {
            kind: 'gain-score',
            amount: 3,
            target: { kind: 'co-located', trackId: 'board' },
          },
        ],
      },
    },
    victory: { kind: 'score-at-least', amount: 99 },
  });
  const game = await testGame(definition).players(2).start();

  await game.as(1).do('advance', {});

  expect(game.state()).toHaveProperty(
    'engine.kits.movement.positions.board.1',
    4,
  );
  expect(game.state()).toHaveProperty(
    'engine.kits.movement.positions.board.2',
    4,
  );
  // Initialization lands player 2 on the tagged position, then player 1 lands
  // there during the action; both deterministic landings schedule the tag rule.
  expect(game.state()).toHaveProperty('engine.playerValues.scores.1', 4);
  expect(game.state()).toHaveProperty('engine.playerValues.scores.2', 3);
  expect(await game.replay()).toEqual(game.state());
});

it('emits structured JSON narration with server-owned player variants', async () => {
  const definition = compileJsonGame(manifest, {
    ...document,
    actions: {
      advance: {
        effects: [
          {
            kind: 'narrate',
            key: 'race.checkpoint',
            params: { checkpoint: 4 },
            default: 'Un joueur atteint le point de contrôle.',
            variants: [
              {
                target: { kind: 'self' },
                text: 'Vous atteignez le point de contrôle.',
              },
              {
                target: { kind: 'all-opponents' },
                text: 'Un adversaire atteint le point de contrôle.',
              },
            ],
          },
        ],
      },
    },
    victory: { kind: 'score-at-least', amount: 99 },
  });
  const game = await testGame(definition).players(2).start();

  await game.as(1).do('advance', {});

  expect(
    (await game.events()).find(
      (event) =>
        event.type === 'game.message' &&
        (event.data as { key?: string }).key === 'race.checkpoint',
    ),
  ).toMatchObject({
    type: 'game.message',
    data: {
      key: 'race.checkpoint',
      params: { checkpoint: 4 },
      narration: {
        default: 'Un joueur atteint le point de contrôle.',
        byPlayerId: {
          1: 'Vous atteignez le point de contrôle.',
          2: 'Un adversaire atteint le point de contrôle.',
        },
      },
    },
  });
  expect(await game.replay()).toEqual(game.state());
});
