import {
  cards,
  clockwise,
  defineGame,
  diceKit,
  movement,
  playerView,
  victoryWhen,
  when,
} from '../../../core/application/public-api';
import { SAC_VARIANTS, sacVariant } from './content';
import {
  SAC_ACTIONS,
  resolveManagement,
  resolvePurchase,
  skipEliminatedOrBlocked,
} from './rules';
import type { SacPlayerView, SacState } from './state';

export default defineGame<SacState, typeof SAC_ACTIONS, SacPlayerView>({
  id: 'sac-a-malices',
  displayName: 'Sac à Malices !',
  category: 'JeuxDePlateaux',
  subcategory: 'LesQuatreVents',
  description: 'Jeu immobilier décliné sur sept plateaux thématiques.',
  players: { min: 2, max: 8 },
  components: [
    movement.track({ id: 'city', spaces: 40 }),
    diceKit({ id: 'pair', count: 2, sides: 6 }),
    ...SAC_VARIANTS.flatMap((variant) => [
      cards.deck({
        id: `chance:${variant.id}`,
        cards: variant.chance,
        shuffle: true,
      }),
      cards.deck({
        id: `community:${variant.id}`,
        cards: variant.community,
        shuffle: true,
      }),
    ]),
  ],
  shortcuts: [{ key: 'Space', type: 'action', actionType: 'roll' }],
  setup: ({ players }) => {
    const zeros = () =>
      Object.fromEntries(players.map((player) => [player.id, 0]));
    const falses = () =>
      Object.fromEntries(players.map((player) => [player.id, false]));
    return {
      variantId: 'classic',
      configured: false,
      money: zeros(),
      ownership: {},
      buildings: {},
      skipTurns: zeros(),
      jailTurns: zeros(),
      eliminated: falses(),
      jailCards: zeros(),
      extraRoll: falses(),
      consecutiveDoubles: zeros(),
      pot: 0,
      lastRoll: 0,
      pendingPurchase: null,
      pendingManagement: null,
      winnerId: null,
    };
  },
  initialPhase: 'setup',
  turn: clockwise(),
  actions: SAC_ACTIONS,
  choices: {
    'sac.purchase': {
      resolve: ({ state, value, ctx }) =>
        resolvePurchase(state, String(value), ctx),
    },
    'sac.management': {
      resolve: ({ state, value, ctx }) =>
        resolveManagement(state, Number(value), ctx),
    },
  },
  automatic: [
    when(
      'skip-bankrupt-or-blocked-player',
      ({ state, ctx }) => {
        const currentId = ctx.players.current()?.id ?? 0;
        return (
          state.configured &&
          (state.eliminated[currentId] || state.skipTurns[currentId] > 0)
        );
      },
      ({ state, ctx }) => skipEliminatedOrBlocked(state, ctx),
    ),
  ],
  victory: victoryWhen(({ state }) =>
    state.winnerId == null
      ? null
      : { winnerPlayerIds: [state.winnerId], reason: 'last-solvent-player' },
  ),
  view: ({ state, ctx }) => {
    const {
      pendingPurchase: _pendingPurchase,
      pendingManagement: _pendingManagement,
      ...publicState
    } = state;
    const variant = sacVariant(state.variantId);
    const positions = Object.fromEntries(
      ctx.players
        .all()
        .map((player) => [player.id, ctx.movement.position('city', player.id)]),
    );
    return playerView({
      game: { ...structuredClone(publicState), positions },
      extras: {
        money: structuredClone(state.money),
        ownership: structuredClone(state.ownership),
        buildings: structuredClone(state.buildings),
        variant: { id: variant.id, label: variant.label },
      },
      board: { tiles: variant.tiles, positions },
    });
  },
  bot: {
    choose: ({ availableActions }) => {
      if (availableActions.includes('selectVariant'))
        return {
          type: 'selectVariant',
          payload: { variantId: 'classic' },
        };
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
