import { defineAction, defineChoice } from '../../actions/action-builders';
import { gameInput } from '../../actions/game-input-schema';
import { cards } from '../../cards/cards-contracts';
import { defineCardsSchema } from '../../cards/typed-cards';
import { defineConfiguration } from '../../configuration/configuration-kit';
import type { SacMovement, SacProgram, SacVariantId } from './program';
import { defineEffect } from '../../effects/effects-core';
import { defineEvent } from '../../events/game-event-definition';
import { ownership } from '../../kits/ownership-kit';
import { setupPlayingPhases } from '../../kits/phase-kit';
import { raceGame } from '../../patterns/gameplay-pattern-track-card';
import { createSacBoard } from './sac-board';
import {
  createSacSupport,
  SAC,
  sacBuildings,
  type SacManagement,
  type SacState,
} from './sac-support';

export function sacRules(source: SacProgram) {
  const support = createSacSupport(source);
  const board = createSacBoard(support);
  const { program } = support;
  const phases = setupPlayingPhases<SacState>();
  const variantIds = program.variants.map((variant) => variant.id);
  const variantSelected = defineEvent({
    type: 'game.variant.selected',
    data: gameInput.object({ variantId: gameInput.enum(variantIds) }),
  });
  const config = defineConfiguration<SacState, { variantId: SacVariantId }>({
    input: gameInput.object({ variantId: gameInput.enum(variantIds) }),
    defaults: { variantId: 'classic' },
    phase: phases.initialPhase,
    permission: 'owner',
    ui: {
      title: 'Variante du plateau',
      submitLabel: 'Démarrer la partie',
    },
    onConfigured: ({ config: selectedConfig, ctx }) => {
      const selected = program.variants.find(
        (variant) => variant.id === selectedConfig.variantId,
      );
      if (!selected) return ctx.reject('UNKNOWN_VARIANT', selectedConfig);
      for (const player of ctx.players.all())
        ctx.resources.set(player.id, SAC.money, selected.rules.startMoney);
      phases.transition(ctx, 'playing');
      variantSelected.emit(ctx, { variantId: selected.id });
    },
  });
  const createTurnActions = () => {
    const roll = defineAction<SacState, Record<string, never>>({
      input: gameInput.object({}),
      documentation: 'Lance deux dés, déplace le pion et résout la case.',
      available: ({ actor, ctx }) =>
        ctx.match.playerStatus(actor.id) === 'active',
      execute: ({ state, actor, ctx }) => {
        if (ctx.resources.get(actor.id, SAC.jailTurns) > 0) {
          board.resolveJailTurn(state, actor.id, ctx);
          return;
        }
        const [first, second] = board.rollPair(ctx);
        const total = first + second;
        const isDouble = first === second;
        const doubles = isDouble
          ? ctx.resources.add(actor.id, SAC.doubles, 1)
          : ctx.resources.set(actor.id, SAC.doubles, 0);
        ctx.events.message('game.dice.rolled', {
          playerId: actor.id,
          diceId: 'main',
          values: [first, second],
          total,
        });
        if (doubles >= 3) {
          ctx.resources.set(actor.id, SAC.doubles, 0);
          support.sendToJail(state, actor.id, ctx);
          ctx.turn.complete();
          return;
        }
        if (isDouble) ctx.turn.extra();
        board.moveForward(state, actor.id, total, 0, ctx);
        ctx.turn.complete();
      },
    });
    function management(kind: SacManagement) {
      return defineAction<SacState, Record<string, never>>({
        input: gameInput.object({}),
        documentation: `Ouvre le choix de propriété pour l’opération ${kind}.`,
        available: ({ state, actor, ctx }) =>
          support.managementOptions(state, actor.id, kind, ctx).length > 0,
        execute: ({ state, actor, ctx }) => {
          const options = support.managementOptions(state, actor.id, kind, ctx);
          ctx.choice.one({
            id: 'sac.management',
            player: actor.id,
            options,
            data: { flow: 'management', playerId: actor.id, kind },
            label: (tileIndex) =>
              support.current(ctx).tiles[tileIndex]?.title ?? String(tileIndex),
          });
        },
      });
    }
    const payFine = defineAction<SacState, Record<string, never>>({
      input: gameInput.object({}),
      documentation: 'Paie l’amende de prison lorsque la variante le permet.',
      available: ({ actor, ctx }) => {
        const rules = support.current(ctx).rules;
        return (
          ctx.resources.get(actor.id, SAC.jailTurns) > 0 &&
          rules.jail.allowPayFine &&
          ctx.resources.has(actor.id, SAC.money, rules.jail.autoFine)
        );
      },
      execute: ({ state, actor, ctx }) => {
        const fine = support.current(ctx).rules.jail.autoFine;
        support.changeMoney(state, actor.id, -fine, true, ctx);
        ctx.resources.set(actor.id, SAC.jailTurns, 0);
        ctx.events.message('sac.jail.fine-paid', {
          playerId: actor.id,
          amount: fine,
        });
      },
    });
    const useJailCard = defineAction<SacState, Record<string, never>>({
      input: gameInput.object({}),
      documentation: 'Utilise une carte de sortie de prison conservée.',
      available: ({ actor, ctx }) =>
        ctx.resources.get(actor.id, SAC.jailTurns) > 0 &&
        ctx.resources.get(actor.id, SAC.jailCards) > 0,
      execute: ({ actor, ctx }) => {
        ctx.resources.remove(actor.id, SAC.jailCards, 1);
        ctx.resources.set(actor.id, SAC.jailTurns, 0);
        ctx.events.message('sac.jail.card-used', { playerId: actor.id });
      },
    });
    return { roll, management, payFine, useJailCard };
  };
  const { roll, management, payFine, useJailCard } = createTurnActions();
  const movementInput = gameInput.union([
    gameInput.object({
      kind: gameInput.literal('delta'),
      delta: gameInput.number({ integer: true }),
    }),
    gameInput.object({
      kind: gameInput.enum([
        'last',
        'next-station',
        'next-community',
        'previous-chance',
      ]),
    }),
    gameInput.object({
      kind: gameInput.literal('start'),
      collect: gameInput.boolean(),
    }),
    gameInput.object({
      kind: gameInput.literal('next-group'),
      groupId: gameInput.string({ min: 1, max: 128 }),
    }),
    gameInput.object({
      kind: gameInput.literal('tile'),
      tileId: gameInput.string({ min: 1, max: 128 }),
      direction: gameInput.enum(['forward', 'backward']),
    }),
  ]);
  const createEffects = () => ({
    'sac.lose-infrastructure': defineEffect<SacState, Record<string, never>>({
      input: gameInput.object({}),
      apply: ({ state, actorPlayerId, ctx }) => {
        if (actorPlayerId != null)
          support.loseInfrastructure(state, actorPlayerId, ctx);
      },
    }),
    'sac.everyone-money': defineEffect<SacState, { delta: number }>({
      input: gameInput.object({
        delta: gameInput.number({ integer: true }),
      }),
      apply: ({ state, data, ctx }) => {
        for (const player of ctx.players.active())
          support.changeMoney(
            state,
            player.id,
            data.delta,
            data.delta < 0,
            ctx,
          );
      },
    }),
    'sac.movement': defineEffect<SacState, { movement: SacMovement }>({
      input: gameInput.object({ movement: movementInput }),
      apply: ({ state, actorPlayerId, data, ctx }) => {
        if (actorPlayerId != null)
          board.applyMovement(state, actorPlayerId, data.movement, ctx);
      },
    }),
    'sac.money': defineEffect<SacState, { delta: number }>({
      input: gameInput.object({
        delta: gameInput.number({ integer: true }),
      }),
      apply: ({ state, actorPlayerId, data, ctx }) => {
        if (actorPlayerId != null)
          support.changeMoney(
            state,
            actorPlayerId,
            data.delta,
            data.delta < 0,
            ctx,
          );
      },
    }),
  });
  const effects = createEffects();
  const buildDefinition = () => {
    const choices = {
      'sac.purchase': defineChoice<SacState, string>({
        input: gameInput.string({ min: 1, max: 128 }),
        resolve: ({ state, value, ctx }) =>
          board.resolvePurchase(state, value, ctx),
      }),
      'sac.management': defineChoice<SacState, number>({
        input: gameInput.number({ integer: true }),
        resolve: ({ state, value, ctx }) =>
          board.resolveManagement(state, value, ctx),
      }),
    };
    const cardSchema = defineCardsSchema({
      decks: Object.fromEntries(
        program.variants.flatMap((variant) =>
          (['chance', 'community'] as const).map((kind) => {
            const id = `${kind}:${variant.id}`;
            return [
              id,
              cards.deck({
                id,
                cards: variant[kind],
                shuffle: true,
                empty: 'recycle',
              }),
            ];
          }),
        ),
      ),
      hands: {},
    });
    return {
      roll,
      build: management('build'),
      sell: management('sell'),
      mortgage: management('mortgage'),
      unmortgage: management('unmortgage'),
      payFine,
      useJailCard,
      effects,
      choices,
      config,
      events: [variantSelected],
      patterns: [
        raceGame<SacState>({
          trackId: SAC.track,
          spaces: 40,
          diceId: 'pair',
          diceCount: 2,
        }),
      ],
      components: [
        ownership.registry({
          id: SAC.properties,
          assets: [
            ...new Set(
              program.variants.flatMap((variant) =>
                variant.tiles.map((tile) => tile.id),
              ),
            ),
          ],
          visibility: 'public',
        }),
        ...cardSchema.components,
      ],
      initialization: { counters: { [SAC.pot]: 0 }, startRound: false },
      resourceIds: [SAC.money, SAC.jailCards],
      setup: () => {
        const state: SacState = {};
        Reflect.set(state, 'buildings', {});
        return state;
      },
      viewExtension: ({ state }: { state: SacState }) => ({
        buildings: Object.fromEntries(
          Object.entries(sacBuildings(state)).map(([position, building]) => [
            position,
            {
              houses: building.houses,
              hotel: building.hotel,
              mortgaged: building.mortgaged,
            },
          ]),
        ),
      }),
      chooseBot(availableActions: readonly string[]) {
        if (availableActions.includes('use_jail_card'))
          return 'sac-use-jail-card' as const;
        if (availableActions.includes('pay_fine'))
          return 'sac-pay-fine' as const;
        return availableActions.includes('roll') ? ('sac-roll' as const) : null;
      },
      phases,
    };
  };
  return buildDefinition();
}
