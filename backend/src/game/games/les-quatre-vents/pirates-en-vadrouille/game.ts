import {
  cards,
  defineEffect,
  defineGame,
  gameInput,
  inventory,
  playerView,
  raceGame,
} from '../../../core/application/public-api';
import { PIRATES_CONTENT } from './content';
import {
  pirateCollectionIds,
  obstacleImmunity,
  PIRATES_ACTIONS,
  stealTreasure,
} from './rules';
import type {
  PirateCollection,
  PiratesPlayerView,
  PiratesState,
} from './state';

const cardDecks = (['treasure', 'obstacle', 'bonus'] as const).map((id) =>
  cards.deck({ id, cards: PIRATES_CONTENT[id], shuffle: true }),
);

export default defineGame<
  PiratesState,
  typeof PIRATES_ACTIONS,
  PiratesPlayerView
>({
  id: 'pirates-en-vadrouille',
  displayName: 'Pirates en vadrouille !',
  category: 'JeuxDePlateaux',
  subcategory: 'LesQuatreVents',
  description: 'Explorez Papayousse et ouvrez son coffre légendaire.',
  players: { min: 2, max: 6 },
  patterns: [
    raceGame({ trackId: 'island', spaces: PIRATES_CONTENT.tiles.length }),
  ],
  components: [
    ...cardDecks,
    ...(['treasure', 'obstacle', 'bonus'] as const).map((kind) =>
      inventory.set({
        id: `pirates-${kind}`,
        items: PIRATES_CONTENT[kind].map((card) => String(card.id)),
        visibility: 'public',
      }),
    ),
  ],
  initialization: {
    resources: { 'pirate-gold': 0 },
    startRound: false,
  },
  shortcuts: [
    { key: 'D', type: 'action', actionType: 'roll' },
    { key: 'P', type: 'interface', id: 'position' },
    { key: 'S', type: 'interface', id: 'score' },
  ],
  setup: () => ({}),
  actions: PIRATES_ACTIONS,
  effects: {
    'pirates.steal-treasure': defineEffect<
      PiratesState,
      Record<string, never>
    >({
      input: gameInput.object({}),
      apply: ({ actorPlayerId, targetPlayerIds, ctx }) => {
        const targetId = targetPlayerIds[0];
        if (actorPlayerId != null && targetId != null) {
          stealTreasure(actorPlayerId, targetId, ctx);
        }
      },
    }),
  },
  view: ({ state, actor, ctx }) => {
    const collections = Object.fromEntries(
      ctx.players.all().map((player) => [
        player.id,
        resolveCollection(
          pirateCollectionIds(player.id, ctx),
          ctx.resources.get(player.id, 'pirate-gold'),
        ),
      ]),
    );
    const obstacleImmunities = Object.fromEntries(
      ctx.players
        .all()
        .map((player) => [player.id, obstacleImmunity(player.id, ctx)]),
    );
    const positions = Object.fromEntries(
      ctx.players
        .all()
        .map((player) => [
          player.id,
          ctx.movement.position('island', player.id),
        ]),
    );
    return playerView({
      game: {
        obstacleImmunity: obstacleImmunities,
        collections,
        lastRoll: ctx.dice.last('main')?.total ?? null,
        positions,
        winnerId: ctx.match.result()?.winnerPlayerIds[0] ?? null,
        skipTurns: Object.fromEntries(
          ctx.players
            .all()
            .map((player) => [player.id, ctx.turn.skipCount(player.id)]),
        ),
      },
      extras: {
        currentPlayerView: actor
          ? { id: actor.id, username: actor.username }
          : null,
        collections: structuredClone(collections),
        statuses: {
          skipTurn: Object.fromEntries(
            ctx.players
              .all()
              .map((player) => [player.id, ctx.turn.skipCount(player.id)]),
          ),
          obstacleImmunity: structuredClone(obstacleImmunities),
        },
        ui: {
          panels: [
            {
              title: 'Butins',
              lines: ctx.players.all().map((player) => {
                const collection = pirateCollectionIds(player.id, ctx);
                return `${player.username} : ${collection.treasureIds.length} trésor(s), ${ctx.resources.get(player.id, 'pirate-gold')} pièce(s)`;
              }),
            },
          ],
        },
      },
      board: { tiles: structuredClone(PIRATES_CONTENT.tiles), positions },
    });
  },
  bot: { choose: () => ({ type: 'roll', payload: {} }) },
});

function resolveCollection(
  collection: import('./state').PirateCollectionState,
  goldPieces: number,
): PirateCollection {
  const cards = (kind: 'treasure' | 'obstacle' | 'bonus', ids: number[]) =>
    ids.flatMap((id) => {
      const card = PIRATES_CONTENT[kind].find((candidate) => candidate.id === id);
      return card ? [structuredClone(card)] : [];
    });
  return {
    treasures: cards('treasure', collection.treasureIds),
    obstacles: cards('obstacle', collection.obstacleIds),
    bonus: cards('bonus', collection.bonusIds),
    goldPieces,
  };
}
