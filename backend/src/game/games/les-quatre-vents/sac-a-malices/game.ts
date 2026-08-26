import {
  cards,
  defineChoice,
  defineConfiguration,
  defineEvent,
  defineGame,
  gameInput,
  ownership,
  playerView,
  publicFields,
  raceGame,
  setupPlayingPhases,
} from '../../../core/application/public-api';
import { SAC_VARIANTS, type SacVariantId } from './content';
import { SAC_ACTIONS } from './actions';
import {
  currentSacVariant,
  SAC_CONSECUTIVE_DOUBLES,
  SAC_JAIL_CARDS,
  SAC_JAIL_TURNS,
  SAC_POT,
} from './economy';
import {
  resolveManagement,
  resolvePurchase,
  SAC_EFFECTS,
} from './rules';
import type { SacPlayerView, SacState } from './state';

const SAC_VARIANT_IDS = SAC_VARIANTS.map((variant) => variant.id);
const SAC_PHASES = setupPlayingPhases<SacState>();
const VARIANT_SELECTED = defineEvent({
  type: 'game.variant.selected',
  data: gameInput.object({ variantId: gameInput.enum(SAC_VARIANT_IDS) }),
});

export default defineGame<SacState, typeof SAC_ACTIONS, SacPlayerView>({
  id: 'sac-a-malices',
  displayName: 'Sac à Malices !',
  category: 'JeuxDePlateaux',
  subcategory: 'LesQuatreVents',
  description: 'Jeu immobilier décliné sur sept plateaux thématiques.',
  players: { min: 2, max: 8 },
  config: defineConfiguration<SacState, { variantId: SacVariantId }>({
    input: gameInput.object({
      variantId: gameInput.enum(SAC_VARIANT_IDS),
    }),
    defaults: { variantId: 'classic' },
    phase: SAC_PHASES.initialPhase,
    permission: 'owner',
    ui: {
      title: 'Variante du plateau',
      submitLabel: 'Démarrer la partie',
    },
    onConfigured: ({ state, config, ctx }) => {
      const selected = SAC_VARIANTS.find(
        (variant) => variant.id === config.variantId,
      );
      if (!selected) ctx.reject('UNKNOWN_VARIANT', config);
      for (const player of ctx.players.all()) {
        ctx.resources.set(player.id, 'money', selected.rules.startMoney);
      }
      SAC_PHASES.transition(ctx, 'playing');
      VARIANT_SELECTED.emit(ctx, {
        variantId: selected.id,
      });
    },
  }),
  patterns: [
    raceGame({
      trackId: 'city',
      spaces: 40,
      diceId: 'pair',
      diceCount: 2,
    }),
  ],
  components: [
    ownership.registry({
      id: 'properties',
      assets: Array.from({ length: 40 }, (_, index) => String(index)),
      visibility: 'public',
    }),
    ...SAC_VARIANTS.flatMap((variant) => [
      cards.deck({
        id: `chance:${variant.id}`,
        cards: variant.chance,
        shuffle: true,
        empty: 'recycle',
      }),
      cards.deck({
        id: `community:${variant.id}`,
        cards: variant.community,
        shuffle: true,
        empty: 'recycle',
      }),
    ]),
  ],
  initialization: { counters: { [SAC_POT]: 0 }, startRound: false },
  shortcuts: [{ key: 'Space', type: 'action', actionType: 'roll' }],
  setup: () => ({ buildings: {} }),
  initialPhase: SAC_PHASES.initialPhase,
  phases: SAC_PHASES.phases,
  actions: SAC_ACTIONS,
  effects: SAC_EFFECTS,
  choices: {
    'sac.purchase': defineChoice<SacState, string>({
      input: gameInput.string({ min: 1, max: 128 }),
      resolve: ({ state, value, ctx }) =>
        resolvePurchase(state, value, ctx),
    }),
    'sac.management': defineChoice<SacState, number>({
      input: gameInput.number({ integer: true }),
      resolve: ({ state, value, ctx }) =>
        resolveManagement(state, value, ctx),
    }),
  },
  view: ({ state, ctx }) => {
    const variant = currentSacVariant(ctx);
    const positions = ctx.players.byId((player) =>
      ctx.movement.position('city', player.id),
    );
    const playerResourceMap = (resourceId: string) =>
      ctx.players.byId((player) =>
        ctx.resources.get(player.id, resourceId),
      );
    return playerView({
      game: {
        ...publicFields(state, ['buildings']),
        jailTurns: playerResourceMap(SAC_JAIL_TURNS),
        jailCards: playerResourceMap(SAC_JAIL_CARDS),
        consecutiveDoubles: playerResourceMap(SAC_CONSECUTIVE_DOUBLES),
        pot: ctx.counters.get(SAC_POT),
        lastRoll: ctx.dice.last('pair')?.total ?? 0,
        extraRoll: ctx.players.byId(
          (player) => ctx.turn.extraCount(player.id) > 0,
        ),
        eliminated: ctx.players.byId(
          (player) => ctx.match.playerStatus(player.id) === 'eliminated',
        ),
        positions,
        winnerId: ctx.match.result()?.winnerPlayerIds[0] ?? null,
        skipTurns: ctx.players.byId((player) =>
          ctx.turn.skipCount(player.id),
        ),
      },
      extras: {
        buildings: structuredClone(state.buildings),
        variant: { id: variant.id, label: variant.label },
      },
      board: { tiles: variant.tiles, positions },
    });
  },
  bot: {
    choose: ({ availableActions }) => {
      if (availableActions.includes('use_jail_card'))
        return { type: 'use_jail_card', payload: {} };
      if (availableActions.includes('pay_fine'))
        return { type: 'pay_fine', payload: {} };
      return availableActions.includes('roll')
        ? { type: 'roll', payload: {} }
        : null;
    },
  },
});
